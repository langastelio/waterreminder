// ---------- State ----------
const DEFAULTS = {
  goal: 1600, remind: false, interval: 60, name: '', theme: 'system', onboarded: false,
  weight: '', activity: '1.12', climate: '1'
};

const keyForDate = (d) => `water-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const todayKey = () => keyForDate(new Date());

let settings = loadSettings();
let records = loadRecords();
let reminderTimer = null;

// ---------- Elements ----------
const el = (id) => document.getElementById(id);
const waveEl = el('wave');
const currentEl = el('current');
const goalEl = el('goal');
const listEl = el('recordList');
const emptyEl = el('emptyState');
const overlay = el('sheetOverlay');

// ---------- Storage ----------
function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('water-settings')) }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettingsStore() {
  localStorage.setItem('water-settings', JSON.stringify(settings));
}
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(todayKey())) || []; }
  catch { return []; }
}
function saveRecords() {
  localStorage.setItem(todayKey(), JSON.stringify(records));
}

// ---------- Theme ----------
function resolveTheme() {
  if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
  const m = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  return m && m.matches ? 'dark' : 'light';
}
function applyTheme() {
  const t = resolveTheme();
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'dark' ? '#0f1b2d' : '#3ea0f7';
}
// React to OS theme changes while in "system" mode
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (settings.theme === 'system') applyTheme();
  });
}

// ---------- Greeting ----------
function updateGreeting() {
  const g = el('greeting');
  if (!g) return;
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  g.textContent = settings.name ? `${part}, ${settings.name}!` : 'Have a good day!';
}

// ---------- Render ----------
function total() {
  return records.reduce((s, r) => s + r.amount, 0);
}

function render() {
  const sum = total();
  currentEl.textContent = sum;
  goalEl.textContent = settings.goal;

  const pct = Math.min(100, (sum / settings.goal) * 100);
  waveEl.style.height = pct + '%';

  // list (newest first)
  listEl.innerHTML = '';
  if (records.length === 0) {
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    [...records].reverse().forEach((r) => {
      const li = document.createElement('li');
      li.className = 'record-item';
      li.innerHTML = `
        <span class="icon">${r.amount >= 300 ? '🥛' : '🥤'}</span>
        <div class="info">
          <div class="time">${r.time}</div>
          <div class="desc">Drink a cup of water</div>
        </div>
        <span class="amt">${r.amount}ml</span>
        <button class="del" data-id="${r.id}" aria-label="Delete">✕</button>`;
      listEl.appendChild(li);
    });
  }
}

// ---------- Actions ----------
function addWater(amount) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  records.push({ id: Date.now() + Math.random(), amount, time });
  saveRecords();
  render();
  celebrate();
  if (total() >= settings.goal) {
    notify('Goal reached! 🎉', `You drank ${total()}ml today. Great job!`);
  }
}

function deleteRecord(id) {
  records = records.filter((r) => String(r.id) !== String(id));
  saveRecords();
  render();
}

function celebrate() {
  const drop = document.getElementById('drop');
  drop.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }],
    { duration: 300, easing: 'ease-out' }
  );
}

// ---------- In-app sound (WebAudio) ----------
// A short "ding" that works while the app is open, even if the OS
// notification sound is muted. Audio must be "unlocked" by a user
// gesture first (browser autoplay policy), which we do on first tap.
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* ignore */ }
}
function playDing() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    // two soft "water drop" notes
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch (e) { /* ignore */ }
}

// ---------- Notifications / reminders ----------
function notify(title, body) {
  // In-app cues (work whenever the app is open)
  playDing();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = {
    body,
    icon: 'icons/icon.svg',
    badge: 'icons/icon.svg',
    silent: false,
    vibrate: [200, 100, 200],
    tag: 'water-reminder',
    renotify: true
  };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts));
    } else {
      new Notification(title, opts);
    }
  } catch (e) { /* ignore */ }
}

function startReminders() {
  clearInterval(reminderTimer);
  if (!settings.remind) return;
  const ms = Math.max(15, settings.interval) * 60 * 1000;
  reminderTimer = setInterval(() => {
    if (total() < settings.goal) {
      notify('Time to drink water 💧', `You're at ${total()}/${settings.goal}ml. Take a sip!`);
    }
  }, ms);
}

async function ensurePermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

