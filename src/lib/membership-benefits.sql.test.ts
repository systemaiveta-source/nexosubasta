import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE plans(id uuid PRIMARY KEY,name text,months int,audience text,max_active_auctions int,referral_pct numeric);
    CREATE TABLE subscriptions(id uuid PRIMARY KEY,user_id uuid,plan_id uuid,status text,starts_at timestamptz,ends_at timestamptz);
    CREATE TABLE profiles(id uuid PRIMARY KEY,display_name text,country text,city text,bio text,phone text,referral_code text,created_at timestamptz DEFAULT now(),account_status text DEFAULT 'active',referred_by uuid);
    CREATE TABLE reviews(reviewee_id uuid,rating int,comment text,created_at timestamptz DEFAULT now());
    CREATE TABLE wallet_transactions(user_id uuid,kind text,ref_user_id uuid,amount numeric,currency text);
    CREATE TABLE auctions(id uuid,seller_id uuid,title text,status text,current_price numeric,currency text,bid_count int,ends_at timestamptz,auction_type text,closing_mode text,winner_id uuid,selection_pending boolean,extension_pending boolean,extension_used boolean,republished_from uuid,created_at timestamptz DEFAULT now());
    CREATE VIEW auctions_safe AS SELECT * FROM auctions WHERE status<>'draft' OR seller_id=auth.uid();
    CREATE TABLE notification_push_outbox(id uuid,status text,claimed_at timestamptz,created_at timestamptz,notification_id uuid,device_id uuid,user_id uuid);
    CREATE TABLE notifications(id uuid,title text,body text,link text,event_kind text);
    CREATE TABLE push_devices(id uuid,user_id uuid,active boolean,transport text,subscription jsonb);
    CREATE TABLE notification_preferences(user_id uuid,new_auctions boolean,activity boolean);
    CREATE TABLE categories(id uuid,name text);
    CREATE TABLE transactions(id uuid,auction_id uuid);
    ALTER TABLE auctions ADD COLUMN starting_price numeric,ADD COLUMN images text[],ADD COLUMN category_id uuid;
    INSERT INTO plans VALUES('${id}','Inicio',1,'seller',3,5);`);
  for (const file of ["0031_profile_membership_benefits_and_push_recovery", "0032_owner_publication_projection", "0033_membership_calendar_windows_and_public_badges"])
    await db.exec(readFileSync(`drizzle/migrations/${file}.sql`, "utf8"));
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(`TRUNCATE subscriptions,profiles,auctions,reviews; SELECT set_config('test.uid','${owner}',false);
    INSERT INTO profiles(id,display_name,phone,referral_code) VALUES('${owner}','Owner','PRIVATE','PRIVATE');
    UPDATE plans SET featured_interval='none',profile_badge=null,max_active_auctions=3,referral_pct=5;
    INSERT INTO subscriptions VALUES('${id}','${owner}','${id}','active',now()-interval '1 hour',now()+interval '1 month');`);
});
const benefits = async () => (await db.query<{b: Record<string,unknown>}>(`SELECT membership_benefits('${owner}') AS b`)).rows[0]?.b;
it("monthly advertising lasts 24 hours, not 25", async () => {
  await db.exec("UPDATE plans SET featured_interval='monthly'; UPDATE subscriptions SET starts_at=now()-interval '1 month'-interval '23 hours'");
  expect((await benefits())?.["featured"]).toBe(true);
  await db.exec("UPDATE subscriptions SET starts_at=now()-interval '1 month'-interval '25 hours'");
  expect((await benefits())?.["featured"]).toBe(false);
});
it("weekly advertising lasts 24 hours and repeats after 7 days", async () => {
  await db.exec("UPDATE plans SET featured_interval='weekly'; UPDATE subscriptions SET starts_at=now()-interval '7 days'-interval '23 hours'");
  expect((await benefits())?.["featured"]).toBe(true);
  await db.exec("UPDATE subscriptions SET starts_at=now()-interval '7 days'-interval '25 hours'");
  expect((await benefits())?.["featured"]).toBe(false);
});
it("elite is permanently featured only during an effective subscription", async () => {
  await db.exec("UPDATE plans SET featured_interval='always',profile_badge='Élite',max_active_auctions=null,referral_pct=20,priority_support=true");
  expect(await benefits()).toMatchObject({featured:true,badge:"Élite",max_active_auctions:null,referral_pct:20,priority_support:true});
  await db.exec("UPDATE subscriptions SET starts_at=now()+interval '1 day'");
  expect(await benefits()).toEqual({});
  await db.exec("UPDATE subscriptions SET starts_at=now()-interval '2 days',ends_at=now()-interval '1 day'");
  expect(await benefits()).toEqual({});
});
it("public profile never exposes contact, referral code or subscription dates", async () => {
  const result = await db.query<{p: Record<string,unknown>}>(`SELECT public_user_profile('${owner}') AS p`);
  expect(result.rows[0]?.p).toHaveProperty("display_name","Owner");
  expect(result.rows[0]?.p).not.toHaveProperty("phone");
  expect(result.rows[0]?.p).not.toHaveProperty("referral_code");
  expect(result.rows[0]?.p["membership"]).toEqual({badge:null});
});
it("own publication RPC includes own drafts but never other users' publications", async () => {
  await db.exec(`INSERT INTO auctions(id,seller_id,title,status) VALUES('${id}','${owner}','Own draft','draft'),('${other}','${other}','Foreign','active')`);
  const result = await db.query<{a: {title: string}[]}>("SELECT my_publications() AS a");
  expect(result.rows[0]?.a.map(a=>a.title)).toEqual(["Own draft"]);
  await db.exec("SELECT set_config('test.uid','',false)");
  await expect(db.query("SELECT my_publications()")).rejects.toThrow("Inicia sesión");
});
it("only active auctions from eligible plans are featured", async () => {
  await db.exec(`UPDATE plans SET featured_interval='always'; INSERT INTO auctions(id,seller_id,status) VALUES('${id}','${owner}','active'),('${other}','${owner}','draft')`);
  expect((await db.query("SELECT * FROM featured_auction_ids()")).rows).toEqual([{featured_auction_ids:id}]);
});