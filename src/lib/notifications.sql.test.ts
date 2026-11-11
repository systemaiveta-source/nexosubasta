import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
const db = new PGlite();
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  auction = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE TABLE notification_preferences(user_id uuid PRIMARY KEY,new_auctions boolean DEFAULT false,activity boolean DEFAULT true,categories uuid[] DEFAULT '{}');
 CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,title text,body text,link text,read boolean DEFAULT false,created_at timestamptz DEFAULT now());
 CREATE TABLE push_devices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,active boolean DEFAULT true,transport text DEFAULT 'webpush',subscription jsonb);
 CREATE TABLE notification_push_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),notification_id uuid REFERENCES notifications(id),device_id uuid,user_id uuid,status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),claimed_at timestamptz,UNIQUE(notification_id,device_id));
 CREATE TABLE auction_push_events(auction_id uuid PRIMARY KEY); CREATE TABLE categories(id uuid,name text);
 CREATE TABLE auctions(id uuid PRIMARY KEY,seller_id uuid,status text DEFAULT 'draft',title text,description text DEFAULT '',category_id uuid,auction_type text DEFAULT 'item',starting_price numeric,currency text DEFAULT 'USD',images text[]);
 CREATE TABLE transactions(id uuid,auction_id uuid); CREATE TABLE plans(id uuid,name text,months integer,audience text,max_active_auctions integer,referral_pct numeric); CREATE TABLE subscriptions(user_id uuid,plan_id uuid,status text,starts_at timestamptz,ends_at timestamptz); CREATE TABLE profiles(id uuid,display_name text,country text,city text,bio text,created_at timestamptz,account_status text,referred_by uuid); CREATE TABLE reviews(reviewee_id uuid,rating integer,comment text,created_at timestamptz); CREATE TABLE wallet_transactions(user_id uuid,kind text,ref_user_id uuid,amount numeric,currency text);
 ALTER TABLE notifications ENABLE ROW LEVEL SECURITY; GRANT SELECT,UPDATE,DELETE ON notifications TO authenticated; CREATE POLICY own ON notifications TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());`);
  await db.exec(
    readFileSync(
      "drizzle/migrations/0030_notification_consent_publication_read_cleanup.sql",
      "utf8",
    ),
  );
  await db.exec(
    "CREATE TRIGGER enqueue AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION enqueue_notification_push()",
  );
  await db.exec(readFileSync("drizzle/migrations/0031_profile_membership_benefits_and_push_recovery.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0042_descriptive_auction_push_notifications.sql", "utf8"));
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE notification_push_outbox,notifications,push_devices,notification_preferences,auction_push_events,auctions; SELECT set_config('test.uid','${a}',false);
 INSERT INTO notification_preferences(user_id,categories) VALUES('${a}',ARRAY['${b}']::uuid[]),('${b}','{}');
 INSERT INTO push_devices(user_id,subscription) VALUES('${a}','{}'),('${a}','{}'),('${b}','{}');`);
});
it("all categories notify once per user and active device, including seller", async () => {
  await db.exec(
    `INSERT INTO auctions(id,seller_id,title,category_id) VALUES('${auction}','${a}','Test','${auction}'); UPDATE auctions SET status='active'; UPDATE auctions SET title='Updated'; UPDATE auctions SET status='scheduled'; UPDATE auctions SET status='active';`,
  );
  expect((await db.query("SELECT count(*)::int AS n FROM notifications")).rows).toEqual([{ n: 2 }]);
  expect((await db.query("SELECT count(*)::int AS n FROM notification_push_outbox")).rows).toEqual([
    { n: 3 },
  ]);
  const batch = await db.query("SELECT * FROM claim_notification_push_batch(20)");
  expect(batch.rows).toHaveLength(3);
  expect((await db.query("SELECT * FROM claim_notification_push_batch(20)")).rows).toHaveLength(0);
});
it("draft saves and scheduling do not notify; direct active insert notifies once", async () => {
  await db.exec(
    `INSERT INTO auctions(id,seller_id,title) VALUES('${auction}','${a}','Test'); UPDATE auctions SET title='Saved',status='scheduled';`,
  );
  expect((await db.query("SELECT * FROM notifications")).rows).toHaveLength(0);
  await db.exec(
    `DELETE FROM auctions; INSERT INTO auctions(id,seller_id,title,status) VALUES('${auction}','${a}','Test','active')`,
  );
  expect((await db.query("SELECT * FROM notifications")).rows).toHaveLength(2);
});
it("inactive and expired devices never receive a new publication", async () => {
  await db.exec(
    `UPDATE push_devices SET active=false WHERE user_id='${a}'; UPDATE push_devices SET subscription='{"expirationTime":1}' WHERE user_id='${b}'; INSERT INTO auctions(id,title,status) VALUES('${auction}','Test','active')`,
  );
  expect((await db.query("SELECT * FROM notifications")).rows).toHaveLength(0);
});
it("bulk deletion includes all read pages but never unread or another owner", async () => {
  await db.exec(
    `INSERT INTO notifications(user_id,title,read) SELECT '${a}','Read',true FROM generate_series(1,45); INSERT INTO notifications(user_id,title,read) VALUES('${a}','Unread',false),('${b}','Other',true); SET ROLE authenticated;`,
  );
  expect((await db.query("SELECT delete_read_notifications() AS n")).rows).toEqual([{ n: 45 }]);
  await db.exec("RESET ROLE");
  expect((await db.query("SELECT title FROM notifications ORDER BY title")).rows).toEqual([
    { title: "Other" },
    { title: "Unread" },
  ]);
});
it("individual deletion refuses unread and foreign ids and is idempotent", async () => {
  await db.exec(
    `INSERT INTO notifications(id,user_id,title,read) VALUES('${auction}','${b}','Other',true),('${a}','${a}','Unread',false),('${b}','${a}','Read',true); SET ROLE authenticated;`,
  );
  for (const id of [auction, a])
    expect((await db.query(`SELECT delete_read_notifications('${id}') AS n`)).rows).toEqual([
      { n: 0 },
    ]);
  expect((await db.query(`SELECT delete_read_notifications('${b}') AS n`)).rows).toEqual([
    { n: 1 },
  ]);
  expect((await db.query(`SELECT delete_read_notifications('${b}') AS n`)).rows).toEqual([
    { n: 0 },
  ]);
  await expect(db.exec(`DELETE FROM notifications WHERE id='${a}'`)).rejects.toThrow();
});
it("unauthenticated deletion rejected", async () => {
  await db.exec("SELECT set_config('test.uid','',false)");
  await expect(db.query("SELECT delete_read_notifications()")).rejects.toThrow("Inicia sesión");
});
it("activity queue remains independent of new-auction preference", async () => {
  await db.exec(
    `UPDATE notification_preferences SET new_auctions=false; INSERT INTO notifications(user_id,title,body,link) VALUES('${a}','Chat','Message','/operaciones/${auction}')`,
  );
  expect((await db.query("SELECT * FROM claim_notification_push_batch(20)")).rows).toHaveLength(2);
});
it("reclaims stale claims but not fresh claims, and stops after three attempts", async () => {
  await db.exec(`INSERT INTO notifications(user_id,title,link) VALUES('${a}','Chat','/operaciones/${auction}')`);
  expect((await db.query("SELECT * FROM claim_notification_push_batch(20)")).rows).toHaveLength(2);
  expect((await db.query("SELECT * FROM claim_notification_push_batch(20)")).rows).toHaveLength(0);
  for (const attempts of [1,2]) {
    await db.exec("UPDATE notification_push_outbox SET claimed_at=now()-interval '6 minutes'");
    expect((await db.query("SELECT * FROM claim_notification_push_batch(20)")).rows).toHaveLength(2);
    expect((await db.query("SELECT min(attempts)::int AS n FROM notification_push_outbox")).rows).toEqual([{n:attempts+1}]);
  }
  await db.exec("UPDATE notification_push_outbox SET claimed_at=now()-interval '6 minutes'");
  expect((await db.query("SELECT * FROM claim_notification_push_batch(20)")).rows).toHaveLength(0);
});
it("chat notifications inherit only the auction's public item thumbnail", async () => {
  await db.exec(`INSERT INTO auctions(id,title,status,images) VALUES('${auction}','Item','active',ARRAY['public.jpg']); INSERT INTO transactions VALUES('${b}','${auction}'); INSERT INTO notifications(user_id,title,link) VALUES('${a}','Chat','/operaciones/${b}');`);
  const result = await db.query<{image_path:string|null}>("SELECT * FROM claim_notification_push_batch(20)");
  expect(result.rows.filter(r=>r.image_path==='public.jpg')).toHaveLength(5);
});

it("new auction push includes an explicit article description and keeps the public thumbnail", async () => {
  await db.exec(`
    INSERT INTO categories(id,name) VALUES ('${auction}','Tecnología');
    INSERT INTO auctions(id,seller_id,title,description,category_id,status,images)
    VALUES ('${auction}','${a}','Cámara digital',
      'Cámara digital profesional en excelente estado y con accesorios.',
      '${auction}','active',ARRAY['public-camera.jpg']);
  `);
  const notifications = await db.query<{user_id:string;title:string;body:string}>(
    "SELECT user_id,title,body FROM notifications ORDER BY user_id",
  );
  expect(notifications.rows).toHaveLength(2);
  expect(notifications.rows[0]).toMatchObject({
    title: "Cámara digital",
    body: "Tecnología · Nuevo artículo en subasta: Cámara digital profesional en excelente estado y con accesorios.",
  });
  const queued = await db.query<{image_path:string|null}>(
    "SELECT * FROM claim_notification_push_batch(20)",
  );
  expect(queued.rows).toHaveLength(2);
  expect(queued.rows.every((row) => row.image_path === "public-camera.jpg")).toBe(true);
});
