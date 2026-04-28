import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Activity, Package, ShoppingCart, ShieldCheck, Pill, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Afya Cloud — Healthcare management for Kenya" },
      { name: "description", content: "Multi-tenant SaaS for clinics, pharmacies, labs and hospitals in Kenya. POS, inventory, EMR and analytics in one platform." },
    ],
  }),
});

function Landing() {
  const { session, loading } = useAuth();

  if (!loading && session) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Afya Cloud</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/auth"><Button>Get started</Button></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-6 py-20 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Built for the Kenyan health ecosystem
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Modern healthcare operations for{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              clinics, pharmacies & labs
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            One platform to manage inventory, prescriptions, point-of-sale, patients and analytics — secure, multi-tenant, and ready for M-Pesa.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth"><Button size="lg">Start free</Button></Link>
            <Link to="/auth"><Button size="lg" variant="outline">Sign in</Button></Link>
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-6 pb-24 md:grid-cols-3">
          {[
            { icon: Package, title: "Smart inventory", desc: "Batch tracking, expiry alerts and reorder levels to eliminate stock-outs and wastage." },
            { icon: ShoppingCart, title: "Pharmacy POS", desc: "Fast checkout with M-Pesa, cash and card. Auto stock deduction on every sale." },
            { icon: Stethoscope, title: "Patient records", desc: "Centralized EMR with prescription history accessible across facilities." },
            { icon: Pill, title: "Prescription tracking", desc: "Verify prescriptions, prevent fraud and reduce duplicate dispensing." },
            { icon: ShieldCheck, title: "Multi-tenant security", desc: "Row-level isolation per facility with role-based access control." },
            { icon: Activity, title: "Real-time analytics", desc: "Sales, inventory value and expiring stock — at a glance." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container mx-auto px-6 py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Afya Cloud. Digitizing Kenyan healthcare.
        </div>
      </footer>
    </div>
  );
}
