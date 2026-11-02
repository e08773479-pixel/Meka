/* =========================================
   MEKA — SUPABASE CONNECTION
========================================= */

"use strict";

import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";

import {
  MEKA_CONFIG,
  validateMekaConfig
} from "./config.js";


/* =========================================
   CONFIGURATION
========================================= */

validateMekaConfig();

const SUPABASE_URL =
  MEKA_CONFIG.supabase.url;

const SUPABASE_KEY =
  MEKA_CONFIG.supabase.publishableKey;


/* =========================================
   CREATE SUPABASE CLIENT
========================================= */

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage: localStorage
    },

    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },

    global: {
      headers: {
        "X-Client-Info": "meka-web/1.0.0"
      }
    }
  }
);


/* =========================================
   CONNECTION STATUS
========================================= */

export const MekaConnection = {

  online: navigator.onLine,

  status: "initializing",

  listeners: new Set(),

  setStatus(status) {

    this.status = status;

    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error(error);
      }
    });

  },

  subscribe(callback) {

    this.listeners.add(callback);

    callback(this.status);

    return () => {
      this.listeners.delete(callback);
    };

  }

};


window.addEventListener("online", () => {

  MekaConnection.online = true;

  MekaConnection.setStatus("online");

});


window.addEventListener("offline", () => {

  MekaConnection.online = false;

  MekaConnection.setStatus("offline");

});


/* =========================================
   INITIAL CONNECTION CHECK
========================================= */

export async function checkSupabaseConnection() {

  try {

    const { error } = await supabase
      .from("platform_settings")
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    MekaConnection.setStatus("connected");

    return {
      success: true,
      status: "connected"
    };

  } catch (error) {

    console.error(
      "MEKA connection error:",
      error
    );

    MekaConnection.setStatus("error");

    return {
      success: false,
      status: "error",
      error
    };

  }

}


/* =========================================
   AUTHENTICATION
========================================= */

export const MekaAuth = {


  /* GET CURRENT SESSION */

  async getSession() {

    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;

  },


  /* GET CURRENT USER */

  async getUser() {

    const { data, error } =
      await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return data.user;

  },


  /* EMAIL SIGN UP */

  async signUp({
    email,
    password,
    displayName,
    username
  }) {

    const { data, error } =
      await supabase.auth.signUp({

        email,
        password,

        options: {
          data: {
            display_name: displayName,
            username: username
          }
        }

      });

    if (error) {
      throw error;
    }

    return data;

  },


  /* EMAIL SIGN IN */

  async signIn({
    email,
    password
  }) {

    const { data, error } =
      await supabase.auth.signInWithPassword({

        email,
        password

      });

    if (error) {
      throw error;
    }

    return data;

  },


  /* GOOGLE SIGN IN */

  async signInWithGoogle() {

    const redirectTo =
      window.location.origin +
      window.location.pathname;

    const { data, error } =
      await supabase.auth.signInWithOAuth({

        provider: "google",

        options: {
          redirectTo
        }

      });

    if (error) {
      throw error;
    }

    return data;

  },


  /* SIGN OUT */

  async signOut() {

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    return true;

  },


  /* PASSWORD RESET */

  async resetPassword(email) {

    const redirectTo =
      window.location.origin +
      window.location.pathname;

    const { data, error } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo
        }
      );

    if (error) {
      throw error;
    }

    return data;

  },


  /* UPDATE PASSWORD */

  async updatePassword(password) {

    const { data, error } =
      await supabase.auth.updateUser({
        password
      });

    if (error) {
      throw error;
    }

    return data;

  },


  /* AUTH STATE LISTENER */

  onAuthStateChange(callback) {

    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange(
      (event, session) => {

        callback({
          event,
          session,
          user: session?.user ?? null
        });

      }
    );

    return () => {
      subscription.unsubscribe();
    };

  }

};


/* =========================================
   REALTIME CONNECTION
========================================= */

