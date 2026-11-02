// Supabase Edge Function: extract a recipe (names, quantities, steps) from public link metadata,
// pasted text, or frames sampled from a video/screen recording/ingredient photos the user uploaded.
//
// Rules enforced here:
//  * Only content that is publicly and legally reachable is read: oEmbed endpoints and a page's own
//    public metadata (Open Graph / schema.org Recipe). Videos are never downloaded from platforms.
//  * The model must not invent quantities; anything inferred is flagged quantity_is_estimate.
//  * The model never returns nutrition. Calories and macros are computed by the app/database from
//    food_items (USDA) after the user reviews the ingredients.
//
// Deploy: supabase secrets set ANTHROPIC_API_KEY=... && supabase functions deploy analyze-recipe
// Optional: META_OEMBED_TOKEN (Instagram/Facebook oEmbed app token) to read public Instagram/Facebook posts.
import { cors, json, requireUser, structured } from '../_shared/claude.ts';

type Mode = 'text' | 'link' | 'frames';
interface Input { mode: Mode; text?: string; url?: string; frames?: string[]; lang: 'ar' | 'en' }

const nullableNumber = { type: ['number', 'null'] };
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['has_recipe', 'title', 'servings', 'prep_minutes', 'cook_minutes', 'oven_temp_c', 'tools', 'ingredients', 'steps', 'alternatives', 'confidence'],
  properties: {
    has_recipe: { type: 'boolean' },
    title: { type: 'string' },
    servings: nullableNumber,
    prep_minutes: nullableNumber,
    cook_minutes: nullableNumber,
    oven_temp_c: nullableNumber,
    tools: { type: 'array', items: { type: 'string' } },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'quantity_is_estimate'],
        properties: {
          name: { type: 'string' },
          quantity: nullableNumber,
          unit: { type: ['string', 'null'], enum: ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece', 'clove', 'slice', 'can', 'pinch', 'handful', null] },
          quantity_is_estimate: { type: 'boolean' },
        },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'minutes', 'temp_c'],
        properties: { text: { type: 'string' }, minutes: nullableNumber, temp_c: nullableNumber },
      },
    },
    alternatives: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
};

const SYSTEM = `You extract cooking recipes for a family nutrition app.
Return only what the source actually shows or says.
- Ingredient names: short and specific, in the language of the source (keep Arabic in Arabic).
- Quantities: copy exactly when stated. If a quantity is not stated but can be reasonably judged from what is visible (e.g. "2 eggs" seen being cracked), give your best estimate and set quantity_is_estimate=true. If it cannot be judged, use null. Never present an estimate as exact.
- "to taste" seasonings: quantity null.
- Units must be one of the allowed values; convert words like "كوب"→cup, "ملعقة كبيرة"→tbsp, "حبة"→piece.
- Steps: concise, in order, with minutes and temperature (°C) only when stated.
- Do not output calories, macros or health claims.
- If the material does not contain a recipe, set has_recipe=false and leave lists empty.
- confidence: high = complete written recipe; medium = some quantities estimated; low = mostly inferred.`;

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'instagram'], [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(facebook\.com|fb\.watch)$/, 'facebook'], [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, 'pinterest'],
];

function platformOf(u: URL): string {
  return PLATFORMS.find(([re]) => re.test(u.hostname))?.[1] ?? 'other';
}

