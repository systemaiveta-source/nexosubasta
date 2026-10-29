import { z } from "zod";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const fieldSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().trim().min(1).max(100),
  help: z.string().max(300).default(""),
  type: z.enum(["text", "number", "email", "url", "file"]),
  required: z.boolean(),
});
export type ProofField = z.infer<typeof fieldSchema>;
export const defaultFields: ProofField[] = [{ id: "reference", label: "Referencia / número de transacción", help: "Copia la referencia que aparece en tu comprobante.", type: "text", required: true }];
export const configSchema = z.object({
  description: z.string().max(500).default(""),
  countries: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  data: z.record(z.string().max(500)).default({}),
  qr_path: z.string().max(300).default(""),
  requirements: z.array(fieldSchema).min(1).max(12).default(defaultFields),
}).superRefine((v, ctx) => {
  if (new Set(v.requirements.map(f => f.id)).size !== v.requirements.length) ctx.addIssue({ code: "custom", message: "Cada campo debe tener un identificador único" });
  if (!v.requirements.some(f => f.required)) ctx.addIssue({ code: "custom", message: "Exige al menos un comprobante obligatorio" });
  if (v.data.payment_link && !safeUrl(v.data.payment_link)) ctx.addIssue({ code: "custom", message: "El enlace de pago debe ser HTTPS válido" });
  if (v.data.email && !z.string().email().safeParse(v.data.email).success) ctx.addIssue({ code: "custom", message: "Correo del método no válido" });
});
export type MethodConfig = z.infer<typeof configSchema>;
export type PaymentMethod = { id: string; name: string; kind: string; instructions: string; active: boolean; sort: number; details: unknown };
export const methodSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(100), kind: z.enum(["bank", "wallet", "platform", "crypto", "manual"]), instructions: z.string().trim().min(5).max(4000), active: z.boolean(), sort: z.number().int().min(0).max(10000), details: configSchema });
export function methodConfig(details: unknown): MethodConfig {
  const parsed = configSchema.safeParse(details);
  return parsed.success ? parsed.data : { description: "", countries: [], currency: "USD", data: {}, qr_path: "", requirements: defaultFields };
}
export const dataLabels: Record<string, string> = { bank_name: "Banco", bank_country: "País del banco", holder: "Beneficiario / titular", account_type: "Tipo de cuenta", account_number: "Número de cuenta", phone: "Teléfono", email: "Correo", identifier: "Usuario / identificador", payment_link: "Enlace de pago", network: "Red", address: "Dirección de billetera", extra: "Datos adicionales" };
export function methodKeys(kind: string) {
  if (kind === "bank") return ["bank_name", "bank_country", "holder", "account_type", "account_number"];
  if (kind === "crypto") return ["holder", "network", "address", "payment_link", "extra"];
  return ["holder", "phone", "email", "identifier", "payment_link", "extra"];
}
export function safeUrl(value: string) { try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !!u.hostname; } catch { return false; } }
export function validateProof(fields: ProofField[], values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const value = (values[f.id] ?? "").trim();
    if (!value) { if (f.required) errors[f.id] = "Este campo es obligatorio"; continue; }
    if (value.length > 2000) errors[f.id] = "Máximo 2000 caracteres";
    else if (f.type === "email" && !z.string().email().safeParse(value).success) errors[f.id] = "Escribe un correo válido";
    else if (f.type === "url" && !safeUrl(value)) errors[f.id] = "Escribe una URL HTTPS válida";
    else if (f.type === "number" && !/^\d{1,100}$/.test(value)) errors[f.id] = "Solo números, máximo 100 dígitos";
    else if (f.type === "file" && !/^[a-f0-9-]{36}\/proof\/[a-f0-9-]{36}\.(pdf|png|jpg|webp)$/.test(value)) errors[f.id] = "Adjunta un archivo válido";
  }
  return errors;
}
export function validateDocument(type: string, size: number, qr = false) {
  if (!DOCUMENT_TYPES.includes(type) || (qr && type === "application/pdf")) throw new Error(qr ? "Usa JPG, PNG o WebP" : "Usa JPG, PNG, WebP o PDF");
  if (size <= 0 || size > MAX_DOCUMENT_BYTES) throw new Error("El archivo debe pesar entre 1 byte y 5 MB");
}
export const paymentStatus: Record<string, string> = { pending: "Pendiente de revisión", approved: "Aprobada", rejected: "Rechazada", needs_info: "Información adicional requerida" };