import { authenticate, cors, handleError, json } from "../_shared/http.ts";
import { matchesPremiumCode } from "../_shared/premium-code.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { client, user } = await authenticate(req);
    const lifetimeSecret = Deno.env.get("LIFETIME_PREMIUM_CODE");
    const yearSecret = Deno.env.get("PENNY_YEAR_CODE");
    if ((!lifetimeSecret || lifetimeSecret.trim().length < 24) && (!yearSecret || yearSecret.trim().length < 10))
      return json(
        { error: "Code redemption is unavailable. Please try again later." },
        503,
      );
    const { data: allowed, error: rateError } = await client.rpc(
      "penny_consume_premium_code_attempt",
      { owner_id: user.id },
    );
    if (rateError) throw rateError;
    if (!allowed)
      return json(
        { error: "Too many tries. Please try again in 15 minutes." },
        429,
      );
    const text = await req.text();
    if (text.length > 512)
      return json({ error: "That code does not match. Please check it." }, 400);
    let code: unknown;
    try {
      code = JSON.parse(text).code;
    } catch {
      return json({ error: "Please enter a valid code." }, 400);
    }
    const lifetime = lifetimeSecret?.trim().length && lifetimeSecret.trim().length >= 24 && await matchesPremiumCode(code, lifetimeSecret);
    const year = yearSecret?.trim().length && yearSecret.trim().length >= 10 && await matchesPremiumCode(code, yearSecret);
    if (!lifetime && !year)
      return json({ error: "That code does not match. Please check it." }, 400);
    const { data: expiry, error } = await client.rpc(lifetime ? "penny_grant_lifetime_premium" : "penny_grant_year_premium", { owner_id: user.id });
    if (error) throw error;
    return json({
      active: true,
      lifetime: !!lifetime,
      expiresAt: lifetime ? null : expiry,
      everPremium: true,
    });
  } catch (error) {
    return handleError(error);
  }
});
