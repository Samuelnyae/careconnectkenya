import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, AlertTriangle, Clock, Search, ScanLine, Package, Wallet, Ban,
} from "lucide-react";
import { toast } from "sonner";
import {
  EXPIRY_LABEL, canManageInventory, expiryStatus, stockCost, stockStatus, stockValue,
  type MovementType,
} from "@/lib/inventory";
import { ProductDialog } from "@/components/inventory/product-dialog";
import { ProductDetailSheet } from "@/components/inventory/product-detail-sheet";
import { StockMoveDialog } from "@/components/inventory/stock-move-dialog";
import { SuppliersTab } from "@/components/inventory/suppliers-tab";
import { PurchasingTab } from "@/components/inventory/purchasing-tab";
import { StockTakeTab } from "@/components/inventory/stock-take-tab";
import { ExpiryTab } from "@/components/inventory/expiry-tab";
import { MovementsTab } from "@/components/inventory/movements-tab";
import { ReportsTab } from "@/components/inventory/reports-tab";
import type { Batch, Product, Supplier } from "@/components/inventory/types";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory & Pharmacy Stock Control | CareConnect" },
      { name: "description", content: "Manage products, batches, suppliers, purchase orders, stock takes and expiry across your health facility." },
      { property: "og:title", content: "Inventory & Pharmacy Stock Control" },
      { property: "og:description", content: "Batch-level stock control, expiry alerts, purchasing and audit history for Kenyan health facilities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ProtectedLayout><InventoryPage /></ProtectedLayout>,
});

