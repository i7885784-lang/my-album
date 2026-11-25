self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const url = new URL("/photos", self.location.origin).href;
      if (windows.length) {
        await windows[0].navigate(url);
        await windows[0].focus();
      } else await self.clients.openWindow(url);
    })(),
  );
});
