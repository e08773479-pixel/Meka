/* ==========================================
   MEKA APPLICATION
   Main application controller
========================================== */

import {
  startAuthentication,
  getCurrentUser,
  logout,
  subscribeAuth
} from "./auth.js";

import {
  initializeChat,
  loadConversations,
  openConversation,
  sendMessage
} from "./chat.js";

import {
  initializeSocial,
  loadFeed,
  loadStories,
  createPost,
  createStory
} from "./social.js";

import {
  checkSupabaseConnection
} from "./supabase.js";

import {
  MEKA_CONFIG,
  validateMekaConfig
} from "./config.js";

/* ==========================================
   APPLICATION STATE
========================================== */

const AppState = {
  initialized: false,
  authenticated: false,
  currentUser: null,
  currentPage: "chats",
  connection: false,
  initializing: false
};

const AppEvents = new EventTarget();

function emit(name, detail = {}) {
  AppEvents.dispatchEvent(
    new CustomEvent(name, { detail })
  );
}

/* ==========================================
   HELPERS
========================================== */

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function notify(message, type = "info") {
  const toast = $("#meka-toast");

  emit("toast", { message, type });

  if (!toast) {
    console.info(`[MEKA] ${message}`);
    return;
  }

  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("show");

  clearTimeout(notify.timer);

  notify.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function setButtonLoading(button, loading) {
  if (!button) return;

  button.disabled = loading;

  if (loading) {
    button.dataset.originalText =
      button.textContent;

    button.textContent = "جاري التنفيذ...";
  } else {
    button.textContent =
      button.dataset.originalText ||
      button.textContent;
  }
}

function showElement(selector) {
  const node = $(selector);

  if (node) {
    node.hidden = false;
  }
}

function hideElement(selector) {
  const node = $(selector);

  if (node) {
    node.hidden = true;
  }
}

/* ==========================================
   APPLICATION SCREEN CONTROL
========================================== */

function showApplication() {
  document.body.classList.add("meka-authenticated");

  const app = $(
    "#app-screen, #main-app, [data-app-screen]"
  );

  const login = $(
    "#auth-screen, #login-screen, [data-auth-screen]"
  );

  if (app) {
    app.hidden = false;
    app.classList.add("is-active");
  }

  if (login) {
    login.hidden = true;
    login.classList.remove("is-active");
  }

  emit("application-shown");
}

function showAuthentication() {
  document.body.classList.remove("meka-authenticated");

  const app = $(
    "#app-screen, #main-app, [data-app-screen]"
  );

  const login = $(
    "#auth-screen, #login-screen, [data-auth-screen]"
  );

  if (app) {
    app.hidden = true;
    app.classList.remove("is-active");
  }

  if (login) {
    login.hidden = false;
    login.classList.add("is-active");
  }

  emit("authentication-shown");
}

/* ==========================================
   USER PROFILE
========================================== */

function updateUserInterface(user) {
  if (!user) return;

  const name =
    user.display_name ||
    user.full_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "مستخدم MEKA";

  const email = user.email || "";

  $$("[data-user-name], #current-user-name")
    .forEach(node => {
      node.textContent = name;
    });

  $$("[data-user-email], #current-user-email")
    .forEach(node => {
      node.textContent = email;
    });

  $$("[data-user-avatar], #current-user-avatar")
    .forEach(node => {
      node.textContent =
        name.trim().charAt(0) || "M";
    });

  emit("user-interface-updated", { user });
}

/* ==========================================
   NAVIGATION
========================================== */

const PAGE_SELECTORS = {
  chats: [
    "#chats-page",
    "[data-page='chats']"
  ],

  contacts: [
    "#contacts-page",
    "[data-page='contacts']"
  ],

  stories: [
    "#stories-page",
    "[data-page='stories']"
  ],

  social: [
    "#social-page",
    "[data-page='social']"
  ],

  calls: [
    "#calls-page",
    "[data-page='calls']"
  ],

  profile: [
    "#profile-page",
    "[data-page='profile']"
  ],

  settings: [
    "#settings-page",
    "[data-page='settings']"
  ]
};

function findPageElement(selectors) {
  for (const selector of selectors) {
    const node = $(selector);

    if (node) return node;
  }

  return null;
}

export function navigateTo(page) {
  if (!PAGE_SELECTORS[page]) {
    console.warn("MEKA unknown page:", page);
    return false;
  }

  AppState.currentPage = page;

  Object.entries(PAGE_SELECTORS).forEach(
    ([pageName, selectors]) => {
      const node = findPageElement(selectors);

      if (!node) return;

      const active = pageName === page;

      node.hidden = !active;
      node.classList.toggle("is-active", active);
    }
  );

  $$("[data-navigate]").forEach(button => {
    const active =
      button.dataset.navigate === page;

    button.classList.toggle("active", active);

    button.setAttribute(
      "aria-current",
      active ? "page" : "false"
    );
  });

  emit("navigation-changed", { page });

  if (page === "chats") {
    loadConversations();
  }

  if (page === "social") {
    loadFeed();
  }

  if (page === "stories") {
    loadStories();
  }

  return true;
}

function bindNavigation() {
  document.addEventListener("click", event => {
    const button = event.target.closest(
      "[data-navigate]"
    );

    if (!button) return;

    event.preventDefault();

    navigateTo(button.dataset.navigate);
  });
}

/* ==========================================
   CHAT INTERFACE
========================================== */

function bindChatInterface() {
  document.addEventListener("click", event => {
    const conversation = event.target.closest(
      "[data-open-conversation]"
    );

    if (!conversation) return;

    const id =
      conversation.dataset.openConversation;

    if (id) {
      openConversation(id);
    }
  });

  const form = $(
    "#message-form, [data-message-form]"
  );

  const input = $(
    "#message-input, [data-message-input]"
  );

  if (form && input) {
    form.addEventListener("submit", async event => {
      event.preventDefault();

      const message = input.value.trim();

      if (!message) return;

      const result = await sendMessage(message);

      if (result) {
        input.value = "";
      }
    });
  }
}

/* ==========================================
   SOCIAL INTERFACE
========================================== */

function bindSocialInterface() {
  const postForm = $(
    "#create-post-form, [data-create-post-form]"
  );

  const postInput = $(
    "#post-content, [data-post-content]"
  );

  if (postForm && postInput) {
    postForm.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const content = postInput.value.trim();

        if (!content) return;

        const result = await createPost(content);

        if (result) {
          postInput.value = "";
        }
      }
    );
  }

  const storyForm = $(
    "#create-story-form, [data-create-story-form]"
  );

  const storyInput = $(
    "#story-content, [data-story-content]"
  );

  if (storyForm && storyInput) {
    storyForm.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const content = storyInput.value.trim();

        if (!content) return;

        const result = await createStory(content);

        if (result) {
          storyInput.value = "";
        }
      }
    );
  }
}

