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
  const before = total();
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  records.push({ id: Date.now() + Math.random(), amount, time });
  saveRecords();
  render();
  celebrate();
  if (navigator.vibrate) navigator.vibrate(20); // light tick on every log

  // Fire the celebration only when crossing the goal for the first time today
  if (total() >= settings.goal && before < settings.goal) {
    goalReached();
  }
}

function goalReached() {
  if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 140]); // happy buzz
  launchConfetti();
  notify('Goal reached! 🎉', `You drank ${total()}ml today. Great job!`);
}

function launchConfetti() {
  const c = el('confetti');
  if (!c) return;
  const colors = ['#3ea0f7', '#5fd0a0', '#ffd166', '#ff7b9c', '#8fc7fb', '#2bb578'];
  const n = 34;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--x', (Math.random() * 160 - 80) + 'px');
    p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    if (Math.random() > 0.5) p.style.borderRadius = '50%';
    const dur = 1.6 + Math.random() * 1.2;
    p.style.animationDuration = dur + 's';
    p.style.animationDelay = Math.random() * 0.25 + 's';
    c.appendChild(p);
    setTimeout(() => p.remove(), (dur + 0.6) * 1000);
  }
}

function deleteRecord(id) {
  const index = records.findIndex((r) => String(r.id) === String(id));
  if (index === -1) return;
  const [removed] = records.splice(index, 1);
  saveRecords();
  render();
  showUndoToast(removed, index);
}

// ---------- Undo toast ----------
let lastDeleted = null;
let toastTimer = null;
function showUndoToast(record, index) {
  lastDeleted = { record, index };
  el('toastMsg').textContent = `${record.amount}ml removed`;
  const toast = el('toast');
  toast.classList.remove('show');
  void toast.offsetWidth; // restart the countdown animation
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 4000);
}
function hideToast() {
  el('toast').classList.remove('show');
  lastDeleted = null;
}
function undoDelete() {
  if (lastDeleted) {
    const i = Math.min(lastDeleted.index, records.length);
    records.splice(i, 0, lastDeleted.record);
    saveRecords();
    render();
  }
  clearTimeout(toastTimer);
  hideToast();
}

function celebrate() {
  const drop = document.getElementById('drop');
  drop.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }],
    { duration: 300, easing: 'ease-out' }
  );
  // expanding ripple on the water surface
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  drop.appendChild(ripple);
  setTimeout(() => ripple.remove(), 750);
  // bump the amount number
  const b = document.querySelector('.drop-amount b');
  if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
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

function playVanish() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    // quick downward "swoosh" — a falling tone with a soft fade
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
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

// ---------- Swipe to delete ----------
let swipe = null;
const SWIPE_THRESHOLD = 110;

listEl.addEventListener('touchstart', (e) => {
  const item = e.target.closest('.record-item');
  if (!item) return;
  swipe = {
    item,
    id: item.querySelector('.del')?.dataset.id,
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    dx: 0,
    axis: null
  };
  item.style.transition = 'none';
}, { passive: true });

listEl.addEventListener('touchmove', (e) => {
  if (!swipe) return;
  const t = e.touches[0];
  const dx = t.clientX - swipe.startX;
  const dy = t.clientY - swipe.startY;
  if (swipe.axis === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    swipe.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  }
  if (swipe.axis !== 'x') return;
  e.preventDefault(); // we own the horizontal gesture; let vertical scroll through
  swipe.dx = dx;
  swipe.item.style.transform = `translateX(${dx}px)`;
  swipe.item.style.opacity = String(Math.max(0.25, 1 - Math.abs(dx) / 260));
  swipe.item.classList.toggle('will-delete', Math.abs(dx) > SWIPE_THRESHOLD);
}, { passive: false });

function endSwipe() {
  if (!swipe) return;
  const { item, dx, id } = swipe;
  swipe = null;
  item.style.transition = 'transform .25s ease, opacity .25s ease';
  if (Math.abs(dx) > SWIPE_THRESHOLD && id) {
    const dir = dx > 0 ? 1 : -1;
    playVanish();
    if (navigator.vibrate) navigator.vibrate(30);
    item.style.transform = `translateX(${dir * window.innerWidth}px)`;
    item.style.opacity = '0';
    setTimeout(() => deleteRecord(id), 180);
  } else {
    item.classList.remove('will-delete');
    item.style.transform = '';
    item.style.opacity = '';
  }
}
listEl.addEventListener('touchend', endSwipe);
listEl.addEventListener('touchcancel', endSwipe);