export const MekaRealtime = {


  /* CREATE CHANNEL */

  createChannel(channelName, options = {}) {

    return supabase.channel(
      channelName,
      options
    );

  },


  /* REMOVE CHANNEL */

  async removeChannel(channel) {

    if (!channel) {
      return;
    }

    return await supabase.removeChannel(channel);

  },


  /* REMOVE ALL CHANNELS */

  async removeAllChannels() {

    return await supabase.removeAllChannels();

  },


  /* CHANNEL STATUS */

  getChannels() {

    return supabase.getChannels();

  }

};


/* =========================================
   STORAGE
========================================= */

export const MekaStorage = {


  /* UPLOAD FILE */

  async upload(
    bucket,
    path,
    file,
    options = {}
  ) {

    if (!(file instanceof File)) {
      throw new Error("Invalid file.");
    }

    const { data, error } =
      await supabase.storage
        .from(bucket)
        .upload(path, file, {

          cacheControl: "3600",

          upsert: false,

          ...options

        });

    if (error) {
      throw error;
    }

    return data;

  },


  /* GET PUBLIC URL */

  getPublicUrl(bucket, path) {

    const { data } =
      supabase.storage
        .from(bucket)
        .getPublicUrl(path);

    return data.publicUrl;

  },


  /* GET SIGNED URL */

  async getSignedUrl(
    bucket,
    path,
    expiresIn = 3600
  ) {

    const { data, error } =
      await supabase.storage
        .from(bucket)
        .createSignedUrl(
          path,
          expiresIn
        );

    if (error) {
      throw error;
    }

    return data.signedUrl;

  },


  /* DELETE FILE */

  async remove(bucket, paths) {

    const { data, error } =
      await supabase.storage
        .from(bucket)
        .remove(
          Array.isArray(paths)
            ? paths
            : [paths]
        );

    if (error) {
      throw error;
    }

    return data;

  }

};


/* =========================================
   DATABASE HELPERS
========================================= */

export const MekaDB = {


  /* SELECT */

  async select(
    table,
    columns = "*",
    options = {}
  ) {

    let query = supabase
      .from(table)
      .select(columns);

    if (options.filters) {

      for (const filter of options.filters) {

        query = query.filter(
          filter.column,
          filter.operator,
          filter.value
        );

      }

    }

    if (options.order) {

      query = query.order(
        options.order.column,
        {
          ascending:
            options.order.ascending ?? false
        }
      );

    }

    if (options.limit) {

      query = query.limit(options.limit);

    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data;

  },


  /* INSERT */

  async insert(table, values) {

    const { data, error } =
      await supabase
        .from(table)
        .insert(values)
        .select();

    if (error) {
      throw error;
    }

    return data;

  },


  /* UPDATE */

  async update(
    table,
    values,
    filters
  ) {

    let query = supabase
      .from(table)
      .update(values);

    for (const filter of filters) {

      query = query.eq(
        filter.column,
        filter.value
      );

    }

    const { data, error } =
      await query.select();

    if (error) {
      throw error;
    }

    return data;

  },


  /* DELETE */

  async delete(table, filters) {

    let query = supabase
      .from(table)
      .delete();

    for (const filter of filters) {

      query = query.eq(
        filter.column,
        filter.value
      );

    }

    const { data, error } =
      await query.select();

    if (error) {
      throw error;
    }

    return data;

  }

};


/* =========================================
   ERROR HANDLER
========================================= */

export function handleSupabaseError(error) {

  console.error(
    "MEKA Supabase:",
    error
  );

  if (!navigator.onLine) {
    return "لا يوجد اتصال بالإنترنت.";
  }

  const message =
    error?.message || "";

  if (message.includes("Invalid login credentials")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  }

  if (message.includes("Email not confirmed")) {
    return "يرجى تأكيد بريدك الإلكتروني أولاً.";
  }

  if (message.includes("User already registered")) {
    return "هذا الحساب مسجل بالفعل.";
  }

  if (message.includes("JWT")) {
    return "انتهت جلسة الدخول. سجل الدخول مرة أخرى.";
  }

  return "حدث خطأ أثناء الاتصال. حاول مرة أخرى.";

}


/* =========================================
   INITIALIZE
========================================= */

MekaConnection.setStatus(
  navigator.onLine
    ? "ready"
    : "offline"
);


/* =========================================
   EXPORT DEFAULT
========================================= */

export default supabase;
