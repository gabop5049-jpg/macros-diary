const test = require('node:test');
const assert = require('node:assert');
const { dayKey, weekDays, totals, macroSplit, streak, weeklyWeights } = require('../stats.js');
const { TAGS, IDEAS } = require('../ideas.js');

const day = (m, d) => new Date(2026, m - 1, d);

test('week runs Sunday to Saturday', () => {
  const days = weekDays(day(10, 22)); // a Thursday
  assert.deepStrictEqual([dayKey(days[0]), dayKey(days[6])], ['2026-10-18', '2026-10-24']);
  assert.strictEqual(dayKey(weekDays(day(10, 18))[0]), '2026-10-18'); // Sunday is its own week start
});

test('totals use servings, and default to 1 serving', () => {
  const t = totals([{ kcal: 100, protein: 10, carbs: 5, fat: 2, qty: 2 }, { kcal: 50, protein: 0, carbs: 10, fat: 1 }]);
  assert.deepStrictEqual(t, { kcal: 250, protein: 20, carbs: 20, fat: 5 });
});

test('macro split is by calories, not grams', () => {
  // 50 g carbs = 200 kcal, 10 g fat = 90 kcal, 25 g protein = 100 kcal
  assert.deepStrictEqual(macroSplit({ carbs: 50, fat: 10, protein: 25 }), { carbs: 51, fat: 23, protein: 26 });
  assert.deepStrictEqual(macroSplit({ carbs: 0, fat: 0, protein: 0 }), { carbs: 0, fat: 0, protein: 0 });
});

test('streak counts days in a row and survives until you log today', () => {
  const f = [{ kcal: 1 }];
  const log = { '2026-10-19': f, '2026-10-20': f, '2026-10-21': f, '2026-10-17': f };
  assert.strictEqual(streak(log, day(10, 22)), 3); // today empty: counts back from yesterday
  assert.strictEqual(streak({ ...log, '2026-10-22': f }, day(10, 22)), 4);
  assert.strictEqual(streak({ ...log, '2026-10-21': [] }, day(10, 22)), 0);
});

test('weekly weights average each week and leave gaps empty', () => {
  const w = weeklyWeights({ '2026-10-19': 80, '2026-10-21': 81, '2026-10-05': 82, '2026-09-01': 90 }, day(10, 22), 3);
  assert.deepStrictEqual(w.map((x) => [dayKey(x.start), x.avg]), [['2026-10-04', 82], ['2026-10-11', null], ['2026-10-18', 80.5]]);
});

test('every meal idea has a known tag and valid foods', () => {
  for (const idea of IDEAS) {
    assert.ok(idea.tags.length && idea.tags.every((t) => TAGS.includes(t)), idea.name);
    for (const f of idea.foods) for (const k of ['kcal', 'protein', 'carbs', 'fat']) assert.ok(f[k] >= 0, `${idea.name} ${f.name} ${k}`);
  }
  for (const tag of TAGS) assert.ok(IDEAS.some((i) => i.tags.includes(tag)), tag);
});
