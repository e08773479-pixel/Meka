/* =========================================
   MEKA — AUTHENTICATION SYSTEM
========================================= */

"use strict";

import {
  supabase,
  MekaAuth,
  handleSupabaseError
} from "./supabase.js";


/* =========================================
   AUTH STATE
========================================= */

export const AuthState = {
  user: null,
  session: null,
  loading: true,
  initialized: false,
  listeners: new Set()
};


/* =========================================
   NOTIFICATION
========================================= */

function notify(message, type = "info") {

  if (typeof window.mekaToast === "function") {
    window.mekaToast(message, type);
    return;
  }

  console.log("MEKA:", message);

}


/* =========================================
   VALIDATION
========================================= */

function validateEmail(email) {

  const value = String(email || "").trim();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

}


function validatePassword(password) {

  return (
    typeof password === "string" &&
    password.length >= 8
  );

}


function validateUsername(username) {

  return (
    typeof username === "string" &&
    /^[a-zA-Z0-9_]{3,24}$/.test(username)
  );

}


function validateDisplayName(name) {

  const value = String(name || "").trim();

  return value.length >= 2 && value.length <= 60;

}


/* =========================================
   STATE UPDATER
========================================= */

function updateAuthState(session, event = "INITIALIZED") {

  AuthState.session = session || null;

  AuthState.user =
    session?.user || null;

  AuthState.loading = false;

  AuthState.initialized = true;

  AuthState.listeners.forEach(callback => {

    try {

      callback({
        event,
        user: AuthState.user,
        session: AuthState.session,
        authenticated: Boolean(AuthState.user)
      });

    } catch (error) {

      console.error(
        "MEKA auth listener:",
        error
      );

    }

  });

}


/* =========================================
   SUBSCRIBE TO AUTH STATE
========================================= */

export function subscribeAuth(callback) {

  AuthState.listeners.add(callback);

  if (AuthState.initialized) {

    callback({
      event: "CURRENT_STATE",
      user: AuthState.user,
      session: AuthState.session,
      authenticated: Boolean(AuthState.user)
    });

  }

  return () => {

    AuthState.listeners.delete(callback);

  };

}


/* =========================================
   INITIALIZE AUTH
========================================= */

let authSubscription = null;

export async function initializeAuth() {

  if (AuthState.initialized) {
    return AuthState.user;
  }

  try {

    const session =
      await MekaAuth.getSession();

    updateAuthState(
      session,
      "INITIALIZED"
    );

    if (!authSubscription) {

      authSubscription =
        MekaAuth.onAuthStateChange(
          ({ event, session }) => {

            updateAuthState(
              session,
              event
            );

          }
        );

    }

    return AuthState.user;

  } catch (error) {

    console.error(
      "MEKA auth initialization:",
      error
    );

    updateAuthState(null, "ERROR");

    return null;

  }

}


/* =========================================
   CREATE ACCOUNT
========================================= */

export async function createAccount({
  email,
  password,
  displayName,
  username
}) {

  email = String(email || "").trim().toLowerCase();

  username = String(username || "").trim().toLowerCase();

  displayName = String(displayName || "").trim();

  if (!validateEmail(email)) {
    throw new Error("اكتب بريدًا إلكترونيًا صحيحًا.");
  }

  if (!validatePassword(password)) {
    throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف.");
  }

  if (!validateUsername(username)) {
    throw new Error(
      "اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا إنجليزيًا أو رقمًا أو _."
    );
  }

  if (!validateDisplayName(displayName)) {
    throw new Error("الاسم يجب أن يكون بين حرفين و60 حرفًا.");
  }

  try {

    const result = await MekaAuth.signUp({

      email,
      password,
      displayName,
      username

    });

    /*
      إنشاء صف المستخدم في profiles
      يتم لاحقًا عبر trigger موثوق في قاعدة البيانات.
      لا ننشئ ملفًا شخصيًا من المتصفح هنا.
    */

    if (result.session) {

      updateAuthState(
        result.session,
        "SIGNED_UP"
      );

    }

    return {
      success: true,
      user: result.user,
      session: result.session,
      confirmationRequired: !result.session
    };

  } catch (error) {

    throw new Error(
      handleSupabaseError(error)
    );

  }

}


/* =========================================
   EMAIL LOGIN
========================================= */

export async function loginWithEmail({
  email,
  password
}) {

  email = String(email || "").trim().toLowerCase();

  if (!validateEmail(email)) {
    throw new Error("اكتب بريدًا إلكترونيًا صحيحًا.");
  }

  if (!password) {
    throw new Error("اكتب كلمة المرور.");
  }

  try {

    const result = await MekaAuth.signIn({

      email,
      password

    });

    updateAuthState(
      result.session,
      "SIGNED_IN"
    );

    return {
      success: true,
      user: result.user,
      session: result.session
    };

  } catch (error) {

    throw new Error(
      handleSupabaseError(error)
    );

  }

}


