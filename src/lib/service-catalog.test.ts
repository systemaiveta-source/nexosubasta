import { describe, expect, it } from "vitest";
import { SERVICE_CATALOG, serviceRequestSchema } from "./service-catalog";
describe("formularios específicos", () => {
  it("transporte exige ambas direcciones completas", () => { expect(serviceRequestSchema.safeParse({ category: "transport", subcategory: "Acarreo", values: { origin: "Managua" } }).success).toBe(false); });
  it("mecánica no se replica en contabilidad ni plomería", () => { expect(SERVICE_CATALOG.find((c) => c.id === "mechanics")?.fields.some((f) => f.key === "brand")).toBe(true); expect(SERVICE_CATALOG.find((c) => c.id === "accounting")?.fields.some((f) => f.key === "brand")).toBe(false); expect(SERVICE_CATALOG.find((c) => c.id === "plumbing")?.fields.some((f) => f.key === "urgency")).toBe(true); });
  it("asistencia carretera requiere ubicación y contacto", () => {
    const category = SERVICE_CATALOG.find((c) => c.id === "mechanics");
    const values = Object.fromEntries((category?.fields ?? []).filter((f) => !f.when).map((f) => [f.key, f.options?.[0] ?? (f.key === "year" ? "2020" : "detalle")]));
    values["attendance"] = "Asistencia en carretera";
    expect(serviceRequestSchema.safeParse({ category: "mechanics", subcategory: "Diagnóstico", values }).success).toBe(false);
    values["road_location"] = "Dirección exacta"; values["road_contact"] = "Instrucciones de asistencia";
    expect(serviceRequestSchema.safeParse({ category: "mechanics", subcategory: "Diagnóstico", values }).success).toBe(true);
  });
  it("Otros no permite solicitud sin categoría personalizada", () => { expect(serviceRequestSchema.safeParse({ category: "other", subcategory: "Servicio personalizado", values: {} }).success).toBe(false); });
});