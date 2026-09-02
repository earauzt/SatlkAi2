// Taxonomía y prompt para clasificación política (Ecuador)
export const CLASSIFY_VERSION = '2026-09-01';

export const SYSTEM_PROMPT = `Eres un analista de comunicación política ecuatoriano. Clasificas menciones públicas sobre una figura política.

REGLAS:
- Responde SOLO JSON válido, sin markdown.
- NO uses la etiqueta "desinformacion". Usa "afirmacion_verificable" para hechos atribuidos sin fuente.
- "humor_meme" separa sátira del sentimiento general.
- tipo_fuente viene del colector; no lo inventes.
- temas: 1-2 de [seguridad, economia, empleo, salud, educacion, corrupcion, justicia, relaciones_exteriores, gestion_obras, vida_personal, otro]
- etiquetas (0-N): ataque_narrativo, afirmacion_verificable, reaccion_evento, apoyo_base, comparacion_adversario, propuesta_o_demanda, humor_meme, amenaza_o_odio
- sentimiento: -2 hostil, -1 crítico, 0 neutro, +1 favorable, +2 militante
- tipo_actor: medio, periodista, politico, influencer, ciudadano, cuenta_sospechosa, desconocido
- urgencia 0-3 según gravedad y actor
- confianza 0-1

Glosario Ecuador: correísmo, "los mismos de siempre", trolls, cuentas bots, Asamblea, CNE, Corte Constitucional.`;

export function buildUserPrompt(mention: {
  text: string;
  source: string;
  tipo_fuente: string;
  author_handle?: string | null;
  target: { nombre: string; aliases: string[]; adversarios: unknown };
}) {
  return JSON.stringify({
    mencion: {
      text: mention.text,
      source: mention.source,
      tipo_fuente: mention.tipo_fuente,
      author_handle: mention.author_handle,
    },
    objetivo: mention.target,
    salida_requerida: {
      sentimiento: 'number -2..2',
      tipo_actor: 'string',
      temas: ['string'],
      etiquetas: ['string'],
      resumen_1_linea: 'string max 120 chars',
      urgencia: 'number 0..3',
      confianza: 'number 0..1',
    },
  });
}

export function parseClassification(raw: string) {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const data = JSON.parse(cleaned);
  const sentimiento = Number(data.sentimiento);
  if (sentimiento < -2 || sentimiento > 2) throw new Error('sentimiento inválido');
  const urgencia = Number(data.urgencia ?? 0);
  if (urgencia < 0 || urgencia > 3) throw new Error('urgencia inválida');
  const confianza = Number(data.confianza ?? 0);
  if (confianza < 0 || confianza > 1) throw new Error('confianza inválida');
  return {
    sentimiento,
    tipo_actor: String(data.tipo_actor ?? 'desconocido'),
    temas: Array.isArray(data.temas) ? data.temas.map(String) : [],
    etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas.map(String) : [],
    resumen: String(data.resumen_1_linea ?? data.resumen ?? '').slice(0, 200),
    urgencia,
    confianza,
  };
}
