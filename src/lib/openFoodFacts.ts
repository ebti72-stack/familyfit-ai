/**
 * Open Food Facts client (https://world.openfoodfacts.org, ODbL).
 * Read access is public and needs no API key. We request only the fields we display.
 */
import type { Nutrients } from './types';

export interface Product {
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  per100: Nutrients;
  /** null when the product label gives no serving size. */
  servingGrams: number | null;
  servingLabel: string | null;
  ingredientsText: string | null;
  allergens: string[]; // normalised codes, e.g. 'milk', 'gluten'
  /** Which nutrient fields were actually present on the source record. */
  missing: (keyof Nutrients)[];
  source: 'open_food_facts' | 'family_manual' | 'label_ocr';
  sourceUrl: string | null;
}

const FIELDS = [
  'code', 'product_name', 'product_name_ar', 'product_name_en', 'brands', 'image_front_url', 'image_url',
  'serving_size', 'serving_quantity', 'nutriments', 'ingredients_text', 'ingredients_text_ar', 'ingredients_text_en', 'allergens_tags',
].join(',');

export const OFF_USER_AGENT = 'FamilyFitAI/0.1 (https://github.com/ebti72-stack/familyfit-ai)';

/** Validates EAN-8/EAN-13/UPC-A/UPC-E style numeric codes (with checksum when length allows). */
export function isLikelyBarcode(code: string): boolean {
  if (!/^\d{6,14}$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return true; // UPC-E (6–8) etc: accept, OFF will tell us
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const ALLERGEN_MAP: Record<string, string> = {
  'en:milk': 'milk', 'en:eggs': 'eggs', 'en:fish': 'fish', 'en:crustaceans': 'shellfish', 'en:molluscs': 'shellfish',
  'en:nuts': 'tree_nuts', 'en:peanuts': 'peanuts', 'en:gluten': 'gluten', 'en:soybeans': 'soy', 'en:sesame-seeds': 'sesame',
};

function num(v: unknown): number | null {
  const x = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(x) ? x : null;
}

/** Converts an OFF API v2 product object into our Product. Returns null if energy/macros are missing. */
export function parseOffProduct(raw: any, barcode: string, lang: 'ar' | 'en' = 'ar'): Product | null {
  if (!raw) return null;
  const nm = raw.nutriments ?? {};
  let kcal = num(nm['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(nm['energy-kj_100g']) ?? num(nm['energy_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  const protein = num(nm['proteins_100g']);
  const carbs = num(nm['carbohydrates_100g']);
  const fat = num(nm['fat_100g']);
  if (kcal == null || protein == null || carbs == null || fat == null) return null;

  const missing: (keyof Nutrients)[] = [];
  const opt = (key: string, field: keyof Nutrients, factor = 1) => {
    const v = num(nm[key]);
    if (v == null) {
      missing.push(field);
      return 0;
    }
    return v * factor;
  };
  // OFF stores sodium in grams per 100 g.
  let sodium = num(nm['sodium_100g']);
  if (sodium == null) {
    const salt = num(nm['salt_100g']);
    sodium = salt != null ? salt / 2.5 : null;
  }
  if (sodium == null) missing.push('sodium');

  const name =
    (lang === 'ar' ? raw.product_name_ar : raw.product_name_en) || raw.product_name || raw.product_name_en || raw.product_name_ar || '';
  const servingQ = num(raw.serving_quantity);

  return {
    barcode: String(raw.code ?? barcode),
    name: String(name).trim() || barcode,
    brand: raw.brands ? String(raw.brands).split(',')[0].trim() : null,
    imageUrl: raw.image_front_url || raw.image_url || null,
    per100: {
      kcal: Math.round(kcal),
      protein,
      carbs,
      fat,
      fiber: opt('fiber_100g', 'fiber'),
      sugar: opt('sugars_100g', 'sugar'),
      satFat: opt('saturated-fat_100g', 'satFat'),
      sodium: sodium != null ? Math.round(sodium * 1000) : 0,
    },
    servingGrams: servingQ && servingQ > 0 && servingQ < 2000 ? servingQ : null,
    servingLabel: raw.serving_size || null,
    ingredientsText: (lang === 'ar' ? raw.ingredients_text_ar : raw.ingredients_text_en) || raw.ingredients_text || null,
    allergens: Array.from(new Set(((raw.allergens_tags as string[]) ?? []).map((t) => ALLERGEN_MAP[t]).filter(Boolean))),
    missing,
    source: 'open_food_facts',
    sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`,
  };
}

export type LookupResult =
  | { status: 'found'; product: Product }
  | { status: 'incomplete'; name: string | null } // exists but lacks nutrition facts
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export async function fetchOffProduct(barcode: string, lang: 'ar' | 'en' = 'ar', fetchImpl: typeof fetch = fetch): Promise<LookupResult> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    // Browsers forbid setting User-Agent; native platforms send it as OFF asks.
    if (typeof navigator === 'undefined' || (navigator as any).product === 'ReactNative') headers['User-Agent'] = OFF_USER_AGENT;
    const res = await fetchImpl(url, { headers });
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
    const body = await res.json();
    if (body.status === 0 || !body.product) return { status: 'not_found' };
    const p = parseOffProduct(body.product, barcode, lang);
    if (!p) return { status: 'incomplete', name: body.product.product_name ?? null };
    return { status: 'found', product: p };
  } catch (e: any) {
    return { status: 'error', message: e?.message ?? 'network error' };
  }
}

// ---------------------------------------------------------------------------
// Assessment against the user's goals (informational, never a verdict)
// ---------------------------------------------------------------------------
export interface Assessment {
  key: string;
  tone: 'good' | 'info' | 'caution';
  params?: Record<string, string | number>;
}

export function assessProduct(
  p: Product,
  ctx: { remainingKcal: number; remainingProtein: number; sugarMax: number; sodiumMax: number; allergies: string[] },
  grams: number,
): Assessment[] {
  const f = grams / 100;
  const kcal = p.per100.kcal * f;
  const protein = p.per100.protein * f;
  const sugar = p.per100.sugar * f;
  const sodium = p.per100.sodium * f;
  const out: Assessment[] = [];

  const hits = p.allergens.filter((a) => ctx.allergies.includes(a));
  if (hits.length) out.push({ key: 'assess.allergen', tone: 'caution', params: { list: hits.join(', ') } });

  // Protein density: ≥ 10 g protein per 100 kcal is a strong protein source.
  if (p.per100.kcal > 0 && (p.per100.protein * 4) / p.per100.kcal >= 0.25 && protein >= 8) {
    out.push({ key: 'assess.protein', tone: 'good', params: { g: Math.round(protein) } });
  }
  // UK FSA front-of-pack thresholds per 100 g (solids): sugar > 22.5 g high, salt > 1.5 g (sodium 600 mg) high.
  if (p.per100.sugar > 22.5 && !p.missing.includes('sugar')) {
    out.push({ key: 'assess.sugarHigh', tone: 'caution', params: { pct: Math.round((sugar / Math.max(1, ctx.sugarMax)) * 100) } });
  } else if (p.per100.sugar <= 5 && !p.missing.includes('sugar')) {
    out.push({ key: 'assess.sugarLow', tone: 'good' });
  }
  if (p.per100.sodium > 600 && !p.missing.includes('sodium')) {
    out.push({ key: 'assess.sodiumHigh', tone: 'caution', params: { pct: Math.round((sodium / ctx.sodiumMax) * 100) } });
  }
  if (p.per100.fiber >= 6 && !p.missing.includes('fiber')) out.push({ key: 'assess.fiber', tone: 'good' });
  if (kcal <= 200 && kcal > 0) out.push({ key: 'assess.snack', tone: 'info', params: { kcal: Math.round(kcal) } });
  if (kcal > ctx.remainingKcal && ctx.remainingKcal >= 0) {
    out.push({ key: 'assess.overRemaining', tone: 'info', params: { kcal: Math.round(kcal), left: Math.round(ctx.remainingKcal) } });
  } else if (ctx.remainingKcal > 0) {
    out.push({ key: 'assess.share', tone: 'info', params: { pct: Math.round((kcal / ctx.remainingKcal) * 100) } });
  }
  if (out.some((a) => a.tone === 'caution')) out.push({ key: 'assess.alternative', tone: 'info' });
  if (p.missing.length) out.push({ key: 'assess.missing', tone: 'info' });
  return out;
}
