// Macro Diary: Today, Plan, Progress and More pages, food sheet and barcode lookup. All data stays in localStorage.
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const KEY = 'macro-diary.v1';
const $ = (id) => document.getElementById(id);
const { dayKey, addDays, weekDays, totals, macroSplit } = Stats;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// ---------- storage ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return { units: 'imperial', profile: null, log: {}, recent: [], weights: {}, meals: [], foods: [], ...s };
  } catch (e) { /* corrupt or blocked storage: start fresh */ }
  return { units: 'imperial', profile: null, log: {}, recent: [], weights: {}, meals: [], foods: [] };
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { alert('Could not save. Your browser storage may be full or turned off.'); }
}

// ---------- dates ----------
let current = new Date();
function dateLabel(d) {
  const diff = Math.round((new Date(dayKey(d)) - new Date(dayKey(new Date()))) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function setDay(d) { current = d; renderToday(); }

// ---------- units ----------
const LB = 0.45359237, IN = 2.54;
const round1 = (n) => Math.round(n * 10) / 10;

// ---------- views ----------
const VIEWS = { today: 'Today', plan: 'Plan', progress: 'Progress', more: 'More' };
let view = 'today';
function show(v) {
  view = v;
  for (const k of Object.keys(VIEWS)) {
    $(k + 'View').hidden = k !== v;
    if (k === v) $('tab-' + k).setAttribute('aria-current', 'page'); else $('tab-' + k).removeAttribute('aria-current');
  }
  $('dateBtn').hidden = $('streak').hidden = v !== 'today';
  $('title').hidden = v === 'today';
  $('title').textContent = VIEWS[v];
  if (v === 'plan') renderPlan();
  if (v === 'progress') { progressWeek = new Date(); renderProgress(); }
  window.scrollTo(0, 0);
}
for (const k of Object.keys(VIEWS)) $('tab-' + k).onclick = () => show(k);
$('addBtn').onclick = () => openSheet(defaultMeal());
$('datePick').onchange = () => {
  const [y, m, d] = $('datePick').value.split('-').map(Number);
  if (y) setDay(new Date(y, m - 1, d));
};

// The + button guesses the meal from the time of day; the sheet's Meal dropdown can change it.
function defaultMeal() {
  const h = new Date().getHours();
  return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snacks';
}

// ---------- today ----------
const entriesFor = (d) => state.log[dayKey(d)] || [];
const goalNow = () => (state.profile ? Calc.targets(state.profile) : null);
const expanded = new Set();

function renderToday() {
  $('dateLabel').textContent = dateLabel(current);
  $('datePick').value = dayKey(current);
  $('streakNum').textContent = Stats.streak(state.log, new Date());

  const week = $('week');
  week.replaceChildren();
  const todayKey = dayKey(new Date());
  for (const d of weekDays(current)) {
    const b = el('button', entriesFor(d).length ? 'done' : '');
    b.type = 'button';
    if (dayKey(d) === todayKey) b.classList.add('today');
    b.setAttribute('aria-pressed', dayKey(d) === dayKey(current));
    b.setAttribute('aria-label', d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }));
    b.append(el('span', '', 'SMTWTFS'[d.getDay()]), el('i'));
    b.onclick = () => setDay(d);
    week.append(b);
  }

  const items = entriesFor(current);
  const t = totals(items);
  const goal = goalNow();
  const eaten = Math.round(t.kcal);
  $('calEaten').textContent = `${eaten.toLocaleString()} cal`;
  $('calGoal').textContent = goal ? `/ ${goal.calories.toLocaleString()}` : '';
  const left = goal ? goal.calories - eaten : null;
  $('calLeft').textContent = left === null ? 'Set your goals in More' : left >= 0 ? `${left.toLocaleString()} left` : `${(-left).toLocaleString()} over`;
  $('calBar').style.width = (goal ? Math.min(100, (eaten / goal.calories) * 100) : 0) + '%';
  $('calBar').classList.toggle('over', left !== null && left < 0);

  const macros = $('macros');
  macros.replaceChildren();
  for (const [k, label] of [['carbs', 'Carbs'], ['fat', 'Fat'], ['protein', 'Protein']]) {
    const have = Math.round(t[k]);
    const want = goal ? goal[k] : 0;
    const box = el('div');
    const val = el('div');
    val.append(el('b', '', `${have} g`), el('span', 'small muted', want ? ` / ${want}` : ''));
    const bar = el('div', 'bar');
    const fill = el('i', `c-${k}` + (want && have > want * 1.05 ? ' over' : ''));
    fill.style.width = (want ? Math.min(100, (have / want) * 100) : 0) + '%';
    bar.append(fill);
    box.append(el('div', 'small', label), val, bar);
    macros.append(box);
  }

  const meals = $('meals');
  meals.replaceChildren();
  for (const meal of MEALS) meals.append(mealCard(meal, items.filter((e) => e.meal === meal)));
  $('viewAll').textContent = expanded.size === MEALS.length ? 'Hide all' : 'View all';
}

