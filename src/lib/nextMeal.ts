/**
 * Next-meal recommendation engine.
 *
 * Deterministic and data-driven: every number comes from FOODS (USDA per-100 g data) scaled by
 * grams. The optional LLM layer (supabase/functions/next-meal-coach) may only re-word the
 * explanation; it never changes nutrition values or picks foods outside these candidates.
 */
import { FOODS, type Allergen } from '../data/foods';
import { RECIPES, type Recipe } from '../data/recipes';
import { scaleNutrients, sumNutrients, type Remaining } from './nutrition';
import type { MealType, Nutrients } from './types';

export interface NextMealProfile {
  allergies: string[];
  dislikedFoods: string[];
  dietaryPreferences: string[]; // 'vegetarian' | 'pescatarian'
  isMinor: boolean;
}

export interface NextMealPrefs {
  favorites: string[];
  rejected: string[];
  pantry: string[];
  budgetTier: 1 | 2 | 3;
}

export interface NextMealInput {
  dailyKcalGoal: number;
  remaining: Remaining;
  now: Date;
  mealsLoggedToday: MealType[];
  profile: NextMealProfile;
  prefs: NextMealPrefs;
  /** Recipe ids eaten recently (most recent first), for variety. */
  recentRecipeIds: string[];
  excludeIds?: string[];
  mealTypeOverride?: MealType;
}

export interface PlannedIngredient {
  food: string;
  grams: number;
  swaps: string[];
  nutrients: Nutrients;
}

export type SuggestionKind = 'best_fit' | 'variety' | 'quick_budget';

export interface MealSuggestion {
  kind: SuggestionKind;
  recipe: Recipe;
  ingredients: PlannedIngredient[];
  totals: Nutrients;
  /** 0–100: how well this portion matches the macro target for this meal. */
  fitPercent: number;
  reasons: { key: string; params?: Record<string, string | number> }[];
  autoSwapped: { from: string; to: string }[];
}

export interface NextMealResult {
  mealType: MealType;
  target: Remaining;
  mode: 'normal' | 'light' | 'goal_reached';
  suggestions: MealSuggestion[];
}

const SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };
const ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export function mealTypeForTime(now: Date): MealType {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17.5) return 'snack';
  if (h < 21.5) return 'dinner';
  return 'snack';
}

/** What share of today's remaining macros this meal should cover. */
export function mealTarget(input: Pick<NextMealInput, 'dailyKcalGoal' | 'remaining' | 'now' | 'mealsLoggedToday' | 'mealTypeOverride'>): { mealType: MealType; target: Remaining } {
  const mealType = input.mealTypeOverride ?? mealTypeForTime(input.now);
  const h = input.now.getHours();
  const idx = ORDER.indexOf(mealType);
  // Meals still ahead today (after this one) that have not been logged yet.
  const ahead = h >= 21 ? [] : ORDER.slice(idx + 1).filter((m) => !input.mealsLoggedToday.includes(m));
  const denom = SHARE[mealType] + ahead.reduce((s, m) => s + SHARE[m], 0);
  let frac = SHARE[mealType] / denom;
  // A single meal should not exceed ~1.4× its usual share of the whole day.
  const capKcal = input.dailyKcalGoal * SHARE[mealType] * 1.4;
  const rawKcal = input.remaining.kcal * frac;
  if (rawKcal > capKcal) frac = capKcal / Math.max(1, input.remaining.kcal);
  return {
    mealType,
    target: {
      kcal: input.remaining.kcal * frac,
      protein: input.remaining.protein * frac,
      carbs: input.remaining.carbs * frac,
      fat: input.remaining.fat * frac,
    },
  };
}

function recipeAllergens(foods: string[]): Set<Allergen> {
  const s = new Set<Allergen>();
  foods.forEach((f) => FOODS[f]?.allergens.forEach((a) => s.add(a)));
  return s;
}

const MEAT = new Set(['chicken_breast', 'lean_beef']);
const SEAFOOD = new Set(['salmon', 'tuna', 'shrimp']);

function foodAllowed(food: string, p: NextMealProfile): boolean {
  const item = FOODS[food];
  if (!item) return false;
  if (item.allergens.some((a) => p.allergies.includes(a))) return false;
  if (p.dislikedFoods.includes(food)) return false;
  if (p.dietaryPreferences.includes('vegetarian') && (MEAT.has(food) || SEAFOOD.has(food))) return false;
  if (p.dietaryPreferences.includes('pescatarian') && MEAT.has(food)) return false;
  return true;
}

/** Same-energy swap: new grams keep calories roughly equal (clamped to 0.5–2× and rounded to 5 g). */
export function swapGrams(fromFood: string, toFood: string, grams: number): number {
  const a = FOODS[fromFood].per100.kcal;
  const b = FOODS[toFood].per100.kcal;
  const g = b > 0 ? (grams * a) / b : grams;
  return round5(Math.min(Math.max(g, grams * 0.5), grams * 2));
}

const round5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);

