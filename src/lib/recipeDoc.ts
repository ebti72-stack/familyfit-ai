/**
 * Recipe documents and translations.
 * Quantities, units, times and temperatures are never translated or re-generated: they come from the
 * structured recipe. Only words are translated, and every translated step is checked to contain the
 * same numbers as its source.
 */
import { FOODS } from '../data/foods';
import { DOC_LABELS, DOC_LANGS, FIL_FOODS, FIL_RECIPES, UNIT_LABELS } from '../data/recipeI18n';
import { RECIPE_BY_ID } from '../data/recipes';
import { BUILTIN_PREFIX, type DocLang, type RecipeIngredientLine, type RecipeNutrition, type UserRecipe } from './recipe';
import type { Nutrients } from './types';

export interface RecipeTranslation {
  recipeId: string;
  lang: DocLang;
  title: string;
  description: string;
  ingredientNames: string[];
  steps: string[];
  notes: string;
  servingTip: string;
  /** Fields still in the source language (no offline translation and no service). */
  pending: ('title' | 'ingredients' | 'steps' | 'notes')[];
  /** Step indices whose numbers differ from the source — must be reviewed before export. */
  numberWarnings: number[];
  machine: boolean;
  edited: boolean;
}

export const isRtl = (lang: DocLang) => DOC_LANGS.find((l) => l.code === lang)?.rtl ?? false;

function foodNameIn(foodId: string, lang: DocLang): string | null {
  if (lang === 'ar' || lang === 'en') return FOODS[foodId]?.[lang] ?? null;
  if (lang === 'fil') return FIL_FOODS[foodId] ?? null;
  return null;
}

/** Best offline translation: complete for built-in recipes in ar/en/fil, ingredient names for matched foods. */
export function offlineTranslation(r: UserRecipe, lang: DocLang): RecipeTranslation {
  const base: RecipeTranslation = {
    recipeId: r.id, lang, title: r.title, description: r.description, ingredientNames: r.ingredients.map((i) => i.name), steps: r.steps.map((s) => s.text),
    notes: r.notes, servingTip: r.servingTip, pending: [], numberWarnings: [], machine: false, edited: false,
  };
  if (lang === r.lang) return base;
  const builtin = r.id.startsWith(BUILTIN_PREFIX) ? RECIPE_BY_ID[r.id.slice(BUILTIN_PREFIX.length)] : undefined;
  const pending: RecipeTranslation['pending'] = [];
  let title = r.title;
  let steps = base.steps;
  if (builtin && (lang === 'ar' || lang === 'en')) {
    title = builtin[lang];
    steps = lang === 'ar' ? builtin.stepsAr : builtin.stepsEn;
  } else if (builtin && lang === 'fil' && FIL_RECIPES[builtin.id]) {
    title = FIL_RECIPES[builtin.id].title;
    steps = FIL_RECIPES[builtin.id].steps;
  } else {
    pending.push('title', 'steps');
  }
  const names = r.ingredients.map((i) => (i.foodId ? foodNameIn(i.foodId, lang) : null));
  if (names.some((x) => x == null)) pending.push('ingredients');
  if ((r.notes || r.servingTip || r.description) && !builtin) pending.push('notes');
  const ingredientNames = names.map((x, i) => x ?? r.ingredients[i].name);
  const src = builtin ? builtin.stepsEn : base.steps;
  return { ...base, title, steps, ingredientNames, pending, numberWarnings: builtin ? checkNumbers(src, steps) : [] };
}

/** Numbers in a text (Arabic-Indic digits normalised), as a sorted list. */
export function numbersIn(s: string): string[] {
  const ascii = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  return (ascii.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => x.replace(',', '.')).sort();
}

export function checkNumbers(source: string[], translated: string[]): number[] {
  const bad: number[] = [];
  source.forEach((s, i) => {
    if (numbersIn(s).join('|') !== numbersIn(translated[i] ?? '').join('|')) bad.push(i);
  });
  if (translated.length !== source.length) for (let i = Math.min(source.length, translated.length); i < Math.max(source.length, translated.length); i++) bad.push(i);
  return bad;
}

