import { importPKCS8, SignJWT } from 'npm:jose@6.1.3';
import { adminClient } from './http.ts';
const ACTIVE = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']);
let access: { value: string; expires: number } | null = null;
async function googleToken() {
  if (access && access.expires > Date.now() + 60_000) return access.value;
  const service = JSON.parse(Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') || '{}');
  if (!service.client_email || !service.private_key) throw new Error('Google Play service account is not configured');
  const key = await importPKCS8(service.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' }).setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(service.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!response.ok) throw new Error('Google authentication failed');
  const data = await response.json(); access = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 }; return access.value;
}
export async function verifyWithGoogle(purchaseToken: string, userId: string, productId: string) {
  const packageName = Deno.env.get('ANDROID_PACKAGE_NAME') || 'app.penny.expenses';
  const expectedProduct = Deno.env.get('PLAY_PRODUCT_ID') || 'penny_premium';
  if (productId !== expectedProduct || !purchaseToken || purchaseToken.length > 4096) throw new Error('Invalid purchase');
  const bearer = await googleToken();
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases`;
  const response = await fetch(`${base}/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers: { Authorization: `Bearer ${bearer}` } });
  if (!response.ok) throw new Error('Purchase verification failed');
  const data = await response.json();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId)))).map(n => n.toString(16).padStart(2, '0')).join('');
  if (data.externalAccountIdentifiers?.obfuscatedExternalAccountId !== hash) throw new Error('Purchase belongs to another account');
  const item = data.lineItems?.find((entry: { productId: string }) => entry.productId === expectedProduct);
  if (!item || !item.expiryTime) throw new Error('Invalid subscription item');
  const active = ACTIVE.has(data.subscriptionState) && new Date(item.expiryTime).getTime() > Date.now();
  // Pending subscriptions are never granted or acknowledged.
  if (active && data.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
    const ack = await fetch(`${base}/subscriptions/${encodeURIComponent(expectedProduct)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!ack.ok) throw new Error('Purchase acknowledgement failed');
  }
  const { error } = await adminClient().rpc('penny_store_play_purchase', { token: purchaseToken, owner_id: userId, product: expectedProduct, expiry: item.expiryTime, state: data.subscriptionState });
  if (error) throw new Error('Could not save purchase verification');
  return { active, expiresAt: item.expiryTime, everPremium: true };
}
export async function subscriptionStatus(userId: string) {
  const client = adminClient();
  const { data: membership, error: membershipError } = await client.from('penny_entitlements').select('lifetime').eq('user_id', userId).maybeSingle();
  if (membershipError) throw membershipError;
  if (membership?.lifetime) return { active: true, lifetime: true, expiresAt: null, everPremium: true };
  const { data: tokens, error: tokenError } = await client.rpc('penny_get_play_purchases', { owner_id: userId });
  if (tokenError) throw tokenError;
  if (tokens?.length) {
    // Re-check with Google on each online status request; refunds and revocations
    // cannot retain access until a locally cached expiry.
    const statuses = [];
    for (const row of tokens) statuses.push(await verifyWithGoogle(row.purchase_token, userId, row.product_id));
    const active = statuses.filter(s => s.active).sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0];
    if (active) return active;
  }
  const { data, error } = await client.from('penny_entitlements').select('expires_at, ever_premium').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return { active: false, expiresAt: data?.expires_at || null, everPremium: !!data?.ever_premium };
}
