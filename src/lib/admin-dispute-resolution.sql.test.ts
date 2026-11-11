import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const db = new PGlite();
const buyer = "11111111-1111-4111-8111-111111111111";
const seller = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const tx = "44444444-4444-4444-8444-444444444444";
const dispute = "55555555-5555-4555-8555-555555555555";
const uid = (id: string) => db.query("SELECT set_config('test.uid',$1,false)", [id]);
const staff = (id: string) => db.query("SELECT set_config('test.staff',$1,false)", [id]);

beforeAll(async () => {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
      $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.is_staff(_user uuid) RETURNS boolean LANGUAGE sql AS
      $$ SELECT _user IS NOT NULL AND _user::text=nullif(current_setting('test.staff',true),'') $$;
    CREATE FUNCTION public.notify(uuid,text,text,text) RETURNS void LANGUAGE sql AS 'SELECT';
    CREATE TABLE public.transactions(
      id uuid PRIMARY KEY,
      buyer_id uuid NOT NULL,
      seller_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      buyer_confirmed boolean NOT NULL DEFAULT false,
      seller_confirmed boolean NOT NULL DEFAULT false,
      buyer_payment_accepted_at timestamptz,
      seller_payment_accepted_at timestamptz,
      completed_at timestamptz
    );
    CREATE TABLE public.disputes(
      id uuid PRIMARY KEY,
      transaction_id uuid NOT NULL REFERENCES public.transactions(id),
      status text NOT NULL DEFAULT 'open',
      resolution text,
      resolved_by uuid,
      resolved_at timestamptz
    );
    CREATE TABLE public.admin_audit_log(
      actor_id uuid NOT NULL,
      action text NOT NULL,
      target text,
      details jsonb
    );
  `);
  await db.exec(readFileSync("drizzle/migrations/0043_admin_dispute_completion_override.sql", "utf8"));
  await db.exec(`
    CREATE TRIGGER closed_operation_guard
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.closed_operation_guard();
  `);
}, 30000);

afterAll(() => db.close());

beforeEach(async () => {
  await db.exec("TRUNCATE public.admin_audit_log,public.disputes,public.transactions");
  await db.query(
    "INSERT INTO public.transactions(id,buyer_id,seller_id,status) VALUES($1,$2,$3,'disputed')",
    [tx,buyer,seller],
  );
  await db.query(
    "INSERT INTO public.disputes(id,transaction_id) VALUES($1,$2)",
    [dispute,tx],
  );
  await uid(buyer);
  await staff("");
});

it("el administrador puede completar tras resolver la disputa sin fingir confirmaciones", async () => {
  await uid(admin);
  await staff(admin);
  await db.query(
    "SELECT public.resolve_dispute($1,'resolved','Se verificó la evidencia y se autoriza completar','completed')",
    [dispute],
  );

  const transaction = (await db.query(
    "SELECT status,buyer_confirmed,seller_confirmed,buyer_payment_accepted_at,seller_payment_accepted_at FROM public.transactions WHERE id=$1",
    [tx],
  )).rows[0];
  expect(transaction).toMatchObject({
    status: "completed",
    buyer_confirmed: false,
    seller_confirmed: false,
    buyer_payment_accepted_at: null,
    seller_payment_accepted_at: null,
  });
  expect((await db.query("SELECT status,resolution FROM public.disputes WHERE id=$1",[dispute])).rows[0])
    .toMatchObject({status:"resolved",resolution:"Se verificó la evidencia y se autoriza completar"});
  expect((await db.query("SELECT details->>'admin_completion_override' AS override FROM public.admin_audit_log")).rows)
    .toEqual([{override:"true"}]);
});

it("el cierre normal sigue exigiendo aceptaciones y confirmaciones", async () => {
  await db.exec("UPDATE public.disputes SET status='resolved' WHERE id='"+dispute+"'");
  await expect(
    db.query("UPDATE public.transactions SET status='completed' WHERE id=$1",[tx]),
  ).rejects.toThrow(/Faltan aceptaciones, confirmaciones/);
});

it("una disputa abierta sigue bloqueando incluso a un administrador fuera de resolve_dispute", async () => {
  await uid(admin);
  await staff(admin);
  await db.query("SELECT set_config('nexo.admin_dispute_resolution','on',false)");
  await expect(
    db.query("UPDATE public.transactions SET status='completed' WHERE id=$1",[tx]),
  ).rejects.toThrow(/disputa abierta/);
});

it("no administrador no puede resolver ni completar una disputa", async () => {
  await expect(
    db.query(
      "SELECT public.resolve_dispute($1,'resolved','Decisión administrativa válida','completed')",
      [dispute],
    ),
  ).rejects.toThrow(/No autorizado/);
  await expect(
    db.query("UPDATE public.transactions SET status='completed' WHERE id=$1",[tx]),
  ).rejects.toThrow(/Faltan aceptaciones, confirmaciones/);
});

it("solo una disputa resuelta puede autorizar el cierre administrativo", async () => {
  await uid(admin);
  await staff(admin);
  await expect(
    db.query(
      "SELECT public.resolve_dispute($1,'rejected','Decisión administrativa válida','completed')",
      [dispute],
    ),
  ).rejects.toThrow(/Solo una disputa resuelta/);
});
