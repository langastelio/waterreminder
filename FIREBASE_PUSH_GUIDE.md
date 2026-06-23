# 🔔 Full Guide: Firebase Push Notifications for the Water Reminder PWA

This guide adds **real push notifications** — the kind that fire even when the app is
**closed** — using **Firebase Cloud Messaging (FCM)**. This is the proper fix for the
"reminders only fire while the app is open" limitation of the current in-page timer.

---

## 0. How it works (the mental model)

Web push has **two halves**:

```
   [ Your PWA on the phone ]                    [ Firebase / your server ]
   1. Ask permission                            
   2. Get an FCM "token" (device address)  ───►  3. Store the token
                                                  4. A scheduled job sends a push
   6. Service worker wakes up, shows   ◄───────  5. FCM delivers to the device
      the notification (even if app closed)
```

- The **client** (your app) can only *receive*. It cannot schedule its own background
  push — phones suspend the JS timer once the app closes.
- To actually *send* a reminder on a schedule, you need a **server-side trigger**. The
  easiest is a **Firebase Cloud Function** running on a schedule (covered in Part B).

**Hard requirement:** push only works over **HTTPS** (or `http://localhost`). Plain
`http://192.168.x.x` will NOT work. The simplest hosting is **Firebase Hosting** (free,
HTTPS by default) — see Part C.

---

# PART A — Client setup (receive push)

## Step 1 — Create a Firebase project
1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it e.g. `water-reminder`, accept defaults, create.

## Step 2 — Register a Web app & copy the config
1. In the project, click the **`</>` (Web)** icon to "Add app to get started".
2. Give it a nickname (e.g. `water-pwa`). **Don't** enable Firebase Hosting yet (optional).
3. Firebase shows a `firebaseConfig` object — **copy it**. It looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "water-reminder.firebaseapp.com",
     projectId: "water-reminder",
     storageBucket: "water-reminder.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   ```

## Step 3 — Enable Cloud Messaging & get the VAPID key
1. **Project settings** (gear icon) → **Cloud Messaging** tab.
2. Under **Web configuration → Web Push certificates**, click **Generate key pair**.
3. Copy the **public key** string — this is your **VAPID key**.

## Step 4 — Fill in the two template files (already scaffolded)
This repo already contains two starter files — just replace the placeholders:

| File | Replace |
|------|---------|
| [`firebase-messaging-sw.js`](firebase-messaging-sw.js) | the `firebaseConfig` object |
| [`firebase-push.js`](firebase-push.js) | the `firebaseConfig` object **and** `VAPID_KEY` |

> ⚠️ These values (apiKey etc.) are **safe to expose** in client code — they identify the
> project, they are not secrets. Security is enforced by Firebase rules, not by hiding them.

## Step 5 — Load the client script from `index.html`
Add this near the bottom of `<body>` in [index.html](index.html), after `app.js`:
```html
<script type="module" src="firebase-push.js"></script>
```

## Step 6 — Trigger `enablePush()` from a user gesture
Browsers only allow the permission prompt from a tap. Wire it to the existing
**"Enable reminders"** toggle. In [app.js](app.js), inside the settings **Save** handler,
after computing `settings.remind`:
```js
if (settings.remind && window.enablePush) {
  const token = await window.enablePush();   // asks permission + gets FCM token
  // optionally: send `token` to your backend / Firestore here
}
```
(`enablePush` is exposed on `window` by `firebase-push.js`.)

## Step 7 — Test from the Firebase Console (no server needed yet)
1. Run the app over HTTPS or `localhost` and tap **Enable reminders** → allow.
2. Open the browser console — copy the printed **FCM token** (also saved to
   `localStorage` as `fcm-token`).
3. Firebase console → **Messaging** → **Create your first campaign** → **Firebase
   Notification messages** → **Send test message**.
4. Paste the token → **Test**. You should get a notification — try it with the app
   **closed** to confirm background delivery. ✅

If that works, the client half is done.

---

# PART B — Server setup (send reminders on a schedule)

To send the periodic "time to drink" reminders automatically you need a server-side
trigger. The cleanest option is a **scheduled Cloud Function**.

