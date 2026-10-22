// Macro Diary: profile, daily targets, food diary and barcode lookup. All data stays in localStorage.
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const KEY = 'macro-diary.v1';
const $ = (id) => document.getElementById(id);

// ---------- storage ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return { units: 'imperial', profile: null, log: {}, recent: [], ...s };
  } catch (e) { /* corrupt or blocked storage: start fresh */ }
  return { units: 'imperial', profile: null, log: {}, recent: [] };
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { alert('Could not save. Your browser storage may be full or turned off.'); }
}

// ---------- dates (local time, not UTC, so "today" matches the phone's clock) ----------
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let current = new Date();
function dateLabel(d) {
  const diff = Math.round((new Date(dayKey(d)) - new Date(dayKey(new Date()))) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------- units ----------
const LB = 0.45359237, IN = 2.54;
const round1 = (n) => Math.round(n * 10) / 10;

// ---------- views ----------
function show(view) {
  const diary = view === 'diary';
  $('diaryView').hidden = !diary;
  $('goalsView').hidden = diary;
  $('datebar').hidden = !diary;
  $('title').textContent = diary ? 'Diary' : 'Goals';
  $(diary ? 'tabDiary' : 'tabGoals').setAttribute('aria-current', 'page');
  $(diary ? 'tabGoals' : 'tabDiary').removeAttribute('aria-current');
  window.scrollTo(0, 0);
}
$('tabDiary').onclick = () => show('diary');
$('tabGoals').onclick = () => show('goals');
$('prevDay').onclick = () => { current.setDate(current.getDate() - 1); renderDiary(); };
$('nextDay').onclick = () => { current.setDate(current.getDate() + 1); renderDiary(); };

// ---------- diary ----------
const entriesFor = (d) => state.log[dayKey(d)] || [];
const totals = (items) => items.reduce((t, e) => ({
  kcal: t.kcal + e.kcal * e.qty, protein: t.protein + e.protein * e.qty,
  carbs: t.carbs + e.carbs * e.qty, fat: t.fat + e.fat * e.qty,
}), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

function renderDiary() {
  $('dateLabel').textContent = dateLabel(current);
  const items = entriesFor(current);
  const t = totals(items);
  const goal = state.profile ? Calc.targets(state.profile) : null;

  $('eqGoal').textContent = goal ? goal.calories.toLocaleString() : '—';
  $('eqFood').textContent = Math.round(t.kcal).toLocaleString();
  const left = goal ? goal.calories - Math.round(t.kcal) : null;
  $('eqResult').textContent = left === null ? '—' : left.toLocaleString();
  $('eqResultBox').classList.toggle('over', left !== null && left < 0);

  const macros = $('macros');
  macros.replaceChildren();
  for (const [k, label, color] of [['protein', 'Protein', '--protein'], ['carbs', 'Carbs', '--carbs'], ['fat', 'Fat', '--fat']]) {
    const have = Math.round(t[k]);
    const want = goal ? goal[k] : 0;
    const row = document.createElement('div');
    row.className = 'macro num' + (want && have > want * 1.05 ? ' over' : '');
    const name = document.createElement('span');
    name.textContent = label;
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('i');
    fill.style.width = (want ? Math.min(100, (have / want) * 100) : 0) + '%';
    fill.style.background = `var(${color})`;
    bar.append(fill);
    const val = document.createElement('span');
    val.className = 'small';
    val.textContent = goal ? `${have} / ${want} g` : `${have} g`;
    row.append(name, bar, val);
    macros.append(row);
  }

  const meals = $('meals');
  meals.replaceChildren();
  MEALS.forEach((meal) => {
    const card = document.createElement('section');
    card.className = 'card meal';
    const head = document.createElement('header');
    const mealItems = items.filter((e) => e.meal === meal);
    const h = document.createElement('span'); h.textContent = meal;
    const k = document.createElement('span'); k.className = 'num'; k.textContent = Math.round(totals(mealItems).kcal) || '';
    head.append(h, k);
    card.append(head);
    for (const e of mealItems) {
      const row = document.createElement('div');
      row.className = 'entry';
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      const info = document.createElement('div');
      const name = document.createElement('div'); name.className = 'name'; name.textContent = e.name;
      const sub = document.createElement('div'); sub.className = 'small muted';
      sub.textContent = `${e.qty} × ${e.serving || 'serving'} · P ${round1(e.protein * e.qty)} C ${round1(e.carbs * e.qty)} F ${round1(e.fat * e.qty)}`;
      info.append(name, sub);
      const kc = document.createElement('span'); kc.className = 'num'; kc.textContent = Math.round(e.kcal * e.qty);
      row.append(info, kc);
      row.onclick = () => openSheet(meal, e);
      row.onkeydown = (ev) => { if (ev.key === 'Enter') openSheet(meal, e); };
      card.append(row);
    }
    const add = document.createElement('button');
    add.className = 'addlink';
    add.textContent = 'ADD FOOD';
    add.onclick = () => openSheet(meal);
    card.append(add);
    meals.append(card);
  });
}

// ---------- goals ----------
let units = state.units;
function setUnits(u) {
  // Convert what's typed so switching units doesn't lose input.
  const p = readProfile(true);
  units = u;
  document.querySelectorAll('[data-units]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.units === u));
  $('heightImperial').hidden = u !== 'imperial';
  $('heightMetric').hidden = u !== 'metric';
  $('weightLabel').textContent = u === 'imperial' ? 'Weight (lb)' : 'Weight (kg)';
  if (p) fillProfile(p);
}
document.querySelectorAll('[data-units]').forEach((b) => (b.onclick = () => setUnits(b.dataset.units)));

function fillProfile(p) {
  $('sex').value = p.sex; $('age').value = p.age || '';
  if (p.heightCm) {
    const totalIn = p.heightCm / IN;
    $('heightFt').value = Math.floor(totalIn / 12);
    $('heightIn').value = round1(totalIn % 12);
    $('heightCm').value = round1(p.heightCm);
  }
  if (p.weightKg) $('weight').value = units === 'imperial' ? round1(p.weightKg / LB) : round1(p.weightKg);
  $('bodyFat').value = p.bodyFat || '';
  for (const k of ['activity', 'training', 'goal', 'intensity', 'lifeStage']) if (p[k]) $(k).value = p[k];
  $('lifeStageBox').hidden = $('sex').value !== 'female';
}

// Reads the form in metric. With `loose`, returns what's there even if incomplete (for unit switching).
function readProfile(loose) {
  const num = (id) => parseFloat($(id).value);
  const heightCm = units === 'imperial' ? ((num('heightFt') || 0) * 12 + (num('heightIn') || 0)) * IN : num('heightCm');
  const weightKg = units === 'imperial' ? num('weight') * LB : num('weight');
  const p = {
    sex: $('sex').value, age: num('age'), heightCm, weightKg, bodyFat: num('bodyFat') || 0,
    activity: $('activity').value, training: $('training').value, goal: $('goal').value,
    intensity: $('intensity').value, lifeStage: $('sex').value === 'female' ? $('lifeStage').value : 'none',
  };
  if (loose) return p;
  if (!(p.age >= 13 && p.age <= 100)) return 'Enter an age between 13 and 100.';
  if (!(p.heightCm >= 100 && p.heightCm <= 250)) return 'Enter a height between 3\'4" and 8\'2" (100–250 cm).';
  if (!(p.weightKg >= 25 && p.weightKg <= 450)) return 'Enter a weight between 55 and 990 lb (25–450 kg).';
  if (p.bodyFat && !(p.bodyFat >= 3 && p.bodyFat <= 70)) return 'Body fat should be between 3% and 70%, or leave it blank.';
  return p;
}

$('sex').onchange = () => { $('lifeStageBox').hidden = $('sex').value !== 'female'; };
$('profileForm').onsubmit = (ev) => {
  ev.preventDefault();
  const p = readProfile(false);
  if (typeof p === 'string') { renderTargets(null, p); return; }
  state.profile = p; state.units = units; save();
  renderTargets(Calc.targets(p));
  renderDiary();
};

function renderTargets(t, error) {
  $('targetsCard').hidden = false;
  const grid = $('targetsGrid'), notes = $('targetsNotes');
  grid.replaceChildren(); notes.replaceChildren();
  $('targetsDetail').textContent = '';
  if (error) {
    const n = document.createElement('div'); n.className = 'note'; n.textContent = error; notes.append(n);
    $('targetsCard').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  for (const [label, val] of [['Calories', `${t.calories.toLocaleString()} kcal`], ['Protein', `${t.protein} g`], ['Carbs', `${t.carbs} g`], ['Fat', `${t.fat} g`]]) {
    const d = document.createElement('div');
    const b = document.createElement('b'); b.textContent = val;
    const s = document.createElement('span'); s.className = 'small muted'; s.textContent = label;
    d.append(b, s); grid.append(d);
  }
  const wk = units === 'imperial' ? `${round1(t.weeklyChangeKg / LB)} lb` : `${t.weeklyChangeKg} kg`;
  $('targetsDetail').textContent = `Maintenance is about ${t.tdee.toLocaleString()} kcal/day (BMR ${t.bmr.toLocaleString()}, ${t.formula} formula). `
    + `Expected change: ${t.weeklyChangeKg > 0 ? '+' : ''}${wk} per week. Aim for about ${t.fiber} g of fiber.`;
  for (const msg of t.notes) { const n = document.createElement('div'); n.className = 'note'; n.textContent = msg; notes.append(n); }
}

// ---------- add / edit food ----------
let editing = null;
MEALS.forEach((m) => { const o = document.createElement('option'); o.textContent = m; $('meal').append(o); });

function openSheet(meal, entry) {
  editing = entry || null;
  $('foodForm').reset();
  $('meal').value = meal;
  $('sheetTitle').textContent = entry ? 'Edit food' : 'Add food';
  $('saveFood').textContent = entry ? 'Save changes' : 'Add to diary';
  $('deleteFood').hidden = !entry;
  $('recentBox').hidden = !!entry || !state.recent.length;
  $('scanBtn').hidden = !!entry;
  setStatus('');
  if (entry) fillFood(entry);
  renderRecent();
  $('foodSheet').hidden = false;
}
function closeSheet() { stopScan(); $('foodSheet').hidden = true; }
$('closeSheet').onclick = closeSheet;
$('foodSheet').onclick = (ev) => { if (ev.target === $('foodSheet')) closeSheet(); };
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('foodSheet').hidden) closeSheet(); });

function fillFood(f) {
  $('foodName').value = f.name; $('serving').value = f.serving || '';
  $('qty').value = f.qty || 1;
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) $(k).value = round1(f[k]);
}

function renderRecent() {
  const box = $('recent');
  box.replaceChildren();
  for (const f of state.recent.slice(0, 15)) {
    const b = document.createElement('button');
    b.type = 'button';
    const n = document.createElement('span'); n.textContent = f.name;
    const k = document.createElement('span'); k.className = 'small muted num'; k.textContent = `${Math.round(f.kcal)} kcal`;
    b.append(n, k);
    b.onclick = () => fillFood({ ...f, qty: 1 });
    box.append(b);
  }
}

$('foodForm').onsubmit = (ev) => {
  ev.preventDefault();
  const food = {
    name: $('foodName').value.trim(), serving: $('serving').value.trim(),
    kcal: parseFloat($('kcal').value) || 0, protein: parseFloat($('protein').value) || 0,
    carbs: parseFloat($('carbs').value) || 0, fat: parseFloat($('fat').value) || 0,
  };
  const qty = parseFloat($('qty').value);
  if (!food.name || !(qty > 0)) return;
  const key = dayKey(current);
  const list = state.log[key] || (state.log[key] = []);
  if (editing) Object.assign(editing, food, { qty, meal: $('meal').value });
  else list.push({ id: Date.now() + Math.random(), meal: $('meal').value, qty, ...food });
  // Most recent first, one entry per food name, capped so storage stays small.
  state.recent = [food, ...state.recent.filter((r) => r.name.toLowerCase() !== food.name.toLowerCase())].slice(0, 50);
  save();
  closeSheet();
  renderDiary();
};
$('deleteFood').onclick = () => {
  const key = dayKey(current);
  state.log[key] = (state.log[key] || []).filter((e) => e !== editing);
  save(); closeSheet(); renderDiary();
};

// ---------- barcode scanning ----------
function setStatus(msg, err) { $('scanStatus').textContent = msg; $('scanStatus').classList.toggle('err', !!err); }
let scanControls = null;
function stopScan() {
  if (scanControls) { scanControls.stop(); scanControls = null; }
  $('scanBox').hidden = true;
}
function loadScanner() {
  if (window.ZXingBrowser) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'vendor/zxing-browser.min.js';
    s.onload = ok; s.onerror = () => fail(new Error('Could not load the scanner.'));
    document.head.append(s);
  });
}
$('scanBtn').onclick = async () => {
  $('scanBox').hidden = false;
  setStatus('Starting camera…');
  try {
    await loadScanner();
    const reader = new ZXingBrowser.BrowserMultiFormatReader();
    scanControls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, $('video'), (result) => {
      if (!result || !scanControls) return;
      const code = result.getText();
      stopScan();
      lookup(code);
    });
    setStatus('Point the camera at the barcode.');
  } catch (e) {
    setStatus(e.name === 'NotAllowedError'
      ? 'Camera access was blocked. Allow it in your browser settings, or type the barcode number.'
      : 'Could not start the camera. Type the barcode number instead.', true);
  }
};
$('lookupBtn').onclick = () => lookup($('manualCode').value.trim());
$('manualCode').onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); lookup($('manualCode').value.trim()); } };

