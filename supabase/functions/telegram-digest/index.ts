import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization");
  const cronSecret = Deno.env.get("MONITOR_CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");

  const isService =
    auth === `Bearer ${serviceKey}` ||
    (cronSecret && headerSecret === cronSecret);

  if (!isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { db: { schema: "monitor" } },
  );

  const hours = Math.min(Number(new URL(req.url).searchParams.get("hours") ?? "24"), 48);
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  const { data: rows, error } = await supabase
    .from("mentions")
    .select(
      `id, text, source, published_at, classifications (sentimiento, etiquetas, resumen, urgencia)`,
    )
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const mentions = rows ?? [];
  const bySource: Record<string, number> = {};
  let neg = 0;
  let pos = 0;
  let urgent = 0;

  for (const m of mentions) {
    bySource[m.source] = (bySource[m.source] ?? 0) + 1;
    const c = Array.isArray(m.classifications) ? m.classifications[0] : m.classifications;
    if (!c) continue;
    if (c.sentimiento < 0) neg++;
    if (c.sentimiento > 0) pos++;
    if (c.urgencia >= 2) urgent++;
  }

  const top = mentions.slice(0, 5).map((m) => {
    const c = Array.isArray(m.classifications) ? m.classifications[0] : m.classifications;
    return `• ${c?.resumen ?? m.text.slice(0, 80)} (${m.source})`;
  });

  const sourceLines = Object.entries(bySource)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const message = [
    `📊 Digest monitor político (${hours}h)`,
    `Total: ${mentions.length} menciones`,
    `Sentimiento: ${pos} favorable · ${neg} crítico`,
    urgent > 0 ? `⚠️ ${urgent} urgentes` : null,
    "",
    "Por fuente:",
    sourceLines || "  (sin datos)",
    "",
    "Destacadas:",
    ...top,
  ]
    .filter(Boolean)
    .join("\n");

  const tgRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-notify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "digest", message }),
  });

  const tgBody = await tgRes.json();
  return new Response(
    JSON.stringify({
      ok: tgRes.ok,
      mentions: mentions.length,
      telegram: tgBody,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