// ---------- Smart goal calculator ----------
// Baseline ~35 ml per kg of body weight, scaled by activity and climate.
// Result is clamped to a sensible range and rounded to the nearest 50 ml.
function suggestGoal(weight, activity, climate) {
  const ml = weight * 35 * activity * climate;
  return Math.min(5000, Math.max(1000, Math.round(ml / 50) * 50));
}

// ---------- Settings sheet ----------
function openSheet() {
  el('nameInput').value = settings.name;
  el('themeSelect').value = settings.theme;
  el('goalInput').value = settings.goal;
  el('remindToggle').checked = settings.remind;
  el('intervalInput').value = settings.interval;
  el('calcWeight').value = settings.weight;
  el('calcActivity').value = settings.activity;
  el('calcClimate').value = settings.climate;
  el('calcResult').hidden = true;
  overlay.classList.add('open');
}
function closeSheet() { overlay.classList.remove('open'); }

// ---------- Events ----------
// Unlock audio on the first interaction anywhere (needed so the reminder
// timer can play a sound later without a direct user gesture).
window.addEventListener('pointerdown', unlockAudio, { once: true });

el('addBtn').addEventListener('click', () => addWater(200));

document.querySelectorAll('.chip').forEach((c) =>
  c.addEventListener('click', () => addWater(parseInt(c.dataset.amount, 10)))
);

listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.del');
  if (btn) deleteRecord(btn.dataset.id);
});

el('bellBtn').addEventListener('click', openSheet);

el('calcBtn').addEventListener('click', () => {
  const weight = parseFloat(el('calcWeight').value);
  const result = el('calcResult');
  if (!weight || weight < 20) {
    result.innerHTML = 'Enter a valid weight to get a suggestion.';
    result.hidden = false;
    return;
  }
  const goal = suggestGoal(weight, parseFloat(el('calcActivity').value), parseFloat(el('calcClimate').value));
  el('goalInput').value = goal;
  result.innerHTML = `Suggested daily goal: <b>${goal}ml</b> 💧<br><small>Applied to the field above — tap Save to keep it.</small>`;
  result.hidden = false;
});

overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });

el('saveSettings').addEventListener('click', async () => {
  settings.name = el('nameInput').value.trim().slice(0, 24);
  settings.theme = el('themeSelect').value;
  settings.goal = Math.max(200, parseInt(el('goalInput').value, 10) || DEFAULTS.goal);
  settings.interval = Math.max(15, parseInt(el('intervalInput').value, 10) || DEFAULTS.interval);
  settings.weight = el('calcWeight').value;
  settings.activity = el('calcActivity').value;
  settings.climate = el('calcClimate').value;
  const wantRemind = el('remindToggle').checked;
  settings.remind = wantRemind ? await ensurePermission() : false;
  saveSettingsStore();
  applyTheme();
  updateGreeting();
  startReminders();
  render();
  closeSheet();
});

el('resetDay').addEventListener('click', () => {
  records = [];
  saveRecords();
  render();
  closeSheet();
});

// ---------- History (local) ----------
// Collect every stored day -> { date: Date, total: number }
function allDays() {
  const days = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('water-') || k === 'water-settings') continue;
    const parts = k.split('-'); // ['water', Y, M, D]
    if (parts.length !== 4) continue;
    const date = new Date(+parts[1], +parts[2] - 1, +parts[3]);
    let recs;
    try { recs = JSON.parse(localStorage.getItem(k)) || []; } catch { recs = []; }
    const sum = recs.reduce((s, r) => s + (r.amount || 0), 0);
    days.push({ date, total: sum, key: k });
  }
  days.sort((a, b) => a.date - b.date);
  return days;
}

