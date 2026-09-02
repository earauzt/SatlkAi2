import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseClassification,
} from "./classify.ts";

export type MentionInput = {
  text: string;
  source: string;
  tipo_fuente: string;
  author_handle?: string | null;
};

export type TargetInput = {
  nombre: string;
  aliases: string[];
  adversarios: unknown;
};

export type Classifier = {
  id: string;
  model: string;
  classify: (mention: MentionInput, target: TargetInput) => Promise<ReturnType<typeof parseClassification>>;
};

function getEnv(name: string) {
  const v = Deno.env.get(name);
  return v && v.trim() ? v.trim() : undefined;
}

export function resolveClassifier(): Classifier | null {
  const forced = getEnv("CLASSIFY_PROVIDER")?.toLowerCase();
  if (forced === "rules" || forced === "none") return null;

  const openaiKey = getEnv("OPENAI_API_KEY");
  const anthropicKey = getEnv("ANTHROPIC_API_KEY");
  const baseUrl = (getEnv("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/$/, "");

  let provider = forced;
  if (!provider || provider === "auto") {
    if (openaiKey) provider = "openai";
    else if (anthropicKey) provider = "anthropic";
    else return null;
  }

  if (provider === "openai" || provider === "openrouter") {
    if (!openaiKey) throw new Error("OPENAI_API_KEY requerida para CLASSIFY_PROVIDER=openai");
    const model = getEnv("CLASSIFY_MODEL") ?? "gpt-4o-mini";
    return {
      id: provider,
      model,
      classify: (mention, target) =>
        classifyOpenAICompatible({ apiKey: openaiKey, baseUrl, model, mention, target }),
    };
  }

  if (provider === "anthropic") {
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY requerida para CLASSIFY_PROVIDER=anthropic");
    const model = getEnv("CLASSIFY_MODEL") ?? "claude-haiku-4-5-20251001";
    return {
      id: "anthropic",
      model,
      classify: (mention, target) =>
        classifyAnthropic({ apiKey: anthropicKey, model, mention, target }),
    };
  }

  throw new Error(`CLASSIFY_PROVIDER desconocido: ${provider}`);
}

async function classifyOpenAICompatible(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  mention: MentionInput;
  target: TargetInput;
}) {
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 512,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt({ ...opts.mention, target: opts.target }) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("Sin respuesta del modelo");
  return parseClassification(text);
}

async function classifyAnthropic(opts: {
  apiKey: string;
  model: string;
  mention: MentionInput;
  target: TargetInput;
}) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 512,
      system: [{ type: "text", text: SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: buildUserPrompt({ ...opts.mention, target: opts.target }),
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  const text = body.content?.find((c: { type: string }) => c.type === "text")?.text;
  if (!text) throw new Error("Sin respuesta del modelo");
  return parseClassification(text);
}

export function ruleBasedFallback(mention: MentionInput) {
  const t = mention.text.toLowerCase();
  const etiquetas: string[] = [];
  let sentimiento = 0;

  if (/robó|mintió|corrupto|traicion|escándalo|denuncia/.test(t)) {
    etiquetas.push("ataque_narrativo");
    sentimiento = -1;
  }
  if (/\d+%|\d+\s*(millones|mil)|según fuentes|supuestamente/.test(t)) {
    etiquetas.push("afirmacion_verificable");
  }
  if (/gracias|apoyo|adelante|vamos|excelente/.test(t)) {
    etiquetas.push("apoyo_base");
    sentimiento = 1;
  }
  if (/meme|jaja|😂|🤣/.test(t)) etiquetas.push("humor_meme");
  if (/amenaza|muerte|asesin/.test(t)) {
    etiquetas.push("amenaza_o_odio");
    sentimiento = -2;
  }

  return {
    sentimiento,
    tipo_actor: mention.tipo_fuente === "prensa" ? "medio" : "desconocido",
    temas: ["otro"],
    etiquetas,
    resumen: mention.text.slice(0, 120),
    urgencia: etiquetas.includes("amenaza_o_odio") ? 3 : sentimiento <= -1 ? 2 : 0,
    confianza: 0.45,
  };
}
