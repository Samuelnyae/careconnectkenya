import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Membership = {
  id: string;
  tenant_id: string;
  role: string;
  tenants: { id: string; name: string; slug: string; type: string } | null;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  memberships: Membership[];
  currentTenantId: string | null;
  setCurrentTenantId: (id: string) => void;
  currentTenant: Membership["tenants"] | null;
  currentRole: string | null;
  refreshMemberships: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(null);

  const loadMemberships = async (userId: string) => {
    const { data } = await supabase
      .from("memberships")
      .select("id, tenant_id, role, tenants(id, name, slug, type)")
      .eq("user_id", userId);
    const rows = (data ?? []) as unknown as Membership[];
    setMemberships(rows);
    if (rows.length > 0) {
      const stored = typeof window !== "undefined" ? localStorage.getItem("currentTenantId") : null;
      const match = stored && rows.find((r) => r.tenant_id === stored);
      setCurrentTenantIdState(match ? stored : rows[0].tenant_id);
    } else {
      setCurrentTenantIdState(null);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => void loadMemberships(s.user.id), 0);
      } else {
        setMemberships([]);
        setCurrentTenantIdState(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        void loadMemberships(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const setCurrentTenantId = (id: string) => {
    setCurrentTenantIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("currentTenantId", id);
  };

  const refreshMemberships = async () => {
    if (user) await loadMemberships(user.id);
  };

  const currentMembership = memberships.find((m) => m.tenant_id === currentTenantId) ?? null;

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        loading,
        memberships,
        currentTenantId,
        setCurrentTenantId,
        currentTenant: currentMembership?.tenants ?? null,
        currentRole: currentMembership?.role ?? null,
        refreshMemberships,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}