/* ==========================================
   LOGOUT
========================================== */

function bindLogout() {
  const buttons = $$(
    "#logout-button, [data-logout]"
  );

  buttons.forEach(button => {
    button.addEventListener("click", async () => {
      const confirmed = confirm(
        "هل تريد تسجيل الخروج من MEKA؟"
      );

      if (!confirmed) return;

      try {
        setButtonLoading(button, true);

        await logout();

        AppState.authenticated = false;
        AppState.currentUser = null;

        showAuthentication();

        notify("تم تسجيل الخروج", "success");

      } catch (error) {
        console.error("MEKA logout:", error);

        notify("تعذر تسجيل الخروج", "error");

      } finally {
        setButtonLoading(button, false);
      }
    });
  });
}

/* ==========================================
   AUTHENTICATION STATE
========================================== */

function handleAuthenticationChange(user) {
  if (user) {
    AppState.authenticated = true;
    AppState.currentUser = user;

    updateUserInterface(user);
    showApplication();

    initializeAuthenticatedModules();

  } else {
    AppState.authenticated = false;
    AppState.currentUser = null;

    showAuthentication();
  }

  emit("authentication-changed", {
    user,
    authenticated: !!user
  });
}

let modulesInitializedForUser = null;

async function initializeAuthenticatedModules() {
  const user = AppState.currentUser;

  if (!user?.id) return;

  if (modulesInitializedForUser === user.id) {
    return;
  }

  modulesInitializedForUser = user.id;

  try {
    await initializeChat();

    await initializeSocial();

    navigateTo("chats");

    notify("مرحبًا بك في MEKA", "success");

    emit("modules-ready");

  } catch (error) {
    console.error(
      "MEKA module initialization:",
      error
    );

    modulesInitializedForUser = null;

    notify(
      "تم تسجيل الدخول، لكن بعض الأقسام لم تعمل",
      "warning"
    );
  }
}