## Step 1 — Save device tokens (so you know who to push)
When `enablePush()` returns a token, write it to **Firestore**. Add to `firebase-push.js`
(or app.js) using the Firestore SDK:
```js
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const db = getFirestore(app);
// after getting `token`:
await setDoc(doc(db, 'devices', token), {
  token,
  goalMet: false,
  updatedAt: Date.now()
});
```

## Step 2 — Install the Firebase CLI & init Functions
```bash
npm install -g firebase-tools
firebase login
firebase init functions        # choose your project, JavaScript, install deps
```

## Step 3 — Write a scheduled function
In `functions/index.js`:
```js
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

// Runs every hour between 08:00–22:00 (adjust the cron as you like)
exports.waterReminder = onSchedule('every 60 minutes from 08:00 to 22:00', async () => {
  const db = getFirestore();
  const snap = await db.collection('devices').get();
  const tokens = snap.docs.map((d) => d.data().token).filter(Boolean);
  if (!tokens.length) return;

  await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: 'Time to drink water 💧',
      body: 'Take a sip and stay hydrated!'
    },
    webpush: {
      fcmOptions: { link: 'https://YOUR_DOMAIN/index.html' }
    }
  });
});
```

## Step 4 — Deploy
```bash
firebase deploy --only functions
```
> Scheduled (v2) functions use Cloud Scheduler, which requires the project on the
> **Blaze (pay-as-you-go)** plan. For this tiny app the cost is effectively **$0** —
> well within the free allowances — but a billing account must be attached.

### Smarter reminders (optional)
- Have the app write `goalMet: true` to its `devices/{token}` doc when the daily goal is
  reached, then skip those tokens in the function.
- Store each device's preferred interval / quiet hours and branch on them.
- Clean up tokens that FCM reports as invalid (check the `sendEachForMulticast` response
  and delete failed tokens).

---

# PART C — Hosting over HTTPS (required for push)

Firebase Hosting is the easiest HTTPS host and pairs naturally with FCM.

```bash
firebase init hosting     # set public dir to "." (this folder), single-page: No
firebase deploy --only hosting
```
You'll get a URL like `https://water-reminder.web.app`. Install the PWA from there and
push will work end-to-end. (GitHub Pages / Netlify also work — any HTTPS host is fine; you
just won't get Cloud Functions there.)

---

## Coexistence with the existing service worker
- Your current [sw.js](sw.js) handles **offline caching**.
- `firebase-messaging-sw.js` handles **push**.
- They can both be registered and run side by side — FCM specifically looks for the file
  named `firebase-messaging-sw.js` at the root, so don't rename it.

## Platform caveats
- **Android / Chrome:** full support, background push works great.
- **iOS / Safari:** web push works **only for PWAs installed to the Home Screen**
  (iOS 16.4+). The user must "Add to Home Screen" first; push won't work in the Safari tab.
- **Desktop Chrome/Edge/Firefox:** supported.

## Troubleshooting
| Symptom | Likely cause |
|--------|--------------|
| No token / `messaging/permission-blocked` | Notifications denied, or not on HTTPS/localhost |
| Token works in console but no scheduled push | Function not deployed, or project not on Blaze |
| Nothing on iOS | App not installed to Home Screen, or iOS < 16.4 |
| `failed-service-worker-registration` | `firebase-messaging-sw.js` not at site root / wrong path |
| Works open, not closed | You're showing via `onMessage` only — background needs the SW `onBackgroundMessage` (already in the template) |

---

## Quick checklist
- [ ] Firebase project created
- [ ] Web app registered, `firebaseConfig` copied
- [ ] VAPID key generated
- [ ] `firebase-messaging-sw.js` + `firebase-push.js` filled in
- [ ] `firebase-push.js` loaded in `index.html`
- [ ] `enablePush()` wired to the reminders toggle
- [ ] Tested with "Send test message" (app closed)
- [ ] (Optional) Tokens saved to Firestore
- [ ] (Optional) Scheduled Cloud Function deployed on Blaze
- [ ] Hosted over HTTPS
