/**
 * Recipe model shared by the analyzer, the favourites library, substitutions, documents and translations.
 * Nutrition is always computed here from FOODS (USDA) × grams — never taken from an AI model.
 */
import { FOODS } from '../data/foods';
import { RECIPES, type Recipe } from '../data/recipes';
import { scaleNutrients, sumNutrients } from './nutrition';
import type { MealType, Nutrients } from './types';
import { ZERO } from './types';
import type { Unit } from '../data/recipeLexicon';

export type Confidence = 'high' | 'medium' | 'low';
export type CookingMethod = 'none' | 'boiled' | 'baked' | 'grilled' | 'pan_fried' | 'deep_fried' | 'air_fried' | 'steamed';
export type RecipeSourceKind = 'builtin' | 'link' | 'video' | 'text' | 'photos' | 'manual';
export type VersionKind = 'original' | 'improved' | 'translated';
export type DocLang = 'ar' | 'en' | 'fil' | 'hi' | 'ur' | 'ne' | 'fr';

export interface RecipeIngredientLine {
  /** Text as written in the source (kept for transparency). */
  raw: string;
  /** Display name (user-editable). */
  name: string;
  foodId: string | null;
  qty: number | null;
  unit: Unit | null;
  /** Resolved grams used for nutrition. null = unknown → not counted, needs review. */
  grams: number | null;
  confidence: Confidence;
  /** Quantity was estimated (e.g. from a video) and must be confirmed by the user. */
  estimated: boolean;
  toTaste: boolean;
  /** The user explicitly confirmed this line in the review screen. */
  confirmed: boolean;
}

export interface RecipeStep {
  text: string;
  minutes: number | null;
  tempC: number | null;
}

export interface UserRecipe {
  id: string;
  ownerMemberId: string;
  familyId: string;
  parentId: string | null;
  versionKind: VersionKind;
  lang: DocLang;
  title: string;
  description: string;
  emoji: string;
  imageUri: string | null;
  sourceKind: RecipeSourceKind;
  sourceUrl: string | null;
  sourcePlatform: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  cookingMethod: CookingMethod;
  ingredients: RecipeIngredientLine[];
  steps: RecipeStep[];
  tools: string[];
  notes: string;
  servingTip: string;
  /** Final cooked weight in grams, if the user weighed it (enables per-100 g values). */
  finalWeightG: number | null;
  mealTypes: MealType[];
  sharedWithFamily: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeNutrition {
  total: Nutrients;
  perServing: Nutrients;
  per100g: Nutrients | null;
  confidence: Confidence;
  /** Ingredient lines that were not counted (unknown food or quantity). */
  uncounted: string[];
  /** Oil absorbed during deep frying — an explicit, labelled estimate. */
  absorbedOilG: number;
  rawWeightG: number;
}

/** Share of the non-fat ingredient weight assumed absorbed as oil when deep-frying (labelled as an estimate). */
export const DEEP_FRY_ABSORPTION = 0.08;

export function computeRecipeNutrition(r: Pick<UserRecipe, 'ingredients' | 'servings' | 'finalWeightG' | 'cookingMethod'>): RecipeNutrition {
  const counted = r.ingredients.filter((i) => i.foodId && FOODS[i.foodId] && i.grams != null && i.grams > 0);
  const uncounted = r.ingredients.filter((i) => !counted.includes(i) && !(i.toTaste && isNegligible(i.foodId))).map((i) => i.name || i.raw);
  const parts = counted.map((i) => scaleNutrients(FOODS[i.foodId!].per100, i.grams!));
  const rawWeightG = counted.reduce((s, i) => s + (i.grams ?? 0), 0);
  let absorbedOilG = 0;
  if (r.cookingMethod === 'deep_fried') {
    const solid = counted.filter((i) => FOODS[i.foodId!].category !== 'fat' && !LIQUIDS.has(i.foodId!)).reduce((s, i) => s + (i.grams ?? 0), 0);
    absorbedOilG = Math.round(solid * DEEP_FRY_ABSORPTION);
    // Oil listed "for frying" is replaced by the absorbed estimate (most of it stays in the pan).
    const fryOil = counted.filter((i) => (i.foodId === 'veg_oil' || i.foodId === 'olive_oil') && /قلي|fry/i.test(i.raw));
    fryOil.forEach((i) => parts.splice(counted.indexOf(i), 1, ZERO));
    if (absorbedOilG > 0) parts.push(scaleNutrients(FOODS.veg_oil.per100, absorbedOilG));
  }
  const total = sumNutrients(parts);
  const servings = Math.max(1, r.servings || 1);
  const perServing = sumNutrients([total].map((t) => divide(t, servings)));
  const per100g = r.finalWeightG && r.finalWeightG > 0 ? divide(total, r.finalWeightG / 100) : null;
  return { total, perServing, per100g, confidence: recipeConfidence(r.ingredients, r.cookingMethod), uncounted, absorbedOilG, rawWeightG };
}

const LIQUIDS = new Set(['water', 'milk_whole', 'milk_lowfat', 'heavy_cream', 'coconut_milk', 'soy_sauce', 'lemon']);
const isNegligible = (foodId: string | null) => foodId === 'salt' || foodId === 'spices' || foodId === 'water' || foodId === 'parsley' || foodId === 'lemon' || foodId == null;

function divide(n: Nutrients, by: number): Nutrients {
  const out = { ...n };
  (Object.keys(out) as (keyof Nutrients)[]).forEach((k) => (out[k] = Math.round((n[k] / by) * 10) / 10));
  return out;
}

/** Overall confidence: the weakest material line wins; "to taste" seasonings do not lower it. */
export function recipeConfidence(lines: RecipeIngredientLine[], method: CookingMethod = 'none'): Confidence {
  const material = lines.filter((l) => !(l.toTaste && isNegligible(l.foodId)));
  if (material.some((l) => !l.foodId || l.grams == null || (l.confidence === 'low' && !l.confirmed))) return 'low';
  if (method === 'deep_fried' || material.some((l) => (l.confidence === 'medium' || l.estimated) && !l.confirmed)) return 'medium';
  return 'high';
}

export function needsReview(l: RecipeIngredientLine): boolean {
  if (l.confirmed) return false;
  if (l.toTaste && isNegligible(l.foodId)) return false;
  return !l.foodId || l.grams == null || l.confidence === 'low' || l.estimated;
}

// ---------------------------------------------------------------------------
// Built-in recipes viewed through the same model (so they can be favourited, documented and translated).
// ---------------------------------------------------------------------------
export const BUILTIN_PREFIX = 'b:';
export const isBuiltinRef = (id: string) => id.startsWith(BUILTIN_PREFIX);

export function builtinAsUserRecipe(r: Recipe, lang: 'ar' | 'en'): UserRecipe {
  return {
    id: BUILTIN_PREFIX + r.id,
    ownerMemberId: '',
    familyId: '',
    parentId: null,
    versionKind: 'original',
    lang,
    title: r[lang],
    description: '',
    emoji: r.emoji,
    imageUri: null,
    sourceKind: 'builtin',
    sourceUrl: null,
    sourcePlatform: null,
    servings: 1,
    prepMinutes: r.prepMinutes,
    cookMinutes: null,
    difficulty: r.prepMinutes <= 10 ? 'easy' : 'medium',
    cookingMethod: 'none',
    ingredients: r.ingredients.map((i) => ({
      raw: `${i.grams} g ${FOODS[i.food][lang]}`, name: FOODS[i.food][lang], foodId: i.food, qty: i.grams, unit: 'g', grams: i.grams,
      confidence: 'high', estimated: false, toTaste: false, confirmed: true,
    })),
    steps: (lang === 'ar' ? r.stepsAr : r.stepsEn).map((text) => ({ text, minutes: minutesIn(text), tempC: tempIn(text) })),
    tools: [],
    notes: '',
    servingTip: '',
    finalWeightG: null,
    mealTypes: r.mealTypes,
    sharedWithFamily: false,
    createdAt: '',
    updatedAt: '',
  };
}

export function findBuiltin(ref: string): Recipe | undefined {
  return RECIPES.find((r) => BUILTIN_PREFIX + r.id === ref);
}

export function minutesIn(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|إلى|to)?\s*(\d+)?\s*(دقائق|دقيقة|دقيقه|min|mins|minutes)/i);
  if (m) return Math.round(+(m[2] ?? m[1]));
  const h = text.match(/(\d+(?:\.\d+)?)\s*(ساعة|ساعه|ساعات|hour|hours|hr)/i);
  if (h) return Math.round(+h[1] * 60);
  if (/(ربع ساعة|quarter of an hour)/i.test(text)) return 15;
  if (/(نصف ساعة|half an hour)/i.test(text)) return 30;
  return null;
}

