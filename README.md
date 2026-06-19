# 💧 Water Reminder — PWA

A lightweight **Progressive Web App** that reminds you to drink water, tracks your daily
intake, and shows your hydration trend over time. Built with plain **HTML, CSS, and
JavaScript** — no frameworks, no build step, no backend. All data lives **locally on the
device** and the app works fully **offline** once installed.

---

## 1. Overview

The app is designed for **mobile phones** (installable to the home screen like a native
app). It centers on a single goal: help the user reach a daily water target by making
logging fast and progress visual.

- **No account, no server, no internet required** after first load.
- **All information is stored locally** in the browser via `localStorage`.
- **Installable PWA** — runs standalone, full-screen, with its own icon.

---

## 2. Core Features

### 🌊 Splash Screen (4 seconds)
On launch the app shows a branded intro screen — a floating water-drop logo, the app
title, a tagline, and a progress bar that fills over exactly **4 seconds** before fading
into the main app.

### 💧 Today View (Home)
- A large **teardrop gauge** that fills with an animated water wave as you drink, showing
  `current / goal` in millilitres.
- A round **“+” button** for a quick 200 ml log.
- **Quick-add chips** — `+100ml`, `+200ml`, `+300ml`, `+500ml`.
- A **Daily Record** list of every drink logged today (time + amount), each removable.
- A celebratory notification when the daily goal is reached. 🎉

### 📊 History & Trend View
Accessed via the bottom tab bar:
- **Stat cards** — average intake per day, best day, and current **goal streak**
  (consecutive days the goal was met).
- **Last 7 days bar chart** — one bar per day; bars turn **green** when the goal was met,
  and today is labelled “Today”.
- **Daily totals list** — every recorded day, newest first, with a progress bar,
  amount-vs-goal, and a ✅ “Goal met” badge.

### 👋 Onboarding (first launch)
On the very first launch, after the splash screen, a one-time setup card asks for the
user's **name**, **daily goal** (with quick presets), and **reminder** preferences. After
that it never shows again (tracked by an `onboarded` flag in settings). The name powers a
time-aware greeting ("Good morning, Carlos!").

### 🌗 Dark mode & theming
A **Theme** setting offers **System (auto)**, **Light**, and **Dark**. In System mode the
app follows the OS color scheme live via `prefers-color-scheme`, and the status-bar
`theme-color` updates to match.

### 🔔 Reminders & Settings
A settings sheet (bell icon) lets the user:
- Set the **daily goal** (ml).
- Toggle **reminders** on/off (uses Web Notifications).
- Set the **reminder interval** (minutes).
- **Reset today’s record.**

When reminders are on, the app periodically notifies the user to drink until the daily
goal is met.

**Sound & vibration:** notifications fire with the device's default notification sound,
a vibration pattern (`[200,100,200]` on supported phones), and an in-app WebAudio "ding"
that plays even if the OS notification sound is muted. (The in-app sound needs one tap to
"unlock" audio first, per browser autoplay rules.)

**⚠️ Background limitation:** reminders run on an in-page timer, so the recurring
"time to drink" reminder only fires while the app is **open / in the foreground**. When
the PWA is fully closed, the OS suspends the timer. Reliable background or scheduled
reminders would require the **Push API + a push server** (out of scope for this
offline-only build).

---

## 3. How Data Is Stored (Local Only)

Everything is kept in the browser’s `localStorage` — nothing is uploaded anywhere.

| Key | Contents |
|-----|----------|
| `water-settings` | `{ goal, remind, interval }` — user preferences |
| `water-YYYY-M-D` | An array of that day’s drinks: `[{ id, amount, time }, ...]` |

- Each calendar day gets its **own key**, so a new day starts fresh automatically.
- The History view is built by **scanning all `water-*` keys**, summing each day, and
  charting/listing the results.
- Because storage is per-device, clearing browser data or uninstalling the PWA removes
  the history.

---

## 4. Progressive Web App (PWA) Capabilities

- **`manifest.json`** — defines the app name, icon, theme color, and standalone display
  so it can be **installed to the home screen**.
- **`sw.js` (service worker)** — caches all assets on install, serves them offline, and
  handles notification clicks (re-focuses or opens the app).
- **Mobile-first design** — safe-area padding for notches, fixed bottom tab bar, no
  zoom/scroll bounce, touch-friendly targets.

---

## 5. File Structure

```
water reminder app/
├── index.html      → markup: splash, home view, history view, tab bar, settings sheet
├── styles.css      → blue mobile theme, animations, chart, tab bar, splash
├── app.js          → all logic: logging, storage, history, chart, reminders, splash
├── manifest.json   → PWA install metadata
├── sw.js           → service worker (offline cache + notifications)
├── icons/
│   └── icon.svg    → app icon
└── README.md       → this document
```

---

## 6. How It Works (Flow)

1. **Launch** → 4-second splash → main app.
2. **Log water** (button or chips) → record saved to today’s `localStorage` key → the
   teardrop gauge fills and the daily list updates instantly.
3. **Goal reached** → celebration notification.
4. **Reminders** (if enabled) → periodic “time to drink” notifications until the goal is
   met.
5. **History tab** → reads every stored day → renders stats, a 7-day trend chart, and the
   full daily-totals list.

---

## 7. Running the App

A service worker requires an `http://` origin (it won’t register from `file://`):

```powershell
cd "C:\Users\A267829\OneDrive - Standard Bank\Desktop\Automation\watter reminder app"
python -m http.server 8000
```

- **On this PC:** open `http://localhost:8000`
- **On your phone (same Wi-Fi):** run `ipconfig`, take the IPv4 address (e.g.
  `192.168.x.x`), then open `http://192.168.x.x:8000` and choose **“Add to Home Screen.”**

> Note: phone push notifications need an **HTTPS** origin (or `localhost`). On a plain
> `http://192.168.x.x` address everything works except OS-level notifications — for full
> notification testing, host the folder on any HTTPS static host (GitHub Pages, Netlify,
> etc.).

---

## 8. Technology Summary

| Aspect | Choice |
|--------|--------|
| Languages | HTML, CSS, vanilla JavaScript |
| Frameworks | None |
| Data storage | `localStorage` (on-device) |
| Offline | Service worker cache |
| Platform | Mobile-first PWA, installable |
| Backend | None (fully client-side) |
