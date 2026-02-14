const CACHE_VERSION = "bredy-pwa-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-image`;
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/images/pwa/icon-192.png",
  "/images/pwa/icon-512.png",
];

// 앱 쉘/오프라인 기본 자산을 선캐시한다.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// API 요청은 항상 네트워크 우선으로 두고, 정적 리소스만 캐시 전략을 적용한다.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.destination === "style" || request.destination === "script") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

// 클라이언트에서 SW 즉시 교체를 요청할 때 사용한다.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 서버에서 전달한 payload를 읽어 브라우저 알림으로 표시한다.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "Bredy 알림",
    body: "새 알림이 도착했습니다.",
    url: "/",
    tag: "default",
  };

  try {
    const parsed = event.data.json();
    const notification =
      parsed && typeof parsed === "object" && parsed.notification
        ? parsed.notification
        : {};
    const data =
      parsed && typeof parsed === "object" && parsed.data ? parsed.data : {};
    payload = {
      title: data.title || notification.title || parsed.title || payload.title,
      body: data.body || notification.body || parsed.body || payload.body,
      url:
        data.url ||
        notification.click_action ||
        parsed.url ||
        payload.url,
      tag: data.tag || notification.tag || parsed.tag || payload.tag,
    };
  } catch (error) {
    console.error("Push payload parse failed:", error);
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/images/pwa/icon-192.png",
      badge: "/images/pwa/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawTargetUrl = event.notification.data?.url || "/";
  const targetUrl = new URL(rawTargetUrl, self.location.origin).toString();

  // 1) 이미 해당 페이지가 열려 있으면 포커스
  // 2) 같은 오리진 탭이 있으면 그 탭을 해당 URL로 이동
  // 3) 없으면 새 창으로 열기
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    const exactClient = clients.find((client) => client.url === targetUrl);
    if (exactClient) {
      await exactClient.focus();
      return;
    }

    const sameOriginClient = clients.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });

    if (sameOriginClient) {
      await sameOriginClient.focus();
      if ("navigate" in sameOriginClient) {
        await sameOriginClient.navigate(targetUrl);
      }
      return;
    }

    await self.clients.openWindow(targetUrl);
  })());
});
