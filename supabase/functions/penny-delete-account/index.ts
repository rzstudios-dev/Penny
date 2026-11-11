import { authenticate, cors, handleError, json } from '../_shared/http.ts';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { user, client } = await authenticate(req); const body = await req.json();
    if (body.confirm !== 'DELETE') return json({ error: 'Explicit deletion confirmation required' }, 400);
    // The app-owned account row cascades to every Penny data table in one
    // database transaction. Shared Supabase Auth and other apps are untouched.
    const { error } = await client.from('penny_accounts').delete().eq('user_id', user.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch (error) { return handleError(error); }
});