export function buildIngredients(list: { food: string; grams: number; swaps?: string[] }[]): PlannedIngredient[] {
  return list.map((i) => ({
    food: i.food,
    grams: i.grams,
    swaps: i.swaps ?? [],
    nutrients: scaleNutrients(FOODS[i.food].per100, i.grams),
  }));
}

export function totalsOf(ings: PlannedIngredient[]): Nutrients {
  return sumNutrients(ings.map((i) => i.nutrients));
}

/** Resolve a recipe for this profile: auto-swap disliked/allergen ingredients, or reject the recipe. */
function adaptRecipe(r: Recipe, p: NextMealProfile): { ings: { food: string; grams: number; swaps: string[] }[]; autoSwapped: { from: string; to: string }[] } | null {
  const out: { food: string; grams: number; swaps: string[] }[] = [];
  const autoSwapped: { from: string; to: string }[] = [];
  for (const ing of r.ingredients) {
    if (foodAllowed(ing.food, p)) {
      out.push({ food: ing.food, grams: ing.grams, swaps: (ing.swaps ?? []).filter((s) => foodAllowed(s, p)) });
      continue;
    }
    const alt = (ing.swaps ?? []).find((s) => foodAllowed(s, p));
    if (!alt) return null;
    autoSwapped.push({ from: ing.food, to: alt });
    out.push({
      food: alt,
      grams: swapGrams(ing.food, alt, ing.grams),
      swaps: [ing.food, ...(ing.swaps ?? [])].filter((s) => s !== alt && foodAllowed(s, p)),
    });
  }
  // Safety net: the final ingredient list must be free of declared allergens.
  if ([...recipeAllergens(out.map((i) => i.food))].some((a) => p.allergies.includes(a))) return null;
  return { ings: out, autoSwapped };
}

const FLOOR = { kcal: 80, protein: 8, carbs: 12, fat: 5 };
const WEIGHT = { kcal: 1.0, protein: 1.3, carbs: 0.7, fat: 0.7 };

/** Weighted relative error between a meal and the target; overshooting is penalised 1.5×. */
export function macroError(t: Nutrients, target: Remaining): number {
  let sum = 0;
  let wsum = 0;
  (['kcal', 'protein', 'carbs', 'fat'] as const).forEach((k) => {
    const denom = Math.max(target[k], FLOOR[k]);
    let e = (t[k] - target[k]) / denom;
    if (e > 0) e *= 1.5;
    sum += WEIGHT[k] * Math.min(Math.abs(e), 2);
    wsum += WEIGHT[k];
  });
  return sum / wsum;
}

export function fitPercent(t: Nutrients, target: Remaining): number {
  return Math.max(0, Math.min(100, Math.round(100 * (1 - macroError(t, target) / 1.2))));
}

interface Scored {
  recipe: Recipe;
  ingredients: PlannedIngredient[];
  totals: Nutrients;
  err: number;
  score: number;
  autoSwapped: { from: string; to: string }[];
  vegGrams: number;
  pantryShare: number;
}

function scoreRecipe(r: Recipe, input: NextMealInput, target: Remaining, scaleRange: [number, number]): Scored | null {
  const adapted = adaptRecipe(r, input.profile);
  if (!adapted) return null;
  let best: { s: number; ings: PlannedIngredient[]; totals: Nutrients; err: number } | null = null;
  for (let s = scaleRange[0]; s <= scaleRange[1] + 1e-9; s += 0.05) {
    const ings = buildIngredients(adapted.ings.map((i) => ({ ...i, grams: round5(i.grams * s) })));
    const totals = totalsOf(ings);
    const err = macroError(totals, target);
    if (!best || err < best.err) best = { s, ings, totals, err };
  }
  if (!best) return null;
  const foods = best.ings.map((i) => i.food);
  const pantryShare = input.prefs.pantry.length ? foods.filter((f) => input.prefs.pantry.includes(f)).length / foods.length : 0;
  const vegGrams = best.ings.filter((i) => FOODS[i.food].category === 'vegetable' || FOODS[i.food].category === 'fruit').reduce((a, i) => a + i.grams, 0);
  let score = best.err;
  if (input.prefs.favorites.includes(r.id)) score -= 0.08;
  score -= 0.06 * pantryShare;
  const recentIdx = input.recentRecipeIds.indexOf(r.id);
  if (recentIdx >= 0 && recentIdx < 3) score += 0.25; // eaten very recently
  else if (recentIdx >= 0) score += 0.08;
  if (r.cost > input.prefs.budgetTier) score += 0.06 * (r.cost - input.prefs.budgetTier);
  if (input.profile.isMinor && !r.kidFriendly) score += 0.05;
  return { recipe: r, ingredients: best.ings, totals: best.totals, err: best.err, score, autoSwapped: adapted.autoSwapped, vegGrams, pantryShare };
}

