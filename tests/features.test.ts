import { describe, expect, it } from 'vitest';
import { FOODS } from '../src/data/foods';
import { FIL_FOODS, FIL_RECIPES, DOC_LABELS, UNIT_LABELS } from '../src/data/recipeI18n';
import { RECIPES } from '../src/data/recipes';
import { earnedBadges, makeLog, monthSummary, newBadges, plannedDates, defaultFastingProfile, type FastingLog } from '../src/lib/fasting';
import { datesOfHijriMonth, hijriTabular, toHijri } from '../src/lib/hijri';
import { recommendNextMeal, mealTarget, type NextMealInput } from '../src/lib/nextMeal';
import { scaleNutrients, sumNutrients } from '../src/lib/nutrition';
import { asNextMealRecipe, builtinAsUserRecipe, computeRecipeNutrition, needsReview, type UserRecipe } from '../src/lib/recipe';
import { buildDocModel, checkNumbers, docHtml, docText, formatQty, offlineTranslation } from '../src/lib/recipeDoc';
import { linesFromExtraction, parseIngredientLine, parseRecipeText, updateLine } from '../src/lib/recipeParser';
import { applySubstitutions, suggestSubstitutions } from '../src/lib/substitutions';

const CAPTION = `مكرونة الدجاج بالكريمة 🍝
يكفي 4 أشخاص
المكونات:
- 500 غرام صدر دجاج
- 2 كوب معكرونة
- علبة كريمة طبخ 200 مل
- 2 ملعقة كبيرة زبدة
- 3 فصوص ثوم
- بصلة متوسطة
- ½ كوب جبنة بارميزان
- ملح وفلفل حسب الرغبة
الطريقة:
1. اسلقي المعكرونة 10 دقائق ثم صفيها.
2. قطعي الدجاج وشوحيه بالزبدة مع الثوم والبصل.
3. أضيفي الكريمة والجبنة واتركيها 5 دقائق ثم أضيفي المعكرونة.
#وصفات #مكرونة`;

function recipeFrom(text: string, extra: Partial<UserRecipe> = {}): UserRecipe {
  const p = parseRecipeText(text);
  return {
    id: 'r1', ownerMemberId: 'm1', familyId: 'f1', parentId: null, versionKind: 'original', lang: 'ar', title: p.title, description: '', emoji: '🍝',
    imageUri: null, sourceKind: 'text', sourceUrl: null, sourcePlatform: null, servings: p.servings ?? 1, prepMinutes: p.prepMinutes, cookMinutes: p.cookMinutes,
    difficulty: null, cookingMethod: 'pan_fried', ingredients: p.ingredients, steps: p.steps, tools: [], notes: '', servingTip: '', finalWeightG: null,
    mealTypes: ['lunch', 'dinner'], sharedWithFamily: false, createdAt: '', updatedAt: '', ...extra,
  };
}

describe('recipe text analyzer', () => {
  const p = parseRecipeText(CAPTION);
  it('extracts title, servings, ingredients and steps from a social caption', () => {
    expect(p.title).toBe('مكرونة الدجاج بالكريمة');
    expect(p.servings).toBe(4);
    expect(p.ingredients).toHaveLength(8);
    expect(p.steps).toHaveLength(3);
    expect(p.steps[0].minutes).toBe(10);
  });
  it('converts household measures to grams with the right food', () => {
    const by = Object.fromEntries(p.ingredients.map((i) => [i.foodId, i]));
    expect(by.chicken_raw.grams).toBe(500);
    expect(by.chicken_raw.confidence).toBe('high');
    expect(by.pasta_dry.grams).toBe(200);
    expect(by.butter.grams).toBeCloseTo(28.4, 1);
    expect(by.garlic.grams).toBe(9);
    expect(by.heavy_cream.unit).toBe('ml');
    expect(by.parmesan.grams).toBe(50);
  });
  it('never invents a quantity: "to taste" stays empty, unknown food stays uncounted', () => {
    const salt = p.ingredients.find((i) => i.foodId === 'salt')!;
    expect(salt.grams).toBeNull();
    expect(salt.toTaste).toBe(true);
    const odd = parseIngredientLine('2 ملعقة صلصة سريراتشا');
    expect(odd.foodId).toBeNull();
    expect(odd.grams).toBeNull();
    expect(needsReview(odd)).toBe(true);
  });
  it('handles English, fractions, ranges and Arabic duals', () => {
    expect(parseIngredientLine('1 1/2 cups flour')).toMatchObject({ foodId: 'flour_white', qty: 1.5, grams: 187.5 });
    expect(parseIngredientLine('2-3 tbsp olive oil')).toMatchObject({ foodId: 'olive_oil', qty: 2.5, estimated: true });
    expect(parseIngredientLine('بيضتين')).toMatchObject({ foodId: 'egg_raw', qty: 2, grams: 100 });
    expect(parseIngredientLine('٢٠٠ غ أرز مطبوخ')).toMatchObject({ foodId: 'rice_white', grams: 200 });
    expect(parseIngredientLine('chicken breast 200g')).toMatchObject({ foodId: 'chicken_raw', grams: 200 });
  });
  it('marks AI-estimated quantities for review and recomputes on edit', () => {
    const [l] = linesFromExtraction([{ name: 'chicken', quantity: 300, unit: 'g', quantity_is_estimate: true }]);
    expect(l.estimated).toBe(true);
    expect(needsReview(l)).toBe(true);
    const fixed = updateLine(l, { grams: 350 });
    expect(fixed.grams).toBe(350);
    expect(needsReview(fixed)).toBe(false);
  });
});

