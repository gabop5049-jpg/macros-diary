// Export and import of all app data. Imported files are untrusted: every value is checked, and
// only known fields are copied into a fresh object, so nothing unexpected reaches the app.
(function (root) {
  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  const ENUMS = {
    sex: ['male', 'female'],
    activity: ['sedentary', 'light', 'moderate', 'very', 'extreme'],
    training: ['strength', 'mixed', 'cardio', 'none'],
    goal: ['cut', 'recomp', 'maintain', 'bulk'],
    intensity: ['easy', 'standard', 'aggressive'],
    lifeStage: ['none', 'preg1', 'preg2', 'preg3', 'breastfeeding'],
  };
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fail = (msg) => { throw new Error(msg); };
  function num(v, min, max, where) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(`${where} must be a number from ${min} to ${max}.`);
    return v;
  }
  function str(v, maxLen, where, allowEmpty) {
    if (typeof v !== 'string' || v.length > maxLen || (!allowEmpty && !v.trim())) fail(`${where} must be text up to ${maxLen} characters.`);
    return v;
  }
  function oneOf(v, list, where) { if (!list.includes(v)) fail(`${where} has an unknown value.`); return v; }

  function food(f, where) {
    if (!isObj(f)) fail(`${where} is not a food.`);
    return {
      name: str(f.name, 120, `${where} name`), serving: str(f.serving ?? '', 40, `${where} serving`, true),
      kcal: num(f.kcal, 0, 20000, `${where} calories`), protein: num(f.protein, 0, 2000, `${where} protein`),
      carbs: num(f.carbs, 0, 2000, `${where} carbs`), fat: num(f.fat, 0, 2000, `${where} fat`),
    };
  }

  function profile(p) {
    if (p === null) return null;
    if (!isObj(p)) fail('Profile is not valid.');
    const out = {
      age: num(p.age, 13, 100, 'Age'), heightCm: num(p.heightCm, 100, 250, 'Height'),
      weightKg: num(p.weightKg, 25, 450, 'Weight'), bodyFat: num(p.bodyFat, 0, 70, 'Body fat'),
    };
    if (out.bodyFat > 0 && out.bodyFat < 3) fail('Body fat must be 0 (unknown) or from 3 to 70.');
    for (const [k, list] of Object.entries(ENUMS)) out[k] = oneOf(p[k], list, `Profile ${k}`);
    return out;
  }

  // Returns a clean state object, or throws an Error whose message can be shown to the user.
  function validate(file) {
    if (!isObj(file) || file.app !== 'macro-diary' || file.version !== 1 || !isObj(file.data)) fail('This is not a Macro Diary backup.');
    const d = file.data;
    const state = { units: oneOf(d.units, ['imperial', 'metric'], 'Units'), profile: profile(d.profile), log: {}, recent: [] };
    if (!isObj(d.log)) fail('Diary is not valid.');
    for (const [day, list] of Object.entries(d.log)) {
      if (!DATE.test(day)) fail(`"${day.slice(0, 20)}" is not a date.`);
      if (!Array.isArray(list) || list.length > 500) fail(`Diary for ${day} is not valid.`);
      state.log[day] = list.map((e, i) => {
        const where = `${day} item ${i + 1}`;
        return { ...food(e, where), id: num(e.id, 0, Number.MAX_SAFE_INTEGER, `${where} id`),
          meal: oneOf(e.meal, MEALS, `${where} meal`), qty: num(e.qty, 0.001, 1000, `${where} servings`) };
      });
    }
    if (!Array.isArray(d.recent) || d.recent.length > 50) fail('Recent foods are not valid.');
    state.recent = d.recent.map((f, i) => food(f, `Recent food ${i + 1}`));
    // Weights and saved meals came later, so older backups without them still import.
    const weights = d.weights ?? {};
    if (!isObj(weights)) fail('Weights are not valid.');
    state.weights = {};
    for (const [day, kg] of Object.entries(weights)) {
      if (!DATE.test(day)) fail(`"${day.slice(0, 20)}" is not a date.`);
      state.weights[day] = num(kg, 25, 450, `Weight on ${day}`);
    }
    const meals = d.meals ?? [];
    if (!Array.isArray(meals) || meals.length > 200) fail('Saved meals are not valid.');
    state.meals = meals.map((m, i) => {
      const where = `Saved meal ${i + 1}`;
      if (!isObj(m) || !Array.isArray(m.foods) || !m.foods.length || m.foods.length > 50) fail(`${where} is not valid.`);
      return { id: num(m.id, 0, Number.MAX_SAFE_INTEGER, `${where} id`), name: str(m.name, 120, `${where} name`),
        foods: m.foods.map((f, j) => ({ ...food(f, `${where} food ${j + 1}`), qty: num(f.qty, 0.001, 1000, `${where} food ${j + 1} servings`) })) };
    });
    return state;
  }

  // Parses file text and validates it. Never throws: returns { state } or { error }.
  function parse(text) {
    try {
      if (text.length > MAX_FILE_BYTES) fail('The file is too big to be a backup.');
      let json;
      try { json = JSON.parse(text); } catch (e) { fail('The file is not valid JSON.'); }
      return { state: validate(json) };
    } catch (e) { return { error: e.message }; }
  }

  const wrap = (state) => ({ app: 'macro-diary', version: 1, exportedAt: new Date().toISOString(), data: state });

  const api = { parse, wrap, MAX_FILE_BYTES };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Backup = api;
})(this);
