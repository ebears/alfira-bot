self.registration.unregister().then(() => {
  console.log('[SW] Unregistered stale service worker');
});
