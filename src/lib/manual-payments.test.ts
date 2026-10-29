import { describe, it, expect } from "vitest";
import {
  validateProof,
  defaultFields,
  validateDocument,
  MAX_DOCUMENT_BYTES,
  methodSchema,
  methodConfig,
  safeUrl,
} from "./manual-payments";

describe("comprobantes manuales", () => {
  it("exige cada campo obligatorio", () =>
    expect(validateProof(defaultFields, {})).toHaveProperty("reference"));
  it("permite campos opcionales vacíos", () =>
    expect(validateProof([{ ...defaultFields[0], required: false }], {})).toEqual({}));
  it("rechaza URL no HTTPS y credenciales en URL", () => {
    expect(safeUrl("javascript:alert(1)")).toBe(false);
    expect(safeUrl("https://user:pass@example.com")).toBe(false);
  });
  it("valida correo y número de operación", () => {
    expect(
      validateProof([{ ...defaultFields[0], type: "email" }], { reference: "inválido" }),
    ).toHaveProperty("reference");
    expect(
      validateProof([{ ...defaultFields[0], type: "number" }], { reference: "12abc" }),
    ).toHaveProperty("reference");
  });
  it("exige ruta privada para archivo", () =>
    expect(
      validateProof([{ ...defaultFields[0], type: "file" }], {
        reference: "https://example.com/proof.pdf",
      }),
    ).toHaveProperty("reference"));
  it("limita documentos a 5 MB", () => {
    expect(() => validateDocument("application/pdf", MAX_DOCUMENT_BYTES)).not.toThrow();
    expect(() => validateDocument("application/pdf", MAX_DOCUMENT_BYTES + 1)).toThrow();
  });
  it("rechaza SVG y PDF como QR", () => {
    expect(() => validateDocument("image/svg+xml", 100)).toThrow();
    expect(() => validateDocument("application/pdf", 100, true)).toThrow();
  });
  it("impide requisitos duplicados", () =>
    expect(
      methodSchema.safeParse({
        name: "Banco",
        kind: "bank",
        instructions: "Instrucciones",
        sort: 1,
        active: false,
        details: { requirements: [defaultFields[0], defaultFields[0]] },
      }).success,
    ).toBe(false));
  it("conserva campos y requisitos al editar y reabrir un método", () => {
    const details = {
      currency: "USD",
      description: "Datos editados",
      data: { holder: "Destinatario de prueba", extra: "Referencia adicional" },
      requirements: [
        { ...defaultFields[0], id: "operation", type: "number" as const },
        { ...defaultFields[0], id: "note", required: false },
      ],
    };
    const saved = methodSchema.parse({
      name: "Método de prueba",
      kind: "manual",
      instructions: "Instrucciones editadas",
      sort: 2,
      active: false,
      details,
    });
    const reopened = methodConfig(JSON.parse(JSON.stringify(saved.details)));
    expect(reopened.data).toEqual(details.data);
    expect(reopened.requirements).toEqual(details.requirements);
    expect(reopened.currency).toBe("USD");
    expect(saved.active).toBe(false);
  });
  it("mantiene al menos un comprobante obligatorio al guardar", () => {
    expect(
      methodSchema.safeParse({
        name: "Método",
        kind: "manual",
        instructions: "Instrucciones",
        sort: 0,
        active: false,
        details: { requirements: [{ ...defaultFields[0], required: false }] },
      }).success,
    ).toBe(false);
  });
});