// "Oatmeal and 2 more" plus "430 cal · C 52% F 26% P 22%".
function summaryLines(foods) {
  if (!foods.length) return [el('div', 'small muted', 'Nothing logged yet')];
  const t = totals(foods), pct = macroSplit(t);
  return [
    el('div', 'sum muted', foods.length > 1 ? `${foods[0].name} and ${foods.length - 1} more` : foods[0].name),
    el('div', 'small muted num', `${Math.round(t.kcal)} cal · C ${pct.carbs}% F ${pct.fat}% P ${pct.protein}%`),
  ];
}

function mealCard(meal, mealItems) {
  const card = el('section', 'card meal');
  const subs = el('div', 'subs');
  subs.append(...summaryLines(mealItems));
  const more = el('button', 'more', '···');
  more.type = 'button';
  more.setAttribute('aria-label', `Show ${meal} foods`);
  more.setAttribute('aria-expanded', expanded.has(meal));
  more.onclick = () => { expanded.has(meal) ? expanded.delete(meal) : expanded.add(meal); renderToday(); };
  const log = el('button', 'logbtn', 'Log');
  log.type = 'button';
  log.onclick = () => openSheet(meal);
  card.append(document.getElementById('icon-' + meal).content.cloneNode(true), el('h3', '', meal), more, log, subs);

  if (expanded.has(meal)) {
    const list = el('div', 'items');
    for (const e of mealItems) {
      const row = el('div', 'entry');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      const text = el('div');
      text.append(el('div', 'name', e.name),
        el('div', 'small muted', `${e.qty} × ${e.serving || 'serving'} · C ${round1(e.carbs * e.qty)} F ${round1(e.fat * e.qty)} P ${round1(e.protein * e.qty)}`));
      row.append(text, el('span', 'num', Math.round(e.kcal * e.qty)));
      row.onclick = () => openSheet(meal, e);
      row.onkeydown = (ev) => { if (ev.key === 'Enter') openSheet(meal, e); };
      list.append(row);
    }
    if (mealItems.length) {
      const saveMeal = el('button', 'addlink', 'Save as meal');
      saveMeal.type = 'button';
      saveMeal.onclick = () => saveAsMeal(mealItems);
      list.append(saveMeal);
    }
    card.append(list);
  }
  return card;
}
$('viewAll').onclick = () => {
  if (expanded.size === MEALS.length) expanded.clear(); else MEALS.forEach((m) => expanded.add(m));
  renderToday();
};

function saveAsMeal(foods) {
  const name = (prompt('Name this meal (e.g. BLT):', foods.map((f) => f.name).join(', ').slice(0, 60)) || '').trim().slice(0, 120);
  if (!name) return;
  const copy = foods.map(({ name, serving, kcal, protein, carbs, fat, qty }) => ({ name, serving, kcal, protein, carbs, fat, qty }));
  state.meals = [{ id: Date.now(), name, foods: copy }, ...state.meals.filter((m) => m.name.toLowerCase() !== name.toLowerCase())].slice(0, 200);
  save();
  alert(`Saved "${name}". Find it under Plan → My meals.`);
}

// ---------- plan ----------
MEALS.forEach((m) => $('planMeal').append(el('option', '', m)));

