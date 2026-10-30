import { supabase } from "@/integrations/supabase/client";

const KEY = "nexo_ref";

export function normalizeRefCode(code: string | null | undefined): string | null {
  const c = (code ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(c) ? c : null;
}

export function rememberRef(code: string | null | undefined) {
  const c = normalizeRefCode(code);
  if (c && typeof localStorage !== "undefined") localStorage.setItem(KEY, c);
  return c;
}

export function storedRef(): string | null {
  if (typeof localStorage === "undefined") return null;
  return normalizeRefCode(localStorage.getItem(KEY));
}

/** Links a freshly created account (e.g. Google) to its sponsor once; server enforces rules. */
export async function claimStoredRef() {
  const code = storedRef();
  if (!code) return;
  const { error } = await supabase.rpc("claim_referral", { _code: code });
  if (!error) localStorage.removeItem(KEY);
}
