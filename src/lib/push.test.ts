import { afterEach, describe, expect, it, vi } from "vitest";
import { auctionPushPath, pushConfigured, registerPush, devicePushState } from "./push";
import { allowedPushEndpoint } from "./web-push-schema";
afterEach(() => vi.unstubAllGlobals());
describe("push contextual seguro", () => {
  it("permiso concedido no equivale a suscripción de esta cuenta", () => {
    expect(devicePushState(true, "granted", "device-a", ["device-b"])).toBe("unregistered");
    expect(devicePushState(true, "granted", "device-a", ["device-a"])).toBe("active");
    expect(devicePushState(true, "denied", null, [])).toBe("blocked");
    expect(devicePushState(false, "default", null, [])).toBe("unsupported");
  });
  it("sin credenciales no solicita permisos ni registra worker", async () => {
    const config = { vapidKey: "" };
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
  it("requiere una clave pública VAPID válida sin Firebase", () => {
    expect(pushConfigured({ vapidKey: "public" })).toBe(false);
    expect(pushConfigured({ vapidKey: "B".repeat(87) })).toBe(true);
  });
  it("en iframe no solicita permiso ni registra dispositivos", async () => {
    const permission = vi.fn();
    const worker = vi.fn();
    vi.stubGlobal("window", { isSecureContext: true, Notification: {}, top: {}, self: {} });
    vi.stubGlobal("navigator", { serviceWorker: { register: worker } });
    vi.stubGlobal("Notification", { permission: "default", requestPermission: permission });
    await expect(
      registerPush({
        vapidKey: "B".repeat(87),
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
        vapidKey: "B".repeat(87),
      }),
    ).rejects.toThrow("bloqueadas");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(worker).not.toHaveBeenCalled();
  });
  it("bloquea destinos arbitrarios y permite servicios push de navegadores", () => {
    expect(allowedPushEndpoint("https://fcm.googleapis.com/fcm/send/device")).toBe(true);
    expect(allowedPushEndpoint("https://web.push.apple.com/device")).toBe(true);
    expect(allowedPushEndpoint("http://127.0.0.1/private")).toBe(false);
    expect(allowedPushEndpoint("https://fcm.googleapis.com.evil.test/device")).toBe(false);
    expect(allowedPushEndpoint("https://user:secret@fcm.googleapis.com/device")).toBe(false);
  });
  it("granted auto-registers without prompting and reuses existing subscription", async () => {
    const frame = {};
    const json = { endpoint: "https://web.push.apple.com/device" };
    const subscribe = vi.fn();
    const existing = { toJSON: () => json };
    const registration = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(existing), subscribe },
    };
    vi.stubGlobal("window", {
      isSecureContext: true,
      Notification: {},
      PushManager: {},
      top: frame,
      self: frame,
    });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });
    vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
    expect(await registerPush({ vapidKey: "B".repeat(87) })).toEqual(json);
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });
  it("default permission uses native prompt before worker subscription", async () => {
    const frame = {};
    const worker = vi.fn();
    const request = vi.fn().mockImplementation(() => {
      expect(worker).not.toHaveBeenCalled();
      return Promise.resolve("default");
    });
    vi.stubGlobal("window", { isSecureContext: true, Notification: {}, top: frame, self: frame });
    vi.stubGlobal("navigator", { serviceWorker: { register: worker } });
    vi.stubGlobal("Notification", { permission: "default", requestPermission: request });
    await expect(registerPush({ vapidKey: "B".repeat(87) })).rejects.toThrow();
    expect(request).toHaveBeenCalledOnce();
    expect(worker).not.toHaveBeenCalled();
  });
  it("passive synchronization never prompts even if permission changes to default", async () => {
    const frame = {};
    const request = vi.fn();
    vi.stubGlobal("window", { isSecureContext: true, Notification: {}, top: frame, self: frame });
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("Notification", { permission: "default", requestPermission: request });
    await expect(registerPush({ vapidKey: "B".repeat(87) }, false)).rejects.toThrow(
      "aún no concedido",
    );
    expect(request).not.toHaveBeenCalled();
  });
});