// Adds foods to `meal` on the selected day. Logging a saved meal also moves it to the top of History.
function addEntries(foods, meal, saved) {
  const key = dayKey(current);
  const list = state.log[key] || (state.log[key] = []);
  for (const f of foods) {
    const food = { name: f.name, serving: f.serving, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat };
    list.push({ id: Date.now() + Math.random(), meal, qty: f.qty ?? 1, ...food });
    remember(food);
  }
  if (saved) saved.lastUsed = Date.now();
  save();
  renderToday();
}
// Most recent first, one entry per food name, capped so storage stays small.
function remember(food) {
  state.recent = [food, ...state.recent.filter((r) => r.name.toLowerCase() !== food.name.toLowerCase())].slice(0, 50);
}
function flash(btn, text) {
  btn.dataset.label ??= btn.textContent;
  btn.textContent = text;
  clearTimeout(btn.flashTimer);
  btn.flashTimer = setTimeout(() => { btn.textContent = btn.dataset.label; }, 1500);
}

function planCard(m, onDelete) {
  const card = el('section', 'card meal');
  card.style.gridTemplateColumns = '1fr auto auto';
  const subs = el('div', 'subs');
  subs.style.gridColumn = '1 / -1';
  const t = totals(m.foods), pct = macroSplit(t);
  subs.append(el('div', 'small muted', m.foods.map((f) => f.name).join(', ')),
    el('div', 'small muted num', `${Math.round(t.kcal)} cal · ${Math.round(t.protein)} g protein · C ${pct.carbs}% F ${pct.fat}% P ${pct.protein}%`));
  card.append(el('h3', '', m.name));
  if (onDelete) {
    const del = el('button', 'more', '✕');
    del.type = 'button';
    del.setAttribute('aria-label', `Delete ${m.name}`);
    del.onclick = onDelete;
    card.append(del);
  } else card.append(el('span'));
  const log = el('button', 'logbtn', 'Log');
  log.type = 'button';
  log.onclick = () => { addEntries(m.foods, $('planMeal').value, onDelete ? m : null); flash(log, 'Logged ✓'); };
  card.append(log, subs);
  return card;
}

function renderPlan() {
  $('planDay').textContent = dateLabel(current);
  if (!$('planMeal').dataset.touched) $('planMeal').value = defaultMeal();
  const mine = $('myMeals');
  mine.replaceChildren();
  if (!state.meals.length) mine.append(el('p', 'small muted card', 'No saved meals yet. On Today, tap ··· on a meal, then "Save as meal". It shows up here to log again in one tap.'));
  for (const m of state.meals) mine.append(planCard(m, () => {
    if (!confirm(`Delete the saved meal "${m.name}"? Foods already in your diary stay.`)) return;
    state.meals = state.meals.filter((x) => x !== m);
    save(); renderPlan();
  }));
  // One tag at a time: most ideas fit several tags, so showing every group repeats them.
  const tabs = $('ideaTags');
  tabs.replaceChildren();
  for (const tag of Ideas.TAGS) {
    const b = el('button', '', tag);
    b.type = 'button';
    b.setAttribute('aria-pressed', tag === ideaTag);
    b.onclick = () => { ideaTag = tag; renderPlan(); };
    tabs.append(b);
  }
  $('ideas').replaceChildren(...Ideas.IDEAS.filter((i) => i.tags.includes(ideaTag)).map((i) => planCard(i)));
}
let ideaTag = Ideas.TAGS[0];
$('planMeal').onchange = () => { $('planMeal').dataset.touched = '1'; };

// ---------- progress ----------
let progressWeek = new Date();
const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, text) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}
const shortDate = (d) => d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
const toUnits = (kg) => (state.units === 'imperial' ? kg / LB : kg);
const unitName = () => (state.units === 'imperial' ? 'lb' : 'kg');

