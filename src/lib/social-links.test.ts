import { describe, expect, it } from "vitest";
import { socialLinkSchema } from "./social-links";
const base = { network: "Facebook", label: "NEXO", active: true, sort: 0 };
describe("redes sociales", () => {
  it("acepta enlace HTTPS y rechaza scripts y credenciales", () => {
    expect(socialLinkSchema.safeParse({ ...base, url: "https://facebook.com/nexo" }).success).toBe(
      true,
    );
    for (const url of [
      "javascript:alert(1)",
      "http://facebook.com",
      "https://user:pass@facebook.com",
      "https://127.0.0.1/x",
    ])
      expect(socialLinkSchema.safeParse({ ...base, url }).success).toBe(false);
  });
});
