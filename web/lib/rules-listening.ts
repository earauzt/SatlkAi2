/**
 * Reglas de palabras clave alineadas con classify-batch `rules-v1`.
 * Se usan SOLO cuando no hay fila en monitor.classifications.
 * No inventan clusters de embeddings.
 */

export type SentimentBucket = 'positivo' | 'negativo' | 'neutro';

export function bucketFromSentimiento(value: number): SentimentBucket {
  if (value > 0) return 'positivo';
  if (value < 0) return 'negativo';
  return 'neutro';
}

const ATTACK =
  /robó|mintió|corrupto|traicion|escándalo|denuncia|cárcel|responsable de la crisis|adueñarse/i;
const SUPPORT = /gracias|apoyo|adelante|vamos|excelente|oficializó|inscribió/i;
const VERIFY = /\d+%|\d+\s*(millones|mil)|según fuentes|supuestamente/i;
const HUMOR = /meme|jaja|😂|🤣/i;
const THREAT = /amenaza|muerte|asesin/i;

export function rulesV1FromText(text: string): {
  sentimiento: number;
  etiquetas: string[];
  temas: string[];
} {
  const t = text.toLowerCase();
  const etiquetas: string[] = [];
  let sentimiento = 0;

  if (ATTACK.test(t)) {
    etiquetas.push('ataque_narrativo');
    sentimiento = -1;
  }
  if (VERIFY.test(t)) etiquetas.push('afirmacion_verificable');
  if (SUPPORT.test(t)) {
    etiquetas.push('apoyo_base');
    if (sentimiento === 0) sentimiento = 1;
  }
  if (HUMOR.test(t)) etiquetas.push('humor_meme');
  if (THREAT.test(t)) {
    etiquetas.push('amenaza_o_odio');
    sentimiento = -2;
  }

  return { sentimiento, etiquetas, temas: keywordThemes(t).map((x) => x.id) };
}

export const KEYWORD_THEMES: { id: string; label: string; pattern: RegExp }[] = [
  {
    id: 'barcelona_alvarez',
    label: 'Barcelona SC y los Álvarez',
    pattern: /barcelona|\bbsc\b|álvarez|alvarez/i,
  },
  {
    id: 'prefectura_guayas',
    label: 'Prefectura del Guayas',
    pattern: /prefectur|guayas/i,
  },
  {
    id: 'candidatura_adn',
    label: 'Candidatura ADN',
    pattern: /\badn\b|candidat|inscri/i,
  },
  {
    id: 'asamblea',
    label: 'Asamblea y sucesión',
    pattern: /asamble|guim|comisi[oó]n de salud|asambleísta/i,
  },
  {
    id: 'seguridad',
    label: 'Seguridad',
    pattern: /seguridad|delincuen|crimen|violencia/i,
  },
  {
    id: 'economia',
    label: 'Economía',
    pattern: /econom[ií]a|empleo|impuesto|presupuesto/i,
  },
  {
    id: 'corrupcion',
    label: 'Corrupción',
    pattern: /corrup|soborno/i,
  },
  {
    id: 'salud',
    label: 'Salud',
    pattern: /salud|hospital/i,
  },
  {
    id: 'educacion',
    label: 'Educación',
    pattern: /educaci/i,
  },
  {
    id: 'justicia',
    label: 'Justicia',
    pattern: /justicia|fiscal[ií]a|c[aá]rcel/i,
  },
  {
    id: 'entrevista',
    label: 'Entrevistas y medios',
    pattern: /entrevista|en directo|jungbluth/i,
  },
];

export const TEMA_IA_LABELS: Record<string, string> = {
  seguridad: 'Seguridad',
  economia: 'Economía',
  empleo: 'Empleo',
  salud: 'Salud',
  educacion: 'Educación',
  corrupcion: 'Corrupción',
  justicia: 'Justicia',
  relaciones_exteriores: 'Relaciones exteriores',
  gestion_obras: 'Gestión y obras',
  vida_personal: 'Vida personal',
  otro: 'Otro',
};

export function keywordThemes(text: string): { id: string; label: string }[] {
  return KEYWORD_THEMES.filter((theme) => theme.pattern.test(text)).map((theme) => ({
    id: theme.id,
    label: theme.label,
  }));
}

export function labelTema(raw: string): string {
  return TEMA_IA_LABELS[raw] ?? KEYWORD_THEMES.find((t) => t.id === raw)?.label ?? raw.replace(/_/g, ' ');
}
