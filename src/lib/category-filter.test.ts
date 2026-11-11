import { describe, expect, it } from "vitest";
import { categoryMatchesPreference, toggleCategoryGroup, toggleCategorySelection } from "./category-filter";

describe("filtros de categorías de avisos", () => {
  const all = ["root-a", "child-a", "root-b"];

  it("lista vacía significa todas las categorías, incluso las nuevas", () => {
    expect(categoryMatchesPreference([], "future-category")).toBe(true);
    expect(categoryMatchesPreference([], null)).toBe(true);
  });

  it("una selección limita los avisos a las categorías elegidas", () => {
    expect(categoryMatchesPreference(["child-a"], "child-a")).toBe(true);
    expect(categoryMatchesPreference(["child-a"], "root-a")).toBe(false);
    expect(categoryMatchesPreference(["child-a"], null)).toBe(false);
  });

  it("permite excluir una categoría partiendo de todas", () => {
    expect(toggleCategorySelection([], "child-a", false, all)).toEqual(["root-a", "root-b"]);
  });

  it("vuelve a todas al seleccionar el último elemento pendiente", () => {
    expect(toggleCategorySelection(["root-a", "child-a"], "root-b", true, all)).toEqual([]);
  });

  it("selecciona y excluye un grupo sin alterar el resto", () => {
    expect(toggleCategoryGroup(["root-b"], ["root-a", "child-a"], true, all)).toEqual([]);
    expect(toggleCategoryGroup([], ["root-a", "child-a"], false, all)).toEqual(["root-b"]);
  });
});
