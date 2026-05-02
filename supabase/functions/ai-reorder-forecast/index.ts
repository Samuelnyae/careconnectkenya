import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAIStructured, corsHeaders, jsonResponse } from "../_shared/ai.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) return jsonResponse({ error: "tenant_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: products } = await supabase
      .from("products")
      .select("id, name, stock_qty, reorder_level, expiry_date")
      .eq("tenant_id", tenant_id)
      .limit(500);

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: sales } = await supabase
      .from("sales")
      .select("created_at, sale_items(product_id, product_name, quantity)")
      .eq("tenant_id", tenant_id)
      .gte("created_at", since)
      .limit(3000);

    const sold: Record<string, { name: string; total_90d: number; days_active: Set<string> }> = {};
    for (const s of sales ?? []) {
      const day = (s as any).created_at.slice(0, 10);
      for (const item of (s as any).sale_items ?? []) {
        if (!item.product_id) continue;
        const slot = sold[item.product_id] || (sold[item.product_id] = { name: item.product_name, total_90d: 0, days_active: new Set() });
        slot.total_90d += item.quantity || 0;
        slot.days_active.add(day);
      }
    }

    const items = (products ?? []).map((p: any) => {
      const s = sold[p.id];
      return {
        product_id: p.id,
        name: p.name,
        stock: p.stock_qty,
        reorder_level: p.reorder_level,
        expiry: p.expiry_date,
        sold_last_90d: s?.total_90d || 0,
        active_sale_days: s?.days_active.size || 0,
      };
    });

    if (items.length === 0) return jsonResponse({ recommendations: [], summary: "No products in inventory yet." });

    const result = await callAIStructured({
      systemPrompt: "You are an inventory planner. Forecast which products to reorder soon based on 90-day sales velocity, current stock, reorder level, and expiry date. Estimate days-of-stock-remaining = stock / (sold_last_90d / 90). Flag urgency. Suggest a reorder quantity covering ~30 days of demand. Avoid recommending reorders for items expiring soon.",
      userPrompt: `Inventory snapshot:\n${JSON.stringify(items, null, 2)}`,
      toolName: "reorder_forecast",
      toolDescription: "Return reorder recommendations",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                name: { type: "string" },
                current_stock: { type: "number" },
                days_remaining: { type: "number" },
                urgency: { type: "string", enum: ["low", "medium", "high", "critical"] },
                suggested_reorder_qty: { type: "number" },
                reason: { type: "string" },
              },
              required: ["product_id", "name", "current_stock", "days_remaining", "urgency", "suggested_reorder_qty", "reason"],
            },
          },
        },
        required: ["summary", "recommendations"],
      },
    });
    return jsonResponse(result);
  } catch (e) {
    console.error("ai-reorder-forecast error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});