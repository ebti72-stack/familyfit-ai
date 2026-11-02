/**
 * Deterministic recipe text parser (works offline, no AI): captions, pasted recipes, typed ingredient lists.
 * It never invents quantities: anything it cannot read is returned with grams = null and flagged for review.
 */
import {
  CAN_GRAMS, COOKED_FORM, COOKED_WORDS, CUP_GRAMS, FOOD_ALIASES, HANDFUL_GRAMS, LIQUID_DENSITY, NUMBER_WORDS, PIECE_GRAMS, TO_TASTE, UNIT_WORDS,
  norm, type Unit,
} from '../data/recipeLexicon';
import { minutesIn, tempIn, type Confidence, type RecipeIngredientLine, type RecipeStep } from './recipe';
import { FOODS } from '../data/foods';

const ALIAS_INDEX: { alias: string; food: string }[] = Object.entries(FOOD_ALIASES)
  .flatMap(([food, list]) => list.map((a) => ({ alias: norm(a), food })))
  .sort((a, b) => b.alias.length - a.alias.length);

const LETTER = /[a-z0-9؀-ۿ]/;

/** Find the food mentioned in a (normalised) text. Longest alias wins; whole-word match (Arabic "ال" and "و" prefixes allowed). */
export function matchFood(text: string): string | null {
  const n = norm(text);
  for (const { alias, food } of ALIAS_INDEX) {
    let from = 0;
    while (true) {
      const i = n.indexOf(alias, from);
      if (i < 0) break;
      const before = n.slice(Math.max(0, i - 2), i);
      const after = n[i + alias.length] ?? '';
      const okBefore = i === 0 || !LETTER.test(n[i - 1]) || /(^|[^a-z؀-ۿ])(ال|و|ب)$/.test(n.slice(Math.max(0, i - 3), i)) || before === 'ال';
      const okAfter = !after || !LETTER.test(after) || (/[؀-ۿ]/.test(alias) && /^(ات|ه|ين|ان)/.test(n.slice(i + alias.length)));
      if (okBefore && okAfter) {
        const cooked = COOKED_WORDS.some((w) => n.includes(norm(w)));
        return cooked && COOKED_FORM[food] ? COOKED_FORM[food] : food;
      }
      from = i + 1;
    }
  }
  return null;
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/** Parse a quantity at the start of s. Returns qty, the rest of the string and whether it was a range. */
function leadingQty(s: string): { qty: number; rest: string; range: boolean } | null {
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)(?=\s|$)/); // 1 1/2
  if (m) return { qty: +m[1] + +m[2] / +m[3], rest: s.slice(m[0].length).trim(), range: false };
  m = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|الى|او|to|or)\s*(\d+(?:\.\d+)?)/); // 2-3
  if (m) return { qty: (+m[1] + +m[2]) / 2, rest: s.slice(m[0].length).trim(), range: true };
  m = s.match(/^(\d+)\/(\d+)/);
  if (m) return { qty: +m[1] / +m[2], rest: s.slice(m[0].length).trim(), range: false };
  m = s.match(/^(\d+(?:\.\d+)?)\s*([½¼¾⅓⅔])?/);
  if (m && m[0].trim()) return { qty: +m[1] + (m[2] ? FRACTIONS[m[2]] : 0), rest: s.slice(m[0].length).trim(), range: false };
  m = s.match(/^([½¼¾⅓⅔])/);
  if (m) return { qty: FRACTIONS[m[1]], rest: s.slice(1).trim(), range: false };
  for (const [re, v] of NUMBER_WORDS) {
    const w = s.match(re);
    if (w) return { qty: v, rest: s.slice(w[0].length).trim(), range: false };
  }
  return null;
}

function leadingUnit(s: string): { unit: Unit; dual: boolean; rest: string } | null {
  for (const u of UNIT_WORDS) {
    const m = s.match(u.re);
    if (m) return { unit: u.unit, dual: !!u.dual, rest: s.slice(m[0].length).replace(/^(من|of)\s+/, '').trim() };
  }
  return null;
}

