// Supabase Edge Function: deletes the caller's auth user after delete_my_data() removed app data.
// Deploy: supabase functions deploy delete-account
// The service-role key is provided by Supabase to edge functions as SUPABASE_SERVICE_ROLE_KEY and never ships in the app.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return new Response('unauthorized', { status: 401 });
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return new Response('unauthorized', { status: 401 });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const del = await admin.auth.admin.deleteUser(data.user.id);
  if (del.error) return new Response(del.error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
