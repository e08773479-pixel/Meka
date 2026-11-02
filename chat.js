import {
  ConversationsDB,
  MessagesDB
} from "./database.js";

import {
  supabase,
  MekaStorage
} from "./supabase.js";

import { MEKA_CONFIG } from "./config.js";
import { getCurrentUser } from "./auth.js";

/* =========================================
   MEKA CHAT ENGINE
========================================= */

const ChatState = {
  conversations: [],
  activeConversation: null,
  messages: [],
  currentUser: null,
  loading: false,
  sending: false,
  page: 0,
  pageSize: 40,
  hasMore: true,
  subscription: null,
  renderedMessageIds: new Set(),
  replyTo: null
};

const ChatEvents = new EventTarget();

function emit(name, detail = {}) {
  ChatEvents.dispatchEvent(
    new CustomEvent(name, { detail })
  );
}

function element(selector, root = document) {
  return root.querySelector(selector);
}

function elements(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function escapeText(value) {
  return String(value ?? "");
}

function formatTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ar-EG", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

function notify(message, type = "info") {
  emit("toast", { message, type });

  const toast = element("#meka-toast");

  if (toast) {
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("show");

    clearTimeout(notify.timer);

    notify.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }
}

function setLoading(value) {
  ChatState.loading = value;
  emit("loading", { loading: value });
}

/* =========================================
   DOM HELPERS
========================================= */

function getChatListContainer() {
  return (
    element("#chat-list") ||
    element("[data-chat-list]") ||
    element(".chat-list")
  );
}

function getMessagesContainer() {
  return (
    element("#messages-list") ||
    element("#chat-messages") ||
    element("[data-messages-list]") ||
    element(".messages-list")
  );
}

function getConversationTitle() {
  return (
    element("#active-chat-name") ||
    element("[data-active-chat-name]")
  );
}

function getConversationAvatar() {
  return (
    element("#active-chat-avatar") ||
    element("[data-active-chat-avatar]")
  );
}

function getMessageInput() {
  return (
    element("#message-input") ||
    element("[data-message-input]") ||
    element("textarea[name='message']")
  );
}

/* =========================================
   CONVERSATION LIST
========================================= */

export async function loadConversations() {
  try {
    setLoading(true);

    const result =
      await ConversationsDB.getMyConversations();

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر تحميل المحادثات"
      );
    }

    ChatState.conversations = result.data || [];

    renderConversations(ChatState.conversations);

    emit("conversations-loaded", {
      conversations: ChatState.conversations
    });

    return ChatState.conversations;

  } catch (error) {
    console.error("MEKA conversations:", error);

    notify(
      error.message || "حدث خطأ أثناء تحميل المحادثات",
      "error"
    );

    return [];

  } finally {
    setLoading(false);
  }
}

function getConversationDisplayName(conversation) {
  if (!conversation) return "محادثة";

  return (
    conversation.title ||
    conversation.name ||
    conversation.other_user?.display_name ||
    conversation.profile?.display_name ||
    "محادثة جديدة"
  );
}

function getConversationLastMessage(conversation) {
  const message = conversation.last_message;

  if (!message) return "ابدأ المحادثة";

  return message.body || "رسالة";
}

