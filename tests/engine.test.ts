import { describe, expect, it } from 'vitest';
import { computeGoals, mifflinStJeor, remainingFor, scaleNutrients, sumNutrients, ageOn } from '../src/lib/nutrition';
import { recommendNextMeal, mealTarget, swapIngredient, setIngredientGrams, totalsOf, type NextMealInput } from '../src/lib/nextMeal';
import { FOODS } from '../src/data/foods';
import { RECIPES } from '../src/data/recipes';
import { parseOffProduct, assessProduct, isLikelyBarcode } from '../src/lib/openFoodFacts';
import { buildLeaderboard, earnedHabits, streakFor, ranks } from '../src/lib/points';
import { periodRange } from '../src/lib/dates';
import type { HealthProfile } from '../src/lib/types';

const TODAY = new Date('2026-11-01T13:00:00');
const adult: HealthProfile = {
  memberId: 'm1', birthDate: '1990-03-10', sex: 'female', heightCm: 165, weightKg: 62,
  activityLevel: 'moderate', goal: 'healthy_lifestyle', dietaryPreferences: [], allergies: [], dislikedFoods: [],
};

describe('nutrition engine', () => {
  it('Mifflin-St Jeor matches the published formula', () => {
    expect(mifflinStJeor('male', 80, 180, 30)).toBe(1780);
    expect(mifflinStJeor('female', 62, 165, 36)).toBeCloseTo(1310.25);
  });
  it('adult goals are energy-consistent and within AMDR', () => {
    const g = computeGoals(adult, TODAY);
    expect(g.method).toBe('mifflin_st_jeor');
    expect(g.kcal).toBe(Math.round((1310.25 * 1.55) / 5) * 5);
    const kcalFromMacros = g.protein * 4 + g.carbs * 4 + g.fat * 9;
    expect(Math.abs(kcalFromMacros - g.kcal)).toBeLessThan(15);
    expect(g.protein * 4 / g.kcal).toBeGreaterThanOrEqual(0.1);
  });
  it('never applies a deficit to children, even with a weight-loss goal', () => {
    const kid: HealthProfile = { ...adult, birthDate: '2017-06-01', heightCm: 130, weightKg: 28, goal: 'weight_loss', activityLevel: 'active' };
    const g = computeGoals(kid, TODAY);
    expect(ageOn(kid.birthDate, TODAY)).toBe(9);
    expect(g.method).toBe('iom_eer_child');
    expect(g.notes).toContain('goals.note.minorNoWeightGoal');
    const sameKidNoGoal = computeGoals({ ...kid, goal: 'healthy_lifestyle' }, TODAY);
    expect(g.kcal).toBe(sameKidNoGoal.kcal);
  });
  it('child without weight uses age reference', () => {
    const g = computeGoals({ ...adult, birthDate: '2020-01-01', heightCm: 110, weightKg: null }, TODAY);
    expect(g.method).toBe('age_reference');
    expect(g.kcal).toBeGreaterThanOrEqual(1200);
    expect(g.kcal).toBeLessThanOrEqual(1800);
  });
  it('weight-loss goal keeps a safety floor', () => {
    const g = computeGoals({ ...adult, weightKg: 45, heightCm: 150, activityLevel: 'sedentary', goal: 'weight_loss', birthDate: '1960-01-01' }, TODAY);
    expect(g.kcal).toBeGreaterThanOrEqual(1200);
  });
  it('remaining is floored at zero', () => {
    const r = remainingFor({ kcal: 2000, protein: 100, carbs: 250, fat: 60 }, { kcal: 2100, protein: 50, carbs: 300, fat: 20, fiber: 0, sugar: 0, satFat: 0, sodium: 0 });
    expect(r).toEqual({ kcal: 0, protein: 50, carbs: 0, fat: 40 });
  });
});

describe('reference data', () => {
  it('every recipe ingredient and swap exists in FOODS', () => {
    for (const r of RECIPES) for (const i of r.ingredients) {
      expect(FOODS[i.food], `${r.id}:${i.food}`).toBeDefined();
      for (const s of i.swaps ?? []) expect(FOODS[s], `${r.id}:${s}`).toBeDefined();
    }
  });
  it('food energy is consistent with Atwater factors (±20%)', () => {
    for (const f of Object.values(FOODS)) {
      const atw = f.per100.protein * 4 + f.per100.carbs * 4 + f.per100.fat * 9;
      // Fibre yields ~2 kcal/g rather than 4: use that variant too (matters for spices and seeds).
      const atwFibre = atw - f.per100.fiber * 2;
      const diff = Math.min(Math.abs(atw - f.per100.kcal), Math.abs(atwFibre - f.per100.kcal));
      // low-energy vegetables: fibre makes Atwater overshoot; allow a small absolute gap
      expect(f.per100.kcal === 0 ? atw === 0 : diff / f.per100.kcal < 0.2 || diff < 10, f.id).toBe(true);
    }
  });
});

