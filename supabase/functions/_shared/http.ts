import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
export const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export function adminClient() { return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } }); }
export async function authenticate(req: Request) {
  const bearer = req.headers.get('Authorization');
  if (!bearer?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const client = adminClient(); const token = bearer.slice(7);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Unauthorized');
  return { client, user: data.user, token };
}
export function handleError(error: unknown) { const message = error instanceof Error ? error.message : 'Request failed'; return json({ error: message === 'Unauthorized' ? message : 'The request could not be completed. Please try again.' }, message === 'Unauthorized' ? 401 : 400); }