function renderConversations(conversations) {
  const container = getChatListContainer();

  if (!container) {
    emit("render-conversations", { conversations });
    return;
  }

  container.replaceChildren();

  if (!conversations.length) {
    const empty = document.createElement("div");

    empty.className = "meka-empty-state";
    empty.textContent = "لا توجد محادثات حتى الآن";

    container.appendChild(empty);
    return;
  }

  conversations.forEach(conversation => {
    const item = document.createElement("button");

    item.type = "button";
    item.className = "meka-conversation-item";

    item.dataset.conversationId = conversation.id;

    const avatar = document.createElement("div");
    avatar.className = "meka-chat-avatar";

    const avatarText = document.createElement("span");

    avatarText.textContent =
      getConversationDisplayName(conversation)
        .trim()
        .charAt(0) || "M";

    avatar.appendChild(avatarText);

    const content = document.createElement("div");
    content.className = "meka-conversation-content";

    const title = document.createElement("div");
    title.className = "meka-conversation-title";
    title.textContent =
      getConversationDisplayName(conversation);

    const preview = document.createElement("div");
    preview.className = "meka-conversation-preview";
    preview.textContent =
      getConversationLastMessage(conversation);

    content.append(title, preview);

    const meta = document.createElement("div");
    meta.className = "meka-conversation-meta";

    const date = document.createElement("span");

    date.textContent = conversation.updated_at
      ? formatTime(conversation.updated_at)
      : "";

    meta.appendChild(date);

    item.append(avatar, content, meta);

    if (
      ChatState.activeConversation?.id === conversation.id
    ) {
      item.classList.add("active");
    }

    item.addEventListener("click", () => {
      openConversation(conversation.id);
    });

    container.appendChild(item);
  });
}

/* =========================================
   OPEN CONVERSATION
========================================= */

export async function openConversation(conversationId) {
  if (!conversationId) return;

  try {
    await unsubscribeFromMessages();

    ChatState.activeConversation =
      ChatState.conversations.find(
        item => item.id === conversationId
      ) || { id: conversationId };

    ChatState.messages = [];
    ChatState.page = 0;
    ChatState.hasMore = true;
    ChatState.renderedMessageIds.clear();
    ChatState.replyTo = null;

    updateActiveConversationHeader();

    const container = getMessagesContainer();

    if (container) {
      container.replaceChildren();
    }

    emit("conversation-opened", {
      conversation: ChatState.activeConversation
    });

    await loadMessages();

    subscribeToActiveConversation();

  } catch (error) {
    console.error("MEKA open conversation:", error);

    notify("تعذر فتح المحادثة", "error");
  }
}

function updateActiveConversationHeader() {
  const conversation = ChatState.activeConversation;

  if (!conversation) return;

  const title = getConversationTitle();

  if (title) {
    title.textContent =
      getConversationDisplayName(conversation);
  }

  const avatar = getConversationAvatar();

  if (avatar) {
    avatar.textContent =
      getConversationDisplayName(conversation)
        .trim()
        .charAt(0) || "M";
  }

  elements("[data-conversation-id]").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.conversationId === conversation.id
    );
  });
}

/* =========================================
   LOAD MESSAGES
========================================= */

export async function loadMessages(options = {}) {
  const conversation = ChatState.activeConversation;

  if (!conversation?.id) return [];

  if (ChatState.loadingMessages) return [];

  ChatState.loadingMessages = true;

  try {
    const result = await MessagesDB.getMessages(
      conversation.id,
      {
        page: ChatState.page,
        pageSize: ChatState.pageSize
      }
    );

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر تحميل الرسائل"
      );
    }

    const messages = result.data || [];

    ChatState.hasMore =
      messages.length >= ChatState.pageSize;

    if (options.prepend) {
      ChatState.messages = [
        ...messages,
        ...ChatState.messages
      ];
    } else {
      ChatState.messages = messages;
    }

    const container = getMessagesContainer();

    if (container) {
      if (options.prepend) {
        const oldHeight = container.scrollHeight;

        messages.forEach(message => {
          renderMessage(message, {
            prepend: true
          });
        });

        container.scrollTop =
          container.scrollHeight - oldHeight;

      } else {
        container.replaceChildren();

        ChatState.renderedMessageIds.clear();

        ChatState.messages.forEach(message => {
          renderMessage(message);
        });

        container.scrollTop = container.scrollHeight;
      }
    }

    emit("messages-loaded", {
      messages: ChatState.messages,
      conversationId: conversation.id
    });

    return messages;

  } catch (error) {
    console.error("MEKA messages:", error);

    notify("تعذر تحميل الرسائل", "error");

    return [];

  } finally {
    ChatState.loadingMessages = false;
  }
}

