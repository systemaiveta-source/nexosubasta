import { describe, expect, it } from "vitest";
import { normalizeRefCode } from "./referral";
describe("normalizeRefCode", () => {
  it("acepta códigos válidos en mayúsculas", () => expect(normalizeRefCode(" ab12cd34 ")).toBe("AB12CD34"));
  it("rechaza códigos con caracteres extraños", () => expect(normalizeRefCode("x'; drop")).toBeNull());
});
