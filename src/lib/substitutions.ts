/**
 * Healthy substitutions for recipes. Each rule states WHY in nutritional terms (fibre, protein,
 * saturated fat, added sugar, sodium) — fewer calories alone is never the reason, and the card
 * always shows the real before/after numbers, including when calories stay the same or go up.
 */
import { FOODS } from '../data/foods';
import { computeRecipeNutrition, type CookingMethod, type RecipeIngredientLine, type UserRecipe } from './recipe';
import type { Nutrients } from './types';

type L = { ar: string; en: string };
export interface SubRule {
  id: string;
  from: string[];
  /** Replacement food, or the same food with ratio < 1 to "use less". */
  to: string;
  ratio: number;
  reason: L;
  taste: L;
}
export interface MethodRule {
  id: string;
  from: CookingMethod;
  to: CookingMethod;
  reason: L;
  taste: L;
}

export const SUB_RULES: SubRule[] = [
  { id: 'cream_yogurt', from: ['heavy_cream'], to: 'greek_yogurt', ratio: 1,
    reason: { ar: 'دهون مشبعة أقل بكثير وبروتين أعلى.', en: 'Far less saturated fat and more protein.' },
    taste: { ar: 'أكثف وبحموضة خفيفة؛ أضفه بعد إطفاء النار حتى لا يتكتل.', en: 'Thicker and slightly tangy; stir in off the heat so it does not split.' } },
  { id: 'cream_milk', from: ['heavy_cream'], to: 'milk_lowfat', ratio: 1,
    reason: { ar: 'دهون مشبعة أقل مع الحفاظ على طعم الحليب.', en: 'Much less saturated fat while keeping a milky taste.' },
    taste: { ar: 'صلصة أخف قواماً؛ يمكن تكثيفها بملعقة نشا.', en: 'Thinner sauce; thicken with a spoon of starch if needed.' } },
  { id: 'butter_olive', from: ['butter'], to: 'olive_oil', ratio: 0.75,
    reason: { ar: 'دهون غير مشبعة بدلاً من المشبعة، والسعرات متقاربة.', en: 'Unsaturated instead of saturated fat; calories are similar.' },
    taste: { ar: 'نكهة زيتون خفيفة؛ لا يناسب كل الحلويات.', en: 'Light olive flavour; not ideal for every dessert.' } },
  { id: 'oil_olive', from: ['veg_oil'], to: 'olive_oil', ratio: 1,
    reason: { ar: 'نفس السعرات تقريباً لكن دهون أحادية غير مشبعة أكثر.', en: 'About the same calories, more monounsaturated fat.' },
    taste: { ar: 'نكهة أوضح؛ استخدمه لحرارة متوسطة.', en: 'More flavour; best for medium heat.' } },
  { id: 'oil_less', from: ['veg_oil', 'olive_oil'], to: '=', ratio: 0.5,
    reason: { ar: 'نصف كمية الزيت يكفي غالباً للتشويح.', en: 'Half the oil is usually enough for sautéing.' },
    taste: { ar: 'استخدم مقلاة غير لاصقة وحرّك أكثر.', en: 'Use a non-stick pan and stir more often.' } },
  { id: 'sugar_less', from: ['sugar'], to: '=', ratio: 0.5,
    reason: { ar: 'سكر مضاف أقل بالنصف.', en: 'Half the added sugar.' },
    taste: { ar: 'أقل حلاوة؛ في المخبوزات قد يصبح القوام أجف قليلاً.', en: 'Less sweet; baked goods may be slightly drier.' } },
  { id: 'sugar_dates', from: ['sugar'], to: 'dates', ratio: 1.25,
    reason: { ar: 'تحلية طبيعية مع ألياف ومعادن (السعرات متقاربة).', en: 'Natural sweetness with fibre and minerals (similar calories).' },
    taste: { ar: 'لون أغمق ونكهة كراميل؛ استخدمه معجوناً.', en: 'Darker colour and caramel notes; use as a paste.' } },
  { id: 'pasta_ww', from: ['pasta_dry'], to: 'ww_pasta_dry', ratio: 1,
    reason: { ar: 'ألياف أعلى بثلاث مرات تقريباً.', en: 'About three times the fibre.' },
    taste: { ar: 'نكهة قمح أوضح وقوام أمتن.', en: 'Nuttier taste and firmer bite.' } },
  { id: 'pasta_ww_cooked', from: ['white_pasta'], to: 'ww_pasta', ratio: 1,
    reason: { ar: 'ألياف أعلى وسعرات أقل قليلاً.', en: 'More fibre and slightly fewer calories.' },
    taste: { ar: 'نكهة قمح أوضح.', en: 'Nuttier taste.' } },
  { id: 'rice_brown', from: ['rice_white_dry'], to: 'rice_brown_dry', ratio: 1,
    reason: { ar: 'ألياف ومعادن أكثر (السعرات متقاربة).', en: 'More fibre and minerals (similar calories).' },
    taste: { ar: 'يحتاج وقت طهي أطول بنحو 15–20 دقيقة.', en: 'Needs about 15–20 minutes longer to cook.' } },
  { id: 'rice_brown_cooked', from: ['rice_white'], to: 'rice_brown', ratio: 1,
    reason: { ar: 'ألياف ومعادن أكثر.', en: 'More fibre and minerals.' },
    taste: { ar: 'قوام أمتن ونكهة جوزية.', en: 'Chewier, nutty flavour.' } },
  { id: 'rice_quinoa', from: ['rice_white_dry'], to: 'quinoa_dry', ratio: 1,
    reason: { ar: 'بروتين وألياف أعلى.', en: 'More protein and fibre.' },
    taste: { ar: 'حبوب أصغر ونكهة مختلفة؛ تُطهى في 15 دقيقة.', en: 'Smaller grains and different taste; cooks in 15 minutes.' } },
  { id: 'flour_ww', from: ['flour_white'], to: 'flour_ww', ratio: 1,
    reason: { ar: 'ألياف أعلى بأربع مرات تقريباً.', en: 'About four times the fibre.' },
    taste: { ar: 'عجين أثقل؛ ابدأ باستبدال نصف الكمية.', en: 'Denser dough; start by swapping half.' } },
  { id: 'mayo_yogurt', from: ['mayonnaise'], to: 'greek_yogurt', ratio: 1,
    reason: { ar: 'دهون أقل بكثير وبروتين أعلى.', en: 'Far less fat and more protein.' },
    taste: { ar: 'أكثر حموضة؛ أضف رشة ليمون وثوم.', en: 'Tangier; add lemon and garlic.' } },
  { id: 'creamcheese_yogurt', from: ['cream_cheese'], to: 'greek_yogurt', ratio: 1,
    reason: { ar: 'دهون مشبعة أقل وبروتين أعلى.', en: 'Less saturated fat and more protein.' },
    taste: { ar: 'أقل دسامة وأكثر حموضة.', en: 'Less rich and tangier.' } },
  { id: 'cheddar_mozz', from: ['cheddar'], to: 'mozzarella', ratio: 1,
    reason: { ar: 'دهون مشبعة أقل.', en: 'Less saturated fat.' },
    taste: { ar: 'نكهة أخف ومطاطية أكثر عند الذوبان.', en: 'Milder and stretchier when melted.' } },
  { id: 'beef_lean', from: ['beef_raw'], to: 'lean_beef_raw', ratio: 1,
    reason: { ar: 'بروتين أعلى ودهون مشبعة أقل.', en: 'More protein, less saturated fat.' },
    taste: { ar: 'أقل عصارة؛ لا تُفرط في الطهي.', en: 'Less juicy; avoid overcooking.' } },
  { id: 'thigh_breast', from: ['chicken_thigh_raw'], to: 'chicken_raw', ratio: 1,
    reason: { ar: 'بروتين أعلى ودهون أقل.', en: 'More protein and less fat.' },
    taste: { ar: 'أقل طراوة؛ تبّله جيداً.', en: 'Less tender; marinate well.' } },
  { id: 'bread_ww', from: ['white_bread'], to: 'ww_bread', ratio: 1,
    reason: { ar: 'ألياف وبروتين أعلى.', en: 'More fibre and protein.' },
    taste: { ar: 'نكهة قمح أوضح.', en: 'Wheatier taste.' } },
  { id: 'ketchup_paste', from: ['ketchup'], to: 'tomato_paste', ratio: 0.5,
    reason: { ar: 'سكر مضاف وصوديوم أقل.', en: 'Less added sugar and sodium.' },
    taste: { ar: 'أقل حلاوة؛ خففه بقليل من الماء.', en: 'Less sweet; thin with a little water.' } },
  { id: 'soy_less', from: ['soy_sauce'], to: '=', ratio: 0.5,
    reason: { ar: 'صوديوم أقل بالنصف.', en: 'Half the sodium.' },
    taste: { ar: 'عوّض النكهة بالليمون أو الثوم.', en: 'Make up flavour with lemon or garlic.' } },
  { id: 'salt_less', from: ['salt'], to: '=', ratio: 0.5,
    reason: { ar: 'صوديوم أقل.', en: 'Less sodium.' },
    taste: { ar: 'عوّض بالأعشاب والليمون.', en: 'Use herbs and lemon instead.' } },
];

