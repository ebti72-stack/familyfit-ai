/**
 * Turning a source (link, caption, text, video frames) into a recipe draft for review.
 * Quantities come only from the source; anything unclear stays flagged for the user.
 */
import type { AnalyzeResult } from '../backend/types';
import { FOODS } from '../data/foods';
import type { RecipeIngredientLine, UserRecipe } from './recipe';
import { linesFromExtraction, parseRecipeText, type ParsedRecipe } from './recipeParser';

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'pinterest' | 'web';

export function platformOf(url: string): Platform | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const h = u.hostname.replace(/^www\.|^m\./, '');
  if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
  if (/(^|\.)tiktok\.com$/.test(h)) return 'tiktok';
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return 'youtube';
  if (/(^|\.)(facebook\.com|fb\.watch)$/.test(h)) return 'facebook';
  if (/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/.test(h)) return 'pinterest';
  return 'web';
}

export const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', pinterest: 'Pinterest', web: 'Web',
};

/** Emoji from the main protein / category of the recipe (decorative only). */
export function guessEmoji(lines: RecipeIngredientLine[]): string {
  const ids = lines.map((l) => l.foodId ?? '');
  const has = (re: RegExp) => ids.some((x) => re.test(x));
  if (has(/salmon|tuna|shrimp|fish/)) return '🐟';
  if (has(/chicken/)) return '🍗';
  if (has(/beef|lamb/)) return '🥩';
  if (has(/egg/)) return '🍳';
  if (has(/pasta/)) return '🍝';
  if (has(/rice/)) return '🍚';
  if (has(/oats|flour/)) return '🥣';
  if (ids.some((x) => FOODS[x]?.category === 'fruit')) return '🍓';
  if (ids.some((x) => FOODS[x]?.category === 'vegetable')) return '🥗';
  return '🍽️';
}

export function applyParsed(base: UserRecipe, p: ParsedRecipe): UserRecipe {
  return {
    ...base,
    title: p.title || base.title,
    servings: p.servings ?? base.servings,
    prepMinutes: p.prepMinutes ?? base.prepMinutes,
    cookMinutes: p.cookMinutes ?? base.cookMinutes,
    ingredients: p.ingredients,
    steps: p.steps,
    emoji: guessEmoji(p.ingredients),
  };
}

export function applyAnalysis(base: UserRecipe, r: AnalyzeResult): UserRecipe {
  const ingredients = linesFromExtraction(r.ingredients);
  return {
    ...base,
    title: r.title || base.title,
    servings: r.servings ?? base.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    tools: r.tools,
    ingredients,
    steps: r.steps.map((s) => ({ text: s.text, minutes: s.minutes, tempC: s.temp_c ?? (r.ovenTempC && /فرن|oven|bake|اخبز/i.test(s.text) ? r.ovenTempC : null) })),
    emoji: guessEmoji(ingredients),
  };
}

/**
 * Without the server: read the public caption through the platform's official oEmbed endpoint
 * (TikTok returns the caption; YouTube only the title). Returns null when it can't be read.
 */
export async function fetchPublicCaption(url: string, platform: Platform): Promise<string | null> {
  const endpoint = platform === 'tiktok' ? 'https://www.tiktok.com/oembed?url=' : platform === 'youtube' ? 'https://www.youtube.com/oembed?format=json&url=' : null;
  if (!endpoint) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(endpoint + encodeURIComponent(url), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    const text = typeof j?.title === 'string' ? j.title : '';
    return text.trim() || null;
  } catch {
    return null;
  }
}

/** Caption text often lists ingredients inline ("… 2 eggs, 1 cup oats …"): put each item on its own line. */
export function captionToText(caption: string): string {
  return caption.replace(/\s*[•▪︎·|]\s*/g, '\n').replace(/#\S+/g, '').replace(/\s*,\s*(?=\d)/g, '\n').replace(/\s*،\s*(?=[\d٠-٩])/g, '\n');
}

export { parseRecipeText };