function totalForDate(d) {
  try {
    const recs = JSON.parse(localStorage.getItem(keyForDate(d))) || [];
    return recs.reduce((s, r) => s + (r.amount || 0), 0);
  } catch { return 0; }
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function renderHistory() {
  const goal = settings.goal;

  // --- Last 7 days chart (includes today, fills empty days with 0) ---
  const last7 = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    last7.push({ date: d, total: totalForDate(d) });
  }
  const maxVal = Math.max(goal, ...last7.map((x) => x.total), 1);
  const chart = el('chart');
  chart.innerHTML = last7.map((x, idx) => {
    const h = Math.round((x.total / maxVal) * 100);
    const met = x.total >= goal && goal > 0;
    const isToday = idx === 6;
    return `
      <div class="bar-col">
        <span class="bar-val">${x.total || ''}</span>
        <div class="bar-track">
          <div class="bar ${met ? 'goal-met' : ''}" style="height:${Math.max(h, x.total ? 4 : 0)}%"></div>
        </div>
        <span class="bar-day ${isToday ? 'today' : ''}">${isToday ? 'Today' : DOW[x.date.getDay()]}</span>
      </div>`;
  }).join('');

  // --- Stats across all logged days ---
  const days = allDays().filter((d) => d.total > 0);
  const sum = days.reduce((s, d) => s + d.total, 0);
  const avg = days.length ? Math.round(sum / days.length) : 0;
  const best = days.reduce((m, d) => Math.max(m, d.total), 0);

  // streak: consecutive days up to today meeting goal
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    if (totalForDate(d) >= goal && goal > 0) streak++;
    else break;
  }

  el('statAvg').textContent = avg;
  el('statBest').textContent = best;
  el('statStreak').textContent = streak;

  // --- Daily totals list (newest first) ---
  const listEl2 = el('historyList');
  const emptyH = el('historyEmpty');
  const sorted = days.slice().sort((a, b) => b.date - a.date);
  if (sorted.length === 0) {
    listEl2.innerHTML = '';
    emptyH.style.display = 'block';
    return;
  }
  emptyH.style.display = 'none';
  listEl2.innerHTML = sorted.map((d) => {
    const met = d.total >= goal && goal > 0;
    const pct = Math.min(100, Math.round((d.total / goal) * 100));
    const label = d.date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    return `
      <li class="history-item">
        <span class="h-icon">${met ? '✅' : '💧'}</span>
        <div class="h-info">
          <div class="h-date">${label}${met ? '<span class="badge-met">Goal met</span>' : ''}</div>
          <div class="h-bar"><span style="width:${pct}%"></span></div>
        </div>
        <span class="h-amt">${d.total}<small>/${goal}ml</small></span>
      </li>`;
  }).join('');
}

// ---------- Tabs ----------
function switchView(name) {
  el('homeView').hidden = name !== 'home';
  el('historyView').hidden = name !== 'history';
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.view === name)
  );
  if (name === 'history') renderHistory();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => switchView(t.dataset.view))
);

const bell2 = el('bellBtn2');
if (bell2) bell2.addEventListener('click', openSheet);

// ---------- Onboarding (first launch) ----------
function showOnboarding() {
  const ob = el('onboarding');
  el('obName').value = settings.name || '';
  el('obGoal').value = settings.goal;
  el('obInterval').value = settings.interval;
  el('obRemind').checked = settings.remind;
  markPreset(settings.goal);
  ob.hidden = false;
}
function markPreset(goal) {
  document.querySelectorAll('#obPresets button').forEach((b) =>
    b.classList.toggle('active', +b.dataset.goal === +goal)
  );
}
document.querySelectorAll('#obPresets button').forEach((b) =>
  b.addEventListener('click', () => {
    el('obGoal').value = b.dataset.goal;
    markPreset(b.dataset.goal);
  })
);
el('obGoal').addEventListener('input', (e) => markPreset(e.target.value));

el('obFinish').addEventListener('click', async () => {
  unlockAudio();
  settings.name = el('obName').value.trim().slice(0, 24);
  settings.goal = Math.max(200, parseInt(el('obGoal').value, 10) || DEFAULTS.goal);
  settings.interval = Math.max(15, parseInt(el('obInterval').value, 10) || DEFAULTS.interval);
  settings.remind = el('obRemind').checked ? await ensurePermission() : false;
  settings.onboarded = true;
  saveSettingsStore();
  updateGreeting();
  startReminders();
  render();
  el('onboarding').hidden = true;
});

// ---------- Splash (4s) ----------
window.addEventListener('load', () => {
  const splash = el('splash');
  if (!splash) {
    if (!settings.onboarded) showOnboarding();
    return;
  }
  setTimeout(() => splash.classList.add('hide'), 4000);
  setTimeout(() => {
    splash.remove();
    if (!settings.onboarded) showOnboarding();
  }, 4600);
});

// ---------- PWA service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(() => {})
  );
}

// ---------- Init ----------
applyTheme();
updateGreeting();
render();
startReminders();
