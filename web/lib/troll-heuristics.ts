import { resolveAuthor } from './author-display';
import { TROLL_DISCLAIMER } from './constants';
import type { ListeningMention } from './types';
import { getClassification } from './mention-utils';

export { TROLL_DISCLAIMER };

const DEFAULT_X_HANDLE = /^@?[A-Za-z][A-Za-z0-9_]*\d{6,}$/;

export function normalizeCopy(text: string): string {
  return text
    .replace(/^RT @[A-Za-z0-9_]+:\s*/i, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 180)
    .trim();
}

export type TrollSignal = {
  flagged: boolean;
  reasons: string[];
  disclaimer: typeof TROLL_DISCLAIMER;
};

/**
 * Heurística conservadora con campos reales:
 * - classifications.tipo_actor
 * - author_meta.followers (colector X)
 * - author_handle
 * - text (copia repetida)
 * - published_at (ráfaga por cuenta)
 * Nunca afirma que la cuenta sea un bot.
 */
export function trollSignal(
  mention: ListeningMention,
  ctx: {
    copyCounts: Map<string, number>;
    handleCounts24h: Map<string, number>;
  }
): TrollSignal {
  const reasons: string[] = [];
  const author = resolveAuthor(mention);
  const classification = getClassification(mention.classifications);
  const tipoActor = classification?.tipo_actor;

  if (tipoActor === 'cuenta_sospechosa') {
    reasons.push('el clasificador marcó tipo_actor = cuenta_sospechosa');
  }

  if (mention.source !== 'x') {
    return {
      flagged: reasons.length > 0,
      reasons,
      disclaimer: TROLL_DISCLAIMER,
    };
  }

  const followers = author.followers;
  const handle = mention.author_handle ?? '';

  if (followers !== null && followers >= 1000 && tipoActor !== 'cuenta_sospechosa') {
    return { flagged: false, reasons: [], disclaimer: TROLL_DISCLAIMER };
  }

  if (followers !== null && followers < 30) {
    reasons.push(`pocos seguidores en X (${followers}, campo author_meta.followers)`);
  }

  if (DEFAULT_X_HANDLE.test(handle) && (followers === null || followers < 150)) {
    reasons.push('identificador de X con muchos dígitos (cuenta de aspecto genérico)');
  }

  const copy = normalizeCopy(mention.text);
  const copyN = ctx.copyCounts.get(copy) ?? 0;
  if (copyN >= 4 && (followers === null || followers < 500)) {
    reasons.push('el mismo texto aparece en varias menciones (copia repetida)');
  }

  const burst = ctx.handleCounts24h.get(handle.toLowerCase()) ?? 0;
  if (burst >= 5) {
    reasons.push(`varias publicaciones de la misma cuenta en 24 h (${burst})`);
  }

  if (!author.known) {
    reasons.push('no hay autor identificable en author_handle');
  }

  const flagged =
    tipoActor === 'cuenta_sospechosa' ||
    (mention.source === 'x' && reasons.length >= 1 && tipoActor !== 'medio');

  // Evitar marcar solo por "autor no identificado" en X si no hay otra señal.
  const onlyUnknown = reasons.length === 1 && reasons[0].includes('no hay autor identificable');
  return {
    flagged: flagged && !onlyUnknown,
    reasons: flagged && !onlyUnknown ? reasons.filter((r) => !r.includes('no hay autor identificable')) : [],
    disclaimer: TROLL_DISCLAIMER,
  };
}

export function buildTrollContext(mentions: ListeningMention[]): {
  copyCounts: Map<string, number>;
  handleCounts24h: Map<string, number>;
} {
  const copyCounts = new Map<string, number>();
  const handleCounts24h = new Map<string, number>();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const mention of mentions) {
    const copy = normalizeCopy(mention.text);
    if (copy.length >= 40) {
      copyCounts.set(copy, (copyCounts.get(copy) ?? 0) + 1);
    }
    if (mention.source === 'x' && mention.author_handle) {
      const published = new Date(mention.published_at).getTime();
      if (published >= cutoff) {
        const key = mention.author_handle.toLowerCase();
        handleCounts24h.set(key, (handleCounts24h.get(key) ?? 0) + 1);
      }
    }
  }

  return { copyCounts, handleCounts24h };
}
