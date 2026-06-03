import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type MotionPreference = "full" | "reduced" | "none";

interface MotionCtx {
  preference: MotionPreference;
  setPreference: (p: MotionPreference) => void;
  systemPrefersReduced: boolean;
}

const Ctx = createContext<MotionCtx | undefined>(undefined);

const STORAGE_KEY = "cc-motion-preference";

function getSystemPrefersReduced(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readStored(): MotionPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "full" || raw === "reduced" || raw === "none") return raw;
  } catch {}
  return null;
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<MotionPreference>(() => {
    const stored = readStored();
    if (stored) return stored;
    return getSystemPrefersReduced() ? "reduced" : "full";
  });
  const [systemPrefersReduced, setSystemPrefersReduced] = useState(() => getSystemPrefersReduced());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setSystemPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-motion", preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {}
  }, [preference]);

  const setPreference = (p: MotionPreference) => setPreferenceState(p);

  return (
    <Ctx.Provider value={{ preference, setPreference, systemPrefersReduced }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMotion() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMotion must be used within MotionProvider");
  return ctx;
}
