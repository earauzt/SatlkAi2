import { followersOf } from './author-display';
import { isRetweet, reprintKey } from './inbox';
import type { ListeningMention } from './types';

/** Misma clave de agrupación que el inbox (texto canónico o simhash). */
export function groupByReprint(mentions: ListeningMention[]): Map<string, ListeningMention[]> {
  const groups = new Map<string, ListeningMention[]>();
  for (const mention of mentions) {
    const key = reprintKey(mention.text, mention.simhash);
    const list = groups.get(key);
    if (list) list.push(mention);
    else groups.set(key, [mention]);
  }
  return groups;
}

/** Elige el representante del hilo: original > seguidores > reach > más antiguo. */
export function pickCanonical(group: ListeningMention[]): ListeningMention {
  return group.reduce((best, cur) => (canonicalBetter(cur, best) ? cur : best));
}

export function canonicalBetter(a: ListeningMention, b: ListeningMention): boolean {
  const aOrig = !isRetweet(a.text);
  const bOrig = !isRetweet(b.text);
  if (aOrig !== bOrig) return aOrig;
  const af = followersOf(a.author_meta) ?? 0;
  const bf = followersOf(b.author_meta) ?? 0;
  if (af !== bf) return af > bf;
  if (a.reach_score !== b.reach_score) return a.reach_score > b.reach_score;
  return new Date(a.published_at).getTime() < new Date(b.published_at).getTime();
}

export function combinedReachOf(group: ListeningMention[]): number {
  return group.reduce((sum, m) => sum + (m.reach_score ?? 0), 0);
}