function reasonsFor(s: Scored, target: Remaining, kind: SuggestionKind): MealSuggestion['reasons'] {
  const out: MealSuggestion['reasons'] = [];
  if (kind === 'best_fit') out.push({ key: 'nm.reason.bestFit' });
  if (kind === 'variety') out.push({ key: 'nm.reason.variety' });
  if (kind === 'quick_budget') out.push({ key: s.recipe.prepMinutes <= 10 ? 'nm.reason.quick' : 'nm.reason.budget', params: { min: s.recipe.prepMinutes } });
  if (target.protein >= 10 && s.totals.protein >= target.protein * 0.7) out.push({ key: 'nm.reason.protein', params: { g: Math.round(s.totals.protein) } });
  if (s.totals.fiber >= 6) out.push({ key: 'nm.reason.fiber', params: { g: Math.round(s.totals.fiber) } });
  if (s.vegGrams >= 150) out.push({ key: 'nm.reason.veg' });
  if (s.pantryShare >= 0.5) out.push({ key: 'nm.reason.pantry' });
  if (s.autoSwapped.length) out.push({ key: 'nm.reason.adapted' });
  return out;
}

export function recommendNextMeal(input: NextMealInput): NextMealResult {
  const { mealType: baseType, target: baseTarget } = mealTarget(input);
  let mealType = baseType;
  let target = baseTarget;
  let mode: NextMealResult['mode'] = 'normal';

  // Very little left: offer light options instead of pushing the user to "use up" the budget.
  if (input.remaining.kcal < 60) {
    mode = 'goal_reached';
    mealType = 'snack';
    target = { kcal: 100, protein: Math.min(8, input.remaining.protein || 8), carbs: 10, fat: 3 };
  } else if (input.remaining.kcal < 250 || target.kcal < 150) {
    mode = 'light';
    mealType = 'snack';
    target = { ...input.remaining, kcal: Math.min(input.remaining.kcal, 220) };
  }

  const scaleRange: [number, number] = mode !== 'normal' ? [0.5, 1.0] : input.profile.isMinor ? [0.5, 1.2] : [0.6, 1.6];
  const pool = RECIPES.filter(
    (r) => r.mealTypes.includes(mealType) && !input.prefs.rejected.includes(r.id) && !(input.excludeIds ?? []).includes(r.id),
  );
  const scored = pool
    .map((r) => scoreRecipe(r, input, target, scaleRange))
    .filter((x): x is Scored => !!x)
    .filter((x) => mode === 'normal' || x.totals.kcal <= Math.max(target.kcal * 1.25, 130))
    .sort((a, b) => a.score - b.score);

  const picks: { kind: SuggestionKind; s: Scored }[] = [];
  const used = new Set<string>();
  const take = (kind: SuggestionKind, s?: Scored) => {
    if (s && !used.has(s.recipe.id)) {
      picks.push({ kind, s });
      used.add(s.recipe.id);
    }
  };

  take('best_fit', scored[0]);
  const firstStyle = scored[0]?.recipe.style;
  const variety = scored
    .filter((s) => !used.has(s.recipe.id) && s.recipe.style !== firstStyle)
    .map((s) => ({ s, v: s.score - Math.min(s.vegGrams, 300) / 1500 - Math.min(s.totals.fiber, 12) / 120 }))
    .sort((a, b) => a.v - b.v)[0]?.s;
  take('variety', variety);
  const quick = scored.find((s) => !used.has(s.recipe.id) && (s.recipe.prepMinutes <= 10 || s.recipe.cost === 1));
  take('quick_budget', quick);
  // Fill to three if filters were strict.
  for (const s of scored) {
    if (picks.length >= 3) break;
    take(picks.length === 1 ? 'variety' : 'quick_budget', s);
  }

  return {
    mealType,
    target,
    mode,
    suggestions: picks.map(({ kind, s }) => ({
      kind,
      recipe: s.recipe,
      ingredients: s.ingredients,
      totals: s.totals,
      fitPercent: fitPercent(s.totals, target),
      reasons: reasonsFor(s, target, kind),
      autoSwapped: s.autoSwapped,
    })),
  };
}

/** Replace one ingredient (same-energy portion) and recompute everything. */
export function swapIngredient(ings: PlannedIngredient[], index: number, toFood: string): PlannedIngredient[] {
  return ings.map((ing, i) => {
    if (i !== index) return ing;
    const grams = swapGrams(ing.food, toFood, ing.grams);
    const swaps = [ing.food, ...ing.swaps.filter((s) => s !== toFood)];
    return { food: toFood, grams, swaps, nutrients: scaleNutrients(FOODS[toFood].per100, grams) };
  });
}

export function setIngredientGrams(ings: PlannedIngredient[], index: number, grams: number): PlannedIngredient[] {
  const g = Math.max(5, Math.min(1000, Math.round(grams)));
  return ings.map((ing, i) => (i === index ? { ...ing, grams: g, nutrients: scaleNutrients(FOODS[ing.food].per100, g) } : ing));
}

export function scaleAll(ings: PlannedIngredient[], factor: number): PlannedIngredient[] {
  return ings.map((ing) => {
    const g = round5(ing.grams * factor);
    return { ...ing, grams: g, nutrients: scaleNutrients(FOODS[ing.food].per100, g) };
  });
}
