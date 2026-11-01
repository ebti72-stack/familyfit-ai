// Supabase Edge Function: translate a recipe's words. Quantities/units live in structured fields and are
// never sent for translation; every translated step is checked to contain exactly the same numbers.
// Deploy: supabase secrets set ANTHROPIC_API_KEY=... && supabase functions deploy translate-recipe
import { cors, json, numbersIn, requireUser, structured } from '../_shared/claude.ts';

const LANGS: Record<string, string> = {
  ar: 'Arabic', en: 'English', fil: 'Filipino (Tagalog)', hi: 'Hindi', ur: 'Urdu', ne: 'Nepali', fr: 'French',
};

interface Source { title: string; description: string; ingredientNames: string[]; steps: string[]; notes: string; servingTip: string }

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'ingredient_names', 'steps', 'notes', 'serving_tip'],
  properties: {
    title: { type: 'string' }, description: { type: 'string' },
    ingredient_names: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' }, serving_tip: { type: 'string' },
  },
};

function system(target: string) {
  const base = `Translate a home recipe into ${LANGS[target]}.
- Keep every number, time, temperature and unit exactly as in the source (same digits; do not convert units).
- Same number of ingredient names and steps, in the same order. Do not add, merge, drop or explain steps.
- Ingredient names: the word a home cook would use in a shop or kitchen.
- Empty source fields stay empty.`;
  if (target === 'fil') {
    return `${base}
- Write for a domestic helper cooking for a family: simple, direct Tagalog imperatives (e.g. "Hiwain", "Igisa", "Pakuluan nang mahina").
- Keep food words Filipinos commonly say in English when that is clearer (e.g. "olive oil", "broccoli", "oven").
- Short sentences, one action per sentence where possible.`;
  }
  return base;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!(await requireUser(req))) return json({ error: 'unauthorized' }, 401);
  let body: { source: Source; target: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const { source, target } = body;
  if (!LANGS[target] || !source || !Array.isArray(source.steps) || !Array.isArray(source.ingredientNames)) return json({ error: 'bad_request' }, 400);
  if (source.steps.length > 60 || source.ingredientNames.length > 80) return json({ error: 'too_large' }, 413);
  try {
    const out = await structured<any>({
      system: system(target),
      content: [{ type: 'text', text: JSON.stringify({ title: source.title, description: source.description, ingredient_names: source.ingredientNames, steps: source.steps, notes: source.notes, serving_tip: source.servingTip }) }],
      schema: SCHEMA,
    });
    if (!out) return json({ error: 'declined' }, 422);
    const steps: string[] = out.steps ?? [];
    const numberWarnings = source.steps.map((s, i) => (numbersIn(s).join('|') === numbersIn(steps[i] ?? '').join('|') ? -1 : i)).filter((i) => i >= 0);
    return json({
      title: out.title, description: out.description, ingredientNames: out.ingredient_names, steps, notes: out.notes, servingTip: out.serving_tip,
      numberWarnings, lengthMismatch: steps.length !== source.steps.length || (out.ingredient_names ?? []).length !== source.ingredientNames.length,
    });
  } catch (e) {
    if (String(e).includes('not_configured')) return json({ error: 'not_configured' }, 503);
    return json({ error: 'upstream' }, 502);
  }
});
