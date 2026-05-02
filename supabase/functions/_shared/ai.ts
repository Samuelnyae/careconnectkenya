// Shared helper for calling Lovable AI Gateway with tool-calling for structured output.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function callAIStructured(opts: {
  systemPrompt: string;
  userPrompt: string;
  toolName: string;
  toolDescription: string;
  parameters: Record<string, unknown>;
  model?: string;
}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: opts.toolName,
          description: opts.toolDescription,
          parameters: opts.parameters,
        },
      }],
      tool_choice: { type: "function", function: { name: opts.toolName } },
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limit exceeded, try again shortly.");
    if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    const t = await resp.text();
    console.error("AI gateway error:", resp.status, t);
    throw new Error("AI gateway error");
  }
  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No analysis returned");
  return JSON.parse(toolCall.function.arguments);
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}