export function tempIn(text: string): number | null {
  const c = text.match(/(\d{2,3})\s*(?:°|º|درجة|درجه)?\s*(?:c\b|°c|مئوية|مئويه|سيليزي|celsius|degrees c)/i) ?? text.match(/(?:حرارة|حراره|فرن|oven)[^\d]{0,20}(\d{2,3})/i);
  if (c) return +c[1];
  const f = text.match(/(\d{3})\s*(?:°\s*f|fahrenheit|degrees f)/i);
  if (f) return Math.round(((+f[1] - 32) * 5) / 9);
  return null;
}

/** Portion-able candidate for the next-meal engine: one serving, matched foods only. */
export function asNextMealRecipe(r: UserRecipe): Recipe | null {
  const lines = r.ingredients.filter((i) => !(i.toTaste && isNegligible(i.foodId)));
  if (!lines.length || lines.some((i) => !i.foodId || !FOODS[i.foodId] || i.grams == null)) return null;
  const s = Math.max(1, r.servings);
  const ings = lines.filter((i) => (i.grams ?? 0) / s >= 1).map((i) => ({ food: i.foodId!, grams: Math.max(1, Math.round(i.grams! / s)) }));
  return {
    id: r.id,
    ar: r.title,
    en: r.title,
    emoji: r.emoji || '🍽️',
    mealTypes: r.mealTypes.length ? r.mealTypes : ['lunch', 'dinner'],
    style: 'plate',
    prepMinutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) || 30,
    cost: 2,
    kidFriendly: false,
    vegetarian: false,
    ingredients: ings,
    stepsAr: r.steps.map((x) => x.text),
    stepsEn: r.steps.map((x) => x.text),
  };
}

export const SERVING_OPTIONS = [0.5, 1, 1.5, 2];

export function scaleNutrientsBy(n: Nutrients, f: number): Nutrients {
  const out = { ...n };
  (Object.keys(out) as (keyof Nutrients)[]).forEach((k) => (out[k] = Math.round(n[k] * f * 10) / 10));
  return out;
}
