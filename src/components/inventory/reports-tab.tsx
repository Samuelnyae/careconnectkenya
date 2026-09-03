import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { stockCost, stockStatus, stockValue } from "@/lib/inventory";
import type { Product } from "./types";

export function ReportsTab({ products }: { products: Product[] }) {
  const byCategory = useMemo(() => {
    const map = new Map<string, { items: number; qty: number; value: number; cost: number }>();
    for (const p of products) {
      const key = p.category ?? "Uncategorised";
      const cur = map.get(key) ?? { items: 0, qty: 0, value: 0, cost: 0 };
      cur.items += 1;
      cur.qty += p.stock_qty;
      cur.value += p.stock_qty * Number(p.unit_price);
      cur.cost += p.stock_qty * Number(p.cost_price);
      map.set(key, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [products]);

  const reorder = products.filter((p) => stockStatus(p.stock_qty, p.reorder_level) !== "ok");
  const retail = stockValue(products);
  const cost = stockCost(products);

  const exportValuation = () => {
    const head = ["Product", "SKU", "Category", "Qty", "Cost price", "Unit price", "Cost value", "Retail value"];
    const lines = products.map((p) => [
      p.name, p.sku ?? "", p.category ?? "", String(p.stock_qty),
      String(p.cost_price), String(p.unit_price),
      String(p.stock_qty * Number(p.cost_price)), String(p.stock_qty * Number(p.unit_price)),
    ].map((c) => `"${c.replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `stock-valuation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Stock valuation</CardTitle>
          <Button size="sm" variant="outline" onClick={exportValuation}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div><div className="text-xs uppercase text-muted-foreground">Retail value</div><div className="text-2xl font-bold">KSh {retail.toLocaleString()}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Cost value</div><div className="text-2xl font-bold">KSh {cost.toLocaleString()}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Potential margin</div><div className="text-2xl font-bold">KSh {(retail - cost).toLocaleString()}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Value by category</CardTitle></CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No products yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Products</TableHead><TableHead>Units</TableHead><TableHead>Retail value</TableHead></TableRow></TableHeader>
              <TableBody>
                {byCategory.map(([cat, v]) => (
                  <TableRow key={cat}>
                    <TableCell className="font-medium">{cat}</TableCell>
                    <TableCell>{v.items}</TableCell>
                    <TableCell>{v.qty}</TableCell>
                    <TableCell>KSh {v.value.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reorder report ({reorder.length})</CardTitle></CardHeader>
        <CardContent>
          {reorder.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Every product is above its reorder level.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>On hand</TableHead><TableHead>Reorder level</TableHead><TableHead>Suggested order</TableHead></TableRow></TableHeader>
              <TableBody>
                {reorder.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.stock_qty}</TableCell>
                    <TableCell>{p.reorder_level}</TableCell>
                    <TableCell className="font-semibold">{Math.max(p.reorder_level * 2 - p.stock_qty, p.reorder_level)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
