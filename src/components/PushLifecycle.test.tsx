import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  disable: vi.fn(),
  current: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  request: vi.fn(),
  path: "/notificaciones",
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@tanstack/react-router", () => ({ useRouterState: () => mocks.path }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: settings }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/push.functions", () => ({
  getPushSettings: vi.fn(),
  registerPushDevice: mocks.register,
  disablePushDevices: mocks.disable,
}));
vi.mock("@/lib/push", () => ({
  currentPushSubscription: mocks.current,
  registerPush: mocks.subscribe,
  unsubscribePush: mocks.unsubscribe,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn() } }));
import { PushLifecycle } from "./PushLifecycle";
const settings = {
  configured: true,
  config: { vapidKey: "public" },
  preferences: { new_auctions: true, activity: true },
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.path = "/notificaciones";
  Object.defineProperty(window, "PushManager", { value: {}, configurable: true });
  Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
  vi.stubGlobal("Notification", { permission: "default", requestPermission: mocks.request });
  mocks.current.mockResolvedValue(null);
  mocks.subscribe.mockResolvedValue({ endpoint: "device" });
  mocks.register.mockResolvedValue({ ok: true });
  mocks.disable.mockResolvedValue({ ok: true });
  mocks.unsubscribe.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("context offers once; declining never prompts and remount does not repeat", async () => {
  const view = render(<PushLifecycle />);
  fireEvent.click(await screen.findByRole("button", { name: "Ahora no" }));
  view.unmount();
  render(<PushLifecycle />);
  expect(screen.queryByRole("button", { name: "Permitir ahora" })).toBeNull();
  expect(mocks.subscribe).not.toHaveBeenCalled();
});
it("permission request only on explicit gesture and registers granted device", async () => {
  render(<PushLifecycle />);
  fireEvent.click(await screen.findByRole("button", { name: "Permitir ahora" }));
  await waitFor(() =>
    expect(mocks.register).toHaveBeenCalledWith({ data: { subscription: { endpoint: "device" } } }),
  );
  expect(localStorage.getItem("nexo-push-endpoint:owner")).toBe("device");
});
it("already granted permission automatically links device without permission gesture", async () => {
  vi.stubGlobal("Notification", { permission: "granted" });
  render(<PushLifecycle />);
  await waitFor(() => expect(mocks.subscribe).toHaveBeenCalledWith(settings.config, false));
  await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
  expect(screen.queryByRole("button", { name: "Permitir ahora" })).toBeNull();
});
it("denied permission deactivates only saved current-device endpoint, never prompts", async () => {
  vi.stubGlobal("Notification", { permission: "denied" });
  localStorage.setItem("nexo-push-endpoint:owner", "device");
  render(<PushLifecycle />);
  await waitFor(() => expect(mocks.disable).toHaveBeenCalledWith({ data: { endpoint: "device" } }));
  await waitFor(() => expect(localStorage.getItem("nexo-push-endpoint:owner")).toBeNull());
  expect(mocks.subscribe).not.toHaveBeenCalled();
});
it("focus detects permission revoked since mount", async () => {
  const permission = { permission: "granted" };
  vi.stubGlobal("Notification", permission);
  render(<PushLifecycle />);
  await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
  permission.permission = "denied";
  fireEvent.focus(window);
  await waitFor(() => expect(mocks.disable).toHaveBeenCalledWith({ data: { endpoint: "device" } }));
  expect(mocks.subscribe).toHaveBeenCalledTimes(1);
});
