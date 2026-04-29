import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Package, AlertTriangle, Clock, TrendingUp, ShoppingCart } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";

export const Route = createFileRoute("/dashboard")({
  component: () => <ProtectedLayout><Dashboard /></ProtectedLayout>,
});

function Dashboard() {
  const { currentTenantId, currentTenant } = useAuth();
  const [stats, setStats] = useState({ salesToday: 0, inventoryValue: 0, lowStock: 0, expiringSoon: 0, outOfStock: 0, txToday: 0 });
  const [trend, setTrend] = useState<{ date: string; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);

  useEffect(() => {
    if (!currentTenantId) return;
    const load = async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const { data: sales } = await supabase.from("sales").select("total, id").eq("tenant_id", currentTenantId).gte("created_at", startOfDay.toISOString());
      const { data: products } = await supabase.from("products").select("stock_qty, cost_price, reorder_level, expiry_date").eq("tenant_id", currentTenantId);
      const salesToday = (sales ?? []).reduce((s, r) => s + Number(r.total), 0);
      const txToday = (sales ?? []).length;
      const inventoryValue = (products ?? []).reduce((s, p) => s + Number(p.cost_price) * p.stock_qty, 0);
      const lowStock = (products ?? []).filter((p) => p.stock_qty > 0 && p.stock_qty <= p.reorder_level).length;
      const outOfStock = (products ?? []).filter((p) => p.stock_qty === 0).length;
      const in60 = new Date(); in60.setDate(in60.getDate() + 60);
      const expiringSoon = (products ?? []).filter((p) => p.expiry_date && new Date(p.expiry_date) <= in60).length;
      setStats({ salesToday, inventoryValue, lowStock, expiringSoon, outOfStock, txToday });

      // 14-day sales trend
      const since = new Date(); since.setDate(since.getDate() - 13); since.setHours(0,0,0,0);
      const { data: trendSales } = await supabase.from("sales").select("total, created_at").eq("tenant_id", currentTenantId).gte("created_at", since.toISOString());
      const buckets: Record<string, number> = {};
      for (let i = 0; i < 14; i++) {
        const d = new Date(since); d.setDate(since.getDate() + i);
        buckets[d.toISOString().slice(0, 10)] = 0;
      }
      (trendSales ?? []).forEach((s) => {
        const k = new Date(s.created_at).toISOString().slice(0, 10);
        if (k in buckets) buckets[k] += Number(s.total);
      });
      setTrend(Object.entries(buckets).map(([date, total]) => ({ date: date.slice(5), total })));

      // Top selling products (last 30 days)
      const since30 = new Date(); since30.setDate(since30.getDate() - 30);
      const { data: items } = await supabase
        .from("sale_items")
        .select("product_name, quantity, sales!inner(tenant_id, created_at)")
        .eq("sales.tenant_id", currentTenantId)
        .gte("sales.created_at", since30.toISOString());
      const totals: Record<string, number> = {};
      (items ?? []).forEach((it: { product_name: string; quantity: number }) => {
        totals[it.product_name] = (totals[it.product_name] ?? 0) + Number(it.quantity);
      });
      setTopProducts(Object.entries(totals).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5));
    };
    void load();
  }, [currentTenantId]);

  const fmt = (n: number) => "KSh " + n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
  const kpis = [
    { label: "Sales Today", value: fmt(stats.salesToday), icon: DollarSign, tone: "primary" },
    { label: "Transactions Today", value: stats.txToday, icon: ShoppingCart, tone: "accent" },
    { label: "Inventory Value", value: fmt(stats.inventoryValue), icon: Package, tone: "success" },
    { label: "Low Stock", value: stats.lowStock, icon: TrendingUp, tone: "warning" },
    { label: "Expiring Soon", value: stats.expiringSoon, icon: Clock, tone: "warning" },
    { label: "Out of Stock", value: stats.outOfStock, icon: AlertTriangle, tone: "destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to {currentTenant?.name}.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${k.tone}/10 text-${k.tone}`}>
                <k.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sales — last 14 days</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => `KSh ${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top products — last 30 days</CardTitle></CardHeader>
          <CardContent className="h-72">
            {topProducts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                  <Tooltip />
                  <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Getting started</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Head to <strong>Inventory</strong> and add a few products (name, price, stock, expiry).</p>
          <p>2. Open <strong>Pharmacy POS</strong> to process a sale — stock deducts automatically.</p>
          <p>3. Come back here to see live KPIs from your tenant.</p>
        </CardContent>
      </Card>
    </div>
  );
}
