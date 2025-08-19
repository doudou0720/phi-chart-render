const CACHE_NAME = 'phi-chart-render-v1';
const CDN_CACHE_NAME = 'phi-chart-render-cdn-v1';
const CDN_CONFIG = <%= CDN_CONFIG %>;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/src/index.js',
        // 其他核心资源
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 保留当前缓存，删除其他缓存
          if (cacheName !== CACHE_NAME && cacheName !== CDN_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // CDN资源缓存策略
  const isCDNResource = CDN_CONFIG.modules.some(module => 
    event.request.url.includes(`${module.name}@${module.version}`)
  );
  
  if (isCDNResource) {
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;
        
        try {
          const fetchResponse = await fetch(event.request);
          if (fetchResponse.ok) {
            cache.put(event.request, fetchResponse.clone());
          }
          return fetchResponse;
        } catch (e) {
          // 如果CDN请求失败，尝试返回本地资源
          return caches.match(event.request);
        }
      })
    );
    return;
  }
  // 普通资源缓存策略
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // 不缓存HTML以避免更新问题
        if (!event.request.url.endsWith('.html')) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchResponse);
          });
        }
        return fetchResponse.clone();
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});