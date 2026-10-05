import { describe, expect, it } from "vitest";
import { matchesPremiumCode } from "../../supabase/functions/_shared/premium-code";

describe("Server-only lifetime code validation", () => {
  const code = "test-only-random-32-character-code";
  it("matches an exact code with surrounding spaces", async () => {
    expect(await matchesPremiumCode(` ${code} `, code)).toBe(true);
  });
  it("rejects guesses, casing differences and malformed inputs", async () => {
    for (const input of [
      "",
      "guess",
      code.toUpperCase(),
      null,
      1,
      "x".repeat(129),
    ]) {
      expect(await matchesPremiumCode(input, code)).toBe(false);
    }
  });
  it("fails closed without a configured strong secret", async () => {
    await expect(matchesPremiumCode(code, undefined)).rejects.toThrow(
      /not configured/,
    );
    await expect(matchesPremiumCode("1234", "1234")).rejects.toThrow(
      /not configured/,
    );
  });
});
