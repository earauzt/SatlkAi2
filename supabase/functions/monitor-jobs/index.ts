import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const results: Record<string, unknown> = {};

  const spikeRes = await fetch(`${supabaseUrl}/rest/v1/rpc/monitor_check_volume_spike`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      apikey: serviceKey,
    },
    body: "{}",
  });
  results.spike = await spikeRes.json();

  const spike = results.spike as { spike?: boolean; count_1h?: number };
  if (spike?.spike) {
    await fetch(`${supabaseUrl}/functions/v1/telegram-notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "pico_volumen",
        message: `Última hora: ${spike.count_1h} menciones (umbral superado)`,
      }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
