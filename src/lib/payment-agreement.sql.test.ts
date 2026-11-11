import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// La migración se ejecuta en PostgreSQL desechable; nunca usa la base alojada.
const db = new PGlite();
const buyer = "11111111-1111-4111-8111-111111111111";
const seller = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
const tx = "44444444-4444-4444-8444-444444444444";

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
      $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
    CREATE TABLE public.transactions (
      id uuid PRIMARY KEY, buyer_id uuid NOT NULL, seller_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      buyer_confirmed boolean NOT NULL DEFAULT false,
      seller_confirmed boolean NOT NULL DEFAULT false,
      buyer_confirmed_at timestamptz, seller_confirmed_at timestamptz,
      completed_at timestamptz, agreed_method jsonb, payment_stage text,
      accepted_payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb
    );
    CREATE TABLE public.operation_events (transaction_id uuid NOT NULL, actor_id uuid NOT NULL, kind text NOT NULL);
    CREATE TABLE public.disputes (transaction_id uuid NOT NULL, status text NOT NULL);
    CREATE TABLE public.auctions (id uuid PRIMARY KEY, status text NOT NULL DEFAULT 'draft', accepted_payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb);
    CREATE FUNCTION public.notify(uuid, text, text, text) RETURNS void LANGUAGE sql AS 'SELECT';
  `);
  await db.exec(readFileSync("drizzle/migrations/0038_private_chat_payment_agreement.sql", "utf8"));
  await db.exec(`
    CREATE TRIGGER transactions_completion_stage_guard BEFORE UPDATE ON public.transactions
      FOR EACH ROW EXECUTE FUNCTION public.completion_stage_guard();
    CREATE TRIGGER transactions_closed_operation_guard BEFORE UPDATE ON public.transactions
      FOR EACH ROW EXECUTE FUNCTION public.closed_operation_guard();
    CREATE TRIGGER auctions_payment_terms_guard BEFORE INSERT OR UPDATE ON public.auctions
      FOR EACH ROW EXECUTE FUNCTION public.payment_terms_guard();
  `);
}, 30000);

afterAll(() => db.close());

beforeEach(async () => {
  await db.exec(`
    TRUNCATE public.transactions, public.operation_events, public.disputes, public.auctions;
    SELECT set_config('test.uid', '11111111-1111-4111-8111-111111111111', false);
  `);
  await db.query("INSERT INTO public.transactions(id,buyer_id,seller_id) VALUES($1,$2,$3)", [tx, buyer, seller]);
});

async function as(user: string) {
  await db.query("SELECT set_config('test.uid',$1,false)", [user]);
}

describe("migración 0038: acuerdo privado y confirmación bilateral", () => {
  it("guarda aceptación de cada parte una sola vez", async () => {
    await as(buyer);
    await db.query("SELECT public.accept_operation_payment($1)", [tx]);
    await db.query("SELECT public.accept_operation_payment($1)", [tx]);
    const first = await db.query("SELECT buyer_payment_accepted_at IS NOT NULL AS buyer_ok, seller_payment_accepted_at IS NOT NULL AS seller_ok FROM public.transactions WHERE id=$1", [tx]);
    expect(first.rows).toEqual([{ buyer_ok: true, seller_ok: false }]);
    await as(seller);
    await db.query("SELECT public.accept_operation_payment($1)", [tx]);
    expect((await db.query("SELECT count(*)::int AS n FROM public.operation_events")).rows).toEqual([{ n: 2 }]);
    const both = await db.query("SELECT buyer_payment_accepted_at IS NOT NULL AS buyer_ok, seller_payment_accepted_at IS NOT NULL AS seller_ok FROM public.transactions WHERE id=$1", [tx]);
    expect(both.rows).toEqual([{ buyer_ok: true, seller_ok: true }]);
  });

  it("no permite que un tercero acepte ni confirme la operación", async () => {
    await as(outsider);
    await expect(db.query("SELECT public.accept_operation_payment($1)", [tx])).rejects.toThrow("Operación no disponible");
    await expect(db.query("SELECT public.confirm_transaction($1)", [tx])).rejects.toThrow("Operación no disponible");
  });

  it("exige aceptación de ambas partes antes de confirmar y completa tras las dos confirmaciones", async () => {
    await as(buyer);
    await expect(db.query("SELECT public.confirm_transaction($1)", [tx])).rejects.toThrow("Ambas partes deben aceptar la coordinación del pago");
    await db.query("SELECT public.accept_operation_payment($1)", [tx]);
    await as(seller);
    await db.query("SELECT public.accept_operation_payment($1)", [tx]);
    await as(buyer);
    await db.query("SELECT public.confirm_transaction($1)", [tx]);
    let row = await db.query("SELECT status,buyer_confirmed,seller_confirmed FROM public.transactions WHERE id=$1", [tx]);
    expect(row.rows).toEqual([{ status: "pending", buyer_confirmed: true, seller_confirmed: false }]);
    await as(seller);
    await db.query("SELECT public.confirm_transaction($1)", [tx]);
    row = await db.query("SELECT status,buyer_confirmed,seller_confirmed,completed_at IS NOT NULL AS completed FROM public.transactions WHERE id=$1", [tx]);
    expect(row.rows).toEqual([{ status: "completed", buyer_confirmed: true, seller_confirmed: true, completed: true }]);
    await db.query("SELECT public.confirm_transaction($1)", [tx]);
    expect((await db.query("SELECT count(*)::int AS n FROM public.operation_events WHERE kind='completion_confirmed'")).rows).toEqual([{ n: 2 }]);
  });

  it("impide completar mientras exista una disputa abierta", async () => {
    await as(buyer);
    await db.query("SELECT public.accept_operation_payment($1)", [tx]);
    await as(seller);
    await db.query("SELECT public.accept_operation_payment($1)", [tx]);
    await db.query("INSERT INTO public.disputes(transaction_id,status) VALUES($1,'open')", [tx]);
    await as(buyer);
    await expect(db.query("SELECT public.confirm_transaction($1)", [tx])).rejects.toThrow("No se puede completar una operación en disputa");
  });

  it("valida los métodos nuevos y exige activo y red para cripto", async () => {
    await expect(db.query("INSERT INTO public.auctions(id,accepted_payment_methods) VALUES($1,$2::jsonb)", [tx, JSON.stringify([{ name: "USDT", kind: "crypto", asset: "USDT" }])])).rejects.toThrow("Indica activo y red");
    await db.query("INSERT INTO public.auctions(id,accepted_payment_methods) VALUES($1,$2::jsonb)", [tx, JSON.stringify([{ name: "USDT", kind: "crypto", asset: "USDT", network: "TRON" }])]);
  });
});