function InventoryPage() {
  const { currentTenantId, currentRole, user } = useAuth();
  const canManage = canManageInventory(currentRole);

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [moveType, setMoveType] = useState<MovementType>("stock_in");
  const [moveOpen, setMoveOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const [p, s, b] = await Promise.all([
      supabase.from("products").select("*").eq("tenant_id", currentTenantId).order("name"),
      supabase.from("suppliers").select("*").eq("tenant_id", currentTenantId).order("name"),
      supabase.from("product_batches").select("*").eq("tenant_id", currentTenantId).gt("quantity", 0),
    ]);
    setProducts((p.data ?? []) as Product[]);
    setSuppliers((s.data ?? []) as Supplier[]);
    setBatches((b.data ?? []) as Batch[]);
  }, [currentTenantId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const refresh = () => { setRefreshKey((k) => k + 1); };

  // Keep the open detail sheet in sync with reloaded data
  useEffect(() => {
    if (!selected) return;
    const fresh = products.find((p) => p.id === selected.id);
    if (fresh && fresh.stock_qty !== selected.stock_qty) setSelected(fresh);
  }, [products, selected]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean) as string[])].sort(),
    [products],
  );

  const productExpiry = useCallback((p: Product) => {
    const dates = batches.filter((b) => b.product_id === p.id).map((b) => b.expiry_date).filter(Boolean) as string[];
    if (dates.length === 0) return p.expiry_date ?? null;
    return dates.sort()[0] ?? null;
  }, [batches]);

  const filtered = useMemo(() => products.filter((p) => {
    const s = q.toLowerCase().trim();
    if (s && !(
      p.name.toLowerCase().includes(s)
      || (p.sku ?? "").toLowerCase().includes(s)
      || (p.barcode ?? "").toLowerCase().includes(s)
      || (p.category ?? "").toLowerCase().includes(s)
      || (p.manufacturer ?? "").toLowerCase().includes(s)
    )) return false;
    if (category !== "all" && (p.category ?? "") !== category) return false;
    if (stockFilter !== "all" && stockStatus(p.stock_qty, p.reorder_level) !== stockFilter) return false;
    if (expiryFilter !== "all") {
      const es = expiryStatus(productExpiry(p));
      if (expiryFilter === "at_risk" ? !["expired", "critical", "soon"].includes(es) : es !== expiryFilter) return false;
    }
    return true;
  }), [products, q, category, stockFilter, expiryFilter, productExpiry]);

  const kpis = useMemo(() => {
    const low = products.filter((p) => stockStatus(p.stock_qty, p.reorder_level) === "low").length;
    const out = products.filter((p) => stockStatus(p.stock_qty, p.reorder_level) === "out").length;
    const expired = batches.filter((b) => expiryStatus(b.expiry_date) === "expired").length;
    const expiring = batches.filter((b) => ["critical", "soon"].includes(expiryStatus(b.expiry_date))).length;
    return { low, out, expired, expiring, retail: stockValue(products), cost: stockCost(products) };
  }, [products, batches]);

  // Barcode scanner: hardware scanners type fast then press Enter into the search box
  const onScanToggle = () => {
    setScanning((v) => !v);
    setTimeout(() => searchRef.current?.focus(), 50);
  };
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const code = q.trim();
    if (!code) return;
    const hit = products.find((p) => p.barcode === code || p.sku === code);
    if (hit) { setSelected(hit); setQ(""); }
    else toast.error(`No product matches ${code}`);
  };

  const openMove = (type: MovementType) => { setMoveType(type); setMoveOpen(true); };

  if (!currentTenantId || !user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Products, batches, purchasing, stock takes and expiry control.</p>
        </div>
        {canManage ? (
          <Button className="w-full sm:w-auto" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Add product
          </Button>
        ) : (
          <Badge variant="outline" className="w-fit">Read-only — inventory changes need pharmacist or admin role</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Package className="h-4 w-4" />} label="Products" value={String(products.length)} hint={`${batches.length} active batches`} />
        <KpiCard icon={<Wallet className="h-4 w-4" />} label="Stock value (retail)" value={`KSh ${kpis.retail.toLocaleString()}`} hint={`Cost KSh ${kpis.cost.toLocaleString()}`} />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Low / out of stock" value={`${kpis.low} / ${kpis.out}`} hint="Needs reordering" tone="warning" />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Expiring / expired" value={`${kpis.expiring} / ${kpis.expired}`} hint="Batches by expiry date" tone="destructive" />
      </div>

      <Tabs defaultValue="products">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="expiry">Expiry</TabsTrigger>
            <TabsTrigger value="purchasing">Purchasing</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="stocktake">Stock take</TabsTrigger>
            <TabsTrigger value="history">Audit history</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="products" className="pt-4">
          <Card>
            <CardHeader className="gap-3">
              <CardTitle>All products ({filtered.length})</CardTitle>
              <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={onSearchKey}
                    placeholder={scanning ? "Scan barcode now…" : "Search name, SKU, barcode, manufacturer…"}
                    className="pl-9"
                  />
                </div>
                <Button variant={scanning ? "default" : "outline"} onClick={onScanToggle}>
                  <ScanLine className="mr-2 h-4 w-4" />{scanning ? "Scanning" : "Scan"}
                </Button>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="lg:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any stock</SelectItem>
                      <SelectItem value="ok">In stock</SelectItem>
                      <SelectItem value="low">Low stock</SelectItem>
                      <SelectItem value="out">Out of stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any expiry</SelectItem>
                      <SelectItem value="at_risk">At risk</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="critical">≤30 days</SelectItem>
                      <SelectItem value="soon">≤90 days</SelectItem>
                      <SelectItem value="ok">In date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No products yet. Click "Add product" to start.</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No products match these filters.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead><TableHead>Earliest expiry</TableHead><TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => {
                        const exp = productExpiry(p);
                        const ss = stockStatus(p.stock_qty, p.reorder_level);
                        const es = expiryStatus(exp);
                        return (
                          <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {p.image_url ? (
                                  <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded object-cover border" loading="lazy" />
                                ) : (
                                  <div className="h-10 w-10 rounded border bg-muted" />
                                )}
                                <div>
                                  <div className="font-medium">{p.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {[p.strength, p.dosage_form, p.sku].filter(Boolean).join(" · ") || "—"}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                            <TableCell>KSh {Number(p.unit_price).toLocaleString()}</TableCell>
                            <TableCell>{p.stock_qty}</TableCell>
                            <TableCell className="text-muted-foreground">{exp ?? "—"}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {ss === "out" && <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" />Out</Badge>}
                                {ss === "low" && <Badge className="bg-warning text-warning-foreground hover:bg-warning/90"><AlertTriangle className="mr-1 h-3 w-3" />Low</Badge>}
                                {ss === "ok" && <Badge className="bg-success text-success-foreground hover:bg-success/90">OK</Badge>}
                                {es === "expired" && <Badge variant="destructive">Expired</Badge>}
                                {(es === "critical" || es === "soon") && (
                                  <Badge className="bg-warning text-warning-foreground hover:bg-warning/90"><Clock className="mr-1 h-3 w-3" />{EXPIRY_LABEL[es]}</Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiry" className="pt-4">
          <ExpiryTab tenantId={currentTenantId} userId={user.id} products={products} canManage={canManage} onChanged={refresh} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="purchasing" className="pt-4">
          <PurchasingTab tenantId={currentTenantId} userId={user.id} products={products} suppliers={suppliers} canManage={canManage} onChanged={refresh} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="suppliers" className="pt-4">
          <SuppliersTab tenantId={currentTenantId} suppliers={suppliers} canManage={canManage} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="stocktake" className="pt-4">
          <StockTakeTab tenantId={currentTenantId} userId={user.id} products={products} canManage={canManage} onChanged={refresh} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <MovementsTab tenantId={currentTenantId} products={products} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="reports" className="pt-4">
          <ReportsTab products={products} />
        </TabsContent>
      </Tabs>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={currentTenantId}
        product={editing}
        suppliers={suppliers}
        onSaved={() => { refresh(); }}
      />

      <ProductDetailSheet
        product={selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
        tenantId={currentTenantId}
        canManage={canManage}
        onEdit={() => { setEditing(selected); setDialogOpen(true); }}
        onMove={openMove}
        refreshKey={refreshKey}
      />

      <StockMoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        tenantId={currentTenantId}
        userId={user.id}
        product={selected}
        type={moveType}
        suppliers={suppliers}
        onDone={refresh}
      />
    </div>
  );
}

function KpiCard({ icon, label, value, hint, tone }: {
  icon: React.ReactNode; label: string; value: string; hint: string; tone?: "warning" | "destructive";
}) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={`flex items-center gap-2 text-xs uppercase tracking-wide ${toneClass}`}>{icon}{label}</div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}
