import { authenticate, cors, handleError, json } from '../_shared/http.ts';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { user, client, token } = await authenticate(req); const body = await req.json();
    if (body.confirm !== 'DELETE') return json({ error: 'Explicit deletion confirmation required' }, 400);
    // getUser validates the live user. Cascade deletes financial and membership
    // rows; the removed auth.users FK rejects later writes from an old JWT.
    const { error: signOutError } = await client.auth.admin.signOut(token, 'global');
    if (signOutError) throw signOutError;
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch (error) { return handleError(error); }
});