export async function loadOlderMessages() {
  if (!ChatState.hasMore) return [];

  ChatState.page += 1;

  return loadMessages({
    prepend: true
  });
}

/* =========================================
   RENDER MESSAGE
========================================= */

function renderMessage(message, options = {}) {
  const container = getMessagesContainer();

  if (!container || !message?.id) {
    emit("render-message", { message });
    return;
  }

  if (ChatState.renderedMessageIds.has(message.id)) {
    return;
  }

  ChatState.renderedMessageIds.add(message.id);

  const ownMessage =
    message.sender_id === ChatState.currentUser?.id;

  const wrapper = document.createElement("article");

  wrapper.className = ownMessage
    ? "meka-message meka-message-own"
    : "meka-message meka-message-other";

  wrapper.dataset.messageId = message.id;

  const bubble = document.createElement("div");
  bubble.className = "meka-message-bubble";

  if (message.reply_to) {
    const reply = document.createElement("div");

    reply.className = "meka-message-reply";
    reply.textContent =
      message.reply_to.body || "رسالة مقتبسة";

    bubble.appendChild(reply);
  }

  const body = document.createElement("div");

  body.className = "meka-message-body";

  // textContent يمنع تنفيذ HTML أو JavaScript من الرسائل.
  body.textContent =
    message.body || "";

  bubble.appendChild(body);

  if (message.created_at) {
    const time = document.createElement("time");

    time.className = "meka-message-time";
    time.dateTime = message.created_at;
    time.textContent = formatTime(message.created_at);

    bubble.appendChild(time);
  }

  wrapper.appendChild(bubble);

  wrapper.addEventListener("contextmenu", event => {
    event.preventDefault();

    emit("message-menu", {
      message,
      element: wrapper
    });
  });

  wrapper.addEventListener("dblclick", () => {
    setReply(message);
  });

  if (options.prepend) {
    container.prepend(wrapper);
  } else {
    container.appendChild(wrapper);
  }
}

/* =========================================
   SEND MESSAGE
========================================= */

export async function sendMessage(text) {
  const conversation = ChatState.activeConversation;

  const body = String(text ?? "").trim();

  if (!conversation?.id) {
    notify("افتح محادثة أولًا", "warning");
    return null;
  }

  if (!body) return null;

  if (ChatState.sending) return null;

  try {
    ChatState.sending = true;

    emit("sending-message", { sending: true });

    const payload = {
      conversation_id: conversation.id,
      body
    };

    if (ChatState.replyTo?.id) {
      payload.reply_to_id = ChatState.replyTo.id;
    }

    const result = await MessagesDB.sendMessage(payload);

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر إرسال الرسالة"
      );
    }

    const message = result.data;

    if (message) {
      addMessageIfMissing(message);
    }

    ChatState.replyTo = null;

    emit("message-sent", { message });

    await loadConversations();

    return message;

  } catch (error) {
    console.error("MEKA send:", error);

    notify(
      error.message || "فشل إرسال الرسالة",
      "error"
    );

    return null;

  } finally {
    ChatState.sending = false;

    emit("sending-message", { sending: false });
  }
}

function addMessageIfMissing(message) {
  if (!message?.id) return;

  const exists = ChatState.messages.some(
    item => item.id === message.id
  );

  if (exists) return;

  ChatState.messages.push(message);

  renderMessage(message);

  const container = getMessagesContainer();

  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

/* =========================================
   REPLY
========================================= */

export function setReply(message) {
  if (!message?.id) return;

  ChatState.replyTo = message;

  emit("reply-selected", { message });

  const preview =
    element("#reply-preview") ||
    element("[data-reply-preview]");

  if (preview) {
    preview.hidden = false;
    preview.textContent =
      `رد على: ${message.body || "رسالة"}`;
  }

  getMessageInput()?.focus();
}

export function cancelReply() {
  ChatState.replyTo = null;

  const preview =
    element("#reply-preview") ||
    element("[data-reply-preview]");

  if (preview) {
    preview.hidden = true;
    preview.textContent = "";
  }

  emit("reply-cancelled");
}

/* =========================================
   EDIT MESSAGE
========================================= */

export async function editMessage(messageId, newText) {
  const body = String(newText ?? "").trim();

  if (!messageId || !body) return false;

  try {
    const result = await MessagesDB.editMessage(
      messageId,
      body
    );

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر تعديل الرسالة"
      );
    }

    const message = ChatState.messages.find(
      item => item.id === messageId
    );

    if (message) {
      message.body = body;
    }

    const node = element(
      `[data-message-id="${CSS.escape(messageId)}"] .meka-message-body`
    );

    if (node) {
      node.textContent = body;
    }

    emit("message-edited", {
      messageId,
      body
    });

    return true;

  } catch (error) {
    notify(error.message, "error");
    return false;
  }
}

