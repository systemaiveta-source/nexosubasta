import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateDocument } from "./manual-payments";

export const listOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase
      .from("transactions")
      .select("id,auction_id,buyer_id,seller_id,amount,currency,status,payment_stage,created_at")
      .or(`buyer_id.eq.${context.userId},seller_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw new Error("No se pudieron cargar las operaciones");
    const ids = [...new Set(result.data.map(t => t.auction_id))];
    const auctions = ids.length ? await context.supabase.from("auctions_safe").select("id,title,images").in("id", ids) : {data: []};
    return result.data.map(t => ({...t, role: t.buyer_id === context.userId ? "buyer" : "seller", auction: auctions.data?.find(a => a.id === t.auction_id) ?? null}));
  });
export const getOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const tx = await context.supabase
      .from("transactions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (tx.error || !tx.data) throw new Error("Operación no disponible para esta cuenta");
    if (tx.data.buyer_id !== context.userId && tx.data.seller_id !== context.userId)
      throw new Error("Operación no disponible para esta cuenta");
    const [messages, events, disputes, contact, auction] = await Promise.all([
      context.supabase
        .from("messages")
        .select("id,sender_id,body,attachment_path,created_at")
        .eq("transaction_id", data.id)
        .order("created_at")
        .limit(200),
      context.supabase
        .from("operation_events")
        .select("id,actor_id,kind,details,created_at")
        .eq("transaction_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("disputes")
        .select("id,reason,status,resolution,created_at")
        .eq("transaction_id", data.id),
      context.supabase.rpc("tx_contact", { _tx: data.id }),
      context.supabase
        .from("auctions_safe")
        .select("title,auction_type,images")
        .eq("id", tx.data.auction_id)
        .maybeSingle(),
    ]);
    if (messages.error || events.error || disputes.error)
      throw new Error("No se pudo cargar el historial");
    return {
      tx: tx.data,
      messages: messages.data,
      events: events.data,
      disputes: disputes.data,
      contact: contact.data,
      auction: auction.data,
      userId: context.userId,
    };
  });
export const changeOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      action: "complete" | "dispute" | "stage";
      value?: string;
      method?: string;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          action: z.enum(["complete", "dispute", "stage"]),
          value: z.string().max(2000).optional(),
          method: z.string().max(200).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const result =
      data.action === "complete"
        ? await context.supabase.rpc("confirm_transaction", { _tx: data.id })
        : data.action === "dispute"
          ? await context.supabase.rpc("open_dispute", { _tx: data.id, _reason: data.value ?? "" })
          : await context.supabase.rpc("advance_operation", {
              _tx: data.id,
              _stage: data.value ?? "",
              ...(data.method ? { _method: data.method } : {}),
            });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
export const sendOperationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; body: string; key: string; path?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
        key: z.string().uuid(),
        path: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("send_operation_message", {
      _tx: data.id,
      _body: data.body,
      _key: data.key,
      ...(data.path ? { _attachment: data.path } : {}),
    });
    if (result.error) throw new Error(result.error.message);
    return { id: result.data };
  });
export const uploadOperationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FormData) => {
    if (!(input instanceof FormData)) throw new Error("Archivo no válido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const id = z.string().uuid().parse(data.get("id"));
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Adjunta un archivo");
    validateDocument(file.type, file.size);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const matches =
      file.type === "application/pdf"
        ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
        : file.type === "image/png"
          ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
          : file.type === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!matches) throw new Error("El archivo no coincide con su formato");
    const ext = {
      "application/pdf": "pdf",
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    }[file.type];
    const path = `${id}/${context.userId}/${crypto.randomUUID()}.${ext}`;
    const result = await context.supabase.storage
      .from("operation-documents")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (result.error) throw new Error("No se pudo guardar el adjunto privado");
    return { path };
  });
export const openOperationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) =>
    z.object({ path: z.string().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.storage
      .from("operation-documents")
      .createSignedUrl(data.path, 60);
    if (result.error || !result.data) throw new Error("No se pudo abrir el adjunto");
    return { url: result.data.signedUrl };
  });
