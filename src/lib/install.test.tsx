import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstallProvider, useInstall } from "./install";
import { isInstalled, canOfferInstall } from "./install-state";
function Control() {
  const value = useInstall();
  return (
    <>
      {value.available && <button onClick={value.install}>install</button>}
      <output>{String(value.installed)}</output>
    </>
  );
}
afterEach(() => { cleanup(); localStorage.removeItem("nexo-installed"); });
describe("instalación sin salir de la cuenta", () => {
  it("standalone e iOS ocultan la oferta", () => {
    expect(isInstalled(true, false, false)).toBe(true);
    expect(isInstalled(false, true, false)).toBe(true);
    expect(canOfferInstall(true, true)).toBe(false);
    expect(canOfferInstall(false, false)).toBe(false);
  });
  it("appinstalled oculta oferta incluso si vuelve a llegar prompt", () => {
    render(
      <InstallProvider>
        <Control />
      </InstallProvider>,
    );
    act(() => window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true })));
    expect(screen.getByRole("button")).toBeInTheDocument();
    act(() => window.dispatchEvent(new Event("appinstalled")));
    act(() => window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true })));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("true");
  });
  it("solicita instalación sin navegar ni borrar sesión", async () => {
    const prompt = vi.fn(async () => {});
    sessionStorage.setItem("test-session", "present");
    const originalUrl = window.location.href;
    render(
      <InstallProvider>
        <Control />
      </InstallProvider>,
    );
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    act(() => window.dispatchEvent(event));
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(prompt).toHaveBeenCalledOnce();
    expect(window.location.href).toBe(originalUrl);
    expect(sessionStorage.getItem("test-session")).toBe("present");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