/* =========================================
   DELETE MESSAGE
========================================= */

export async function deleteMessage(messageId) {
  if (!messageId) return false;

  try {
    const result =
      await MessagesDB.deleteMessage(messageId);

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر حذف الرسالة"
      );
    }

    ChatState.messages =
      ChatState.messages.filter(
        item => item.id !== messageId
      );

    const node = element(
      `[data-message-id="${CSS.escape(messageId)}"]`
    );

    node?.remove();

    ChatState.renderedMessageIds.delete(messageId);

    emit("message-deleted", { messageId });

    return true;

  } catch (error) {
    notify(error.message, "error");
    return false;
  }
}

/* =========================================
   REACTIONS
========================================= */

export async function reactToMessage(messageId, emoji) {
  if (!messageId || !emoji) return false;

  try {
    const result = await MessagesDB.react(
      messageId,
      emoji
    );

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر إضافة التفاعل"
      );
    }

    emit("message-reacted", {
      messageId,
      emoji
    });

    return true;

  } catch (error) {
    notify(error.message, "error");
    return false;
  }
}

/* =========================================
   READ RECEIPTS
========================================= */

export async function markConversationRead() {
  const conversation = ChatState.activeConversation;

  if (!conversation?.id) return false;

  try {
    const result = await MessagesDB.markRead(
      conversation.id
    );

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر تحديث حالة القراءة"
      );
    }

    emit("conversation-read", {
      conversationId: conversation.id
    });

    return true;

  } catch (error) {
    console.error("MEKA mark read:", error);
    return false;
  }
}

/* =========================================
   REALTIME MESSAGES
========================================= */

function subscribeToActiveConversation() {
  const conversationId =
    ChatState.activeConversation?.id;

  if (!conversationId) return;

  try {
    const result = MessagesDB.subscribe(
      conversationId,
      message => {
        if (!message) return;

        const ownMessage =
          message.sender_id === ChatState.currentUser?.id;

        addMessageIfMissing(message);

        if (!ownMessage) {
          markConversationRead();
        }

        emit("realtime-message", { message });
      }
    );

    ChatState.subscription = result || null;

  } catch (error) {
    console.error("MEKA realtime:", error);

    notify(
      "المحادثة مفتوحة، لكن التحديث الفوري غير متاح حاليًا",
      "warning"
    );
  }
}

async function unsubscribeFromMessages() {
  const subscription = ChatState.subscription;

  if (!subscription) return;

  try {
    if (typeof subscription.unsubscribe === "function") {
      await subscription.unsubscribe();
    } else if (supabase?.removeChannel) {
      await supabase.removeChannel(subscription);
    }
  } catch (error) {
    console.warn("MEKA unsubscribe:", error);
  }

  ChatState.subscription = null;
}

/* =========================================
   FILE ATTACHMENTS
========================================= */

