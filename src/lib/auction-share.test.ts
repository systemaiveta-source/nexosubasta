import { describe, expect, it } from "vitest";
import { auctionShareUrl, socialShareLinks } from "./auction-share";

const id = "12345678-1234-1234-1234-123456789abc";
describe("enlaces de subasta seguros", () => {
  it("comparte la ficha exacta en el dominio NEXO, no la sesión ni el preview", () => {
    expect(auctionShareUrl(id)).toBe(`https://nexosubasta.lovable.app/subastas/${id}`);
    expect(() => auctionShareUrl(`${id}?token=secret`)).toThrow();
    expect(() => auctionShareUrl("https://evil.test")).toThrow();
  });
  it("codifica el título sin permitir que cambie el destino", () => {
    const links = socialShareLinks(id, "Artículo & url=https://evil.test");
    expect(new URL(links.Facebook).searchParams.get("u")).toBe(auctionShareUrl(id));
    expect(new URL(links.X).searchParams.get("url")).toBe(auctionShareUrl(id));
    expect(new URL(links.Telegram).searchParams.get("text")).toBe("Artículo & url=https://evil.test");
  });
});