function renderProgress() {
  const days = weekDays(progressWeek);
  const thisWeek = dayKey(days[0]) === dayKey(weekDays(new Date())[0]);
  $('weekLabel').textContent = thisWeek ? 'This week' : `${shortDate(days[0])} – ${shortDate(days[6])}`;
  $('nextWeek').disabled = thisWeek;
  const goal = goalNow();

  // Bar chart: calories Sun–Sat, dashed line at the goal.
  const kcals = days.map((d) => Math.round(totals(entriesFor(d)).kcal));
  const chart = $('calChart');
  chart.replaceChildren();
  const top = Math.max(...kcals, goal ? goal.calories : 0, 1) * 1.15, H = 140, W = 320, slot = W / 7;
  const y = (v) => H - (v / top) * H;
  chart.append(svg('line', { class: 'axis', x1: 0, x2: W, y1: H, y2: H }));
  kcals.forEach((k, i) => {
    const x = i * slot + slot * 0.2;
    if (k) {
      chart.append(svg('rect', { class: goal && k > goal.calories ? 'over' : 'c-brand', x, y: y(k), width: slot * 0.6, height: H - y(k), rx: 4 }));
      chart.append(svg('text', { x: x + slot * 0.3, y: y(k) - 4, 'text-anchor': 'middle' }, k));
    }
    chart.append(svg('text', { x: x + slot * 0.3, y: H + 18, 'text-anchor': 'middle' }, 'SMTWTFS'[i]));
  });
  if (goal) {
    chart.append(svg('line', { class: 'goal', x1: 0, x2: W, y1: y(goal.calories), y2: y(goal.calories) }));
    chart.append(svg('text', { x: W, y: y(goal.calories) - 4, 'text-anchor': 'end' }, `Goal ${goal.calories}`));
  }
  const logged = kcals.filter(Boolean);
  $('calAvg').textContent = logged.length ? `Average ${Math.round(logged.reduce((a, b) => a + b, 0) / logged.length).toLocaleString()} cal on the ${logged.length} day${logged.length === 1 ? '' : 's'} you logged.` : 'Nothing logged this week.';

  // Pie chart: share of the week's calories from each macro. Each slice is a circle whose thick
  // stroke is dashed to the slice's length (a full stroke of width 2r fills the circle).
  const wt = totals(days.flatMap(entriesFor)), pct = macroSplit(wt);
  const pie = $('pie'), C = 2 * Math.PI * 25;
  pie.replaceChildren();
  let start = 0;
  const sum = pct.carbs + pct.fat + pct.protein;
  if (!sum) pie.append(svg('circle', { cx: 50, cy: 50, r: 45, class: 'axis', fill: 'none', 'stroke-width': 2 }));
  for (const k of ['carbs', 'fat', 'protein']) {
    const len = (pct[k] / (sum || 1)) * C;
    if (len) pie.append(svg('circle', { cx: 50, cy: 50, r: 25, class: `c-${k}`, 'stroke-width': 50,
      'stroke-dasharray': `${len} ${C}`, 'stroke-dashoffset': -start, transform: 'rotate(-90 50 50)' }));
    start += len;
  }
  const legend = $('pieLegend');
  legend.replaceChildren();
  for (const [k, label] of [['carbs', 'Carbs'], ['fat', 'Fat'], ['protein', 'Protein']]) {
    const row = el('div', 'num');
    row.append(el('span', `dot c-${k}`), el('b', '', `${pct[k]}% `), el('span', 'muted', `${label} · ${Math.round(wt[k])} g`));
    legend.append(row);
  }

  renderWeight();
}
$('prevWeek').onclick = () => { progressWeek = addDays(progressWeek, -7); renderProgress(); };
$('nextWeek').onclick = () => { progressWeek = addDays(progressWeek, 7); renderProgress(); };

