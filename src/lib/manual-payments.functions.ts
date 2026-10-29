import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { methodSchema, validateDocument } from "./manual-payments";

export const savePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input: z.input<typeof methodSchema>) => methodSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) throw new Error("Solo administradores");
    const { id, ...row } = data;
    const result = id ? await context.supabase.from("payment_methods").update(row).eq("id", id) : await context.supabase.from("payment_methods").insert(row);
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const uploadMembershipDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FormData) => { if (!(input instanceof FormData)) throw new Error("Archivo no válido"); return input; })
  .handler(async ({ data, context }) => {
    const file = data.get("file");
    const qr = data.get("purpose") === "qr";
    if (!(file instanceof File)) throw new Error("Adjunta un archivo");
    validateDocument(file.type, file.size, qr);
    if (qr) {
      const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
      if (!admin) throw new Error("Solo administradores");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const matches = file.type === "application/pdf" ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
      : file.type === "image/png" ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
      : file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!matches) throw new Error("El contenido del archivo no coincide con su formato");
    const ext = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type];
    const path = `${context.userId}/${qr ? "qr" : "proof"}/${crypto.randomUUID()}.${ext}`;
    const { error } = await context.supabase.storage.from("membership-documents").upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) throw new Error("No se pudo guardar el archivo privado. Intenta de nuevo.");
    return { path };
  });