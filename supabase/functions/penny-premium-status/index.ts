import { authenticate, cors, handleError, json } from '../_shared/http.ts';
import { subscriptionStatus } from '../_shared/play.ts';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try { const { user } = await authenticate(req); return json(await subscriptionStatus(user.id)); }
  catch (error) { return handleError(error); }
});