function renderWeight() {
  $('weightUnit').textContent = `Weight (${unitName()})`;
  if (!$('weightDate').value) $('weightDate').value = dayKey(new Date());
  // Line chart: average weight per week for the last 12 weeks; weeks with no weigh-in are skipped.
  const weeks = Stats.weeklyWeights(state.weights, new Date(), 12);
  const pts = weeks.map((w, i) => ({ ...w, i })).filter((w) => w.avg !== null);
  const chart = $('weightChart');
  chart.replaceChildren();
  if (!pts.length) { $('weightChange').textContent = 'Log your weight to see your trend.'; return; }
  const vals = pts.map((p) => toUnits(p.avg));
  const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1, H = 140, W = 320, L = 34, slot = (W - L) / 11;
  const x = (i) => L + i * slot, yv = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 16);
  chart.append(svg('line', { class: 'axis', x1: L, x2: W, y1: H, y2: H }));
  for (const v of [hi - 1, lo + 1]) chart.append(svg('text', { x: L - 6, y: yv(v) + 4, 'text-anchor': 'end' }, round1(v)));
  chart.append(svg('path', { class: 'line', d: pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.i)} ${yv(vals[j])}`).join(' ') }));
  pts.forEach((p, j) => chart.append(svg('circle', { class: 'pt', cx: x(p.i), cy: yv(vals[j]), r: 3.5 })));
  for (const i of [0, 4, 8, 11]) chart.append(svg('text', { x: x(i), y: H + 18, 'text-anchor': 'middle' }, shortDate(weeks[i].start)));
  if (pts.length < 2) { $('weightChange').textContent = `This week: ${round1(vals[0])} ${unitName()}. Log again next week to see the change.`; return; }
  const diff = round1(vals[vals.length - 1] - vals[vals.length - 2]);
  $('weightChange').textContent = `Latest week average ${round1(vals[vals.length - 1])} ${unitName()}, ${diff > 0 ? '+' : ''}${diff} ${unitName()} vs. the week before you last weighed in.`;
}

$('weightForm').onsubmit = (ev) => {
  ev.preventDefault();
  const v = parseFloat($('weightVal').value);
  const kg = state.units === 'imperial' ? v * LB : v;
  const day = $('weightDate').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(kg >= 25 && kg <= 450)) {
    $('weightStatus').textContent = 'Enter a weight between 55 and 990 lb (25–450 kg).';
    $('weightStatus').classList.add('err');
    return;
  }
  state.weights[day] = kg;
  save();
  $('weightStatus').classList.remove('err');
  $('weightStatus').textContent = `Saved ${round1(v)} ${unitName()} for ${day}. Saving the same date again replaces it.`;
  $('weightVal').value = '';
  renderWeight();
};

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
  state.profile = p; state.units = units;
  // The first weigh-in for the Progress chart; a weight already logged today wins.
  state.weights[dayKey(new Date())] ??= p.weightKg;
  save();
  renderTargets(Calc.targets(p));
  renderToday();
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

// ---------- add food sheet ----------
// Four screens in one sheet: browse (search, barcode, History / My meals / My foods), one food
// with its servings, Create food and Create meal.
let editing = null, tab = 'history', draft = null, newFoodForMeal = false;
const NUTR = ['kcal', 'protein', 'carbs', 'fat'];
const SCREENS = { browse: 'Add food', foodForm: 'Add food', newFoodForm: 'Create food', newMealForm: 'Create meal' };
MEALS.forEach((m) => $('meal').append(el('option', '', m)));
const foodLabel = (f) => (f.brand ? `${f.brand} ${f.name}` : f.name).slice(0, 120);
const macroLine = (t) => `${Math.round(t.kcal)} cal · C ${round1(t.carbs)} g · F ${round1(t.fat)} g · P ${round1(t.protein)} g`;

function showScreen(name) {
  for (const k of Object.keys(SCREENS)) $(k).hidden = k !== name;
  $('sheetTitle').textContent = editing ? 'Edit food' : SCREENS[name];
  $('mealBox').hidden = name === 'newFoodForm' || name === 'newMealForm';
  $('backBtn').style.visibility = name === 'browse' || editing ? 'hidden' : 'visible';
  if (name !== 'browse') stopScan();
  setStatus('');
  $('foodSheet').firstElementChild.scrollTop = 0;
}
$('backBtn').onclick = () => {
  if (!$('newFoodForm').hidden && newFoodForMeal) showScreen('newMealForm');
  else { showScreen('browse'); renderList(); }
};

function openSheet(meal, entry) {
  editing = entry || null;
  for (const f of ['foodForm', 'newFoodForm', 'newMealForm']) $(f).reset();
  $('meal').value = meal;
  $('search').value = '';
  $('saveFood').textContent = entry ? 'Save changes' : 'Add to diary';
  $('deleteFood').hidden = !entry;
  $('foodSheet').hidden = false;
  if (entry) { fillFood(entry); showScreen('foodForm'); }
  else { setTab('history'); showScreen('browse'); }
}
function closeSheet() { stopScan(); $('foodSheet').hidden = true; }
$('closeSheet').onclick = closeSheet;
$('foodSheet').onclick = (ev) => { if (ev.target === $('foodSheet')) closeSheet(); };
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('foodSheet').hidden) closeSheet(); });

// ----- browse -----
function setTab(t) {
  tab = t;
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === t));
  $('search').placeholder = { history: 'Search foods you logged', meals: 'Search my meals', foods: 'Search my foods' }[t];
  $('createBtn').hidden = t === 'history';
  $('createBtn').textContent = t === 'meals' ? 'Create meal' : 'Create food';
  renderList();
}
document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
$('search').oninput = () => renderList();
$('createBtn').onclick = () => (tab === 'meals' ? openMealBuilder() : openNewFood(false));
$('manualBtn').onclick = () => { $('foodForm').reset(); captureBase(); updateTotal(); showScreen('foodForm'); };

// Created foods first, then everything you've logged that isn't one of them.
function myFoods() {
  const mine = new Set(state.foods.map((f) => foodLabel(f).toLowerCase()));
  return [...state.foods, ...state.recent.filter((f) => !mine.has(f.name.toLowerCase()))];
}

// A row: tap the text to open it, tap + to log it straight away.
function itemRow(title, sub, onOpen, onAdd, addLabel) {
  const row = el('div', 'item');
  const open = el('button');
  open.type = 'button';
  open.append(el('div', 'name', title), el('div', 'small muted num', sub));
  open.onclick = onOpen;
  const add = el('button', 'addone', '+');
  add.type = 'button';
  add.setAttribute('aria-label', `${addLabel || 'Log'} ${title}`);
  add.onclick = () => { onAdd(); flash(add, '✓'); };
  row.append(open, add);
  return row;
}
const foodSub = (f) => `${f.serving || '1 serving'} · ${Math.round(f.kcal)} cal`;
const mealSub = (m) => `Meal · ${m.foods.length} food${m.foods.length === 1 ? '' : 's'} · ${Math.round(totals(m.foods).kcal)} cal`;
const foodRow = (f) => itemRow(foodLabel(f), foodSub(f), () => { fillFood({ ...f, name: foodLabel(f), qty: 1 }); showScreen('foodForm'); },
  () => addEntries([{ ...f, name: foodLabel(f) }], $('meal').value));
const mealRow = (m) => itemRow(m.name, mealSub(m), () => openMealBuilder(m), () => addEntries(m.foods, $('meal').value, m));

function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const match = (name) => name.toLowerCase().includes(q);
  let rows;
  if (tab === 'history') {
    const used = state.meals.filter((m) => m.lastUsed && match(m.name)).sort((a, b) => b.lastUsed - a.lastUsed);
    rows = [...used.map(mealRow), ...state.recent.filter((f) => match(f.name)).map(foodRow)];
  } else if (tab === 'meals') rows = state.meals.filter((m) => match(m.name)).map(mealRow);
  else rows = myFoods().filter((f) => match(foodLabel(f))).map(foodRow);
  $('list').replaceChildren(...rows);
  if (!rows.length) {
    const empty = { history: 'Foods and meals you log show up here.', meals: 'No saved meals yet. Tap Create meal.', foods: 'No foods yet. Tap Create food.' }[tab];
    const p = el('p', 'small muted', q ? `Nothing matches "${$('search').value.trim()}".` : empty);
    p.style.padding = '12px';
    $('list').append(p);
  }
}

// ----- one food -----
// `base` is the serving and nutrition the label gave; changing the serving amount scales from it.
let base = null;
function captureBase() { base = { serving: $('serving').value, ...Object.fromEntries(NUTR.map((k) => [k, parseFloat($(k).value) || 0])) }; }
function updateTotal() {
  const qty = parseFloat($('qty').value) || 0;
  const t = Object.fromEntries(NUTR.map((k) => [k, (parseFloat($(k).value) || 0) * qty]));
  $('foodTotal').textContent = `Total for ${round1(qty)} serving${qty === 1 ? '' : 's'}: ${macroLine(t)}`;
}
$('serving').oninput = () => {
  const f = Stats.servingFactor(base.serving, $('serving').value);
  if (f !== null) NUTR.forEach((k) => { $(k).value = round1(base[k] * f); });
  updateTotal();
};
NUTR.forEach((k) => { $(k).oninput = () => { captureBase(); updateTotal(); }; });
$('qty').oninput = updateTotal;

function fillFood(f) {
  $('foodName').value = f.name; $('serving').value = f.serving || '';
  $('qty').value = f.qty || 1;
  for (const k of NUTR) $(k).value = round1(f[k]);
  captureBase();
  updateTotal();
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
  if (editing) { Object.assign(editing, food, { qty, meal: $('meal').value }); remember(food); save(); renderToday(); }
  else addEntries([{ ...food, qty }], $('meal').value);
  closeSheet();
};
$('deleteFood').onclick = () => {
  const key = dayKey(current);
  state.log[key] = (state.log[key] || []).filter((e) => e !== editing);
  save(); closeSheet(); renderToday();
};

// ----- create food -----
function openNewFood(forMeal) {
  newFoodForMeal = forMeal;
  $('newFoodForm').reset();
  showScreen('newFoodForm');
}
$('newFoodForm').onsubmit = (ev) => {
  ev.preventDefault();
  const n = (id) => parseFloat($(id).value) || 0;
  const food = { brand: $('nfBrand').value.trim(), name: $('nfName').value.trim(), serving: $('nfServing').value.trim(),
    kcal: n('nfKcal'), protein: n('nfProtein'), carbs: n('nfCarbs'), fat: n('nfFat') };
  if ($('nfPer').value) food.perContainer = n('nfPer');
  if (!food.name) return;
  const label = foodLabel(food).toLowerCase();
  state.foods = [food, ...state.foods.filter((f) => foodLabel(f).toLowerCase() !== label)].slice(0, 500);
  save();
  if (newFoodForMeal) { draft.foods.push({ ...food, name: foodLabel(food), qty: 1 }); showScreen('newMealForm'); renderDraft(); }
  else { showScreen('browse'); setTab('foods'); }
  setStatus(`Saved ${foodLabel(food)}.`);
};

// ----- create (or edit) a meal -----
function openMealBuilder(m) {
  draft = { id: m ? m.id : null, foods: m ? m.foods.map((f) => ({ ...f })) : [] };
  $('newMealForm').reset();
  $('nmName').value = m ? m.name : '';
  showScreen('newMealForm');
  if (m) $('sheetTitle').textContent = 'Edit meal';
  renderDraft();
}
function renderDraftTotal() {
  $('nmTotal').textContent = draft.foods.length ? `Total: ${macroLine(totals(draft.foods))}` : 'No foods yet. Add them below.';
}
function renderDraft() {
  $('nmFoods').replaceChildren(...draft.foods.map((f, i) => {
    const row = el('div', 'item');
    const text = el('div');
    text.style.cssText = 'flex:1;min-width:0;padding:8px 12px';
    text.append(el('div', 'name', f.name), el('div', 'small muted', foodSub(f)));
    const qty = el('input');
    Object.assign(qty, { type: 'number', min: '0.01', step: 'any', value: f.qty, inputMode: 'decimal' });
    qty.setAttribute('aria-label', `Servings of ${f.name}`);
    qty.oninput = () => { const v = parseFloat(qty.value); if (v > 0 && v <= 1000) { f.qty = v; renderDraftTotal(); } };
    const del = el('button', 'more', '✕');
    del.type = 'button';
    del.setAttribute('aria-label', `Remove ${f.name}`);
    del.onclick = () => { draft.foods.splice(i, 1); renderDraft(); };
    row.append(text, qty, del);
    return row;
  }));
  renderDraftTotal();
  renderPick();
}
function renderPick() {
  const q = $('nmSearch').value.trim().toLowerCase();
  const add = (f) => () => { draft.foods.push({ ...f, name: foodLabel(f), qty: 1 }); renderDraft(); };
  $('nmPick').replaceChildren(...myFoods().filter((f) => foodLabel(f).toLowerCase().includes(q)).slice(0, 20)
    .map((f) => itemRow(foodLabel(f), foodSub(f), add(f), add(f), 'Add')));
}
$('nmSearch').oninput = renderPick;
$('nmNewFood').onclick = () => openNewFood(true);
$('newMealForm').onsubmit = (ev) => {
  ev.preventDefault();
  const name = $('nmName').value.trim();
  if (!name) return;
  if (!draft.foods.length) { setStatus('Add at least one food to the meal.', true); return; }
  const meal = { id: draft.id ?? Date.now(), name, foods: draft.foods };
  const old = state.meals.find((m) => m.id === draft.id);
  if (old) meal.lastUsed = old.lastUsed;
  state.meals = [meal, ...state.meals.filter((m) => m.id !== meal.id && m.name.toLowerCase() !== name.toLowerCase())].slice(0, 200);
  save();
  showScreen('browse');
  setTab('meals');
  setStatus(`Saved ${name}.`);
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
    // The sheet was closed or a typed barcode was found while the camera started: turn it back off.
    if ($('scanBox').hidden) { stopScan(); return; }
    setStatus('Point the camera at the barcode.');
  } catch (e) {
    if ($('scanBox').hidden) return;
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
    showScreen('foodForm');
    setStatus('Found it. Check the numbers against the label, then add it.');
  } catch (e) {
    setStatus(navigator.onLine === false
      ? "You're offline. Barcode lookup needs internet, but you can enter the label by hand."
      : 'Lookup failed. Check your internet connection and try again.', true);
  }
}

// ---------- backup ----------
function setBackupStatus(msg, err) { $('backupStatus').textContent = msg; $('backupStatus').classList.toggle('err', !!err); }

$('exportBtn').onclick = async () => {
  const name = `macro-diary-${dayKey(new Date())}.json`;
  const file = new File([JSON.stringify(Backup.wrap(state), null, 1)], name, { type: 'application/json' });
  // The share sheet ("Save to Files") is the reliable way to save a file from an iPhone home-screen app.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); setBackupStatus(`Exported ${name}.`); }
    catch (e) { if (e.name !== 'AbortError') setBackupStatus('Export failed. Try again.', true); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  setBackupStatus(`Exported ${name}.`);
};

// No `accept` filter on the file input: iOS greys out .json files for some accept values.
$('importBtn').onclick = () => { $('importFile').value = ''; $('importFile').click(); };
$('importFile').onchange = async () => {
  const f = $('importFile').files[0];
  if (!f) return;
  if (f.size > Backup.MAX_FILE_BYTES) { setBackupStatus('The file is too big to be a backup.', true); return; }
  const { state: next, error } = Backup.parse(await f.text());
  if (error) { setBackupStatus(`Not imported: ${error}`, true); return; }
  const days = Object.keys(next.log).length;
  const hasData = state.profile || Object.keys(state.log).length || state.recent.length || state.foods.length;
  if (hasData && !confirm(`Replace everything on this phone with this backup (${days} days of diary)? This can't be undone.`)) return;
  state = next; units = state.units; save();
  setUnits(units);
  if (state.profile) { fillProfile(state.profile); renderTargets(Calc.targets(state.profile)); }
  else { $('profileForm').reset(); $('targetsCard').hidden = true; }
  renderToday();
  setBackupStatus(`Imported ${days} day${days === 1 ? '' : 's'} of diary.`);
};

// ---------- start ----------
setUnits(units);
if (state.profile) { fillProfile(state.profile); renderTargets(Calc.targets(state.profile)); }
renderToday();
show(state.profile ? 'today' : 'more');

// Asks the browser not to evict our storage under pressure (Chrome/Android; Safari may ignore it).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* app still works online */ });
