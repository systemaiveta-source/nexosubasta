import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const db = new PGlite();
const seller = "11111111-1111-4111-8111-111111111111";
const userA = "22222222-2222-4222-8222-222222222222";
const userB = "33333333-3333-4333-8333-333333333333";
const userAll = "44444444-4444-4444-8444-444444444444";
const rootA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const rootB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const auction = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE TABLE public.categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, name text NOT NULL, sort integer NOT NULL DEFAULT 0
    );
    INSERT INTO public.categories(id,slug,name,sort) VALUES
      ('${rootA}','vehiculos','Vehículos',1),
      ('${rootB}','hogar','Hogar',2);
    CREATE TABLE public.auction_push_events(auction_id uuid PRIMARY KEY);
    CREATE TABLE public.notifications(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
      title text NOT NULL, body text, link text, event_kind text NOT NULL DEFAULT 'activity'
    );
    CREATE TABLE public.push_devices(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
      active boolean NOT NULL DEFAULT true, transport text NOT NULL,
      subscription jsonb
    );
    CREATE TABLE public.notification_preferences(
      user_id uuid PRIMARY KEY, new_auctions boolean NOT NULL DEFAULT true,
      activity boolean NOT NULL DEFAULT true, categories uuid[] NOT NULL DEFAULT '{}'
    );
    CREATE TABLE public.notification_push_outbox(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notification_id uuid NOT NULL,
      device_id uuid NOT NULL, user_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz,
      attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.auctions(
      id uuid PRIMARY KEY, seller_id uuid NOT NULL, title text NOT NULL,
      category_id uuid, status text NOT NULL, auction_type text NOT NULL,
      starting_price numeric, currency text, images text[] NOT NULL DEFAULT '{}'
    );
    CREATE TABLE public.transactions(id uuid PRIMARY KEY, auction_id uuid);
    CREATE FUNCTION public.enqueue_notification_push() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO public.notification_push_outbox(notification_id,device_id,user_id)
        SELECT NEW.id,d.id,NEW.user_id FROM public.push_devices d
        JOIN public.notification_preferences p ON p.user_id=d.user_id
        WHERE d.user_id=NEW.user_id AND d.active AND d.transport='webpush'
          AND CASE WHEN NEW.event_kind='new_auction' THEN p.new_auctions ELSE p.activity END;
        RETURN NEW;
      END $$;
    CREATE TRIGGER enqueue_notification_push AFTER INSERT ON public.notifications
      FOR EACH ROW EXECUTE FUNCTION public.enqueue_notification_push();
  `);
  await db.exec(readFileSync("drizzle/migrations/0039_category_tree_and_push_filters.sql", "utf8"));
  await db.exec(`
    CREATE TRIGGER new_auction_notifications AFTER INSERT OR UPDATE ON public.auctions
      FOR EACH ROW EXECUTE FUNCTION public.new_auction_notifications();
  `);
}, 30000);

afterAll(() => db.close());

describe("categorías jerárquicas y preferencias Web Push", () => {
  it("conserva categorías existentes y crea subcategorías relacionadas", async () => {
    const roots = await db.query("SELECT id,name,parent_id,active FROM public.categories WHERE slug IN ('vehiculos','hogar') ORDER BY slug");
    expect(roots.rows).toHaveLength(2);
    expect(roots.rows.every((row) => row.parent_id === null && row.active === true)).toBe(true);
    const child = await db.query("SELECT name,parent_id FROM public.categories WHERE slug='autos'");
    expect(child.rows).toEqual([{ name: "Autos y camionetas", parent_id: rootA }]);
    const extra = await db.query("SELECT count(*)::int AS n FROM public.categories WHERE parent_id IS NOT NULL");
    expect(extra.rows[0].n).toBeGreaterThanOrEqual(30);
  });

  it("crea avisos y elementos de cola solo para categorías elegidas o todas", async () => {
    await db.exec(`
      INSERT INTO public.notification_preferences(user_id,categories) VALUES
        ('${userA}',ARRAY['${rootA}'::uuid]),
        ('${userB}',ARRAY['${rootB}'::uuid]),
        ('${userAll}','{}');
      INSERT INTO public.push_devices(user_id,transport,subscription) VALUES
        ('${userA}','webpush','{"endpoint":"https://push.example/a"}'),
        ('${userB}','webpush','{"endpoint":"https://push.example/b"}'),
        ('${userAll}','webpush','{"endpoint":"https://push.example/all"}');
      INSERT INTO public.auctions(id,seller_id,title,category_id,status,auction_type,starting_price,currency)
        VALUES ('${auction}','${seller}','Camioneta','${rootA}','active','item',100,'USD');
    `);
    const notifications = await db.query("SELECT user_id FROM public.notifications ORDER BY user_id");
    expect(notifications.rows).toEqual([{ user_id: userA }, { user_id: userAll }]);
    const queued = await db.query("SELECT user_id FROM public.notification_push_outbox ORDER BY user_id");
    expect(queued.rows).toEqual([{ user_id: userA }, { user_id: userAll }]);
    const claimed = await db.query("SELECT d.user_id FROM public.claim_notification_push_batch(20) batch JOIN public.push_devices d ON d.id=batch.device_id ORDER BY d.user_id");
    expect(claimed.rows).toEqual([{ user_id: userA }, { user_id: userAll }]);
    await db.exec("UPDATE public.notification_push_outbox SET claimed_at=now()-interval '6 minutes' WHERE status='sending'");
    const recovered = await db.query("SELECT count(*)::int AS n FROM public.claim_notification_push_batch(20)");
    expect(recovered.rows).toEqual([{ n: 2 }]);
    const attempts = await db.query("SELECT min(attempts)::int AS min_attempts FROM public.notification_push_outbox");
    expect(attempts.rows).toEqual([{ min_attempts: 2 }]);
  });
});