/** grams for qty × unit of a food, with the confidence of that conversion. */
export function toGrams(food: string | null, qty: number | null, unit: Unit | null): { grams: number | null; confidence: Confidence } {
  if (qty == null || qty <= 0) return { grams: null, confidence: 'low' };
  const r = (g: number, c: Confidence) => ({ grams: Math.round(g * 10) / 10, confidence: c });
  const density = food ? LIQUID_DENSITY[food] : undefined;
  switch (unit) {
    case 'g': return r(qty, 'high');
    case 'kg': return r(qty * 1000, 'high');
    case 'ml': return r(qty * (density ?? 1), density ? 'high' : 'medium');
    case 'l': return r(qty * 1000 * (density ?? 1), density ? 'high' : 'medium');
    case 'cup':
    case 'tbsp':
    case 'tsp': {
      const div = unit === 'cup' ? 1 : unit === 'tbsp' ? 16 : 48;
      const cup = food ? CUP_GRAMS[food] ?? (density ? 240 * density : undefined) : undefined;
      return cup ? r((qty * cup) / div, 'medium') : { grams: null, confidence: 'low' };
    }
    case 'clove': return r(qty * 3, 'medium');
    case 'pinch': return r(qty * 0.4, 'medium');
    case 'handful': return r(qty * (food ? HANDFUL_GRAMS[food] ?? 30 : 30), 'medium');
    case 'can': return food && CAN_GRAMS[food] ? r(qty * CAN_GRAMS[food], 'medium') : { grams: null, confidence: 'low' };
    case 'slice':
    case 'piece':
    case null: {
      const pg = food ? PIECE_GRAMS[food] : undefined;
      if (pg) return r(qty * pg, 'medium');
      return { grams: null, confidence: 'low' };
    }
    default: return { grams: null, confidence: 'low' };
  }
}

const BULLET = /^[\s•●▪◦·*\-–—✅✔️☑️🔸🔹▫️➖➡️👉]+|^\(?\d{1,2}[.)\-]\s+/u;

