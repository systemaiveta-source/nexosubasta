import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";

const db = new PGlite();
const seller = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const auction = "33333333-3333-4333-8333-333333333333";

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE public.auctions(id uuid PRIMARY KEY, seller_id uuid, status text DEFAULT 'active', bid_count int DEFAULT 0, winner_id uuid, selection_pending boolean DEFAULT false, retired_at timestamptz, created_at timestamptz DEFAULT now(), title text, current_price numeric, currency text, ends_at timestamptz, auction_type text, closing_mode text, extension_pending boolean, extension_used boolean, republished_from uuid);
    CREATE VIEW public.auctions_safe AS SELECT * FROM public.auctions;
    CREATE TABLE public.auction_events(auction_id uuid, kind text, details jsonb);
    CREATE TABLE public.admin_audit_log(actor_id uuid, action text, target text, details jsonb);
    CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, body text, link text, read boolean DEFAULT false);
    CREATE TABLE public.notification_push_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notification_id uuid REFERENCES public.notifications(id), device_id uuid, user_id uuid, status text DEFAULT 'pending');
    CREATE TABLE public.transactions(id uuid, auction_id uuid);
  `);
  await db.exec(readFileSync("drizzle/migrations/0036_unsold_cleanup_and_silent_cancel.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0037_retire_unsold_preserve_history.sql", "utf8"));
}, 30000);

afterAll(() => db.close());

beforeEach(async () => {
  await db.exec(
    `TRUNCATE public.auctions, public.auction_events, public.admin_audit_log, public.notifications, public.notification_push_outbox, public.transactions;
     SELECT set_config('test.uid','${seller}',false);`,
  );
});

it("cancelar una subasta no deja ni crea avisos", async () => {
  await db.exec(
    `INSERT INTO public.auctions(id,seller_id,status) VALUES('${auction}','${seller}','active');
     INSERT INTO public.notifications(user_id,title,link) VALUES('${other}','Nueva subasta en NEXO','/subastas/${auction}');`,
  );
  await db.query(`SELECT public.cancel_auction('${auction}','prueba')`);
  const n = await db.query("SELECT count(*)::int AS n FROM public.notifications");
  expect(n.rows).toEqual([{ n: 0 }]);
  const st = await db.query("SELECT status FROM public.auctions WHERE id=$1", [auction]);
  expect(st.rows).toEqual([{ status: "cancelled" }]);
});

it("retirar vencida sin ofertas conserva historial y limpia avisos", async () => {
  await db.exec(
    `INSERT INTO public.auctions(id,seller_id,status,bid_count) VALUES('${auction}','${seller}','ended_unsold',0);
     INSERT INTO public.notifications(id,user_id,title,link) VALUES('44444444-4444-4444-8444-444444444444','${other}','Nueva subasta en NEXO','/subastas/${auction}');
     INSERT INTO public.notification_push_outbox(notification_id,device_id,user_id) VALUES('44444444-4444-4444-8444-444444444444','${other}','${other}');`,
  );
  await db.query(`SELECT public.delete_unsold_auction('${auction}')`);
  expect((await db.query("SELECT count(*)::int AS n FROM public.auctions")).rows).toEqual([{ n: 1 }]);
  expect((await db.query("SELECT retired_at IS NOT NULL AS retired FROM public.auctions")).rows).toEqual([{retired:true}]);
  expect((await db.query("SELECT public.my_publications() AS publications")).rows).toEqual([{publications:[]}]);
  expect((await db.query("SELECT count(*)::int AS n FROM public.notifications")).rows).toEqual([{ n: 0 }]);
  expect((await db.query("SELECT count(*)::int AS n FROM public.notification_push_outbox")).rows).toEqual([{ n: 0 }]);
});

it("no elimina subastas con ofertas ni ajenas", async () => {
  await db.exec(
    `INSERT INTO public.auctions(id,seller_id,status,bid_count) VALUES('${auction}','${seller}','ended_unsold',2);`,
  );
  await expect(db.query(`SELECT public.delete_unsold_auction('${auction}')`)).rejects.toThrow(
    /vencidas sin ofertas/,
  );
  await db.exec(`UPDATE public.auctions SET bid_count=0, seller_id='${other}'`);
  await expect(db.query(`SELECT public.delete_unsold_auction('${auction}')`)).rejects.toThrow(
    /Solo el subastador/,
  );
  expect((await db.query("SELECT count(*)::int AS n FROM public.auctions")).rows).toEqual([{ n: 1 }]);
});
