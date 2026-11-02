/* =========================================
   MEKA SERVICE WORKER
   Progressive Web App
========================================= */

"use strict";

const CACHE_NAME = "meka-app-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles.css",
  "./config.js",
  "./supabase.js",
  "./auth.js",
  "./database.js",
  "./chat.js",
  "./social.js",
  "./calls.js",
  "./notifications.js",
  "./app.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable.png"
];


/* =========================================
   INSTALL
========================================= */

self.addEventListener("install", event => {

  event.waitUntil(

    (async () => {

      const cache = await caches.open(CACHE_NAME);

      /*
        نحاول تخزين الملفات الموجودة فقط.
        غياب ملف لم نصل إلى إنشائه بعد
        لن يمنع تثبيت Service Worker.
      */

      await Promise.allSettled(

        APP_SHELL.map(async path => {

          try {

            const response = await fetch(path, {
              cache: "no-cache"
            });

            if (
              response.ok &&
              response.type === "basic"
            ) {

              await cache.put(path, response);

            }

          } catch (error) {

            console.warn(
              "MEKA: لم يتم تخزين الملف:",
              path
            );

          }

        })

      );

      await self.skipWaiting();

    })()

  );

});


/* =========================================
   ACTIVATE
========================================= */

self.addEventListener("activate", event => {

  event.waitUntil(

    (async () => {

      const cacheNames = await caches.keys();

      await Promise.all(

        cacheNames.map(async cacheName => {

          if (
            cacheName.startsWith("meka-app-") &&
            cacheName !== CACHE_NAME
          ) {

            await caches.delete(cacheName);

          }

        })

      );

      await self.clients.claim();

    })()

  );

});


/* =========================================
   NETWORK SECURITY
========================================= */

function shouldBypassCache(request, url) {

  if (request.method !== "GET") {
    return true;
  }

  if (url.origin !== self.location.origin) {
    return true;
  }

  const path = url.pathname.toLowerCase();

  /*
    لا نخزن طلبات تسجيل الدخول أو البيانات
    أو الرسائل أو ملفات المستخدمين الخاصة.
  */

  if (
    path.includes("/auth/") ||
    path.includes("/rest/") ||
    path.includes("/storage/") ||
    path.includes("/realtime/") ||
    path.includes("/functions/")
  ) {

    return true;

  }

  return false;

}


/* =========================================
   NETWORK FIRST
   HTML PAGES
========================================= */

async function handleNavigation(request) {

  const cache = await caches.open(CACHE_NAME);

  try {

    const response = await fetch(request);

    if (
      response &&
      response.ok &&
      response.type === "basic"
    ) {

      await cache.put(
        "./index.html",
        response.clone()
      );

    }

    return response;

  } catch (error) {

    const cachedPage = await cache.match("./index.html");

    if (cachedPage) {
      return cachedPage;
    }

    return new Response(

      `<!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>MEKA</title>
      <body style="background:#071c18;color:white;font-family:Arial;text-align:center;padding:50px">
      <h2>MEKA</h2>
      <p>لا يوجد اتصال بالإنترنت حاليًا.</p>
      <p>تحقق من اتصالك وحاول مرة أخرى.</p>
      </body>
      </html>`,

      {
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        }
      }

    );

  }

}


/* =========================================
   STATIC FILES
========================================= */

async function handleStaticFile(request) {

  const cache = await caches.open(CACHE_NAME);

  try {

    const response = await fetch(request);

    if (
      response &&
      response.ok &&
      response.type === "basic"
    ) {

      await cache.put(
        request,
        response.clone()
      );

    }

    return response;

  } catch (error) {

    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(
      "الملف غير متاح حاليًا. تحقق من اتصال الإنترنت.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      }
    );

  }

}


/* =========================================
   FETCH
========================================= */

self.addEventListener("fetch", event => {

  const request = event.request;

  let url;

  try {

    url = new URL(request.url);

  } catch (error) {

    return;

  }

  if (shouldBypassCache(request, url)) {
    return;
  }

  if (request.mode === "navigate") {

    event.respondWith(
      handleNavigation(request)
    );

    return;

  }

  event.respondWith(
    handleStaticFile(request)
  );

});


/* =========================================
   UPDATE COMMUNICATION
========================================= */

self.addEventListener("message", event => {

  if (!event.data) return;

  if (event.data.type === "MEKA_SKIP_WAITING") {

    self.skipWaiting();

  }

});


/* =========================================
   NOTIFICATION CLICK
========================================= */

self.addEventListener("notificationclick", event => {

  event.notification.close();

  event.waitUntil(

    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clients => {

      for (const client of clients) {

        if ("focus" in client) {

          return client.focus();

        }

      }

      return self.clients.openWindow("./");

    })

  );

});
