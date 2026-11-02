export const MEKA_CONFIG = Object.freeze({

  APP_NAME: "MEKA",
  APP_NAME_AR: "ميكا",

  VERSION: "1.0.0",

  SUPABASE_URL:
    "https://rtlxnzyzlkezukyfgjbs.supabase.co",

  SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_qQJb_EzE3NgW74IxkwRDmw_0y4XIymI",

  DEFAULT_LANGUAGE: "ar",

  DEFAULT_THEME: "dark",

  SPLASH_DURATION: 5000,

  MAX_MESSAGE_LENGTH: 5000,

  MAX_UPLOAD_SIZE: 25 * 1024 * 1024,

  STORAGE_BUCKETS: Object.freeze({
    CHAT_MEDIA: "meka-chat-media",
    DOCUMENTS: "meka-documents"
  }),

  REALTIME: Object.freeze({
    ENABLED: true,
    MESSAGE_TABLE: "messages",
    CONVERSATION_TABLE: "conversations"
  })

});

export function getAppBaseUrl() {
  return window.location.origin + window.location.pathname;
}