export async function uploadChatFile(file) {
  const conversation = ChatState.activeConversation;

  if (!conversation?.id) {
    notify("افتح محادثة أولًا", "warning");
    return null;
  }

  if (!(file instanceof File)) return null;

  const maxSize =
    MEKA_CONFIG?.storage?.maxFileSize ||
    25 * 1024 * 1024;

  if (file.size > maxSize) {
    notify("حجم الملف أكبر من المسموح", "error");
    return null;
  }

  try {
    const bucket =
      MEKA_CONFIG?.storage?.chatMedia;

    if (!bucket) {
      throw new Error(
        "اسم مساحة تخزين المحادثات غير مضبوط في config.js"
      );
    }

    const safeName = file.name
      .replace(/[^\w.\-ء-ي]/g, "_")
      .slice(0, 100);

    const path =
      `${conversation.id}/${Date.now()}-${safeName}`;

    const upload = await MekaStorage.upload(
      bucket,
      path,
      file
    );

    if (!upload?.success) {
      throw new Error(
        upload?.error || "فشل رفع الملف"
      );
    }

    emit("chat-file-uploaded", {
      file,
      path,
      bucket
    });

    return {
      bucket,
      path,
      name: file.name,
      size: file.size,
      type: file.type
    };

  } catch (error) {
    console.error("MEKA file upload:", error);

    notify(
      error.message || "تعذر رفع الملف",
      "error"
    );

    return null;
  }
}

/* =========================================
   SEARCH INSIDE CONVERSATION
========================================= */

export function searchMessages(query) {
  const term = String(query ?? "")
    .trim()
    .toLocaleLowerCase();

  if (!term) return [];

  return ChatState.messages.filter(message =>
    String(message.body ?? "")
      .toLocaleLowerCase()
      .includes(term)
  );
}

/* =========================================
   CHAT FORM BINDINGS
========================================= */

function bindMessageForm() {
  const form =
    element("#message-form") ||
    element("[data-message-form]");

  const input = getMessageInput();

  if (form && input) {
    form.addEventListener("submit", async event => {
      event.preventDefault();

      const text = input.value;

      const sent = await sendMessage(text);

      if (sent) {
        input.value = "";
        input.focus();
        cancelReply();
      }
    });
  }

  const sendButton =
    element("#send-message") ||
    element("[data-send-message]");

  if (sendButton && input && !form) {
    sendButton.addEventListener("click", async () => {
      const sent = await sendMessage(input.value);

      if (sent) {
        input.value = "";
        input.focus();
        cancelReply();
      }
    });
  }

  input?.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();

      const formElement =
        element("#message-form") ||
        element("[data-message-form]");

      if (formElement) {
        formElement.requestSubmit();
      } else {
        element("#send-message")?.click();
      }
    }
  });

  const cancelButton =
    element("#cancel-reply") ||
    element("[data-cancel-reply]");

  cancelButton?.addEventListener(
    "click",
    cancelReply
  );

  const fileInput =
    element("#chat-file-input") ||
    element("[data-chat-file-input]");

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    const uploaded = await uploadChatFile(file);

    if (uploaded) {
      notify(
        "تم رفع الملف. ربطه برسالة مرفق يحتاج دالة إرسال المرفقات في قاعدة البيانات.",
        "success"
      );
    }

    fileInput.value = "";
  });
}

/* =========================================
   INITIALIZATION
========================================= */

export async function initializeChat() {
  try {
    ChatState.currentUser = await getCurrentUser();

    if (!ChatState.currentUser) {
      return false;
    }

    bindMessageForm();

    await loadConversations();

    emit("chat-ready");

    return true;

  } catch (error) {
    console.error("MEKA chat initialization:", error);

    notify("تعذر تشغيل المحادثات", "error");

    return false;
  }
}

/* =========================================
   PUBLIC API
========================================= */

export const MekaChat = {
  state: ChatState,
  events: ChatEvents,

  initialize: initializeChat,

  loadConversations,
  openConversation,

  loadMessages,
  loadOlderMessages,

  sendMessage,

  setReply,
  cancelReply,

  editMessage,
  deleteMessage,
  reactToMessage,

  markConversationRead,

  uploadChatFile,

  searchMessages,

  unsubscribe: unsubscribeFromMessages
};

export default MekaChat;