/* =========================================
   GOOGLE LOGIN
========================================= */

export async function loginWithGoogle() {

  try {

    await MekaAuth.signInWithGoogle();

    return {
      success: true,
      redirecting: true
    };

  } catch (error) {

    throw new Error(
      handleSupabaseError(error)
    );

  }

}


/* =========================================
   LOGOUT
========================================= */

export async function logout() {

  try {

    await MekaAuth.signOut();

    updateAuthState(
      null,
      "SIGNED_OUT"
    );

    return true;

  } catch (error) {

    throw new Error(
      handleSupabaseError(error)
    );

  }

}


/* =========================================
   PASSWORD RESET
========================================= */

export async function sendPasswordReset(email) {

  email = String(email || "").trim().toLowerCase();

  if (!validateEmail(email)) {
    throw new Error("اكتب بريدًا إلكترونيًا صحيحًا.");
  }

  try {

    await MekaAuth.resetPassword(email);

    return {
      success: true,
      message: "إذا كان البريد مسجلًا، ستصلك رسالة استعادة كلمة المرور."
    };

  } catch (error) {

    throw new Error(
      handleSupabaseError(error)
    );

  }

}


/* =========================================
   UPDATE PASSWORD
========================================= */

export async function changePassword(password) {

  if (!validatePassword(password)) {
    throw new Error("كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.");
  }

  if (!AuthState.user) {
    throw new Error("يجب تسجيل الدخول أولًا.");
  }

  try {

    await MekaAuth.updatePassword(password);

    return {
      success: true
    };

  } catch (error) {

    throw new Error(
      handleSupabaseError(error)
    );

  }

}


/* =========================================
   CURRENT USER
========================================= */

export function getCurrentUser() {

  return AuthState.user;

}


export function isAuthenticated() {

  return Boolean(AuthState.user);

}


/* =========================================
   REQUIRE AUTHENTICATION
========================================= */

export function requireAuthentication() {

  if (!isAuthenticated()) {

    notify(
      "سجل الدخول أولًا لاستخدام هذه الميزة."
    );

    return false;

  }

  return true;

}


/* =========================================
   AUTH ROUTING
========================================= */

export function showAuthenticatedApp() {

  const authScreen =
    document.getElementById("mekaAuth");

  const appScreen =
    document.getElementById("mekaApp");

  if (authScreen) {
    authScreen.classList.add("is-hidden");
  }

  if (appScreen) {
    appScreen.classList.add("is-active");
  }

}


export function showLoginScreen() {

  const authScreen =
    document.getElementById("mekaAuth");

  const appScreen =
    document.getElementById("mekaApp");

  if (appScreen) {
    appScreen.classList.remove("is-active");
  }

  if (authScreen) {
    authScreen.classList.remove("is-hidden");
  }

}


/* =========================================
   BIND AUTH FORMS
========================================= */

export function bindAuthForms() {

  const loginForm =
    document.getElementById("mekaLoginForm");

  const signupForm =
    document.getElementById("mekaSignupForm");

  const googleButton =
    document.getElementById("mekaGoogleLogin");

  if (loginForm) {

    loginForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const form = new FormData(loginForm);

        try {

          await loginWithEmail({

            email: form.get("email"),

            password: form.get("password")

          });

          notify("تم تسجيل الدخول بنجاح.");

          showAuthenticatedApp();

        } catch (error) {

          notify(error.message, "error");

        }

      }
    );

  }


  if (signupForm) {

    signupForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const form = new FormData(signupForm);

        try {

          const result = await createAccount({

            email: form.get("email"),

            password: form.get("password"),

            displayName: form.get("displayName"),

            username: form.get("username")

          });

          if (result.confirmationRequired) {

            notify(
              "تم إنشاء الحساب. راجع بريدك لتأكيد التسجيل."
            );

          } else {

            notify("تم إنشاء الحساب بنجاح.");

            showAuthenticatedApp();

          }

        } catch (error) {

          notify(error.message, "error");

        }

      }
    );

  }


  if (googleButton) {

    googleButton.addEventListener(
      "click",
      async () => {

        try {

          await loginWithGoogle();

        } catch (error) {

          notify(error.message, "error");

        }

      }
    );

  }

}


/* =========================================
   INITIAL AUTH ROUTING
========================================= */

export async function startAuthentication() {

  bindAuthForms();

  const user = await initializeAuth();

  if (user) {

    showAuthenticatedApp();

  } else {

    showLoginScreen();

  }

  return user;

}


/* =========================================
   END MEKA AUTH
========================================= */
