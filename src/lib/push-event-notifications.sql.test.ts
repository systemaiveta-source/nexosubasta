import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const db = new PGlite();
const buyer = "11111111-1111-4111-8111-111111111111";
const seller = "22222222-2222-4222-8222-222222222222";
const operation = "33333333-3333-4333-8333-333333333333";
const auction = "44444444-4444-4444-8444-444444444444";

beforeAll(async () => {
  await db.exec(`
    CREATE TABLE public.transactions (
      id uuid PRIMARY KEY, auction_id uuid NOT NULL, buyer_id uuid NOT NULL,
      seller_id uuid NOT NULL, amount numeric NOT NULL, currency text NOT NULL,
      status text NOT NULL
    );
    CREATE TABLE public.auctions (id uuid PRIMARY KEY, title text NOT NULL);
    CREATE TABLE public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
      title text NOT NULL, body text, link text, event_kind text NOT NULL DEFAULT 'activity'
    );
    CREATE TABLE public.messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transaction_id uuid NOT NULL,
      sender_id uuid NOT NULL, body text NOT NULL
    );
    INSERT INTO public.transactions(id,auction_id,buyer_id,seller_id,amount,currency,status)
      VALUES ('${operation}','${auction}','${buyer}','${seller}',275,'USD','pending');
    INSERT INTO public.auctions(id,title) VALUES ('${auction}','Cámara digital');
  `);
  await db.exec(readFileSync("drizzle/migrations/0040_private_chat_and_auction_result_push.sql", "utf8"));
}, 30000);

afterAll(() => db.close());

describe("notificaciones push de chat privado y adjudicación", () => {
  it("personaliza el aviso del ganador con el importe final y el chat disponible", async () => {
    await db.exec(`INSERT INTO public.notifications(user_id,title,body,link)
      VALUES ('${buyer}','Subasta adjudicada','Coordina el pago','/operaciones/${operation}')`);
    const result = await db.query(
      "SELECT title,body,event_kind FROM public.notifications WHERE user_id=$1",
      [buyer],
    );
    expect(result.rows).toEqual([{
      title: "¡Ganaste la subasta!",
      body: "Adjudicación confirmada por 275 USD. El chat privado con el vendedor ya está disponible.",
      event_kind: "auction_won",
    }]);
  });

  it("personaliza el aviso del vendedor sin alterar la decisión de adjudicación", async () => {
    await db.exec(`INSERT INTO public.notifications(user_id,title,body,link)
      VALUES ('${seller}','Subasta adjudicada','Tu operación está lista.','/operaciones/${operation}')`);
    const result = await db.query(
      "SELECT title,body,event_kind FROM public.notifications WHERE user_id=$1",
      [seller],
    );
    expect(result.rows).toEqual([{
      title: "Subasta adjudicada",
      body: "Tu artículo fue adjudicado por 275 USD. El chat privado con el comprador ya está disponible.",
      event_kind: "auction_sold",
    }]);
  });

  it("avisa solo a la contraparte y nunca expone el contenido privado del mensaje", async () => {
    await db.exec(`INSERT INTO public.messages(transaction_id,sender_id,body)
      VALUES ('${operation}','${buyer}','Mi cuenta bancaria es 123456789')`);
    const result = await db.query(
      "SELECT user_id,title,body,link,event_kind FROM public.notifications WHERE user_id=$1",
      [seller],
    );
    expect(result.rows).toEqual([{
      user_id: seller,
      title: "Nuevo mensaje privado",
      body: "Tienes un nuevo mensaje sobre: Cámara digital",
      link: `/operaciones/${operation}`,
      event_kind: "chat_message",
    }]);
    expect(result.rows[0].body).not.toContain("123456789");
  });
});
