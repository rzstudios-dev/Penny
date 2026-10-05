// Compare digests in fixed time; never return or log the configured secret.
export async function matchesPremiumCode(
  code: unknown,
  secret: string | undefined,
) {
  if (!secret || secret.trim().length < 24 || secret.trim().length > 128)
    throw new Error("Code redemption is not configured");
  if (typeof code !== "string" || code.length > 128 || !code.trim())
    return false;
  const digest = (value: string) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim()));
  const [a, b] = await Promise.all([digest(code), digest(secret)]);
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
