// Minimal service worker: needed so the browser treats the app as installable.
// It does not cache anything - every request goes straight to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Intentionally empty: default browser network behaviour is kept.
});
