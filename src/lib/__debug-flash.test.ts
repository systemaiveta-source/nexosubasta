import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const extract = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  if (!match?.[1]) throw new Error("SQL fixture extraction failed");
  return match[1];
};
beforeAll(async () => {
  await db.exec(`
    CREATE TABLE auctions(id uuid PRIMARY KEY,seller_id uuid,status text DEFAULT 'draft',auction_type text DEFAULT 'item',rules_version int DEFAULT 4,closing_mode text,closing_phase text DEFAULT 'waiting',starts_at timestamptz,ends_at timestamptz,original_ends_at timestamptz,inactivity_cap_at timestamptz,duration_hours int DEFAULT 24,duration_minutes int DEFAULT 60,wait_days int DEFAULT 7,quiet_period_minutes int DEFAULT 5,quiet_period_seconds int DEFAULT 300,bid_count int DEFAULT 0,reserve_met boolean DEFAULT false,extension_used boolean DEFAULT false,extension_pending boolean DEFAULT false,extensions_count int DEFAULT 0,leader_id uuid,winner_id uuid,current_price numeric,currency text DEFAULT 'USD',selection_pending boolean DEFAULT false);
  `);
  const migration = readFileSync("drizzle/migrations/0025_independent_product_modalities.sql", "utf8");
  const old = readFileSync("drizzle/migrations/0022_auction_minutes_and_safe_transitions.sql", "utf8");
  for (const fn of migration.matchAll(
    /(CREATE FUNCTION public\.(?:fixed|reserve|flash)_product_clock[\s\S]*?END \$\$;)/g,
  )) {
    if (fn[1]) await db.exec(fn[1]);
  }
  await db.exec(extract(old, /(CREATE OR REPLACE FUNCTION public.auction_v2_timing\(\)[\s\S]*?END \$\$;)/));
  await db.exec(extract(migration, /(DO \$\$ DECLARE d text; BEGIN[\s\S]*?END \$\$;)/));
  const latest = readFileSync("drizzle/migrations/0027_mode_edit_and_fixed_publication_guard.sql", "utf8");
  const timingPatch = extract(latest, /(SELECT pg_get_functiondef\('public.auction_v2_timing\(\)'::regprocedure\)[\s\S]*?EXECUTE d;)/);
  await db.exec(`DO $$ DECLARE d text; BEGIN ${timingPatch} END $$;`);
  const v5 = readFileSync("drizzle/migrations/0028_flash_quick_auction_v5.sql", "utf8");
  const v5Timing = extract(v5, /(SELECT pg_get_functiondef\('public\.auction_v2_timing\(\)'::regprocedure\)[\s\S]*?EXECUTE d;)/);
  await db.exec(`DO $$ DECLARE d text; BEGIN ${v5Timing} END $$;`);
  await db.exec("CREATE TRIGGER auction_v2_timing BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION auction_v2_timing()");
}, 30000);
afterAll(() => db.close());

it("debug v5 flash reset", async () => {
  const def = await db.query<{ d: string }>(
    "SELECT pg_get_functiondef('auction_v2_timing()'::regprocedure) AS d",
  );
  console.log("HAS V5 BRANCH:", def.rows[0]?.d.includes("rules_version>=5"));
  await db.query(
    "INSERT INTO auctions(id,seller_id,closing_mode,rules_version) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000009','flash',5)",
  );
  await db.exec("UPDATE auctions SET status='active',starts_at=clock_timestamp()");
  const bid = () =>
    db.exec(
      "UPDATE auctions SET bid_count=bid_count+1,leader_id='00000000-0000-0000-0000-000000000008',current_price=coalesce(current_price,0)+1,reserve_met=true",
    );
  await bid();
  const first = await db.query<{ ends_at: string; phase: string }>(
    "SELECT ends_at::text, closing_phase AS phase FROM auctions",
  );
  await new Promise((r) => setTimeout(r, 120));
  await bid();
  const last = await db.query<{ ends_at: string; phase: string; bc: number }>(
    "SELECT ends_at::text, closing_phase AS phase, bid_count AS bc FROM auctions",
  );
  console.log("FIRST:", first.rows[0]);
  console.log("LAST:", last.rows[0]);
  expect(true).toBe(true);
});
