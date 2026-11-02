/* =========================================
   MEKA — APPLICATION CONFIGURATION
========================================= */

"use strict";


/* =========================================
   APP INFORMATION
========================================= */

export const MEKA_CONFIG = Object.freeze({

  app: {
    name: "MEKA",
    arabicName: "ميكا",
    version: "1.0.0",
    description: "منصة ميكا للتواصل والمراسلة",
    language: "ar",
    direction: "rtl"
  },


  /* =======================================
     SUPABASE CONNECTION
  ======================================= */

  supabase: {

    url: "https://rtlxnzyzlkezukyfgjbs.supabase.co",

    publishableKey:
      "sb_publishable_qQJb_EzE3NgW74IxkwRDmw_0y4XIymI"

  },


  /* =======================================
     AUTHENTICATION
  ======================================= */

  authentication: {

    googleEnabled: true,

    emailEnabled: true,

    rememberSession: true,

    autoRefreshToken: true,

    detectSessionInUrl: true

  },


  /* =======================================
     USER SETTINGS
  ======================================= */

  user: {

    usernameMinLength: 3,

    usernameMaxLength: 24,

    displayNameMaxLength: 60,

    bioMaxLength: 300,

    avatarMaxSizeMB: 5

  },


  /* =======================================
     CHAT SETTINGS
  ======================================= */

  chat: {

    messageMaxLength: 10000,

    pageSize: 30,

    realtimeEnabled: true,

    typingIndicatorEnabled: true,

    readReceiptsEnabled: true,

    mediaEnabled: true

  },


  /* =======================================
     SOCIAL SETTINGS
  ======================================= */

  social: {

    storiesEnabled: true,

    postsEnabled: true,

    reactionsEnabled: true,

    commentsEnabled: true,

    groupsEnabled: true

  },


  /* =======================================
     CALL SETTINGS
  ======================================= */

  calls: {

    audioEnabled: true,

    videoEnabled: true,

    signalingEnabled: true,

    /*
      WebRTC requires STUN/TURN configuration.
      TURN credentials must never be stored here.
    */

    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]

  },


  /* =======================================
     PWA SETTINGS
  ======================================= */

  pwa: {

    enabled: true,

    serviceWorkerPath: "./sw.js",

    manifestPath: "./manifest.json",

    splashDuration: 5000

  },


  /* =======================================
     STORAGE BUCKETS
  ======================================= */

  storage: {

    avatars: "avatars",

    chatMedia: "chat-media",

    stories: "stories",

    postMedia: "post-media",

    voiceMessages: "voice-messages"

  },


  /* =======================================
     SECURITY
  ======================================= */

  security: {

    neverStorePasswordsLocally: true,

    neverExposeServiceRoleKey: true,

    useRowLevelSecurity: true,

    validateUploadedFiles: true,

    sanitizeUserContent: true

  },


  /* =======================================
     INTERFACE
  ======================================= */

  interface: {

    defaultTheme: "dark",

    primaryColor: "#16c784",

    backgroundColor: "#071c18",

    defaultLanguage: "ar"

  }

});


/* =========================================
   VALIDATE CONFIGURATION
========================================= */

export function validateMekaConfig() {

  const errors = [];

  const supabase = MEKA_CONFIG.supabase;

  if (!supabase.url.startsWith("https://")) {

    errors.push("Supabase URL must use HTTPS.");

  }

  if (!supabase.publishableKey.startsWith("sb_publishable_")) {

    errors.push("Invalid Supabase publishable key.");

  }

  if (errors.length > 0) {

    throw new Error(
      "MEKA configuration error: " + errors.join(" ")
    );

  }

  return true;

}


/* =========================================
   ENVIRONMENT INFORMATION
========================================= */

export const MEKA_ENV = Object.freeze({

  production:
    typeof location !== "undefined" &&
    location.hostname !== "localhost" &&
    location.hostname !== "127.0.0.1",

  secure:
    typeof location !== "undefined" &&
    location.protocol === "https:",

  supportedBrowser:
    typeof window !== "undefined"

});


/* =========================================
   EXPORT DEFAULT
========================================= */

export default MEKA_CONFIG;
