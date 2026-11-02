import { MEKA_CONFIG } from "./config.js";

let supabaseClient = null;

let initializationPromise = null;


/* التأكد من تحميل مكتبة Supabase */
async function loadSupabaseLibrary() {

  if (window.supabase?.createClient) {
    return window.supabase;
  }

  try {

    const module = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );

    if (module.createClient) {
      return module;
    }

    throw new Error("Supabase createClient غير متاح.");

  } catch (error) {

    console.error("MEKA Supabase library error:", error);

    throw new Error(
      "تعذر تحميل مكتبة الاتصال بقاعدة البيانات. تحقق من الإنترنت."
    );

  }

}


/* إنشاء الاتصال */
export async function initializeSupabase() {

  if (supabaseClient) {
    return supabaseClient;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {

    const library = await loadSupabaseLibrary();

    const createClient = library.createClient;

    supabaseClient = createClient(
      MEKA_CONFIG.SUPABASE_URL,
      MEKA_CONFIG.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: "pkce"
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

    return supabaseClient;

  })();

  try {

    return await initializationPromise;

  } catch (error) {

    initializationPromise = null;

    throw error;

  }

}


/* الوصول إلى العميل بعد التهيئة */
export function getSupabase() {

  if (!supabaseClient) {

    throw new Error(
      "اتصال Supabase لم يتم تهيئته بعد. استدعِ initializeSupabase أولًا."
    );

  }

  return supabaseClient;

}


/* فحص جلسة المستخدم */
export async function getCurrentSession() {

  const client = getSupabase();

  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session ?? null;

}


/* بيانات المستخدم الحالي */
export async function getCurrentUser() {

  const client = getSupabase();

  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user ?? null;

}


/* مراقبة تغييرات تسجيل الدخول */
export function onAuthStateChange(callback) {

  const client = getSupabase();

  return client.auth.onAuthStateChange(
    (event, session) => {

      try {
        callback(event, session);
      } catch (error) {
        console.error("MEKA auth listener error:", error);
      }

    }
  );

}


/* إنهاء الاتصال المحلي بالجلسة */
export async function signOutFromSupabase() {

  const client = getSupabase();

  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }

}


/* اختبار الاتصال بالخدمة */
export async function testSupabaseConnection() {

  const client = getSupabase();

  const { error } = await client
    .from("platform_settings")
    .select("*")
    .limit(1);

  if (error) {

    console.error("MEKA database test failed:", error);

    throw error;

  }

  return true;

}