/* ==========================================
   AUTH STATE LISTENER
========================================== */

function bindAuthenticationListener() {
  if (typeof subscribeAuth !== "function") {
    return;
  }

  subscribeAuth(user => {
    handleAuthenticationChange(user);
  });
}

/* ==========================================
   CONNECTION STATUS
========================================== */

async function checkConnection() {
  try {
    const result = await checkSupabaseConnection();

    AppState.connection =
      result === true ||
      result?.connected === true ||
      result?.success === true;

    emit("connection-status", {
      connected: AppState.connection
    });

    return AppState.connection;

  } catch (error) {
    console.warn("MEKA connection:", error);

    AppState.connection = false;

    emit("connection-status", {
      connected: false
    });

    return false;
  }
}

function updateConnectionIndicator(connected) {
  $$("[data-connection-status]").forEach(node => {
    node.textContent = connected
      ? "متصل"
      : "غير متصل";

    node.classList.toggle("online", connected);
    node.classList.toggle("offline", !connected);
  });
}

AppEvents.addEventListener(
  "connection-status",
  event => {
    updateConnectionIndicator(
      event.detail.connected
    );
  }
);

/* ==========================================
   APPLICATION EVENTS
========================================== */

function bindApplicationEvents() {
  const eventSources = [
    // Chat and social modules can emit toast events.
  ];

  void eventSources;

  document.addEventListener(
    "click",
    event => {
      const backButton = event.target.closest(
        "[data-back]"
      );

      if (!backButton) return;

      event.preventDefault();

      navigateTo(
        backButton.dataset.back || "chats"
      );
    }
  );

  window.addEventListener("online", () => {
    checkConnection();
  });

  window.addEventListener("offline", () => {
    AppState.connection = false;

    updateConnectionIndicator(false);

    notify("أنت غير متصل بالإنترنت", "warning");
  });
}

/* ==========================================
   CONFIGURATION VALIDATION
========================================== */

function validateConfiguration() {
  try {
    if (typeof validateMekaConfig === "function") {
      const result = validateMekaConfig();

      if (result === false) {
        notify(
          "يرجى مراجعة إعدادات MEKA",
          "warning"
        );
      }

      return result;
    }

    return true;

  } catch (error) {
    console.error("MEKA config:", error);

    notify("هناك مشكلة في الإعدادات", "error");

    return false;
  }
}

/* ==========================================
   START APPLICATION
========================================== */

export async function initializeApp() {
  if (AppState.initialized || AppState.initializing) {
    return;
  }

  AppState.initializing = true;

  try {
    console.info("MEKA starting...");

    validateConfiguration();

    bindNavigation();
    bindChatInterface();
    bindSocialInterface();
    bindLogout();
    bindApplicationEvents();

    bindAuthenticationListener();

    await checkConnection();

    const authResult = await startAuthentication();

    const user =
      authResult?.user ||
      await getCurrentUser();

    if (user) {
      handleAuthenticationChange(user);
    } else {
      showAuthentication();
    }

    AppState.initialized = true;

    emit("app-ready");

    console.info("MEKA initialized");

  } catch (error) {
    console.error("MEKA startup error:", error);

    notify(
      "حدث خطأ أثناء تشغيل التطبيق",
      "error"
    );

    try {
      const user = await getCurrentUser();

      if (user) {
        handleAuthenticationChange(user);
      } else {
        showAuthentication();
      }
    } catch {
      showAuthentication();
    }

  } finally {
    AppState.initializing = false;
  }
}

/* ==========================================
   GLOBAL APPLICATION API
========================================== */

export const MEKA = {
  state: AppState,
  events: AppEvents,

  initialize: initializeApp,

  navigate: navigateTo,

  chat: {
    initialize: initializeChat,
    load: loadConversations,
    open: openConversation,
    send: sendMessage
  },

  social: {
    initialize: initializeSocial,
    loadFeed,
    loadStories,
    createPost,
    createStory
  },

  auth: {
    getCurrentUser,
    logout
  },

  connection: checkConnection
};

window.MEKA = MEKA;

/* ==========================================
   AUTO START
========================================== */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp,
    { once: true }
  );
} else {
  initializeApp();
}

export default MEKA;
