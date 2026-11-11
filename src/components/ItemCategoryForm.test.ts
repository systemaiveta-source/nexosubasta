import { describe, expect, it } from "vitest";
import { getItemAttributeFields, validateItemAttributes } from "./ItemCategoryForm";

describe("formularios de artículos por subcategoría", () => {
  it("exige marca, modelo y año para automóviles", () => {
    expect(validateItemAttributes("autos", {})).toContain("Marca");
    expect(validateItemAttributes("autos", { make: "Toyota", model: "Corolla" })).toContain("Año");
    expect(validateItemAttributes("autos", { make: "Toyota", model: "Corolla", year: "2022", condition: "Usado - bueno" })).toBeNull();
  });

  it("rechaza años fuera de rango y números negativos", () => {
    expect(validateItemAttributes("autos", { make: "Toyota", model: "Corolla", year: "1800" })).toContain("año");
    expect(validateItemAttributes("motocicletas", { make: "Honda", model: "CB", year: "2020", engine: "-5" })).toContain("Cilindrada");
  });

  it("proporciona un formulario de respaldo para nuevas subcategorías administradas", () => {
    const fields = getItemAttributeFields("nueva-subcategoria");
    expect(fields.map((field) => field.key)).toContain("specifications");
    expect(validateItemAttributes("nueva-subcategoria", {})).toContain("Características principales");
  });
});
