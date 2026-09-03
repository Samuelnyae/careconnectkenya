import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { MOVEMENT_LABEL, type MovementType } from "@/lib/inventory";
import { Download } from "lucide-react";
import type { Product } from "./types";

type Row = {
  id: string; product_id: string; movement_type: string; quantity: number;
  reason: string | null; reference: string | null; location_from: string | null;
  location_to: string | null; occurred_at: string;
};

export function MovementsTab({ tenantId, products, refreshKey }: {
  tenantId: string; products: Product[]; refreshKey: number;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("stock_movements")
      .select("id, product_id, movement_type, quantity, reason, reference, location_from, location_to, occurred_at")
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: false })
      .limit(500);
    setRows((data ?? []) as Row[]);
  }, [tenantId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const nameOf = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? "Deleted product";
  }, [products]);

  const filtered = rows.filter((r) => {
    if (type !== "all" && r.movement_type !== type) return false;
    const s = q.toLowerCase().trim();
    if (!s) return true;
    return nameOf(r.product_id).toLowerCase().includes(s)
      || (r.reason ?? "").toLowerCase().includes(s)
      || (r.reference ?? "").toLowerCase().includes(s);
  });

  const exportCsv = () => {
    const head = ["Date", "Product", "Type", "Qty", "Reason", "Reference", "From", "To"];
    const lines = filtered.map((r) => [
      new Date(r.occurred_at).toISOString(), nameOf(r.product_id), r.movement_type,
      String(r.quantity), r.reason ?? "", r.reference ?? "", r.location_from ?? "", r.location_to ?? "",
    ].map((c) => `"${c.replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Stock audit history ({filtered.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />CSV</Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Search product, reason, reference…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All movement types</SelectItem>
              {Object.entries(MOVEMENT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No movements recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Type</TableHead>
                <TableHead>Qty</TableHead><TableHead>Reason</TableHead><TableHead>Location</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(r.occurred_at).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{nameOf(r.product_id)}</TableCell>
                    <TableCell><Badge variant="secondary">{MOVEMENT_LABEL[r.movement_type as MovementType] ?? r.movement_type}</Badge></TableCell>
                    <TableCell className={r.quantity < 0 ? "font-semibold text-destructive" : "font-semibold"}>
                      {r.quantity > 0 ? "+" : ""}{r.quantity}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reason ?? "—"}{r.reference ? ` · ${r.reference}` : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.location_from || r.location_to ? `${r.location_from ?? "—"} → ${r.location_to ?? "—"}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
