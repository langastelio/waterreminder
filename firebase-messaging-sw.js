/* ============================================================
   Firebase Cloud Messaging service worker
   ------------------------------------------------------------
   This file MUST live at the ROOT of your site and be named
   exactly "firebase-messaging-sw.js" — FCM looks for it there.
   It runs separately from your existing sw.js (offline cache).

   1. Replace the firebaseConfig values below with YOUR project's
      config (Firebase console > Project settings > General).
   2. The compat SDK is used here because service workers cannot
      use ES module imports the same way.
   ============================================================ */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
});

const messaging = firebase.messaging();

// Fired when a push arrives while the app is in the BACKGROUND / closed.
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Time to drink water 💧';
  const options = {
    body: (payload.notification && payload.notification.body) || 'Take a sip and stay hydrated!',
    icon: 'icons/icon.svg',
    badge: 'icons/icon.svg',
    vibrate: [200, 100, 200],
    tag: 'water-reminder',
    renotify: true,
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});

// Focus or open the app when the notification is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
