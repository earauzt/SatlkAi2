import type { Classification } from './types';

export function getClassification(
  c: Classification | Classification[] | null | undefined
): Classification | null {
  if (!c) return null;
  return Array.isArray(c) ? c[0] ?? null : c;
}

export function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export function sentimentLabel(v: number) {
  if (v <= -1) return { text: 'Crítico', className: 'bg-red-100 text-red-800' };
  if (v >= 1) return { text: 'Favorable', className: 'bg-emerald-100 text-emerald-800' };
  return { text: 'Neutro', className: 'bg-sky-100 text-sky-800' };
}

export function sentimentClientLabel(v: number) {
  if (v < 0) return { text: 'Negativo', className: 'bg-rose-100 text-rose-800' };
  if (v > 0) return { text: 'Positivo', className: 'bg-emerald-100 text-emerald-800' };
  return { text: 'Neutro', className: 'bg-slate-100 text-slate-700' };
}

export const ETIQUETA_LABELS: Record<string, { label: string; className: string }> = {
  ataque_narrativo: { label: 'Ataque', className: 'bg-red-50 text-red-700 ring-red-200' },
  afirmacion_verificable: { label: 'Verificar', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  apoyo_base: { label: 'Apoyo', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  humor_meme: { label: 'Humor', className: 'bg-zinc-100 text-zinc-700 ring-zinc-200' },
  amenaza_o_odio: { label: 'Amenaza', className: 'bg-rose-100 text-rose-900 ring-rose-300' },
  reaccion_evento: { label: 'Evento', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
  comparacion_adversario: { label: 'Adversario', className: 'bg-orange-50 text-orange-800 ring-orange-200' },
  propuesta_o_demanda: { label: 'Demanda', className: 'bg-blue-50 text-blue-800 ring-blue-200' },
};

export const SOURCE_META: Record<string, { label: string; className: string; icon: string }> = {
  google_news: { label: 'Google News', className: 'bg-blue-50 text-blue-700', icon: 'GN' },
  rss: { label: 'Prensa', className: 'bg-zinc-100 text-zinc-700', icon: 'RSS' },
  youtube: { label: 'YouTube', className: 'bg-red-50 text-red-700', icon: 'YT' },
  x: { label: 'X', className: 'bg-zinc-900 text-white', icon: 'X' },
  reddit: { label: 'Reddit', className: 'bg-orange-50 text-orange-700', icon: 'RD' },
  telegram: { label: 'Telegram', className: 'bg-sky-50 text-sky-700', icon: 'TG' },
};