const FRAC: Record<string, string> = { '0.5': '½', '0.25': '¼', '0.75': '¾', '0.33': '⅓', '0.67': '⅔' };
export function prettyQty(q: number): string {
  const whole = Math.floor(q);
  const frac = Math.round((q - whole) * 100) / 100;
  const f = FRAC[frac.toFixed(2).replace(/0$/, '')] ?? FRAC[String(frac)];
  if (frac === 0) return String(whole);
  if (f) return whole ? `${whole}${f}` : f;
  return String(Math.round(q * 10) / 10);
}

export function formatQty(l: RecipeIngredientLine, lang: DocLang, withGrams: boolean): string {
  const L = DOC_LABELS[lang];
  if (l.qty == null) return l.toTaste ? L.toTaste : '—';
  const unit = l.unit ? UNIT_LABELS[lang][l.unit] : UNIT_LABELS[lang].piece;
  let s = `${prettyQty(l.qty)} ${unit}`;
  if (withGrams && l.grams != null && l.unit !== 'g' && l.unit !== 'kg') s += ` (≈ ${Math.round(l.grams)} ${UNIT_LABELS[lang].g})`;
  if (l.estimated && !l.confirmed) s += ` · ${L.estimated}`;
  return s;
}

export interface DocOptions {
  lang: DocLang;
  checkable: boolean;
  showGrams: boolean;
  includeNutrition: boolean;
}

export interface DocModel {
  lang: DocLang;
  rtl: boolean;
  labels: (typeof DOC_LABELS)['en'];
  title: string;
  description: string;
  emoji: string;
  imageUri: string | null;
  meta: { label: string; value: string }[];
  ingredients: { name: string; qty: string }[];
  steps: { text: string; extra: string }[];
  tools: string[];
  notes: string;
  alternatives: string[];
  servingTip: string;
  nutrition: { rows: { label: string; perServing: string; whole: string; per100: string | null }[]; confidence: string } | null;
  checkable: boolean;
  sourceUrl: string | null;
}

const NUT_KEYS: [keyof Nutrients, keyof (typeof DOC_LABELS)['en'], string][] = [
  ['kcal', 'kcal', ''], ['protein', 'protein', 'g'], ['carbs', 'carbs', 'g'], ['fat', 'fat', 'g'], ['fiber', 'fiber', 'g'], ['sugar', 'sugar', 'g'], ['satFat', 'satFat', 'g'], ['sodium', 'sodium', 'mg'],
];