export const METHOD_RULES: MethodRule[] = [
  { id: 'fry_air', from: 'deep_fried', to: 'air_fried',
    reason: { ar: 'يلغي زيت القلي الممتص (يُحسب تقديرياً).', en: 'Removes the (estimated) absorbed frying oil.' },
    taste: { ar: 'قرمشة أخف؛ ادهن بملعقة زيت صغيرة.', en: 'Lighter crunch; brush with a teaspoon of oil.' } },
  { id: 'fry_bake', from: 'deep_fried', to: 'baked',
    reason: { ar: 'يلغي زيت القلي الممتص (يُحسب تقديرياً).', en: 'Removes the (estimated) absorbed frying oil.' },
    taste: { ar: 'أقل قرمشة؛ اخبز على حرارة عالية 200°م.', en: 'Less crispy; bake hot at 200°C.' } },
];

export interface SubSuggestion {
  key: string; // `${ruleId}:${lineIndex}` or `method:${ruleId}`
  kind: 'ingredient' | 'method';
  lineIndex: number | null;
  fromFood: string | null;
  toFood: string | null;
  fromMethod: CookingMethod | null;
  toMethod: CookingMethod | null;
  reason: L;
  taste: L;
  before: Nutrients; // per serving, whole recipe
  after: Nutrients; // per serving, with only this change applied
}