describe('recipe nutrition (structured data only)', () => {
  const r = recipeFrom(CAPTION);
  const nut = computeRecipeNutrition(r);
  it('whole recipe equals the sum of FOODS × grams; per serving divides by servings', () => {
    const manual = sumNutrients(r.ingredients.filter((i) => i.grams != null && i.foodId).map((i) => scaleNutrients(FOODS[i.foodId!].per100, i.grams!)));
    expect(nut.total.kcal).toBeCloseTo(manual.kcal, 0);
    expect(nut.perServing.kcal).toBeCloseTo(manual.kcal / 4, 0);
    expect(nut.per100g).toBeNull();
  });
  it('per 100 g only when the final weight is known', () => {
    const w = computeRecipeNutrition({ ...r, finalWeightG: 1200 });
    expect(w.per100g!.kcal).toBeCloseTo(w.total.kcal / 12, 0);
  });
  it('confidence reflects household conversions; unknown lines lower it', () => {
    expect(nut.confidence).toBe('medium');
    const bad = { ...r, ingredients: [...r.ingredients, parseIngredientLine('2 ملعقة صلصة سريراتشا')] };
    expect(computeRecipeNutrition(bad).confidence).toBe('low');
    expect(computeRecipeNutrition(bad).uncounted).toHaveLength(1);
  });
  it('deep frying adds a labelled absorbed-oil estimate', () => {
    const fried = computeRecipeNutrition({ ...r, cookingMethod: 'deep_fried' });
    expect(fried.absorbedOilG).toBeGreaterThan(0);
    expect(fried.total.fat).toBeGreaterThan(nut.total.fat);
  });
});

describe('healthy substitutions', () => {
  const r = recipeFrom(CAPTION);
  it('explains and quantifies each swap (cream → yogurt lowers saturated fat, raises protein)', () => {
    const s = suggestSubstitutions(r, 'ar').find((x) => x.key.startsWith('cream_yogurt'))!;
    expect(s.after.satFat).toBeLessThan(s.before.satFat);
    expect(s.after.protein).toBeGreaterThan(s.before.protein);
    expect(s.reason.ar.length).toBeGreaterThan(5);
  });
  it('does not assume fewer calories is better (oil → olive oil keeps calories)', () => {
    const fried = recipeFrom('- 3 ملاعق زيت\n- 300 غ دجاج');
    const s = suggestSubstitutions(fried, 'ar').find((x) => x.key.startsWith('oil_olive'))!;
    expect(s.after.kcal).toBeCloseTo(s.before.kcal, 0);
  });
  it('never suggests an allergen', () => {
    const s = suggestSubstitutions(r, 'ar', ['milk']);
    expect(s.some((x) => x.toFood && FOODS[x.toFood].allergens.includes('milk'))).toBe(false);
  });
  it('applying creates a linked improved version and leaves the original untouched', () => {
    const keys = suggestSubstitutions(r, 'ar').filter((x) => x.key.startsWith('cream_yogurt') || x.key.startsWith('pasta_ww')).map((x) => x.key);
    const v = applySubstitutions(r, keys, 'ar', 'r2', '2026-11-01T00:00:00Z');
    expect(v.parentId).toBe('r1');
    expect(v.versionKind).toBe('improved');
    expect(v.ingredients.some((i) => i.foodId === 'greek_yogurt')).toBe(true);
    expect(r.ingredients.some((i) => i.foodId === 'greek_yogurt')).toBe(false);
    expect(computeRecipeNutrition(v).perServing.fiber).toBeGreaterThan(computeRecipeNutrition(r).perServing.fiber);
  });
});

