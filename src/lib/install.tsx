import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { canOfferInstall, isInstalled } from "./install-state";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const InstallContext = createContext({ installed: false, available: false, install: async () => {} });
export function InstallProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const mode = window.matchMedia("(display-mode: standalone)");
    let completed = false;
    const sync = () => setInstalled(isInstalled(mode.matches, (navigator as Navigator & { standalone?: boolean }).standalone === true, completed));
    sync();
    const offered = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const complete = () => { completed = true; setInstalled(true); setPrompt(null); };
    mode.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", offered);
    window.addEventListener("appinstalled", complete);
    return () => { mode.removeEventListener("change", sync); window.removeEventListener("beforeinstallprompt", offered); window.removeEventListener("appinstalled", complete); };
  }, []);
  const install = async () => {
    if (!prompt || installed) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === "accepted") setInstalled(true);
  };
  return <InstallContext.Provider value={{ installed, available: canOfferInstall(installed, prompt !== null), install }}>{children}</InstallContext.Provider>;
}
export const useInstall = () => useContext(InstallContext);