function applyRuleToLine(l: RecipeIngredientLine, rule: SubRule, lang: 'ar' | 'en'): RecipeIngredientLine {
  const to = rule.to === '=' ? l.foodId! : rule.to;
  const grams = Math.round((l.grams ?? 0) * rule.ratio * 10) / 10;
  const name = rule.to === '=' ? l.name : FOODS[to][lang];
  return { ...l, foodId: to, name, grams, qty: grams, unit: 'g', raw: `${grams} g ${name}`, confidence: l.confidence, confirmed: l.confirmed };
}

export function suggestSubstitutions(r: UserRecipe, lang: 'ar' | 'en', allergies: string[] = []): SubSuggestion[] {
  const base = computeRecipeNutrition(r).perServing;
  const out: SubSuggestion[] = [];
  r.ingredients.forEach((l, i) => {
    if (!l.foodId || l.grams == null) return;
    for (const rule of SUB_RULES) {
      if (!rule.from.includes(l.foodId)) continue;
      const to = rule.to === '=' ? l.foodId : rule.to;
      if (FOODS[to].allergens.some((a) => allergies.includes(a))) continue;
      const next = { ...r, ingredients: r.ingredients.map((x, j) => (j === i ? applyRuleToLine(x, rule, lang) : x)) };
      out.push({
        key: `${rule.id}:${i}`, kind: 'ingredient', lineIndex: i, fromFood: l.foodId, toFood: to, fromMethod: null, toMethod: null,
        reason: rule.reason, taste: rule.taste, before: base, after: computeRecipeNutrition(next).perServing,
      });
    }
  });
  for (const m of METHOD_RULES) {
    if (r.cookingMethod !== m.from) continue;
    const next = { ...r, cookingMethod: m.to };
    out.push({
      key: `method:${m.id}`, kind: 'method', lineIndex: null, fromFood: null, toFood: null, fromMethod: m.from, toMethod: m.to,
      reason: m.reason, taste: m.taste, before: base, after: computeRecipeNutrition(next).perServing,
    });
  }
  return out;
}

/** Apply chosen suggestions (one per ingredient line) → a new "improved" version linked to the original. */
export function applySubstitutions(r: UserRecipe, keys: string[], lang: 'ar' | 'en', newId: string, nowIso: string): UserRecipe {
  let ingredients = [...r.ingredients];
  let cookingMethod = r.cookingMethod;
  const usedLines = new Set<number>();
  for (const key of keys) {
    const [a, b] = key.split(':');
    if (a === 'method') {
      const m = METHOD_RULES.find((x) => x.id === b);
      if (m && cookingMethod === m.from) cookingMethod = m.to;
      continue;
    }
    const rule = SUB_RULES.find((x) => x.id === a);
    const i = Number(b);
    if (!rule || usedLines.has(i) || !ingredients[i]?.foodId || !rule.from.includes(ingredients[i].foodId!)) continue;
    ingredients[i] = applyRuleToLine(ingredients[i], rule, lang);
    usedLines.add(i);
  }
  const suffix = lang === 'ar' ? ' (نسخة محسّنة)' : ' (improved)';
  return {
    ...r, id: newId, parentId: r.id, versionKind: 'improved', title: r.title.endsWith(suffix) ? r.title : r.title + suffix,
    ingredients, cookingMethod, sharedWithFamily: false, createdAt: nowIso, updatedAt: nowIso,
  };
}

export function diff(before: Nutrients, after: Nutrients): Nutrients {
  const out = { ...after };
  (Object.keys(out) as (keyof Nutrients)[]).forEach((k) => (out[k] = Math.round((after[k] - before[k]) * 10) / 10));
  return out;
}
