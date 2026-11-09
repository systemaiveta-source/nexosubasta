import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
const db = new PGlite();
const buyer = "11111111-1111-4111-8111-111111111111";
const seller = "22222222-2222-4222-8222-222222222222";
const third = "33333333-3333-4333-8333-333333333333";
const tx = "44444444-4444-4444-8444-444444444444";
const uid = async (id: string) => db.query("SELECT set_config('test.uid',$1,false)", [id]);
const call = (name: string) => db.query(`SELECT public.${name}('${tx}')`);
const row = async () => (await db.query("SELECT status,buyer_confirmed,seller_confirmed,buyer_payment_accepted_at IS NOT NULL AS buyer_accepted,seller_payment_accepted_at IS NOT NULL AS seller_accepted FROM transactions")).rows[0];
function extract(text: string, pattern: RegExp) {
  const match = text.match(pattern)?.[0];
  if (!match) throw new Error("Missing SQL fixture");
  return match;
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth,storage TO authenticated;
    CREATE FUNCTION notify(uuid,text,text,text) RETURNS void LANGUAGE sql AS 'SELECT';
    CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS 'SELECT false';
    CREATE TABLE transactions(id uuid PRIMARY KEY, buyer_id uuid,seller_id uuid,status text DEFAULT 'pending',buyer_confirmed boolean DEFAULT false,seller_confirmed boolean DEFAULT false,buyer_confirmed_at timestamptz,seller_confirmed_at timestamptz,completed_at timestamptz,payment_stage text DEFAULT 'coordination',agreed_method text);
    CREATE FUNCTION is_tx_party(_tx uuid,_user uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT EXISTS(SELECT 1 FROM transactions WHERE id=_tx AND (_user=buyer_id OR _user=seller_id))$$;
    CREATE TABLE operation_events(id uuid DEFAULT gen_random_uuid(),transaction_id uuid,actor_id uuid,kind text,details jsonb);
    CREATE TABLE disputes(transaction_id uuid,status text);
    CREATE TABLE auctions(id uuid PRIMARY KEY,status text DEFAULT 'draft',accepted_payment_methods jsonb DEFAULT '[]');
    CREATE TABLE messages(id uuid DEFAULT gen_random_uuid(),transaction_id uuid,sender_id uuid,body text,submission_key uuid UNIQUE,attachment_path text);
    CREATE TABLE storage.objects(bucket_id text,name text);
    GRANT SELECT ON transactions,messages,operation_events TO authenticated;
    GRANT SELECT,INSERT ON storage.objects TO authenticated;
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE operation_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY parties ON transactions FOR SELECT TO authenticated USING(buyer_id=auth.uid() OR seller_id=auth.uid());
    CREATE POLICY parties ON messages FOR SELECT TO authenticated USING(is_tx_party(transaction_id,auth.uid()));
    CREATE POLICY parties ON operation_events FOR SELECT TO authenticated USING(is_tx_party(transaction_id,auth.uid()));
  `);
  const base = readFileSync("drizzle/migrations/0005_secure_services_operations.sql", "utf8");
  await db.exec(extract(base, /CREATE OR REPLACE FUNCTION public.send_operation_message\([\s\S]*?END \$\$;/));
  for (const p of base.matchAll(/CREATE POLICY operation_documents_(?:insert|read)[\s\S]*?;/g)) await db.exec(p[0]);
  const guard = readFileSync("drizzle/migrations/0011_closed_chat_delivery_private_service_requests.sql", "utf8");
  await db.exec(extract(guard, /CREATE OR REPLACE FUNCTION public.closed_message_guard\(\)[\s\S]*?END \$\$;/));
  await db.exec(readFileSync("drizzle/migrations/0038_private_chat_payment_agreement.sql", "utf8"));
  await db.exec(`CREATE TRIGGER completion_guard BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION completion_stage_guard();
    CREATE TRIGGER closed_guard BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION closed_operation_guard();
    CREATE TRIGGER closed_message BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION closed_message_guard();
    CREATE TRIGGER terms BEFORE INSERT OR UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION payment_terms_guard();`);
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE transactions,operation_events,disputes,messages,storage.objects,auctions;
    INSERT INTO transactions(id,buyer_id,seller_id) VALUES('${tx}','${buyer}','${seller}');`);
  await uid(buyer);
});
it("sin aceptaciones no permite completar", async () => {
  await expect(call("confirm_transaction")).rejects.toThrow(/Ambas partes/);
  expect(await row()).toMatchObject({ status: "pending", buyer_confirmed: false, seller_confirmed: false });
});
it.each([buyer,seller])("una aceptación es independiente e idempotente (%s)", async who => {
  await uid(who); await call("accept_operation_payment"); await call("accept_operation_payment");
  expect(await row()).toMatchObject({ status: "pending", buyer_accepted: who===buyer, seller_accepted: who===seller, buyer_confirmed:false,seller_confirmed:false });
  await expect(call("confirm_transaction")).rejects.toThrow(/Ambas partes/);
  expect((await db.query("SELECT count(*)::int AS n FROM operation_events")).rows).toEqual([{n:1}]);
});
it.each([buyer,seller])("ambas aceptaciones no cierran; dos finalizaciones cierran (%s primero)", async first => {
  await call("accept_operation_payment"); await uid(seller); await call("accept_operation_payment");
  expect(await row()).toMatchObject({status:"pending",buyer_confirmed:false,seller_confirmed:false});
  await uid(first); await call("confirm_transaction"); await call("confirm_transaction");
  expect(await row()).toMatchObject({status:"pending",buyer_confirmed:first===buyer,seller_confirmed:first===seller});
  await db.query(`SELECT send_operation_message('${tx}','Aún podemos coordinar','55555555-5555-4555-8555-555555555555')`);
  await uid(first===buyer?seller:buyer); await call("confirm_transaction"); await call("confirm_transaction");
  expect(await row()).toMatchObject({status:"completed",buyer_confirmed:true,seller_confirmed:true});
  expect((await db.query("SELECT count(*)::int AS n FROM operation_events WHERE kind='completion_confirmed'")).rows).toEqual([{n:2}]);
  await expect(db.query(`SELECT send_operation_message('${tx}','No debe entrar','66666666-6666-4666-8666-666666666666')`)).rejects.toThrow(/solo lectura/);
  expect((await db.query("SELECT count(*)::int AS n FROM messages")).rows).toEqual([{n:1}]);
});
it("disputa abierta bloquea completar incluso con status pending", async () => {
  await call("accept_operation_payment"); await uid(seller); await call("accept_operation_payment");
  await db.exec(`INSERT INTO disputes VALUES('${tx}','open')`);
  await expect(call("confirm_transaction")).rejects.toThrow(/disputa/);
  expect(await row()).toMatchObject({status:"pending",buyer_confirmed:false,seller_confirmed:false});
});
it("tercero no acepta, no completa ni puede escribir por la otra parte", async () => {
  await uid(third);
  await expect(call("accept_operation_payment")).rejects.toThrow(/no disponible/);
  await expect(call("confirm_transaction")).rejects.toThrow(/no disponible/);
  await db.exec("SET ROLE authenticated");
  expect((await db.query("SELECT * FROM transactions")).rows).toEqual([]);
  await expect(db.query(`UPDATE transactions SET seller_payment_accepted_at=now() WHERE id='${tx}'`)).rejects.toThrow(/permission denied/);
});
it("solicitud y respuesta de pago con adjunto son privadas y persistentes", async () => {
  const path = `${tx}/${seller}/comprobante.pdf`;
  await db.query(`SELECT send_operation_message('${tx}','¿Me compartes cuenta, titular, banco o enlace de pago?','55555555-5555-4555-8555-555555555555')`);
  await uid(seller); await db.exec("SET ROLE authenticated");
  await db.query("INSERT INTO storage.objects VALUES('operation-documents',$1)",[path]);
  await db.query(`SELECT send_operation_message('${tx}','Cuenta de prueba, titular de prueba, banco de prueba. https://example.com/pago','66666666-6666-4666-8666-666666666666',$1)`,[path]);
  expect((await db.query("SELECT * FROM messages")).rows).toHaveLength(2);
  await uid(buyer); expect((await db.query("SELECT * FROM messages")).rows).toHaveLength(2);
  expect((await db.query("SELECT * FROM storage.objects")).rows).toHaveLength(1);
  await uid(third);
  expect((await db.query("SELECT * FROM messages")).rows).toEqual([]);
  expect((await db.query("SELECT * FROM storage.objects")).rows).toEqual([]);
  await expect(db.query(`SELECT send_operation_message('${tx}','Intrusión','77777777-7777-4777-8777-777777777777')`)).rejects.toThrow(/no disponible/);
});
it("publicación con lista vacía y actualización de métodos históricos no exige configuración", async () => {
  await db.exec(`INSERT INTO auctions(id) VALUES('${tx}'); UPDATE auctions SET status='active' WHERE id='${tx}'`);
  expect((await db.query("SELECT accepted_payment_methods FROM auctions")).rows).toEqual([{accepted_payment_methods:[]}]);
});
it("publicación no revalida ni altera configuración histórica", async () => {
  await db.exec("ALTER TABLE auctions DISABLE TRIGGER terms");
  await db.query("INSERT INTO auctions(id,accepted_payment_methods) VALUES($1,$2)",[tx,JSON.stringify([{name:"histórico",kind:"crypto"}])]);
  await db.exec("ALTER TABLE auctions ENABLE TRIGGER terms");
  await db.query("UPDATE auctions SET status='active' WHERE id=$1",[tx]);
  expect((await db.query("SELECT accepted_payment_methods FROM auctions")).rows).toEqual([{accepted_payment_methods:[{name:"histórico",kind:"crypto"}]}]);
});
