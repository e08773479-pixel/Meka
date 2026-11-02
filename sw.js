const CACHE_NAME = "meka-shell-v1";

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
  "./app.js"
];


/* تثبيت Service Worker */
self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())

  );

});


/* تفعيل النسخة الجديدة */
self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys().then(keys => {

      return Promise.all(

        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))

      );

    }).then(() => self.clients.claim())

  );

});


/* التعامل مع الطلبات */
self.addEventListener("fetch", event => {

  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
    لا نخزن طلبات Supabase أو بيانات المستخدمين.
    الاتصال وقاعدة البيانات يظلان عبر الشبكة.
  */

  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.includes("/rest/") ||
    url.pathname.includes("/auth/") ||
    url.pathname.includes("/storage/")
  ) {
    return;
  }


  /*
    لا نتدخل في روابط خارجية.
  */

  if (url.origin !== self.location.origin) {
    return;
  }


  /*
    صفحات التطبيق:
    نحاول الشبكة أولًا، ثم نستخدم النسخة المخزنة.
  */

  if (request.mode === "navigate") {

    event.respondWith(

      fetch(request)
        .then(response => {

          if (response && response.ok) {

            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put("./index.html", copy));

          }

          return response;

        })
        .catch(() => {

          return caches.match("./index.html");

        })

    );

    return;

  }


  /*
    الملفات الثابتة:
    الكاش أولًا ثم الشبكة.
  */

  event.respondWith(

    caches.match(request).then(cachedResponse => {

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then(response => {

        if (
          response &&
          response.ok &&
          response.type === "basic"
        ) {

          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));

        }

        return response;

      });

    })

  );

});


/* استقبال أمر تحديث التطبيق */
self.addEventListener("message", event => {

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

});
