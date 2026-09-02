import { getClassification } from './mention-utils';
import { stripHtml } from './author-display';
import type { Classification, ListeningMention } from './types';

export const CASO_IDS = [
  'ataque',
  'rumor',
  'elogio',
  'territorio',
  'deporte',
  'ruido',
] as const;

export type CasoId = (typeof CASO_IDS)[number];

export const CASO_META: Record<
  CasoId,
  { label: string; className: string }
> = {
  ataque: { label: 'Ataque', className: 'bg-rose-100 text-rose-800' },
  rumor: { label: 'Rumor', className: 'bg-amber-100 text-amber-900' },
  elogio: { label: 'Elogio', className: 'bg-emerald-100 text-emerald-800' },
  territorio: { label: 'Territorio', className: 'bg-violet-100 text-violet-800' },
  deporte: { label: 'Deporte / BSC', className: 'bg-yellow-100 text-yellow-900' },
  ruido: { label: 'Ruido', className: 'bg-zinc-100 text-zinc-700' },
};

const TERRITORIO =
  /prefectur|guayas|asamble|guim|\badn\b|candidat|inscri|cne|alcald/i;
const DEPORTE = /barcelona|\bbsc\b|álvarez|alvarez|studiofutbol|directfutbol/i;

export function isRetweet(text: string): boolean {
  return /^RT\s+@/i.test(stripHtml(text).trim());
}

export function reprintKey(text: string, simhash?: number | null): string {
  const body = stripHtml(text)
    .replace(/^RT\s+@[A-Za-z0-9_]+:\s*/i, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  if (body.length >= 24) return `t:${body}`;
  if (simhash != null && Number(simhash) !== 0) return `h:${simhash}`;
  return `t:${body || 'empty'}`;
}

export function isYoutubeExact(source: string): boolean {
  return source === 'youtube';
}

export function isRulesModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return /rules/i.test(model);
}

/**
 * Caso de inbox (equivalente político de complaint / misinfo / testimonial).
 * Prioriza etiquetas reales de classifications. Territorio y deporte se
 * enrutan por el texto (no se muestran como chips de IA).
 * YouTube: solo enrutado por texto, sin tono derivado.
 */
export function assignCaso(
  mention: ListeningMention,
  classification: Classification | null
): CasoId {
  const text = stripHtml(mention.text);
  const youtube = isYoutubeExact(mention.source);
  const tags = classification?.etiquetas ?? [];

  if (!youtube) {
    if (tags.includes('amenaza_o_odio') || tags.includes('ataque_narrativo')) {
      return 'ataque';
    }
    if (tags.includes('afirmacion_verificable')) return 'rumor';
    if (tags.includes('apoyo_base')) return 'elogio';
  }

  if (TERRITORIO.test(text)) return 'territorio';
  if (DEPORTE.test(text)) return 'deporte';

  if (!youtube && classification) {
    if (classification.sentimiento < 0) return 'ataque';
    if (classification.sentimiento > 0) return 'elogio';
  }

  if (tags.includes('humor_meme')) return 'ruido';
  return 'ruido';
}

export function classifyMention(mention: ListeningMention): Classification | null {
  return getClassification(mention.classifications);
}
