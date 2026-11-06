import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

// Disposable PostgreSQL, never the hosted database. Fixtures have no auth users or payments.
const db = new PGlite();
const migration = readFileSync(
  "drizzle/migrations/0025_independent_product_modalities.sql",
  "utf8",
);
const old = readFileSync(
  "drizzle/migrations/0022_auction_minutes_and_safe_transitions.sql",
  "utf8",
);
const base = readFileSync("drizzle/migrations/0006_atomic_bids_client_service_close.sql", "utf8");
const extract = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  if (!match?.[1]) throw new Error("SQL fixture extraction failed");
  return match[1];
};
beforeAll(async () => {
  await db.exec(`
    CREATE TABLE auctions(id uuid PRIMARY KEY,seller_id uuid,status text DEFAULT 'draft',auction_type text DEFAULT 'item',rules_version int DEFAULT 4,closing_mode text,closing_phase text DEFAULT 'waiting',starts_at timestamptz,ends_at timestamptz,original_ends_at timestamptz,inactivity_cap_at timestamptz,duration_hours int DEFAULT 24,duration_minutes int DEFAULT 60,wait_days int DEFAULT 7,quiet_period_minutes int DEFAULT 5,quiet_period_seconds int DEFAULT 300,bid_count int DEFAULT 0,reserve_met boolean DEFAULT false,extension_used boolean DEFAULT false,extension_pending boolean DEFAULT false,extensions_count int DEFAULT 0,leader_id uuid,winner_id uuid,current_price numeric,currency text DEFAULT 'USD',selection_pending boolean DEFAULT false);
    CREATE TABLE auction_private(auction_id uuid,reserve_price numeric);
    CREATE TABLE auction_events(auction_id uuid,kind text,details jsonb);
    CREATE TABLE transactions(id uuid DEFAULT gen_random_uuid(),auction_id uuid UNIQUE,buyer_id uuid,seller_id uuid,amount numeric,currency text);
    CREATE FUNCTION notify(uuid,text,text,text) RETURNS void LANGUAGE sql AS 'SELECT';
  `);
  for (const fn of migration.matchAll(
    /(CREATE FUNCTION public\.(?:fixed|reserve|flash)_product_clock[\s\S]*?END \$\$;)/g,
  ))
    await db.exec(fn[1]);
  const timing = extract(
    old,
    /(CREATE OR REPLACE FUNCTION public.auction_v2_timing\(\)[\s\S]*?END \$\$;)/,
  );
  await db.exec(timing);
  await db.exec(extract(migration, /(DO \$\$ DECLARE d text; BEGIN[\s\S]*?END \$\$;)/));
  await db.exec(
    "CREATE TRIGGER auction_v2_timing BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION auction_v2_timing()",
  );
  let processor = extract(
    base,
    /(CREATE OR REPLACE FUNCTION public.process_auctions\(\)[\s\S]*?END \$\$;)/,
  );
  const reserveBranch = `IF a.rules_version>=3 AND a.closing_mode='reserve' AND a.bid_count>0 AND NOT a.reserve_met AND NOT a.extension_used THEN
    IF NOT a.extension_pending THEN UPDATE public.auctions SET extension_pending=true WHERE id=a.id; END IF; CONTINUE; END IF;`;
  processor = processor.replace(
    "SELECT reserve_price INTO reserve_value",
    reserveBranch + "\n SELECT reserve_price INTO reserve_value",
  );
  const flashBranch = extract(
    migration,
    /d:=replace\(d,'IF a.rules_version>=3 AND a.closing_mode', \$patch\$([\s\S]*?)\$patch\$\);/,
  );
  processor = processor.replace("IF a.rules_version>=3 AND a.closing_mode", flashBranch);
  await db.exec(processor);
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec("TRUNCATE auctions,auction_private,auction_events,transactions");
});
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
async function fixture(mode: string, n = 1) {
  await db.query("INSERT INTO auctions(id,seller_id,closing_mode) VALUES($1,$2,$3)", [
    id(n),
    id(9),
    mode,
  ]);
  await db.query("UPDATE auctions SET status='active',starts_at=clock_timestamp() WHERE id=$1", [
    id(n),
  ]);
}
async function row(n = 1) {
  return (await db.query<Record<string, unknown>>("SELECT * FROM auctions WHERE id=$1", [id(n)]))
    .rows[0];
}
async function bid(n = 1, met = true) {
  await db.query(
    "UPDATE auctions SET bid_count=bid_count+1,leader_id=$2,current_price=coalesce(current_price,0)+1,reserve_met=$3 WHERE id=$1",
    [id(n), id(8), met],
  );
}
describe("actual PostgreSQL product transitions", () => {
  it("fixed publication gives exactly eight days without bids", async () => {
    await fixture("fixed");
    const a = await row();
    expect(Number(new Date(String(a.ends_at))) - Number(new Date(String(a.starts_at)))).toBe(
      8 * 86400000,
    );
  });
  it("fixed first bid starts full duration and queued subsequent bids never reset it", async () => {
    await fixture("fixed");
    await bid();
    const first = await row();
    await Promise.all([bid(), bid()]);
    const last = await row();
    expect(last.ends_at).toEqual(first.ends_at);
    expect(last.bid_count).toBe(3);
  });
  it("reserve below threshold retains cap; eligible bid starts full quiet period", async () => {
    await fixture("reserve");
    const start = await row();
    await bid(1, false);
    expect((await row()).ends_at).toEqual(start.ends_at);
    await bid();
    const a = await row();
    expect(a.closing_phase).toBe("quiet");
    expect(Number(new Date(String(a.ends_at))) - Date.now()).toBeGreaterThan(299000);
  });
  it("flash first bid opens seven days; later bids during bidding do not reset", async () => {
    await fixture("flash");
    await bid();
    const first = await row();
    await bid();
    expect((await row()).ends_at).toEqual(first.ends_at);
    expect(first.closing_phase).toBe("bidding");
    expect(Number(new Date(String(first.ends_at))) - Date.now()).toBeGreaterThan(
      7 * 86400000 - 1000,
    );
  });
  it("simultaneous independent modes keep their own clock", async () => {
    await fixture("fixed", 1);
    await fixture("reserve", 2);
    await fixture("flash", 3);
    await Promise.all([bid(1), bid(2), bid(3)]);
    expect((await row(1)).closing_phase).toBe("bidding");
    expect((await row(2)).closing_phase).toBe("quiet");
    expect((await row(3)).closing_phase).toBe("bidding");
  });
  it.each(["fixed", "reserve", "flash"])(
    "%s without bids closes unsold, never creates an operation",
    async (mode) => {
      await fixture(mode);
      await db.exec("UPDATE auctions SET ends_at=clock_timestamp()-interval '1 second'");
      await db.exec("SELECT process_auctions()");
      expect((await row()).status).toBe("ended_unsold");
      expect((await db.query("SELECT * FROM transactions")).rows).toHaveLength(0);
    },
  );
  it("unmet reserve with bids asks once for extension, not adjudication", async () => {
    await fixture("reserve");
    await bid(1, false);
    await db.exec("UPDATE auctions SET ends_at=clock_timestamp()-interval '1 second'");
    await db.exec("SELECT process_auctions(); SELECT process_auctions()");
    expect((await row()).extension_pending).toBe(true);
    expect((await row()).status).toBe("active");
    expect((await db.query("SELECT * FROM transactions")).rows).toHaveLength(0);
  });
  it("flash expiration first opens quiet phase, then closes exactly once", async () => {
    await fixture("flash");
    await bid();
    await db.exec(
      "UPDATE auctions SET inactivity_cap_at=clock_timestamp()-interval '1 second',ends_at=clock_timestamp()-interval '1 second'",
    );
    await db.exec("SELECT process_auctions()");
    expect((await row()).closing_phase).toBe("quiet");
    await db.exec("UPDATE auctions SET ends_at=clock_timestamp()-interval '1 second'");
    await Promise.all([db.exec("SELECT process_auctions()"), db.exec("SELECT process_auctions()")]);
    expect((await row()).status).toBe("ended_sold");
    expect((await db.query("SELECT * FROM transactions")).rows).toHaveLength(1);
  });
  it("fixed reserve unmet closes without winner even with a bid", async () => {
    await fixture("fixed");
    await bid(1, false);
    await db.query("INSERT INTO auction_private VALUES($1,100)", [id(1)]);
    await db.exec(
      "UPDATE auctions SET ends_at=clock_timestamp()-interval '1 second'; SELECT process_auctions()",
    );
    expect((await row()).status).toBe("ended_unsold");
    expect((await row()).winner_id).toBeNull();
  });
  it("legacy published clock is unchanged by v4 branch", async () => {
    await fixture("fixed");
    await db.exec("UPDATE auctions SET rules_version=3");
    await bid();
    const first = await row();
    await bid();
    expect((await row()).ends_at).toEqual(first.ends_at);
  });
});
