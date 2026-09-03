import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { EXPIRY_LABEL, MOVEMENT_LABEL, expiryStatus, type MovementType } from "@/lib/inventory";
import { Pencil } from "lucide-react";
import type { Batch, Movement, Product } from "./types";

type Props = {
  product: Product | null;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  canManage: boolean;
  onEdit: () => void;
  onMove: (type: MovementType) => void;
  refreshKey: number;
};

const badgeFor = (status: string) => {
  if (status === "expired") return "destructive" as const;
  return "secondary" as const;
};

export function ProductDetailSheet({ product, onOpenChange, tenantId, canManage, onEdit, onMove, refreshKey }: Props) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [moves, setMoves] = useState<Movement[]>([]);

  const load = useCallback(async () => {
    if (!product) return;
    const [b, m] = await Promise.all([
      supabase.from("product_batches").select("*").eq("tenant_id", tenantId).eq("product_id", product.id)
        .order("expiry_date", { ascending: true, nullsFirst: false }),
      supabase.from("stock_movements").select("*").eq("tenant_id", tenantId).eq("product_id", product.id)
        .order("occurred_at", { ascending: false }).limit(100),
    ]);
    setBatches((b.data ?? []) as Batch[]);
    setMoves((m.data ?? []) as Movement[]);
  }, [product, tenantId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  if (!product) return null;

  const fields: [string, string | number | null][] = [
    ["SKU", product.sku], ["Barcode", product.barcode], ["Category", product.category],
    ["Manufacturer", product.manufacturer], ["Dosage form", product.dosage_form],
    ["Strength", product.strength], ["Unit of measure", product.unit_of_measure],
    ["Storage location", product.storage_location], ["Supplier", product.supplier],
    ["Unit price", `KSh ${Number(product.unit_price).toLocaleString()}`],
    ["Cost price", `KSh ${Number(product.cost_price).toLocaleString()}`],
    ["Reorder level", product.reorder_level],
    ["Stock value", `KSh ${(product.stock_qty * Number(product.unit_price)).toLocaleString()}`],
  ];

  const actions: MovementType[] = ["stock_in", "stock_out", "transfer", "adjustment", "return", "disposal"];

  return (
    <Sheet open={!!product} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 pr-8">
            {product.name}
            {product.is_controlled && <Badge variant="destructive">Controlled</Badge>}
            {!product.is_active && <Badge variant="outline">Inactive</Badge>}
          </SheetTitle>
          <SheetDescription>{product.stock_qty} on hand · reorder at {product.reorder_level}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
              {actions.map((a) => (
                <Button key={a} size="sm" variant="secondary" onClick={() => onMove(a)}>{MOVEMENT_LABEL[a]}</Button>
              ))}
            </div>
          )}

          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
              <TabsTrigger value="batches" className="flex-1">Batches ({batches.length})</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-4">
              {product.image_url && (
                <img src={product.image_url} alt={product.name} className="mb-4 h-40 w-full rounded-lg border object-cover" />
              )}
              <dl className="divide-y text-sm">
                {fields.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v === null || v === "" ? "—" : v}</dd>
                  </div>
                ))}
              </dl>
            </TabsContent>

            <TabsContent value="batches" className="pt-4">
              {batches.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No batches recorded. Use “Stock in” to receive a batch.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Qty</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {batches.map((b) => {
                      const es = expiryStatus(b.expiry_date);
                      return (
                        <TableRow key={b.id}>
                          <TableCell>
                            <div className="font-medium">{b.batch_number}</div>
                            <div className="text-xs text-muted-foreground">{b.storage_location ?? "—"}</div>
                          </TableCell>
                          <TableCell>{b.quantity}</TableCell>
                          <TableCell className="text-muted-foreground">{b.expiry_date ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={badgeFor(es)}>{EXPIRY_LABEL[es]}</Badge>
                              {b.status !== "available" && <Badge variant="outline">{b.status}</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              {moves.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No stock movements yet.</p>
              ) : (
                <div className="space-y-2">
                  {moves.map((m) => (
                    <div key={m.id} className="flex items-start justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <div className="font-medium">{MOVEMENT_LABEL[m.movement_type as MovementType] ?? m.movement_type}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(m.occurred_at).toLocaleString()} {m.reason ? `· ${m.reason}` : ""}
                          {m.reference ? ` · ref ${m.reference}` : ""}
                        </div>
                        {(m.location_from || m.location_to) && (
                          <div className="text-xs text-muted-foreground">{m.location_from ?? "—"} → {m.location_to ?? "—"}</div>
                        )}
                      </div>
                      <span className={m.quantity < 0 ? "font-semibold text-destructive" : "font-semibold text-success"}>
                        {m.quantity > 0 ? "+" : ""}{m.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