const base = (over: Partial<NextMealInput> = {}): NextMealInput => ({
  dailyKcalGoal: 2000,
  remaining: { kcal: 750, protein: 55, carbs: 70, fat: 25 },
  now: new Date('2026-11-01T19:30:00'),
  mealsLoggedToday: ['breakfast', 'lunch', 'snack'],
  profile: { allergies: [], dislikedFoods: [], dietaryPreferences: [], isMinor: false },
  prefs: { favorites: [], rejected: [], pantry: [], budgetTier: 2 },
  recentRecipeIds: [],
  ...over,
});

describe('next meal recommendation', () => {
  it('returns three distinct suggestions for dinner that fit remaining macros', () => {
    const res = recommendNextMeal(base());
    expect(res.mealType).toBe('dinner');
    expect(res.mode).toBe('normal');
    expect(res.suggestions).toHaveLength(3);
    expect(new Set(res.suggestions.map((s) => s.recipe.id)).size).toBe(3);
    expect(res.suggestions.map((s) => s.kind)).toEqual(['best_fit', 'variety', 'quick_budget']);
    const best = res.suggestions[0];
    expect(best.totals.kcal).toBeLessThanOrEqual(res.target.kcal * 1.15);
    expect(best.totals.protein).toBeGreaterThan(res.target.protein * 0.6);
    expect(best.fitPercent).toBeGreaterThan(60);
  });
  it('totals equal the sum of ingredient nutrients (single source of truth)', () => {
    for (const s of recommendNextMeal(base()).suggestions) {
      const manual = sumNutrients(s.ingredients.map((i) => scaleNutrients(FOODS[i.food].per100, i.grams)));
      expect(s.totals.kcal).toBeCloseTo(manual.kcal, 6);
    }
  });
  it('never suggests a declared allergen', () => {
    const res = recommendNextMeal(base({ profile: { allergies: ['fish', 'gluten', 'milk'], dislikedFoods: [], dietaryPreferences: [], isMinor: false } }));
    expect(res.suggestions.length).toBeGreaterThan(0);
    for (const s of res.suggestions) for (const i of s.ingredients) {
      expect(FOODS[i.food].allergens.filter((a) => ['fish', 'gluten', 'milk'].includes(a))).toEqual([]);
    }
  });
  it('vegetarian preference excludes meat and seafood', () => {
    const res = recommendNextMeal(base({ profile: { allergies: [], dislikedFoods: [], dietaryPreferences: ['vegetarian'], isMinor: false } }));
    for (const s of res.suggestions) expect(s.ingredients.map((i) => i.food)).not.toContain('chicken_breast');
  });
  it('auto-swaps a disliked ingredient', () => {
    const res = recommendNextMeal(base({ profile: { allergies: [], dislikedFoods: ['broccoli'], dietaryPreferences: [], isMinor: false } }));
    for (const s of res.suggestions) expect(s.ingredients.map((i) => i.food)).not.toContain('broccoli');
  });
  it('does not push the user to eat when almost nothing remains', () => {
    const res = recommendNextMeal(base({ remaining: { kcal: 30, protein: 2, carbs: 0, fat: 0 } }));
    expect(res.mode).toBe('goal_reached');
    for (const s of res.suggestions) expect(s.totals.kcal).toBeLessThan(200);
  });
  it('light mode keeps suggestions small', () => {
    const res = recommendNextMeal(base({ remaining: { kcal: 180, protein: 10, carbs: 20, fat: 5 } }));
    expect(res.mode).toBe('light');
    for (const s of res.suggestions) expect(s.totals.kcal).toBeLessThanOrEqual(230);
  });
  it('at lunch with dinner still ahead, the target is only a share of the remaining', () => {
    const { mealType, target } = mealTarget({ dailyKcalGoal: 2000, remaining: { kcal: 1500, protein: 100, carbs: 180, fat: 50 }, now: new Date('2026-11-01T13:00:00'), mealsLoggedToday: ['breakfast'] });
    expect(mealType).toBe('lunch');
    expect(target.kcal).toBeLessThan(1000);
    expect(target.kcal).toBeGreaterThan(500);
  });
  it('rejected and excluded recipes are not suggested again', () => {
    const first = recommendNextMeal(base());
    const ids = first.suggestions.map((s) => s.recipe.id);
    const again = recommendNextMeal(base({ excludeIds: ids }));
    for (const s of again.suggestions) expect(ids).not.toContain(s.recipe.id);
  });
  it('swap and quantity edits recompute totals immediately', () => {
    const s = recommendNextMeal(base()).suggestions[0];
    const idx = s.ingredients.findIndex((i) => i.swaps.length > 0);
    const swapped = swapIngredient(s.ingredients, idx, s.ingredients[idx].swaps[0]);
    expect(swapped[idx].food).toBe(s.ingredients[idx].swaps[0]);
    const kcalBefore = totalsOf(s.ingredients).kcal;
    const changed = setIngredientGrams(s.ingredients, 0, s.ingredients[0].grams * 2);
    expect(totalsOf(changed).kcal).toBeGreaterThan(kcalBefore);
  });
  it('children get smaller portions range', () => {
    const res = recommendNextMeal(base({ profile: { allergies: [], dislikedFoods: [], dietaryPreferences: [], isMinor: true }, remaining: { kcal: 2000, protein: 100, carbs: 250, fat: 70 }, dailyKcalGoal: 1600 }));
    for (const s of res.suggestions) expect(s.totals.kcal).toBeLessThan(900);
  });
});