describe('hijri calendar', () => {
  it('tabular algorithm matches a known date', () => {
    expect(hijriTabular('2026-02-18')).toEqual({ y: 1447, m: 9, d: 1 });
  });
  it('Umm al-Qura (when available) and offset adjustment', () => {
    expect(toHijri('2026-02-18')).toEqual({ y: 1447, m: 9, d: 1 });
    expect(toHijri('2026-02-18', 1).d).toBe(2);
  });
  it('a Hijri month is 29–30 contiguous days', () => {
    const d = datesOfHijriMonth(1448, 5);
    expect([29, 30]).toContain(d.length);
    d.forEach((x) => expect(toHijri(x)).toMatchObject({ y: 1448, m: 5 }));
  });
});

describe('fasting tracker and badges', () => {
  const now = '2026-11-01T20:00:00Z';
  const month = datesOfHijriMonth(1448, 5);
  const log = (date: string, status: FastingLog['status'], confirmed = true): FastingLog => {
    const l = makeLog('m1', date, status, 0, now, date);
    return confirmed ? l : { ...l, confirmedAt: null };
  };
  it('planned days are never counted as fasted', () => {
    const logs = [log(month[12], 'planned'), log(month[13], 'planned'), log(month[14], 'planned')];
    expect(earnedBadges(logs, 3)).toEqual([]);
    const s = monthSummary(logs, [], { y: 1448, m: 5 }, 3);
    expect(s.completed).toBe(0);
    expect(s.planned).toBe(3);
    expect(s.remaining).toBe(3);
  });
  it('3 confirmed completed days in one Hijri month earn the crescent badge', () => {
    const logs = [log(month[12], 'completed'), log(month[13], 'completed'), log(month[14], 'completed')];
    const b = earnedBadges(logs, 3).map((x) => x.badge);
    expect(b).toContain('three_month');
    expect(b).toContain('first_fast');
    expect(b).toContain('monthly_goal');
  });
  it('unconfirmed or broken days do not count', () => {
    const logs = [log(month[12], 'completed'), log(month[13], 'completed', false), log(month[14], 'broken')];
    expect(earnedBadges(logs, 3).map((x) => x.badge)).not.toContain('three_month');
  });
  it('badges are issued once per period', () => {
    const logs = [log(month[0], 'completed'), log(month[1], 'completed'), log(month[2], 'completed')];
    const first = newBadges(logs, 0, []);
    expect(newBadges(logs, 0, first)).toEqual([]);
  });
  it('consistency badge after three consecutive months', () => {
    const logs = [1448, 1448, 1448].flatMap((y, i) => datesOfHijriMonth(y, 3 + i).slice(0, 3).map((d) => log(d, 'completed')));
    expect(earnedBadges(logs, 0).some((b) => b.badge === 'consistency_3')).toBe(true);
  });
  it('schedules: Mondays & Thursdays, Ayyam al-Bid', () => {
    const p = { ...defaultFastingProfile('m1'), enabled: true, type: 'mon_thu' as const };
    plannedDates(p, '2026-11-01', '2026-11-30').forEach((d) => expect([1, 4]).toContain(new Date(d + 'T12:00:00').getDay()));
    const bid = plannedDates({ ...p, type: 'ayyam_bid' }, month[0], month[month.length - 1]);
    expect(bid.map((d) => toHijri(d).d)).toEqual([13, 14, 15]);
    expect(plannedDates({ ...p, enabled: false }, '2026-11-01', '2026-11-30')).toEqual([]);
  });
});

const baseInput = (over: Partial<NextMealInput> = {}): NextMealInput => ({
  dailyKcalGoal: 2000, remaining: { kcal: 2000, protein: 100, carbs: 250, fat: 65 }, now: new Date('2026-11-01T13:00:00'), mealsLoggedToday: [],
  profile: { allergies: [], dislikedFoods: [], dietaryPreferences: [], isMinor: false }, prefs: { favorites: [], rejected: [], pantry: [], budgetTier: 2 },
  recentRecipeIds: [], ...over,
});

describe('fasting nutrition mode', () => {
  it('starts with iftar and never reduces the day: shares add up to the whole remaining budget', () => {
    const iftar = mealTarget(baseInput({ fasting: true }));
    expect(iftar.mealType).toBe('iftar');
    expect(iftar.target.kcal).toBeCloseTo(900, 0);
    const snack = mealTarget(baseInput({ fasting: true, mealsLoggedToday: ['iftar'], remaining: { kcal: 1100, protein: 55, carbs: 140, fat: 35 } }));
    const suhoor = mealTarget(baseInput({ fasting: true, mealsLoggedToday: ['iftar', 'snack'], remaining: { kcal: 700, protein: 35, carbs: 90, fat: 22 } }));
    expect(snack.mealType).toBe('snack');
    expect(suhoor.mealType).toBe('suhoor');
    expect(suhoor.target.kcal).toBeCloseTo(700, 0);
  });
  it('suggests real meals for suhoor (not "light" mode)', () => {
    const res = recommendNextMeal(baseInput({ fasting: true, mealsLoggedToday: ['iftar', 'snack'], remaining: { kcal: 700, protein: 35, carbs: 90, fat: 22 } }));
    expect(res.mealType).toBe('suhoor');
    expect(res.mode).toBe('normal');
    expect(res.suggestions.length).toBeGreaterThan(0);
  });
});

