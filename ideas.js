// Built-in meal ideas for the Plan page. Numbers are typical label/USDA values per serving listed;
// they're estimates, so brands will differ a little.
(function (root) {
  const F = (name, serving, kcal, protein, carbs, fat) => ({ name, serving, kcal, protein, carbs, fat });
  const PB2 = F('Peanut butter', '2 tbsp', 190, 7, 7, 16);
  const BANANA = F('Banana', '1 medium', 105, 1.3, 27, 0.4);
  const WHOLE_MILK = F('Whole milk', '1 cup', 149, 8, 12, 8);

  const TAGS = ['High protein', 'Low calorie', 'Cutting', 'Bulking'];
  const IDEAS = [
    { name: 'Greek yogurt bowl', tags: ['High protein', 'Cutting'], foods: [
      F('Nonfat Greek yogurt', '1 cup', 130, 23, 9, 0), F('Blueberries', '1/2 cup', 42, 0.5, 11, 0.2),
      F('Granola', '1/4 cup', 120, 3, 18, 4.5), F('Honey', '1 tsp', 21, 0, 6, 0)] },
    { name: 'Chicken and rice bowl', tags: ['High protein'], foods: [
      F('Grilled chicken breast', '6 oz', 280, 53, 0, 6), F('White rice, cooked', '1 cup', 205, 4, 45, 0.4),
      F('Broccoli', '1 cup', 31, 2.5, 6, 0.3), F('Olive oil', '1 tbsp', 119, 0, 0, 13.5)] },
    { name: 'Egg white omelette', tags: ['High protein', 'Low calorie', 'Cutting'], foods: [
      F('Egg whites', '1 cup', 126, 26, 2, 0.4), F('Spinach', '1 cup', 7, 0.9, 1.1, 0.1),
      F('Feta cheese', '1 oz', 75, 4, 1.2, 6), F('Whole wheat toast', '1 slice', 80, 4, 14, 1)] },
    { name: 'Tuna wrap', tags: ['High protein', 'Low calorie', 'Cutting'], foods: [
      F('Tuna in water, drained', '1 can', 120, 26, 0, 1), F('Light mayo', '1 tbsp', 35, 0, 1, 3.5),
      F('Whole wheat tortilla', '1 large', 130, 4, 22, 3), F('Lettuce', '1/2 cup', 4, 0.3, 0.8, 0)] },
    { name: 'Protein shake', tags: ['High protein', 'Bulking'], foods: [
      F('Whey protein', '1 scoop', 120, 24, 3, 1.5), BANANA, F('2% milk', '1 cup', 122, 8, 12, 4.8), PB2] },
    { name: 'Turkey lettuce wraps', tags: ['Low calorie', 'Cutting', 'High protein'], foods: [
      F('Deli turkey', '3 oz', 90, 15, 3, 1.5), F('Romaine leaves', '3 leaves', 5, 0.4, 1, 0.1),
      F('Tomato', '1/2 medium', 11, 0.5, 2.4, 0.1), F('Mustard', '1 tsp', 3, 0.2, 0.3, 0.2)] },
    { name: 'Veggie egg scramble', tags: ['Low calorie', 'Cutting'], foods: [
      F('Eggs', '2 large', 143, 12.6, 0.7, 9.5), F('Bell pepper', '1/2 cup', 15, 0.5, 3.5, 0.1),
      F('Onion', '1/4 cup', 16, 0.4, 3.7, 0), F('Salsa', '2 tbsp', 10, 0.5, 2, 0)] },
    { name: 'Shrimp stir-fry', tags: ['Low calorie', 'High protein', 'Cutting'], foods: [
      F('Shrimp, cooked', '4 oz', 112, 24, 0.2, 1.2), F('Stir-fry vegetables', '1.5 cups', 60, 3, 12, 0.5),
      F('Soy sauce', '1 tbsp', 9, 1.3, 0.8, 0.1), F('Sesame oil', '1 tsp', 40, 0, 0, 4.5)] },
    { name: 'Apple and peanut butter', tags: ['Low calorie'], foods: [
      F('Apple', '1 medium', 95, 0.5, 25, 0.3), F('Peanut butter', '1 tbsp', 95, 3.5, 3.5, 8)] },
    { name: 'Salmon and quinoa', tags: ['Cutting', 'High protein'], foods: [
      F('Salmon, baked', '5 oz', 290, 31, 0, 17), F('Asparagus', '1 cup', 27, 3, 5, 0.2),
      F('Quinoa, cooked', '1/2 cup', 111, 4, 20, 1.8)] },
    { name: 'PB&J with milk', tags: ['Bulking'], foods: [
      F('White bread', '2 slices', 160, 5, 30, 2), PB2, F('Grape jelly', '1 tbsp', 56, 0, 14, 0), WHOLE_MILK] },
    { name: 'Steak and potato', tags: ['Bulking', 'High protein'], foods: [
      F('Sirloin steak, cooked', '8 oz', 460, 62, 0, 22), F('Baked potato', '1 large', 278, 7.5, 63, 0.4),
      F('Butter', '1 tbsp', 102, 0.1, 0, 11.5), F('Green beans', '1 cup', 44, 2.4, 10, 0.4)] },
    { name: 'Loaded oatmeal', tags: ['Bulking'], foods: [
      F('Rolled oats, dry', '1 cup', 307, 11, 55, 5), WHOLE_MILK, BANANA, PB2, F('Honey', '1 tbsp', 64, 0, 17, 0)] },
    { name: 'Spaghetti bolognese', tags: ['Bulking'], foods: [
      F('Spaghetti, cooked', '2 cups', 440, 16, 86, 2.6), F('90% lean ground beef, cooked', '4 oz', 220, 26, 0, 12),
      F('Marinara sauce', '1/2 cup', 70, 2, 11, 2), F('Parmesan', '2 tbsp', 42, 3.8, 0.4, 2.8)] },
  ];

  const api = { TAGS, IDEAS };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Ideas = api;
})(this);
