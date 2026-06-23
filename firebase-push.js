/* ============================================================
   Firebase Cloud Messaging — client setup (ES module)
   ------------------------------------------------------------
   Load this from index.html with:
     <script type="module" src="firebase-push.js"></script>

   It: initializes Firebase, asks for notification permission,
   gets an FCM token (the "address" of this device), and shows
   foreground messages. Send the token to your server / Firestore
   so a Cloud Function can push to it later.

   Fill in YOUR config + VAPID key below.
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

// Firebase console > Project settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = 'YOUR_PUBLIC_VAPID_KEY';

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Call this from a user gesture (e.g. the "Enable reminders" toggle).
export async function enablePush() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    // Register the FCM service worker explicitly so we control its scope.
    const swReg = await navigator.serviceWorker.register('firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (token) {
      console.log('FCM token:', token);
      // TODO: send `token` to your backend / Firestore so you can push to it.
      localStorage.setItem('fcm-token', token);
      return token;
    }
    console.warn('No registration token available.');
    return null;
  } catch (err) {
    console.error('enablePush failed:', err);
    return null;
  }
}

// Foreground messages (app open & focused) don't auto-show a notification,
// so we display one ourselves.
onMessage(messaging, (payload) => {
  const title = (payload.notification && payload.notification.title) || 'Time to drink water 💧';
  const body = (payload.notification && payload.notification.body) || 'Take a sip!';
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((reg) =>
      reg.showNotification(title, { body, icon: 'icons/icon.svg', badge: 'icons/icon.svg' })
    );
  }
});

// Expose for quick wiring from app.js (optional).
window.enablePush = enablePush;