el('bellBtn').addEventListener('click', openSheet);
el('toastUndo').addEventListener('click', undoDelete);

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
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ---------- Trend chart (7 / 30 days) ----------
let chartRange = 7;
function renderChart() {
  const goal = settings.goal;
  const n = chartRange;
  const compact = n > 7;
  const today = new Date();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push({ date: d, total: totalForDate(d) });
  }
  const maxVal = Math.max(goal, ...days.map((x) => x.total), 1);

  const chart = el('chart');
  chart.classList.toggle('compact', compact);
  chart.innerHTML = days.map((x, idx) => {
    const h = Math.round((x.total / maxVal) * 100);
    const met = x.total >= goal && goal > 0;
    const isToday = idx === n - 1;
    // In 30-day view only label a few cells to avoid clutter
    const showDay = !compact || isToday || idx === 0 || x.date.getDate() === 1 || idx % 5 === 0;
    const dayLbl = isToday ? 'Today' : compact ? x.date.getDate() : DOW[x.date.getDay()];
    return `
      <div class="bar-col">
        ${compact ? '' : `<span class="bar-val">${x.total || ''}</span>`}
        <div class="bar-track">
          <div class="bar ${met ? 'goal-met' : ''}" style="height:${Math.max(h, x.total ? 4 : 0)}%"></div>
        </div>
        <span class="bar-day ${isToday ? 'today' : ''}">${showDay ? dayLbl : ''}</span>
      </div>`;
  }).join('');
  el('chartTitle').textContent = `Last ${n} days`;
}

// ---------- Weekly averages (last 4 rolling weeks) ----------
function renderWeekly() {
  const goal = settings.goal || 1;
  const today = new Date();
  const fmt = (d) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });

  const weeks = [];
  for (let w = 0; w < 4; w++) {
    let sum = 0, end, start;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (w * 7 + i));
      sum += totalForDate(d);
      if (i === 0) end = d;
      if (i === 6) start = d;
    }
    weeks.push({ w, avg: Math.round(sum / 7), total: sum, start, end });
  }

  el('weeklyList').innerHTML = weeks.map((wk) => {
    const pct = Math.min(100, Math.round((wk.avg / goal) * 100));
    const range = `${fmt(wk.start)} – ${fmt(wk.end)}`;
    const label = wk.w === 0 ? 'This week' : wk.w === 1 ? 'Last week' : range;
    const sub = wk.w < 2 ? range : `${wk.total} ml total`;
    return `
      <li class="weekly-item">
        <div class="w-info">
          <div class="w-label">${label}</div>
          <div class="w-sub">${sub}</div>
          <div class="w-bar"><span style="width:${pct}%"></span></div>
        </div>
        <div class="w-avg">${wk.avg}<small>ml/day</small></div>
      </li>`;
  }).join('');
}

// ---------- Calendar heatmap ----------
let hmYear, hmMonth; // currently displayed month
function initHeatmapMonth() {
  if (hmYear === undefined) {
    const now = new Date();
    hmYear = now.getFullYear();
    hmMonth = now.getMonth();
  }
}
function hmLevel(total, goal) {
  if (!total) return 'hm-l0';
  const r = total / goal;
  if (r >= 1) return 'hm-met';
  if (r >= 0.75) return 'hm-l4';
  if (r >= 0.5) return 'hm-l3';
  if (r >= 0.25) return 'hm-l2';
  return 'hm-l1';
}
function renderHeatmap() {
  initHeatmapMonth();
  const goal = settings.goal || 1;
  el('hmMonth').textContent = `${MONTHS[hmMonth]} ${hmYear}`;
  const firstDow = new Date(hmYear, hmMonth, 1).getDay();
  const daysInMonth = new Date(hmYear, hmMonth + 1, 0).getDate();
  const today = new Date();

  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div class="hm-cell blank"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(hmYear, hmMonth, d);
    const total = totalForDate(date);
    const lvl = hmLevel(total, goal);
    const isToday =
      d === today.getDate() && hmMonth === today.getMonth() && hmYear === today.getFullYear();
    const pct = Math.round((total / goal) * 100);
    html += `<div class="hm-cell ${lvl}${isToday ? ' today' : ''}" title="${total}ml (${pct}% of goal)">${d}</div>`;
  }
  el('heatmap').innerHTML = html;

  // Don't allow navigating into the future
  const cur = new Date();
  el('hmNext').disabled =
    hmYear > cur.getFullYear() || (hmYear === cur.getFullYear() && hmMonth >= cur.getMonth());
}
function shiftMonth(delta) {
  initHeatmapMonth();
  hmMonth += delta;
  if (hmMonth < 0) { hmMonth = 11; hmYear--; }
  else if (hmMonth > 11) { hmMonth = 0; hmYear++; }
  renderHeatmap();
}

function renderHistory() {
  const goal = settings.goal;

  renderChart();
  renderWeekly();

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

  renderHeatmap();

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

el('hmPrev').addEventListener('click', () => shiftMonth(-1));
el('hmNext').addEventListener('click', () => shiftMonth(1));

document.querySelectorAll('#rangeToggle button').forEach((b) =>
  b.addEventListener('click', () => {
    chartRange = parseInt(b.dataset.range, 10);
    document.querySelectorAll('#rangeToggle button').forEach((x) =>
      x.classList.toggle('active', x === b)
    );
    renderChart();
  })
);

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
