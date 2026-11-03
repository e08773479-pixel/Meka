
/**
 * NOVA Messenger
 * Application entry point
 *
 * No demo users, fake messages, or mock conversations.
 * Data services will be connected in the Firebase integration stage.
 */

const NovaApp = (() => {
  "use strict";

  const state = {
    initialized: false,
    activeConversationId: null,
    searchQuery: "",
    currentFilter: "all"
  };

  const elements = {};

  function getElements() {
    const ids = [
      "app-loader",
      "app-layout",
      "sidebar",
      "chat-list",
      "chat-search",
      "empty-state",
      "conversation-panel",
      "message-list",
      "message-form",
      "message-input",
      "mobile-back-button"
    ];

    for (const id of ids) {
      elements[id] = document.getElementById(id);
    }
  }

  function validateStructure() {
    const required = [
      "app-layout",
      "sidebar",
      "chat-list",
      "empty-state",
      "conversation-panel"
    ];

    const missing = required.filter(id => !elements[id]);

    if (missing.length > 0) {
      console.error(
        "[NOVA] Missing required application elements:",
        missing
      );

      return false;
    }

    return true;
  }

  function finishStartup() {
    const loader = elements["app-loader"];

    if (!loader) return;

    loader.classList.add("is-finished");

    window.setTimeout(() => {
      loader.remove();
    }, 550);
  }

  function showConversation(conversationId) {
    if (!conversationId || typeof conversationId !== "string") {
      return false;
    }

    const conversation = elements["chat-list"]
      .querySelector(
        `[data-conversation-id="${CSS.escape(conversationId)}"]`
      );

    if (!conversation) {
      console.warn(
        "[NOVA] Conversation was not found:",
        conversationId
      );

      return false;
    }

    state.activeConversationId = conversationId;

    elements["empty-state"].hidden = true;
    elements["conversation-panel"].hidden = false;

    document
      .querySelectorAll(".chat-item.active")
      .forEach(item => item.classList.remove("active"));

    conversation.classList.add("active");

    elements["app-layout"].classList.add("mobile-chat-open");

    return true;
  }

  function closeConversation() {
    state.activeConversationId = null;

    elements["conversation-panel"].hidden = true;
    elements["empty-state"].hidden = false;

    elements["app-layout"].classList.remove("mobile-chat-open");

    document
      .querySelectorAll(".chat-item.active")
      .forEach(item => item.classList.remove("active"));
  }

  function filterConversations() {
    const items = elements["chat-list"]
      .querySelectorAll(".chat-item");

    const query = state.searchQuery.trim().toLocaleLowerCase("ar");

    items.forEach(item => {
      const searchableText = (
        item.textContent || ""
      ).toLocaleLowerCase("ar");

      const matchesSearch = searchableText.includes(query);

      let matchesFilter = true;

      if (state.currentFilter === "unread") {
        matchesFilter = item.dataset.unread === "true";
      }

      if (state.currentFilter === "groups") {
        matchesFilter = item.dataset.type === "group";
      }

      item.hidden = !matchesSearch || !matchesFilter;
    });
  }

  function handleSearch(event) {
    state.searchQuery = event.target.value || "";
    filterConversations();
  }

  function handleFilter(event) {
    const button = event.target.closest("[data-filter]");

    if (!button) return;

    const allowedFilters = ["all", "unread", "groups"];

    const selectedFilter = button.dataset.filter;

    if (!allowedFilters.includes(selectedFilter)) return;

    state.currentFilter = selectedFilter;

    document
      .querySelectorAll(".filter-button")
      .forEach(filterButton => {
        filterButton.classList.toggle(
          "active",
          filterButton === button
        );
      });

    filterConversations();
  }

  function handleChatSelection(event) {
    const item = event.target.closest("[data-conversation-id]");

    if (!item || !elements["chat-list"].contains(item)) {
      return;
    }

    showConversation(item.dataset.conversationId);
  }

  function handleMessageSubmit(event) {
    event.preventDefault();

    if (!state.activeConversationId) {
      return;
    }

    const input = elements["message-input"];

    if (!input) return;

    const messageText = input.value.trim();

    if (!messageText) return;

    /*
     * Sending is intentionally disabled until the real
     * conversation repository and authenticated user
     * are connected.
     *
     * The message is not displayed as sent or saved here.
     */
    console.info(
      "[NOVA] Message sending requires the connected messaging service."
    );
  }

  function bindEvents() {
    elements["chat-search"]?.addEventListener(
      "input",
      handleSearch
    );

    elements["chat-list"]?.addEventListener(
      "click",
      handleChatSelection
    );

    document
      .querySelector(".chat-filters")
      ?.addEventListener("click", handleFilter);

    elements["mobile-back-button"]?.addEventListener(
      "click",
      closeConversation
    );

    elements["message-form"]?.addEventListener(
      "submit",
      handleMessageSubmit
    );

    window.addEventListener("keydown", event => {
      if (event.key === "Escape" && state.activeConversationId) {
        closeConversation();
      }
    });
  }

  function initialize() {
    if (state.initialized) return;

    getElements();

    if (!validateStructure()) {
      return;
    }

    bindEvents();

    state.initialized = true;

    finishStartup();

    console.info("[NOVA] Application initialized.");
  }

  return {
    initialize,
    showConversation,
    closeConversation,
    filterConversations
  };
})();

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    NovaApp.initialize,
    { once: true }
  );
} else {
  NovaApp.initialize();
}

window.NovaApp = NovaApp;
