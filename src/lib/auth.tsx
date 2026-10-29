import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { safeDestination } from "./destinations";

type AuthCtx = { session: Session | null; user: User | null; ready: boolean };
const Ctx = createContext<AuthCtx>({ session: null, user: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthCtx>({ session: null, user: null, ready: false });
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) =>
      setState({ session: data.session, user: data.session?.user ?? null, ready: true }),
    );
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, user: session?.user ?? null, ready: true });
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_IN") {
        const r = sessionStorage.getItem("nexo_redirect");
        sessionStorage.removeItem("nexo_redirect");
        const destination = safeDestination(r);
        if (destination) router.history.push(destination);
      }
      router.invalidate();
      if (event !== "SIGNED_OUT") qc.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, qc]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export type Role = "admin" | "moderator" | "seller" | "buyer";

export function useRoles() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as Role);
    },
  });
  const roles = q.data ?? [];
  return {
    roles,
    loading: q.isLoading,
    isAdmin: roles.includes("admin"),
    isStaff: roles.includes("admin") || roles.includes("moderator"),
    isSeller: roles.includes("seller"),
  };
}

export async function signOut(qc: ReturnType<typeof useQueryClient>, navigate: (o: { to: "/auth"; replace: boolean }) => void) {
  await qc.cancelQueries();
  qc.clear();
  await supabase.auth.signOut();
  navigate({ to: "/auth", replace: true });
}
