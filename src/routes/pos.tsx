import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { enqueue, cacheList, readCache } from "@/lib/offline/db";

export const Route = createFileRoute("/pos")({
  component: () => <ProtectedLayout><POSPage /></ProtectedLayout>,
});

type Product = { id: string; name: string; unit_price: number; stock_qty: number; category: string | null; image_url: string | null };
type CartLine = { product: Product; qty: number };

function POSPage() {
  const { currentTenantId, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const { data, error } = await supabase
      .from("products")
      .select("id, name, unit_price, stock_qty, category, image_url")
      .eq("tenant_id", currentTenantId).order("name");
    if (!error && data) {
      setProducts(data as Product[]);
      void cacheList("cache_products", currentTenantId, data);
    } else {
      // Offline fallback
      const cached = await readCache("cache_products", currentTenantId);
      if (cached) setProducts(cached as Product[]);
    }
  }, [currentTenantId]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return products;
    return products.filter((p) => p.name.toLowerCase().includes(s) || (p.category ?? "").toLowerCase().includes(s));
  }, [products, q]);

  const addToCart = (p: Product) => {
    if (p.stock_qty === 0) return toast.error("Out of stock");
    setCart((c) => {
      const existing = c.find((l) => l.product.id === p.id);
      if (existing) {
        if (existing.qty >= p.stock_qty) { toast.error("Not enough stock"); return c; }
        return c.map((l) => l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...c, { product: p, qty: 1 }];
    });
  };
  const changeQty = (id: string, delta: number) => {
    setCart((c) => c.flatMap((l) => {
      if (l.product.id !== id) return [l];
      const nq = l.qty + delta;
      if (nq <= 0) return [];
      if (nq > l.product.stock_qty) { toast.error("Not enough stock"); return [l]; }
      return [{ ...l, qty: nq }];
    }));
  };
  const removeLine = (id: string) => setCart((c) => c.filter((l) => l.product.id !== id));

  const total = cart.reduce((s, l) => s + l.qty * Number(l.product.unit_price), 0);

  const checkout = async (method: "cash" | "mpesa" | "card") => {
    if (!currentTenantId || !user || cart.length === 0) return;
    setPaying(true);
    // Offline path: queue and exit
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await enqueue({
          tenant_id: currentTenantId,
          table: "sales",
          payload: {
            tenant_id: currentTenantId, cashier_id: user.id, total, payment_method: method,
            customer_name: customer || null, customer_phone: phone || null,
          },
          children: {
            table: "sale_items",
            parentKey: "sale_id",
            rows: cart.map((l) => ({
              product_id: l.product.id, product_name: l.product.name,
              quantity: l.qty, unit_price: l.product.unit_price,
              subtotal: l.qty * Number(l.product.unit_price),
            })),
          },
        });
        // Optimistic local stock update so cashier can keep selling
        setProducts((ps) => ps.map((p) => {
          const line = cart.find((l) => l.product.id === p.id);
          return line ? { ...p, stock_qty: Math.max(0, p.stock_qty - line.qty) } : p;
        }));
        toast.success(`Sale queued offline — KSh ${total.toLocaleString()}. Will sync when online.`);
        setCart([]); setCustomer(""); setPhone("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to queue sale");
      }
      setPaying(false);
      return;
    }
    if (method === "mpesa") {
      if (!phone.trim()) { setPaying(false); return toast.error("Enter customer phone for M-Pesa"); }
      const { data: stk, error: stkErr } = await supabase.functions.invoke("mpesa-stk-push", {
        body: { phone: phone.trim(), amount: total, reference: "POS", description: "Pharmacy sale" },
      });
      if (stkErr || stk?.error) {
        setPaying(false);
        return toast.error(stk?.error || stkErr?.message || "M-Pesa request failed");
      }
      toast.success("STK push sent — ask customer to enter PIN on phone");
    }
    const { data: sale, error } = await supabase.from("sales").insert({
      tenant_id: currentTenantId, cashier_id: user.id, total, payment_method: method,
      customer_name: customer || null,
      customer_phone: phone || null,
    }).select().single();
    if (error || !sale) { setPaying(false); return toast.error(error?.message ?? "Sale failed"); }
    const items = cart.map((l) => ({
      sale_id: sale.id, product_id: l.product.id, product_name: l.product.name,
      quantity: l.qty, unit_price: l.product.unit_price, subtotal: l.qty * Number(l.product.unit_price),
    }));
    const { error: iErr } = await supabase.from("sale_items").insert(items);
    setPaying(false);
    if (iErr) return toast.error(iErr.message);
    toast.success(`Sale complete — KSh ${total.toLocaleString()}`);
    setCart([]); setCustomer(""); setPhone("");
    void load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pharmacy POS</h1>
          <p className="text-muted-foreground">Select products to add to the sale.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or scan barcode…" className="pl-9" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
              No products. Add some in Inventory first.
            </div>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock_qty === 0}
              className="group rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-sm)] transition hover:border-primary/50 hover:shadow-[var(--shadow-md)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted mb-3 flex items-center justify-center">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{p.category ?? "General"}</div>
              <div className="mt-1 font-medium">{p.name}</div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-lg font-bold text-primary">KSh {Number(p.unit_price).toLocaleString()}</div>
                <div className={`text-xs ${p.stock_qty === 0 ? "text-destructive" : "text-muted-foreground"}`}>{p.stock_qty} in stock</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Card className="lg:sticky lg:top-20 lg:self-start shadow-[var(--shadow-md)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Current sale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Customer name (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <Input placeholder="Customer phone (for M-Pesa, e.g. 0712345678)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="space-y-2 max-h-80 overflow-auto">
            {cart.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Cart is empty</div>}
            {cart.map((l) => (
              <div key={l.product.id} className="flex items-center gap-2 rounded-lg border p-2">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{l.product.name}</div>
                  <div className="text-xs text-muted-foreground">KSh {Number(l.product.unit_price).toLocaleString()} × {l.qty}</div>
                </div>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(l.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-6 text-center text-sm">{l.qty}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(l.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeLine(l.product.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold">KSh {total.toLocaleString()}</span>
          </div>
          <div className="grid gap-2">
            <Button disabled={paying || cart.length === 0} onClick={() => void checkout("mpesa")} className="bg-[var(--gradient-primary)]">Charge M-Pesa</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={paying || cart.length === 0} onClick={() => void checkout("cash")}>Cash</Button>
              <Button variant="outline" disabled={paying || cart.length === 0} onClick={() => void checkout("card")}>Card</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
