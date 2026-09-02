import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolveClassifier, ruleBasedFallback } from "./_shared/llm.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
      },
    });
  }

  const cronSecret = Deno.env.get("MONITOR_CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const isService =
    authHeader === `Bearer ${serviceKey}` ||
    (cronSecret && headerSecret === cronSecret);

  if (!isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { db: { schema: "monitor" } },
  );

  const limit = Math.min(
    Number(new URL(req.url).searchParams.get("limit") ?? "20"),
    50,
  );

  const { data: pending, error: fetchErr } = await supabase.rpc(
    "get_unclassified_mentions",
    { p_limit: limit },
  );

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let classifier;
  try {
    classifier = resolveClassifier();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const results: unknown[] = [];

  for (const row of pending ?? []) {
    try {
      const target = row.target ?? {
        nombre: "Político",
        aliases: [],
        adversarios: [],
      };

      const classified = classifier
        ? await classifier.classify(row, target)
        : ruleBasedFallback(row);

      const modelLabel = classifier ? `${classifier.id}:${classifier.model}` : "rules-v1";

      const { error: insErr } = await supabase.from("classifications").upsert(
        {
          mention_id: row.id,
          sentimiento: classified.sentimiento,
          tipo_actor: classified.tipo_actor,
          temas: classified.temas,
          etiquetas: classified.etiquetas,
          resumen: classified.resumen,
          urgencia: classified.urgencia,
          confianza: classified.confianza,
          model: modelLabel,
        },
        { onConflict: "mention_id" },
      );

      if (insErr) throw insErr;
      results.push({ mention_id: row.id, ok: true, urgencia: classified.urgencia });

      if (classified.urgencia >= 2 || classified.etiquetas.includes("amenaza_o_odio")) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-notify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "urgent_mention",
            mention_id: row.id,
            resumen: classified.resumen,
            urgencia: classified.urgencia,
            etiquetas: classified.etiquetas,
          }),
        }).catch(() => {});
      }
    } catch (e) {
      results.push({
        mention_id: row.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return new Response(
    JSON.stringify({
      processed: results.length,
      ok: results.filter((r) => (r as { ok: boolean }).ok).length,
      results,
      classifier: classifier ? { provider: classifier.id, model: classifier.model } : { provider: "rules" },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
