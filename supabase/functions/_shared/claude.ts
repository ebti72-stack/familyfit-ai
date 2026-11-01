// Shared helpers for FamilyFit AI Edge Functions that call Claude.
// The API key lives only in Supabase function secrets: `supabase secrets set ANTHROPIC_API_KEY=...`.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

export const MODEL = 'claude-opus-5-5';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** Only signed-in FamilyFit users may call the AI functions. */
export async function requireUser(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data, error } = await sb.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

let client: Anthropic | null = null;
export function claude(): Anthropic | null {
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return null;
  client ??= new Anthropic();
  return client;
}

/**
 * One structured-output request. Returns the parsed JSON object, or null when the model declined
 * (stop_reason "refusal") or the output was cut off. Server-side fallback is enabled so a declined
 * request is retried on Anthropic's recommended fallback model.
 */
export async function structured<T>(params: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T | null> {
  const c = claude();
  if (!c) throw new Error('not_configured');
  const res = await c.beta.messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 16000,
    betas: ['server-side-fallback-2026-07-01'],
    // deno-lint-ignore no-explicit-any
    ...({ fallbacks: 'default' } as any),
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: params.schema } },
    system: params.system,
    messages: [{ role: 'user', content: params.content }],
  });
  if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return null;
  const text = res.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return null;
  return JSON.parse(text.text) as T;
}

/** Numbers in a text (Arabic-Indic digits normalised), sorted — used to verify translations. */
export function numbersIn(s: string): string[] {
  const ascii = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return (ascii.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => x.replace(',', '.')).sort();
}
