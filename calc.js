// Daily calorie and macro targets. Pure functions, metric units in, numbers out.
(function (root) {
  const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, extreme: 1.9 };

  // Calorie change as a fraction of maintenance, by goal and diet intensity.
  const GOAL_ADJUST = {
    cut:      { easy: -0.10, standard: -0.20, aggressive: -0.25 },
    recomp:   { easy: -0.05, standard: -0.10, aggressive: -0.15 },
    maintain: { easy: 0, standard: 0, aggressive: 0 },
    bulk:     { easy: 0.05, standard: 0.10, aggressive: 0.15 },
  };

  // Protein in grams per kg of body weight (or lean mass, see below).
  const PROTEIN_PER_KG = { cut: 2.2, recomp: 2.2, maintain: 1.8, bulk: 2.0 };

  // Extra kcal/day for pregnancy and breastfeeding (US Dietary Reference Intakes).
  const LIFE_STAGE_KCAL = { none: 0, preg1: 0, preg2: 340, preg3: 452, breastfeeding: 450 };

  function targets(p) {
    const notes = [];
    const lbm = p.bodyFat > 0 ? p.weightKg * (1 - p.bodyFat / 100) : null;

    // Katch-McArdle is more accurate when body fat is known; Mifflin-St Jeor otherwise.
    const bmr = lbm
      ? 370 + 21.6 * lbm
      : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);

    const lifeStage = p.sex === 'female' ? (p.lifeStage || 'none') : 'none';
    const pregnantOrNursing = lifeStage !== 'none';
    const tdee = bmr * (ACTIVITY[p.activity] || ACTIVITY.sedentary) + LIFE_STAGE_KCAL[lifeStage];

    let goal = p.goal;
    let intensity = p.intensity;
    if (pregnantOrNursing && (goal === 'cut' || goal === 'recomp')) {
      goal = 'maintain';
      notes.push('Calorie deficits are not recommended while pregnant or breastfeeding, so this uses maintenance. Talk to your doctor before changing your diet.');
    }
    if (p.age < 18 && goal === 'cut' && intensity !== 'easy') {
      intensity = 'easy';
      notes.push('Under 18, the cut is limited to the easy setting because you are still growing.');
    }

    let calories = tdee * (1 + GOAL_ADJUST[goal][intensity]);
    // The floor never goes above maintenance, so a small, inactive person on a cut still loses weight.
    const floor = Math.min(p.sex === 'male' ? 1500 : 1200, Math.round(tdee));
    if (calories < floor) {
      calories = floor;
      notes.push(`Raised to ${floor} kcal. Eating less than this should be done with a doctor.`);
    }

    // Protein is based on lean mass when known; otherwise on weight, capped at a BMI of 25
    // so heavier people don't get an unrealistically high target.
    const heightM = p.heightCm / 100;
    // With lean mass known, use your weight at 15% body fat (never more than your actual weight).
    const proteinBaseKg = lbm ? Math.min(p.weightKg, lbm / 0.85) : Math.min(p.weightKg, 25 * heightM * heightM);
    let gPerKg = PROTEIN_PER_KG[goal];
    if (p.training === 'none') gPerKg = Math.min(gPerKg, 1.6);
    else if (p.training === 'cardio') gPerKg = Math.min(gPerKg, 1.8);
    const protein = gPerKg * proteinBaseKg;

    // Fat at 25% of calories (30% if you don't train), never under 0.6 g/kg.
    const fatShare = p.training === 'none' ? 0.30 : 0.25;
    const fat = Math.max((calories * fatShare) / 9, 0.6 * p.weightKg);

    // Carbs fill the rest. If protein and fat already use up the calories, carbs go to 0.
    const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);
    const fiber = (calories / 1000) * 14;

    // 7700 kcal is roughly 1 kg of body weight.
    const weeklyChangeKg = ((calories - tdee) * 7) / 7700;

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      fiber: Math.round(fiber),
      weeklyChangeKg: Math.round(weeklyChangeKg * 100) / 100,
      formula: lbm ? 'Katch-McArdle' : 'Mifflin-St Jeor',
      notes,
    };
  }

  const api = { targets, ACTIVITY };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Calc = api;
})(this);
