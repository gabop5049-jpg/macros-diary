const test = require('node:test');
const assert = require('node:assert');
const { targets } = require('../calc.js');

const base = { sex: 'male', age: 25, heightCm: 180, weightKg: 80, bodyFat: 0, activity: 'moderate',
  training: 'strength', goal: 'maintain', intensity: 'standard', lifeStage: 'none' };

test('Mifflin-St Jeor maintenance for a 25 y/o male', () => {
  const t = targets(base);
  assert.strictEqual(t.bmr, 1805); // 800 + 1125 - 125 + 5
  assert.strictEqual(t.tdee, 2798); // 1805 * 1.55
  assert.strictEqual(t.calories, t.tdee);
  assert.strictEqual(t.formula, 'Mifflin-St Jeor');
});

test('macros add up to the calorie target', () => {
  for (const goal of ['cut', 'recomp', 'maintain', 'bulk']) {
    const t = targets({ ...base, goal });
    const kcal = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    assert.ok(Math.abs(kcal - t.calories) < 15, `${goal}: ${kcal} vs ${t.calories}`);
  }
});

test('cut is a deficit and bulk a surplus', () => {
  assert.ok(targets({ ...base, goal: 'cut' }).weeklyChangeKg < 0);
  assert.ok(targets({ ...base, goal: 'bulk' }).weeklyChangeKg > 0);
});

test('body fat switches to Katch-McArdle', () => {
  const t = targets({ ...base, bodyFat: 15 });
  assert.strictEqual(t.formula, 'Katch-McArdle');
  assert.strictEqual(t.bmr, Math.round(370 + 21.6 * 68));
});

test('calorie floor never goes above maintenance', () => {
  const t = targets({ ...base, sex: 'female', age: 70, heightCm: 145, weightKg: 40, activity: 'sedentary', goal: 'cut', intensity: 'aggressive' });
  assert.ok(t.calories <= t.tdee);
  assert.ok(t.notes.length > 0);
});

test('pregnancy blocks a cut', () => {
  const t = targets({ ...base, sex: 'female', lifeStage: 'preg2', goal: 'cut' });
  assert.ok(t.calories >= t.tdee);
});

test('protein is capped for high body weight', () => {
  const t = targets({ ...base, weightKg: 150 });
  assert.ok(t.protein < 2 * 150);
});