export function buildDocModel(r: UserRecipe, nut: RecipeNutrition, tr: RecipeTranslation, opts: DocOptions, alternatives: string[] = []): DocModel {
  const L = DOC_LABELS[opts.lang];
  const U = UNIT_LABELS[opts.lang];
  const min = (m: number | null) => (m ? `${m} ${L.minutes}` : null);
  const meta: DocModel['meta'] = [];
  meta.push({ label: L.servings, value: String(r.servings) });
  if (r.prepMinutes) meta.push({ label: L.prep, value: min(r.prepMinutes)! });
  if (r.cookMinutes) meta.push({ label: L.cook, value: min(r.cookMinutes)! });
  if (r.prepMinutes && r.cookMinutes) meta.push({ label: L.total, value: min(r.prepMinutes + r.cookMinutes)! });
  if (r.difficulty) meta.push({ label: L.difficulty, value: L[r.difficulty] });
  const temp = r.steps.map((s) => s.tempC).find((x) => x != null);
  if (temp) meta.push({ label: L.temperature, value: `${temp}°C` });
  const fmt = (v: number, unit: string) => `${Math.round(v * 10) / 10}${unit ? ' ' + (unit === 'g' ? U.g : unit) : ''}`;
  return {
    lang: opts.lang,
    rtl: isRtl(opts.lang),
    labels: L,
    title: tr.title,
    description: tr.description,
    emoji: r.emoji,
    imageUri: r.imageUri,
    meta,
    ingredients: r.ingredients.map((l, i) => ({ name: tr.ingredientNames[i] ?? l.name, qty: formatQty(l, opts.lang, opts.showGrams) })),
    steps: r.steps.map((s, i) => ({
      text: tr.steps[i] ?? s.text,
      extra: [s.minutes ? `${s.minutes} ${L.minutes}` : '', s.tempC ? `${s.tempC}°C` : ''].filter(Boolean).join(' · '),
    })),
    tools: r.tools,
    notes: tr.notes,
    alternatives,
    servingTip: tr.servingTip,
    nutrition: opts.includeNutrition
      ? {
          rows: NUT_KEYS.map(([k, label, unit]) => ({
            label: L[label],
            perServing: fmt(nut.perServing[k], unit),
            whole: fmt(nut.total[k], unit),
            per100: nut.per100g ? fmt(nut.per100g[k], unit) : null,
          })),
          confidence: `${L.confidence}: ${nut.confidence === 'high' ? L.high : nut.confidence === 'medium' ? L.medium : L.low}`,
        }
      : null,
    checkable: opts.checkable,
    sourceUrl: r.sourceUrl,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Printable A4 HTML (expo-print → PDF). Brand colours, no photos of people. */
export function docHtml(m: DocModel): string {
  const L = m.labels;
  const font = m.lang === 'ar' || m.lang === 'ur' ? "'IBM Plex Sans Arabic','Noto Naskh Arabic','Segoe UI',Tahoma,sans-serif" : m.lang === 'hi' || m.lang === 'ne' ? "'Noto Sans Devanagari','Mangal','Segoe UI',sans-serif" : "'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const nut = m.nutrition
    ? `<section><h2>${esc(L.nutrition)}</h2><table><thead><tr><th></th><th>${esc(L.perServing)}</th><th>${esc(L.whole)}</th>${m.nutrition.rows[0].per100 ? `<th>${esc(L.per100g)}</th>` : ''}</tr></thead><tbody>${m.nutrition.rows
        .map((r) => `<tr><td>${esc(r.label)}</td><td><b>${esc(r.perServing)}</b></td><td>${esc(r.whole)}</td>${r.per100 ? `<td>${esc(r.per100)}</td>` : ''}</tr>`)
        .join('')}</tbody></table><p class="small">${esc(m.nutrition.confidence)} · ${esc(L.estimateNote)}<br/>${esc(L.sourceNote)}</p></section>`
    : '';
  return `<!doctype html><html lang="${m.lang}" dir="${m.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(m.title)}</title>
<style>
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { font-family: ${font}; color: #292F2C; margin: 0; font-size: 12.5pt; line-height: 1.55; background: #fff; }
header { background: #123D32; color: #fff; border-radius: 18px; padding: 18px 22px; display: flex; gap: 16px; align-items: center; }
header .emoji { width: 64px; height: 64px; border-radius: 32px; background: rgba(217,164,65,.18); border: 1px solid rgba(217,164,65,.5); display: flex; align-items: center; justify-content: center; font-size: 34px; }
header h1 { margin: 0; font-size: 22pt; line-height: 1.25; }
header p { margin: 4px 0 0; color: #E8F3EC; font-size: 11pt; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 4px; }
.meta div { background: #E8F3EC; border-radius: 12px; padding: 6px 12px; font-size: 10.5pt; }
.meta b { color: #123D32; }
h2 { color: #123D32; font-size: 15pt; margin: 20px 0 8px; padding-bottom: 6px; border-bottom: 2px solid #D9A441; }
ul.ing { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 24px; }
ul.ing li { break-inside: avoid; padding: 6px 0; border-bottom: 1px dashed #DDE5DF; display: flex; gap: 10px; align-items: flex-start; }
.box { width: 16px; height: 16px; border: 2px solid #237B60; border-radius: 4px; flex: 0 0 16px; margin-top: 4px; }
.qty { color: #237B60; font-weight: 700; white-space: nowrap; }
ol.steps { list-style: none; counter-reset: s; padding: 0; margin: 0; }
ol.steps li { counter-increment: s; position: relative; padding: 8px 0; padding-${m.rtl ? 'right' : 'left'}: 44px; break-inside: avoid; }
ol.steps li::before { content: counter(s); position: absolute; ${m.rtl ? 'right' : 'left'}: 0; top: 8px; width: 30px; height: 30px; border-radius: 15px; background: #237B60; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.extra { display: inline-block; margin-top: 2px; font-size: 10pt; color: #8A6A1E; background: #FBF3E2; border-radius: 8px; padding: 1px 8px; }
table { width: 100%; border-collapse: collapse; font-size: 11pt; }
th { background: #123D32; color: #fff; padding: 6px 8px; font-weight: 600; }
td { padding: 6px 8px; border-bottom: 1px solid #E5ECE7; }
tr:nth-child(even) td { background: #F8F8F5; }
.small { font-size: 9.5pt; color: #6B746F; }
footer { margin-top: 22px; font-size: 9pt; color: #8A938E; text-align: center; }
</style></head><body>
<header><div class="emoji">${esc(m.emoji || '🍽️')}</div><div><h1>${esc(m.title)}</h1>${m.description ? `<p>${esc(m.description)}</p>` : ''}</div></header>
<div class="meta">${m.meta.map((x) => `<div>${esc(x.label)}: <b>${esc(x.value)}</b></div>`).join('')}</div>
<section><h2>${esc(L.ingredients)}</h2><ul class="ing">${m.ingredients
    .map((i) => `<li>${m.checkable ? '<span class="box"></span>' : ''}<span><span class="qty">${esc(i.qty)}</span> — ${esc(i.name)}</span></li>`)
    .join('')}</ul></section>
${m.tools.length ? `<section><h2>${esc(L.tools)}</h2><p>${m.tools.map(esc).join(' · ')}</p></section>` : ''}
<section><h2>${esc(L.steps)}</h2><ol class="steps">${m.steps.map((s) => `<li>${esc(s.text)}${s.extra ? `<br/><span class="extra">${esc(s.extra)}</span>` : ''}</li>`).join('')}</ol></section>
${m.alternatives.length ? `<section><h2>${esc(L.alternatives)}</h2><ul>${m.alternatives.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : ''}
${m.notes ? `<section><h2>${esc(L.notes)}</h2><p>${esc(m.notes)}</p></section>` : ''}
${m.servingTip ? `<section><h2>${esc(L.serving)}</h2><p>${esc(m.servingTip)}</p></section>` : ''}
${nut}
<footer>${esc(L.generated)}${m.sourceUrl ? ` · ${esc(m.sourceUrl)}` : ''}</footer>
</body></html>`;
}

/** Plain-text version for WhatsApp / messages. */
export function docText(m: DocModel): string {
  const L = m.labels;
  const lines = [`*${m.title}* ${m.emoji}`, m.meta.map((x) => `${x.label}: ${x.value}`).join(' | '), '', `*${L.ingredients}*`];
  m.ingredients.forEach((i) => lines.push(`☐ ${i.qty} — ${i.name}`));
  lines.push('', `*${L.steps}*`);
  m.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.text}${s.extra ? ` (${s.extra})` : ''}`));
  if (m.notes) lines.push('', `*${L.notes}*`, m.notes);
  if (m.nutrition) {
    lines.push('', `*${L.nutrition} — ${L.perServing}*`);
    lines.push(m.nutrition.rows.slice(0, 4).map((r) => `${r.label}: ${r.perServing}`).join(' · '));
  }
  lines.push('', `— ${L.generated}`);
  return lines.join('\n');
}
