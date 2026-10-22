// Date and diary math for the Today and Progress pages. Pure functions, no DOM, so Node can test them.
(function (root) {
  // Local time, not UTC, so "today" matches the phone's clock.
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  // Weeks run Sunday to Saturday, like the week strip.
  const weekStart = (d) => addDays(d, -d.getDay());
  const weekDays = (d) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i));

  // Foods without qty (meal ideas) count as one serving.
  const totals = (items) => items.reduce((t, e) => {
    const q = e.qty ?? 1;
    return { kcal: t.kcal + e.kcal * q, protein: t.protein + e.protein * q, carbs: t.carbs + e.carbs * q, fat: t.fat + e.fat * q };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  // Share of calories from each macro, in whole percent. All zero when nothing is logged.
  function macroSplit(t) {
    const c = t.carbs * 4, f = t.fat * 9, p = t.protein * 4, sum = c + f + p;
    if (!sum) return { carbs: 0, fat: 0, protein: 0 };
    return { carbs: Math.round((c / sum) * 100), fat: Math.round((f / sum) * 100), protein: Math.round((p / sum) * 100) };
  }

  // Days in a row with food logged, ending today (or yesterday, so the streak survives until you log today).
  function streak(log, today) {
    const has = (d) => (log[dayKey(d)] || []).length > 0;
    let d = has(today) ? today : addDays(today, -1), n = 0;
    while (has(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  // Average weight (kg) per Sunday-to-Saturday week for the last `weeks` weeks, oldest first.
  // Weeks without a weigh-in have avg null.
  function weeklyWeights(weights, today, weeks) {
    return Array.from({ length: weeks }, (_, i) => {
      const days = weekDays(addDays(today, (i - weeks + 1) * 7));
      const vals = days.map((d) => weights[dayKey(d)]).filter((v) => typeof v === 'number');
      return { start: days[0], avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    });
  }

  // How much bigger serving `to` is than serving `from`, when both are "<amount> <unit>" with the
  // same unit ("30 g" → "45 g" is 1.5, "1/2 cup" → "1 cup" is 2). null when they can't be compared.
  function servingFactor(from, to) {
    const parse = (s) => {
      const m = /^\s*(?:(\d+)\s*\/\s*(\d+)|(\d*\.?\d+))\s*(.*?)\s*$/.exec(s || '');
      if (!m) return null;
      return { amount: m[3] !== undefined ? parseFloat(m[3]) : m[1] / m[2], unit: m[4].toLowerCase() };
    };
    const a = parse(from), b = parse(to);
    if (!a || !b || a.unit !== b.unit || !(a.amount > 0) || !Number.isFinite(a.amount) || !Number.isFinite(b.amount)) return null;
    return b.amount / a.amount;
  }

  const api = { dayKey, addDays, weekStart, weekDays, totals, macroSplit, streak, weeklyWeights, servingFactor };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Stats = api;
})(this);
