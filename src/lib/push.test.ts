import { describe, expect, it } from "vitest";
import { auctionPushPath, pushConfigured, registerPush } from "./push";
describe("push contextual seguro", () => {
  it("sin credenciales no solicita permisos ni registra worker", async () => {
    const config = { apiKey: "", projectId: "", appId: "", vapidKey: "" };
    expect(pushConfigured(config)).toBe(false);
    await expect(registerPush(config)).rejects.toThrow("pendiente de configuración");
  });
  it("destino exacto bloquea ruta externa o credenciales", () => {
    expect(auctionPushPath("12345678-1234-1234-1234-123456789abc")).toBe(
      "/subastas/12345678-1234-1234-1234-123456789abc",
    );
    expect(auctionPushPath("//evil.test")).toBeNull();
    expect(auctionPushPath("12345678-1234-1234-1234-123456789abc?token=secret")).toBeNull();
  });
});
