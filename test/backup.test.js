const test = require('node:test');
const assert = require('node:assert');
const { parse, wrap } = require('../backup.js');

const good = {
  units: 'metric',
  profile: { sex: 'female', age: 30, heightCm: 165, weightKg: 60, bodyFat: 0, activity: 'light',
    training: 'mixed', goal: 'cut', intensity: 'standard', lifeStage: 'none' },
  log: { '2026-10-22': [{ id: 1761100000000.5, meal: 'Lunch', qty: 1.5, name: 'Oats', serving: '40 g', kcal: 150, protein: 5, carbs: 27, fat: 3 }] },
  recent: [{ name: 'Oats', serving: '40 g', kcal: 150, protein: 5, carbs: 27, fat: 3 }],
};
const text = (data) => JSON.stringify(wrap(data));
const withData = (patch) => text({ ...structuredClone(good), ...patch });

test('round trip of a real export', () => {
  assert.deepStrictEqual(parse(text(good)).state, good);
});

test('empty app data imports', () => {
  assert.ok(parse(text({ units: 'imperial', profile: null, log: {}, recent: [] })).state);
});

test('extra fields are dropped, not imported', () => {
  const data = structuredClone(good);
  data.log['2026-10-22'][0].evil = '<img src=x onerror=alert(1)>';
  data.extra = 1;
  const { state } = parse(text(data));
  assert.strictEqual(state.log['2026-10-22'][0].evil, undefined);
  assert.strictEqual(state.extra, undefined);
});

test('rejects bad files', () => {
  const bad = {
    'not JSON': '{oops',
    'other app': JSON.stringify({ app: 'x', version: 1, data: good }),
    'string number': withData({ log: { '2026-10-22': [{ ...good.log['2026-10-22'][0], kcal: '150' }] } }),
    'negative': withData({ recent: [{ ...good.recent[0], fat: -1 }] }),
    'unknown meal': withData({ log: { '2026-10-22': [{ ...good.log['2026-10-22'][0], meal: 'Brunch' }] } }),
    'bad date key': withData({ log: { __proto__x: [] } }),
    'proto key': '{"app":"macro-diary","version":1,"data":{"units":"metric","profile":null,"recent":[],"log":{"__proto__":[]}}}',
    'bad enum': withData({ profile: { ...good.profile, lifeStage: 'x' } }),
    'empty name': withData({ recent: [{ ...good.recent[0], name: ' ' }] }),
    'long name': withData({ recent: [{ ...good.recent[0], name: 'a'.repeat(121) }] }),
    'zero qty': withData({ log: { '2026-10-22': [{ ...good.log['2026-10-22'][0], qty: 0 }] } }),
    'log is array': withData({ log: [] }),
  };
  for (const [why, t] of Object.entries(bad)) assert.ok(parse(t).error, why);
});