describe('Open Food Facts parsing', () => {
  const nutella = {
    code: '3017624010701', product_name: 'Nutella', brands: 'Ferrero,Nutella', serving_quantity: 15, serving_size: '15 g',
    allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
    nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, sugars_100g: 56.3, 'saturated-fat_100g': 10.6, salt_100g: 0.107, fiber_100g: 0 },
  };
  it('parses nutrients, serving and allergens', () => {
    const p = parseOffProduct(nutella, '3017624010701')!;
    expect(p.per100.kcal).toBe(539);
    expect(p.per100.sodium).toBe(43); // 0.107 g salt / 2.5 * 1000
    expect(p.servingGrams).toBe(15);
    expect(p.brand).toBe('Ferrero');
    expect(p.allergens.sort()).toEqual(['milk', 'soy', 'tree_nuts']);
  });
  it('falls back from kJ and refuses records without macros', () => {
    expect(parseOffProduct({ nutriments: { 'energy-kj_100g': 418.4, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } }, '1')!.per100.kcal).toBe(100);
    expect(parseOffProduct({ nutriments: { 'energy-kcal_100g': 100 } }, '1')).toBeNull();
  });
  it('assessment flags high sugar and allergens without absolute verdicts', () => {
    const p = parseOffProduct(nutella, '3017624010701')!;
    const a = assessProduct(p, { remainingKcal: 500, remainingProtein: 40, sugarMax: 50, sodiumMax: 2300, allergies: ['tree_nuts'] }, 15);
    const keys = a.map((x) => x.key);
    expect(keys).toContain('assess.sugarHigh');
    expect(keys).toContain('assess.allergen');
    expect(keys).toContain('assess.alternative');
  });
  it('validates EAN-13 checksums', () => {
    expect(isLikelyBarcode('3017624010701')).toBe(true);
    expect(isLikelyBarcode('3017624010702')).toBe(false);
    expect(isLikelyBarcode('abc')).toBe(false);
  });
});

describe('family points', () => {
  it('awards habits, not body metrics', () => {
    expect(earnedHabits({ waterMl: 1600, waterGoal: 1600, steps: 3000, stepsGoal: 7000, activityMinutes: 20, mealsLogged: 2 }).sort())
      .toEqual(['activity', 'meal_logged', 'water_goal']);
  });
  it('streaks count consecutive days', () => {
    expect(streakFor(new Set(['2026-11-01', '2026-10-31', '2026-10-30', '2026-10-28']), '2026-11-01')).toBe(3);
    expect(streakFor(new Set(['2026-10-31']), '2026-11-01')).toBe(1);
  });
  it('builds a ranked leaderboard with ties', () => {
    const members = ['a', 'b', 'c'].map((id) => ({ id, familyId: 'f', userId: id, displayName: id, avatarEmoji: null, role: 'adult' as const, managedBy: null, shareHealthWithAdmin: false }));
    const pts = [
      { memberId: 'a', logDate: '2026-11-01', reason: 'water_goal', points: 10 },
      { memberId: 'b', logDate: '2026-11-01', reason: 'meal_logged', points: 10 },
      { memberId: 'c', logDate: '2026-11-01', reason: 'activity', points: 20 },
      { memberId: 'c', logDate: '2026-09-01', reason: 'activity', points: 20 },
    ];
    const rows = buildLeaderboard(members, pts, '2026-11-01', '2026-11-01', '2026-11-01');
    expect(rows[0].memberId).toBe('c');
    expect(rows[0].points).toBe(20);
    expect(ranks(rows)).toEqual([1, 2, 2]);
  });
  it('weeks start on Saturday', () => {
    expect(periodRange('week', '2026-11-03')).toEqual(['2026-10-31', '2026-11-03']); // Tue → Sat
    expect(periodRange('month', '2026-11-03')).toEqual(['2026-11-01', '2026-11-03']);
  });
});