export function cleanLine(line: string): string {
  return line
    .replace(/#[^\s#]+/g, '')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(BULLET, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseIngredientLine(raw: string): RecipeIngredientLine {
  const line = cleanLine(raw);
  const n = norm(line);
  let qty: number | null = null;
  let unit: Unit | null = null;
  let range = false;
  let rest = n;

  const lq = leadingQty(n);
  if (lq) {
    qty = lq.qty;
    range = lq.range;
    rest = lq.rest;
  }
  const lu = leadingUnit(rest);
  if (lu) {
    unit = lu.unit;
    rest = lu.rest;
    if (lu.dual) qty = qty ?? 2;
  }
  if (qty == null) {
    // Quantity after the name: "دجاج 500 غرام", "chicken breast 200g", "بيض 3"
    const m = n.match(/(\d+(?:\.\d+)?)\s*([a-z؀-ۿ]+(?:\s[a-z؀-ۿ]+)?)?\s*$/) ?? n.match(/(\d+(?:\.\d+)?)\s*(غ|غرام|جرام|جم|g|grams?|ml|مل|كوب|cups?)(?=$|[^a-z؀-ۿ])/);
    if (m) {
      qty = +m[1];
      const u = m[2] ? leadingUnit(m[2]) : null;
      if (u) unit = u.unit;
    }
  }
  if (qty == null && /(تين|تان)(?=$|\s)/.test(n)) {
    qty = 2;
    unit = unit ?? 'piece';
  }

  let foodId = matchFood(rest) ?? matchFood(n);
  // "1 tbsp olive" / "ملعقة زيتون": a spoon or volume of "olive" is olive oil (whole olives are not measured in spoons/ml).
  if (!foodId && unit && ['tbsp', 'tsp', 'ml', 'l', 'cup'].includes(unit) && /(^|\s)(olive|زيتون)(\s|$)/.test(rest.trim())) foodId = 'olive_oil';
  const toTaste = qty == null && TO_TASTE.test(n);
  // "بصلة متوسطة" / "1 large onion" style: a single countable item → 1 piece, flagged as an assumption to confirm.
  let assumedOne = false;
  if (qty == null && !toTaste && foodId && PIECE_GRAMS[foodId]) {
    qty = 1;
    unit = unit ?? 'piece';
    assumedOne = !/(متوسط|كبير|صغير|حبه|واحده|medium|large|small|one)/.test(n);
  }
  const conv = toGrams(foodId, qty, unit);
  let confidence: Confidence = !foodId ? 'low' : conv.confidence;
  if (range && confidence === 'high') confidence = 'medium';
  if (toTaste) confidence = 'medium';
  const name = foodId ? displayName(line, foodId) : line;
  return { raw: line, name, foodId, qty, unit, grams: conv.grams, confidence, estimated: range || assumedOne, toTaste, confirmed: false };
}

/** Keep the user's wording when it is short and specific; otherwise the canonical food name. */
function displayName(line: string, foodId: string): string {
  let stripped = line.replace(/^[\d\s.,/½¼¾⅓⅔\-–]+/, '').trim();
  // Drop a leading unit word ("كوب مكرونة" → "مكرونة", "2 tbsp butter" → "butter") and a linking "من / of".
  const ns = norm(stripped);
  const u = UNIT_WORDS.find((w) => w.re.test(ns));
  if (u) {
    const words = ns.match(u.re)![0].trim().split(/\s+/).length;
    stripped = stripped.split(/\s+/).slice(words).join(' ');
  }
  stripped = stripped.replace(/^(من|of)\s+/i, '').trim();
  return stripped.length > 0 && stripped.length <= 48 ? stripped : FOODS[foodId].ar;
}

const ING_HEAD = /^(المكونات|المقادير|مكونات|مقادير|ingredients?|you('| wi)ll need)\s*[:：]?$/i;
const STEP_HEAD = /^(الطريقه|طريقه التحضير|طريقه العمل|التحضير|الخطوات|طريقه|method|directions|instructions|steps|preparation)\s*[:：]?$/i;

export interface ParsedRecipe {
  title: string;
  ingredients: RecipeIngredientLine[];
  steps: RecipeStep[];
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ovenTempC: number | null;
}

export function parseRecipeText(text: string): ParsedRecipe {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let section: 'unknown' | 'ing' | 'steps' = 'unknown';
  let title = '';
  const ingredients: RecipeIngredientLine[] = [];
  const steps: RecipeStep[] = [];
  let servings: number | null = null;
  let prepMinutes: number | null = null;
  let cookMinutes: number | null = null;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    const n = norm(line);
    if (ING_HEAD.test(n.replace(/[:：]/g, '').trim() + '')) { section = 'ing'; continue; }
    if (STEP_HEAD.test(n.replace(/[:：]/g, '').trim())) { section = 'steps'; continue; }

    const sv = n.match(/(?:يكفي|تكفي|لعدد|عدد الحصص|الحصص|serves|servings|yield|makes)\s*[:：]?\s*(\d+)/) ?? n.match(/(\d+)\s*(?:اشخاص|افراد|حصص|servings|people|portions)/);
    if (sv) { servings = +sv[1]; continue; }
    // Arabic dual: "يكفي شخصين" / "لشخصين" / "حصتين"
    if (n.length < 40 && /(شخصين|فردين|حصتين)/.test(n)) { servings = 2; continue; }
    if (/(وقت التحضير|مده التحضير|prep(aration)? time|prep)/.test(n) && minutesIn(n) != null && n.length < 60) { prepMinutes = minutesIn(n); continue; }
    if (/(وقت الطهي|وقت الطبخ|مده الطهي|cook(ing)? time|bake time)/.test(n) && minutesIn(n) != null && n.length < 60) { cookMinutes = minutesIn(n); continue; }

    if (section === 'unknown' && !title && ingredients.length === 0 && leadingQty(n) == null && leadingUnit(n) == null && n.length <= 70) { title = line; continue; }
    const looksIngredient = n.length <= 70 && (leadingQty(n) != null || leadingUnit(n) != null || (!!matchFood(n) && n.split(' ').length <= 6 && !/^(ضع|اضف|قلب|اخلط|اطه|اسلق|اقلي|اخبز|سخن|قطع|put|add|mix|stir|cook|bake|boil|fry|heat|cut|chop|serve|preheat|place|pour|season)/.test(n)));
    if (section === 'ing' || (section === 'unknown' && looksIngredient)) {
      if (section === 'unknown' && !looksIngredient && !title) { title = line; continue; }
      if (section === 'ing' && !looksIngredient && n.split(' ').length > 8) {
        steps.push({ text: line, minutes: minutesIn(line), tempC: tempIn(line) });
        continue;
      }
      ingredients.push(parseIngredientLine(line));
      continue;
    }
    if (section === 'steps' || ingredients.length > 0 || n.split(' ').length > 6) {
      if (!title && section === 'unknown' && ingredients.length === 0 && n.split(' ').length <= 6) { title = line; continue; }
      steps.push({ text: line, minutes: minutesIn(line), tempC: tempIn(line) });
      continue;
    }
    if (!title) title = line;
  }
  const ovenTempC = steps.map((s) => s.tempC).find((x) => x != null) ?? null;
  return { title, ingredients, steps, servings, prepMinutes, cookMinutes, ovenTempC };
}

/** Structured extraction from the AI service → lines, re-using the same matcher and gram conversion. */
export function linesFromExtraction(list: { name: string; quantity: number | null; unit: string | null; quantity_is_estimate: boolean }[]): RecipeIngredientLine[] {
  return list.map((x) => {
    const text = [x.quantity ?? '', x.unit ?? '', x.name].join(' ').trim();
    const l = parseIngredientLine(text);
    const estimated = x.quantity_is_estimate || l.estimated;
    return { ...l, name: x.name, estimated, confidence: estimated && l.confidence === 'high' ? 'medium' : l.confidence };
  });
}

/** Recompute grams after the user edits quantity / unit / food in the review screen. */
export function updateLine(l: RecipeIngredientLine, patch: Partial<Pick<RecipeIngredientLine, 'qty' | 'unit' | 'foodId' | 'grams' | 'name'>>): RecipeIngredientLine {
  const next = { ...l, ...patch, confirmed: true, estimated: false };
  if (patch.grams != null) return { ...next, unit: 'g', qty: patch.grams, confidence: next.foodId ? 'high' : 'low' };
  const conv = toGrams(next.foodId, next.qty, next.unit);
  return { ...next, grams: conv.grams, confidence: next.foodId ? (conv.grams == null ? 'low' : conv.confidence === 'low' ? 'low' : 'high') : 'low', toTaste: next.qty == null && l.toTaste };
}
