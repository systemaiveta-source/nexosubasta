import { afterEach, describe, expect, it, vi } from "vitest";
import { auctionPushPath, pushConfigured, registerPush } from "./push";
afterEach(() => vi.unstubAllGlobals());
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
  it("una app sin sender ID no está configurada", () => {
    expect(
      pushConfigured({ apiKey: "public", projectId: "nexo", appId: "invalid", vapidKey: "public" }),
    ).toBe(false);
  });
  it("en iframe no solicita permiso ni registra dispositivos", async () => {
    const permission = vi.fn();
    const worker = vi.fn();
    vi.stubGlobal("window", { isSecureContext: true, Notification: {}, top: {}, self: {} });
    vi.stubGlobal("navigator", { serviceWorker: { register: worker } });
    vi.stubGlobal("Notification", { permission: "default", requestPermission: permission });
    await expect(
      registerPush({
        apiKey: "public",
        projectId: "nexo",
        appId: "1:123:web:abc",
        vapidKey: "public",
      }),
    ).rejects.toThrow("pestaña propia");
    expect(permission).not.toHaveBeenCalled();
    expect(worker).not.toHaveBeenCalled();
  });
  it("si el usuario niega permiso no registra un worker", async () => {
    const frame = {};
    const worker = vi.fn();
    vi.stubGlobal("window", { isSecureContext: true, Notification: {}, top: frame, self: frame });
    vi.stubGlobal("navigator", { serviceWorker: { register: worker } });
    vi.stubGlobal("Notification", {
      permission: "denied",
      requestPermission: vi.fn().mockResolvedValue("denied"),
    });
    await expect(
      registerPush({
        apiKey: "public",
        projectId: "nexo",
        appId: "1:123:web:abc",
        vapidKey: "public",
      }),
    ).rejects.toThrow("bloqueadas");
    expect(worker).not.toHaveBeenCalled();
  });
});