async function getJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'FamilyFitAI/1.0 (+recipe import)' }, signal: AbortSignal.timeout(8000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function decode(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/** Public metadata only: og:title/og:description and schema.org Recipe JSON-LD. */
async function pageMetadata(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'FamilyFitAI/1.0 (+recipe import)', Accept: 'text/html' }, signal: AbortSignal.timeout(8000), redirect: 'follow' });
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 600_000);
    const parts: string[] = [];
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const data = JSON.parse(m[1]);
        const items = ([] as any[]).concat(data['@graph'] ?? data);
        for (const it of items) {
          const t = ([] as string[]).concat(it['@type'] ?? []);
          if (!t.includes('Recipe')) continue;
          parts.push(`Title: ${it.name ?? ''}`, `Servings: ${it.recipeYield ?? ''}`, 'Ingredients:', ...([] as string[]).concat(it.recipeIngredient ?? []));
          const steps = ([] as any[]).concat(it.recipeInstructions ?? []).map((s) => (typeof s === 'string' ? s : s.text ?? ''));
          parts.push('Method:', ...steps);
        }
      } catch { /* ignore malformed JSON-LD */ }
    }
    const og = (p: string) => html.match(new RegExp(`<meta[^>]+property=["']og:${p}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1];
    if (!parts.length) {
      const t = og('title');
      const d = og('description');
      if (t) parts.push(decode(t));
      if (d) parts.push(decode(d));
    }
    return parts.join('\n').trim() || null;
  } catch {
    return null;
  }
}

async function linkText(raw: string): Promise<{ text: string | null; platform: string; status: 'ok' | 'unreachable' | 'unsupported' }> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { text: null, platform: 'other', status: 'unreachable' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { text: null, platform: 'other', status: 'unreachable' };
  const platform = platformOf(u);
  const enc = encodeURIComponent(u.toString());
  if (platform === 'tiktok') {
    const o = await getJson(`https://www.tiktok.com/oembed?url=${enc}`);
    return o?.title ? { text: `${o.title}\n(by ${o.author_name ?? ''})`, platform, status: 'ok' } : { text: null, platform, status: 'unreachable' };
  }
  if (platform === 'youtube') {
    const o = await getJson(`https://www.youtube.com/oembed?url=${enc}&format=json`);
    const meta = await pageMetadata(u.toString());
    const text = [o?.title, meta].filter(Boolean).join('\n');
    return text ? { text, platform, status: 'ok' } : { text: null, platform, status: 'unreachable' };
  }
  if (platform === 'instagram' || platform === 'facebook') {
    const token = Deno.env.get('META_OEMBED_TOKEN');
    if (!token) return { text: null, platform, status: 'unsupported' };
    const kind = platform === 'instagram' ? 'instagram_oembed' : 'oembed_video';
    const o = await getJson(`https://graph.facebook.com/v19.0/${kind}?url=${enc}&access_token=${token}`);
    const caption = o?.html ? decode(String(o.html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : o?.title;
    return caption ? { text: caption, platform, status: 'ok' } : { text: null, platform, status: 'unreachable' };
  }
  const meta = await pageMetadata(u.toString());
  return meta ? { text: meta, platform, status: 'ok' } : { text: null, platform, status: 'unreachable' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!(await requireUser(req))) return json({ error: 'unauthorized' }, 401);
  let input: Input;
  try {
    input = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const empty = { title: '', servings: null, prepMinutes: null, cookMinutes: null, ovenTempC: null, tools: [], ingredients: [], steps: [], alternatives: [], confidence: 'low', sourceText: null };

  let sourceText: string | null = null;
  const content: any[] = [];
  if (input.mode === 'link') {
    const r = await linkText(String(input.url ?? ''));
    if (r.status !== 'ok' || !r.text) return json({ ...empty, status: r.status, message: r.platform });
    sourceText = r.text.slice(0, 20000);
    content.push({ type: 'text', text: `Public post text from ${r.platform}:\n\n${sourceText}` });
  } else if (input.mode === 'text') {
    sourceText = String(input.text ?? '').slice(0, 20000);
    if (sourceText.trim().length < 10) return json({ ...empty, status: 'no_recipe', message: null });
    content.push({ type: 'text', text: `Recipe text:\n\n${sourceText}` });
  } else if (input.mode === 'frames') {
    const frames = (input.frames ?? []).slice(0, 8).filter((f) => typeof f === 'string' && f.length < 2_500_000);
    if (!frames.length) return json({ ...empty, status: 'no_recipe', message: null });
    frames.forEach((data) => content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }));
    content.push({ type: 'text', text: `These are ${frames.length} frames from a cooking video or ingredient photos, in order.${input.text ? `\nCaption/notes from the user:\n${String(input.text).slice(0, 4000)}` : ''}\nExtract the recipe. Quantities you judge from the images must be marked as estimates.` });
  } else {
    return json({ error: 'bad_request' }, 400);
  }

  try {
    const out = await structured<any>({ system: SYSTEM, content, schema: SCHEMA });
    if (!out || !out.has_recipe) return json({ ...empty, status: 'no_recipe', sourceText, message: null });
    return json({
      status: 'ok', title: out.title, servings: out.servings, prepMinutes: out.prep_minutes, cookMinutes: out.cook_minutes, ovenTempC: out.oven_temp_c,
      tools: out.tools, ingredients: out.ingredients, steps: out.steps, alternatives: out.alternatives, confidence: out.confidence, sourceText, message: null,
    });
  } catch (e) {
    if (String(e).includes('not_configured')) return json({ error: 'not_configured' }, 503);
    return json({ error: 'upstream' }, 502);
  }
});