// Turns an Open Food Facts product into one serving of our food. Per-serving values when the
// label has them, otherwise per 100 g.
function parseProduct(p) {
  const n = p.nutriments || {};
  const kcalOf = (suffix) => n['energy-kcal' + suffix] ?? (n['energy' + suffix] != null ? n['energy' + suffix] / 4.184 : undefined);
  const perServing = p.serving_size && kcalOf('_serving') != null;
  const sfx = perServing ? '_serving' : '_100g';
  const name = [p.brands && p.brands.split(',')[0].trim(), p.product_name].filter(Boolean).join(' ');
  return {
    name: name || 'Unnamed product',
    serving: perServing ? p.serving_size : '100 g',
    kcal: kcalOf(sfx) || 0,
    protein: n['proteins' + sfx] || 0,
    carbs: n['carbohydrates' + sfx] || 0,
    fat: n['fat' + sfx] || 0,
  };
}

async function lookup(code) {
  if (!/^\d{6,14}$/.test(code)) { setStatus('Barcodes are 6 to 14 digits.', true); return; }
  setStatus(`Looking up ${code}…`);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,nutriments`);
    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      setStatus(`No match for ${code}. Enter the nutrition label by hand.`, true);
      return;
    }
    stopScan();
    fillFood({ ...parseProduct(data.product), qty: 1 });
    setStatus('Found it. Check the numbers against the label, then add it.');
  } catch (e) {
    setStatus('Lookup failed. Check your internet connection and try again.', true);
  }
}

// ---------- start ----------
setUnits(units);
if (state.profile) { fillProfile(state.profile); renderTargets(Calc.targets(state.profile)); }
renderDiary();
show(state.profile ? 'diary' : 'goals');
