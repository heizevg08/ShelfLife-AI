self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith('shelflifeai-pwa-')).map(name => caches.delete(name)),
  )));
});
