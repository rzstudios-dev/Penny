import { authenticate, cors, handleError, json } from "../_shared/http.ts";
import { matchesPremiumCode } from "../_shared/premium-code.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { client, user } = await authenticate(req);
    const secret = Deno.env.get("LIFETIME_PREMIUM_CODE");
    if (!secret || secret.trim().length < 24 || secret.trim().length > 128)
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
    if (!(await matchesPremiumCode(code, secret)))
      return json({ error: "That code does not match. Please check it." }, 400);
    const { error } = await client.rpc("penny_grant_lifetime_premium", {
      owner_id: user.id,
    });
    if (error) throw error;
    return json({
      active: true,
      lifetime: true,
      expiresAt: null,
      everPremium: true,
    });
  } catch (error) {
    return handleError(error);
  }
});
