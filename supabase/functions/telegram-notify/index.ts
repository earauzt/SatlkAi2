import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!token || !chatId) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const body = await req.json().catch(() => ({}));
  let text = "";

  if (body.type === "urgent_mention") {
    text = `🚨 Urgencia ${body.urgencia}/3\n${body.resumen}\nEtiquetas: ${(body.etiquetas ?? []).join(", ")}`;
  } else if (body.type === "digest") {
    text = body.message ?? "Digest monitor político";
  } else if (body.type === "pico_volumen") {
    text = `📈 Pico de volumen detectado\n${body.message}`;
  } else {
    text = body.message ?? "Alerta monitor político";
  }

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  const tgBody = await tgRes.json();
  return new Response(JSON.stringify({ ok: tgRes.ok, telegram: tgBody }), {
    headers: { "Content-Type": "application/json" },
  });
});
