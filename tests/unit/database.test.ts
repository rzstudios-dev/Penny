import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import { emptyLedger, addWallet } from "../../src/lib/model";

const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  charlie = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('penny.test_user_id', true), '')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values('${alice}'), ('${bob}');`,
  );
  for (const file of (await fs.readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await db.exec(await fs.readFile(`supabase/migrations/${file}`, "utf8"));
  }
}, 20000);
afterAll(async () => {
  await db.close();
});
async function asUser(user: string, operation: () => Promise<unknown>) {
  await db.exec(`set role authenticated; set penny.test_user_id = '${user}';`);
  try {
    return await operation();
  } finally {
    await db.exec("reset role;");
  }
}
describe("Separate Penny database security (in-memory PostgreSQL; no connections)", () => {
  it("saves an owned ledger and increments revision", async () => {
    await asUser(alice, async () => {
      const first = await db.query<{ penny_save_ledger: number }>(
        "select public.penny_save_ledger($1::jsonb, 0)",
        [JSON.stringify(fixtureLedger())],
      );
      expect(Number(first.rows[0].penny_save_ledger)).toBe(1);
      const next = await db.query<{ penny_save_ledger: number }>(
        "select public.penny_save_ledger($1::jsonb, 1)",
        [JSON.stringify(fixtureLedger())],
      );
      expect(Number(next.rows[0].penny_save_ledger)).toBe(2);
    });
  });
  it("prevents another user from seeing, modifying or deleting the ledger", async () => {
    await asUser(bob, async () => {
      expect(
        (await db.query("select * from public.penny_ledgers")).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "delete from public.penny_ledgers where user_id = $1 returning user_id",
            [alice],
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.query("insert into public.penny_ledgers(user_id, data) values($1, $2)", [
          alice,
          JSON.stringify(fixtureLedger()),
        ]),
      ).rejects.toThrow();
    });
  });
  it("rejects stale-device writes", async () => {
    await asUser(alice, async () => {
      await expect(
        db.query("select public.penny_save_ledger($1::jsonb, 1)", [
          JSON.stringify(fixtureLedger()),
        ]),
      ).rejects.toThrow(/CONFLICT/);
    });
  });
  it("enforces category/account limits at the server", async () => {
    await asUser(bob, async () => {
      const l = fixtureLedger();
      l.categories = Array.from({ length: 11 }, (_, i) => ({
        ...l.categories[0],
        id: `c-${i}`,
        name: `Category ${i}`,
      }));
      await expect(
        db.query("select public.penny_save_ledger($1::jsonb, 0)", [
          JSON.stringify(l),
        ]),
      ).rejects.toThrow(/Premium/);
      const a = fixtureLedger();
      a.accounts.push({
        id: "second",
        name: "Savings",
        icon: "wallet",
        openingBalance: 0,
        currency: "USD",
      });
      await expect(
        db.query("select public.penny_save_ledger($1::jsonb, 0)", [
          JSON.stringify(a),
        ]),
      ).rejects.toThrow(/Premium/);
    });
  });
  it("clients cannot grant themselves Premium or call purchase-token RPCs", async () => {
    await asUser(bob, async () => {
      await expect(
        db.query(
          "insert into public.penny_entitlements(user_id, status) values($1, $2)",
          [bob, "SUBSCRIPTION_STATE_ACTIVE"],
        ),
      ).rejects.toThrow();
      await expect(
        db.query("select public.penny_get_play_purchases($1)", [bob]),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it("rejects incomplete penny_ledgers", async () => {
    await asUser(bob, async () => {
      await expect(
        db.query("select public.penny_save_ledger($1::jsonb, 0)", ["{}"]),
      ).rejects.toThrow();
    });
  });
  it("only the server can consume code attempts or grant lifetime access", async () => {
    await asUser(bob, async () => {
      await expect(
        db.query("select public.penny_consume_premium_code_attempt($1)", [bob]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select public.penny_grant_lifetime_premium($1)", [bob]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select public.penny_grant_year_premium($1)", [bob]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query(
          "update public.penny_entitlements set lifetime = true where user_id = $1",
          [bob],
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it("limits code attempts to five per account per fifteen minutes", async () => {
    await db.exec("set role service_role");
    try {
      for (let i = 0; i < 5; i++)
        expect(
          (
            await db.query<{ ok: boolean }>(
              "select public.penny_consume_premium_code_attempt($1) as ok",
              [bob],
            )
          ).rows[0].ok,
        ).toBe(true);
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select public.penny_consume_premium_code_attempt($1) as ok",
            [bob],
          )
        ).rows[0].ok,
      ).toBe(false);
      await db.query(
        "update penny_private.penny_premium_code_attempts set window_start = now() - interval '16 minutes' where user_id = $1",
        [bob],
      );
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select public.penny_consume_premium_code_attempt($1) as ok",
            [bob],
          )
        ).rows[0].ok,
      ).toBe(true);
    } finally {
      await db.exec("reset role");
    }
  });
  it("lifetime access unlocks paid data and survives expired Play receipts", async () => {
    await db.exec("set role service_role");
    try {
      await db.query("select public.penny_grant_lifetime_premium($1)", [alice]);
      await db.query(
        "select public.penny_store_play_purchase('expired-token', $1, 'penny_premium', now() - interval '1 day', 'SUBSCRIPTION_STATE_EXPIRED')",
        [alice],
      );
    } finally {
      await db.exec("reset role");
    }
    await asUser(alice, async () => {
      const ledger = fixtureLedger();
      ledger.accounts.push({
        ...ledger.accounts[0],
        id: "savings",
        name: "Savings",
      });
      ledger.categories = Array.from({ length: 12 }, (_, i) => ({
        ...ledger.categories[0],
        id: `paid-${i}`,
        icon: "desktop",
      }));
      expect(
        (await db.query("select lifetime from public.penny_entitlements")).rows,
      ).toEqual([{ lifetime: true }]);
      await db.query("select public.penny_save_ledger($1::jsonb, 2)", [
        JSON.stringify(ledger),
      ]);
    });
  });
  it("grants a one-year code once and accepts a recorded balance adjustment", async () => {
    await db.exec("set role service_role");
    try {
      const result = await db.query<{ expires: string }>("select public.penny_grant_year_premium($1) as expires", [bob]);
      expect(new Date(result.rows[0].expires).getTime()).toBeGreaterThan(Date.now());
      await expect(db.query("select public.penny_grant_year_premium($1)", [bob])).rejects.toThrow(/already redeemed/);
    } finally { await db.exec("reset role"); }
    await asUser(bob, async () => {
      const ledger = fixtureLedger();
      ledger.transactions.push({ id: "adjustment", accountId: ledger.accounts[0].id, categoryId: "", kind: "expense", amount: 25000, note: "Balance adjustment", date: "2026-10-05", createdAt: "2026-10-05T12:00:00", expenseType: "adjustment" });
      await db.query("select public.penny_save_ledger($1::jsonb, 0)", [JSON.stringify(ledger)]);
    });
  });
  it("rejects expenses assigned to an envelope in another wallet", async () => {
    await asUser(alice, async () => {
      const ledger = fixtureLedger();
      ledger.accounts.push({
        ...ledger.accounts[0],
        id: "savings",
        name: "Savings",
      });
      ledger.transactions.push({
        id: "cross-wallet",
        accountId: "savings",
        categoryId: "food",
        kind: "expense",
        amount: 10000,
        note: "Lunch",
        date: "2026-10-05",
        createdAt: "2026-10-05T12:00:00",
        expenseType: "needs",
      });
      await expect(
        db.query("select public.penny_save_ledger($1::jsonb, 3)", [
          JSON.stringify(ledger),
        ]),
      ).rejects.toThrow(/does not belong/);
    });
  });
  it("deletes only Penny data while preserving a shared login and another app", async () => {
    await db.query("insert into auth.users(id) values($1)", [charlie]);
    await db.exec("create table public.other_app_records(user_id uuid primary key references auth.users(id), label text not null)");
    await db.query("insert into public.other_app_records values($1, 'Keep me')", [charlie]);
    await asUser(charlie, async () => {
      await db.query("insert into public.penny_accounts(user_id) values($1)", [charlie]);
      await db.query("select public.penny_save_ledger($1::jsonb, 0)", [
        JSON.stringify(fixtureLedger()),
      ]);
      await expect(
        db.query("delete from public.penny_accounts where user_id = $1", [charlie]),
      ).rejects.toThrow(/permission denied/);
    });
    await db.exec("set role service_role");
    try {
      await db.query(
        "select public.penny_store_play_purchase('charlie-token', $1, 'penny_premium', now() + interval '1 month', 'SUBSCRIPTION_STATE_ACTIVE')",
        [charlie],
      );
      await db.query("select public.penny_consume_premium_code_attempt($1)", [charlie]);
      await db.query("delete from public.penny_accounts where user_id = $1", [charlie]);
    } finally {
      await db.exec("reset role");
    }
    for (const table of ["penny_accounts", "penny_ledgers", "penny_entitlements"]) {
      expect((await db.query(`select 1 from public.${table} where user_id = $1`, [charlie])).rows).toHaveLength(0);
    }
    for (const table of ["penny_play_purchases", "penny_premium_code_attempts"]) {
      expect((await db.query(`select 1 from penny_private.${table} where user_id = $1`, [charlie])).rows).toHaveLength(0);
    }
    expect((await db.query("select 1 from auth.users where id = $1", [charlie])).rows).toHaveLength(1);
    expect((await db.query("select label from public.other_app_records where user_id = $1", [charlie])).rows).toEqual([{ label: "Keep me" }]);
  });
  it("auth-user deletion cascades to the financial ledger", async () => {
    await db.query("delete from auth.users where id = $1", [alice]);
    expect(
      (
        await db.query("select * from public.penny_ledgers where user_id = $1", [
          alice,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from public.penny_entitlements where user_id = $1", [
          alice,
        ])
      ).rows,
    ).toHaveLength(0);
  });
});

function fixtureLedger(currency = "USD") {
  const ledger = emptyLedger(currency);
  ledger.accounts = [
    {
      id: "main",
      name: "Everyday wallet",
      icon: "wallet",
      openingBalance: 0,
      currency,
    },
  ];
  return addWallet({ ...ledger, accounts: [] }, ledger.accounts[0]);
}