describe('favourites first', () => {
  it('a fitting favourite is suggested first when the toggle is on', () => {
    const fav = 'chicken_wrap';
    const res = recommendNextMeal(baseInput({ prefs: { favorites: [fav], rejected: [], pantry: [], budgetTier: 2 }, favoritesFirst: true }));
    expect(res.suggestions[0].recipe.id).toBe(fav);
    expect(res.suggestions[0].reasons.some((r) => r.key === 'nm.reason.favorite')).toBe(true);
  });
  it('a favourite with an allergen is never suggested', () => {
    const res = recommendNextMeal(baseInput({ prefs: { favorites: ['tuna_salad'], rejected: [], pantry: [], budgetTier: 2 }, favoritesFirst: true, profile: { allergies: ['fish'], dislikedFoods: [], dietaryPreferences: [], isMinor: false } }));
    expect(res.suggestions.some((s) => s.ingredients.some((i) => FOODS[i.food].allergens.includes('fish')))).toBe(false);
  });
  it('user recipes join the pool as one serving', () => {
    const r = recipeFrom(CAPTION);
    const lines = r.ingredients.map((l) => (l.toTaste ? l : updateLine(l, { grams: l.grams ?? 100 })));
    const nm = asNextMealRecipe({ ...r, ingredients: lines })!;
    expect(nm).not.toBeNull();
    expect(nm.ingredients.find((i) => i.food === 'chicken_raw')!.grams).toBe(125);
  });
});

describe('documents and translation', () => {
  it('every food and every built-in recipe has a Filipino translation', () => {
    Object.keys(FOODS).forEach((id) => expect(FIL_FOODS[id], id).toBeTruthy());
    RECIPES.forEach((r) => {
      expect(FIL_RECIPES[r.id], r.id).toBeTruthy();
      expect(FIL_RECIPES[r.id].steps).toHaveLength(r.stepsEn.length);
    });
  });
  it('Filipino steps keep exactly the same numbers as the source', () => {
    RECIPES.forEach((r) => expect(checkNumbers(r.stepsEn, FIL_RECIPES[r.id].steps), r.id).toEqual([]));
    expect(checkNumbers(['Bake 20 minutes at 180°C'], ['I-bake nang 25 minuto sa 180°C'])).toEqual([0]);
  });
  it('labels and units exist for all seven languages', () => {
    Object.values(DOC_LABELS).forEach((l) => Object.values(l).forEach((v) => expect(v.length).toBeGreaterThan(0)));
    expect(Object.keys(UNIT_LABELS)).toHaveLength(7);
  });
  it('quantities and units are preserved in the translated document', () => {
    const r = recipeFrom(CAPTION);
    const tr = offlineTranslation(r, 'fil');
    expect(tr.pending).toContain('steps'); // user recipe steps need the translation service or a manual edit
    expect(tr.ingredientNames[0]).toBe(FIL_FOODS.chicken_raw);
    const butter = r.ingredients.find((i) => i.foodId === 'butter')!;
    expect(formatQty(butter, 'fil', true)).toBe('2 kutsara (tbsp) (≈ 28 g)');
    const html = docHtml(buildDocModel(r, computeRecipeNutrition(r), tr, { lang: 'fil', checkable: true, showGrams: false, includeNutrition: true }));
    expect(html).toContain('class="box"');
    expect(html).toContain('500 g');
    expect(html).toContain('dir="ltr"');
  });
  it('built-in recipe → complete offline Filipino document, Arabic is RTL', () => {
    const r = builtinAsUserRecipe(RECIPES[0], 'ar');
    const tr = offlineTranslation(r, 'fil');
    expect(tr.pending).toEqual([]);
    const m = buildDocModel(r, computeRecipeNutrition(r), tr, { lang: 'fil', checkable: true, showGrams: true, includeNutrition: true });
    expect(docText(m)).toContain('Pakuluan nang mahina ang oats sa gatas nang 4 na minuto.');
    const ar = docHtml(buildDocModel(r, computeRecipeNutrition(r), offlineTranslation(r, 'ar'), { lang: 'ar', checkable: false, showGrams: false, includeNutrition: true }));
    expect(ar).toContain('dir="rtl"');
  });
});
