import { unstable_cache } from 'next/cache';
import { GUSCHMER_ALIASES, GUSCHMER_KEYWORD_CHIPS, GUSCHMER_NAME, GUSCHMER_TARGET_ID } from './constants';
import { avatarUrlOf, followersOf, resolveAuthor, stripHtml } from './author-display';
import { labelTema } from './rules-listening';
import { buildTrollContext, trollSignal } from './troll-heuristics';
import { getClassification } from './mention-utils';
import { assignCaso, CASO_IDS, CASO_META, isRetweet, isRulesModel, isYoutubeExact, reprintKey, type CasoId } from './inbox';
import { createAnonClient } from './supabase/anon';
import type { ListeningQueryOpts, ListeningSort } from './listening-query';
import type { ListeningMention } from './types';

export type SourceMixItem = {
  key: string;
  label: string;
  count: number;
};

export type SentimentSplit = {
  positivo: { count: number; pct: number };
  negativo: { count: number; pct: number };
  neutro: { count: number; pct: number };
  classified: number;
  unclassified: number;
  skippedYoutube: number;
  fromRules: number;
  fromModel: number;
  modelLabel: string | null;
  total: number;
};

export type TopAuthor = {
  label: string;
  handle: string | null;
  count: number;
};

export type ListeningCard = {
  mention: ListeningMention;
  authorLabel: string;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorKnown: boolean;
  avatarUrl: string | null;
  followers: number | null;
  sentiment: number | null;
  sentimentOrigin: 'clasificacion' | 'omitido_youtube' | 'sin_clasificar';
  caso: CasoId;
  etiquetas: string[];
  temas: string[];
  resumen: string | null;
  urgencia: number;
  model: string | null;
  rulesOnly: boolean;
  flagged: boolean;
  trollReasons: string[];
  isOriginal: boolean;
  reprintCount: number;
  combinedReach: number;
  highlightTerms: string[];
};

export type ListeningView = ListeningQueryOpts & {
  targetName: typeof GUSCHMER_NAME;
  fetchedAt: string;
  cacheSeconds: number;
  volume: { h24: number; d7: number; total: number };
  sources: SourceMixItem[];
  sentiment: SentimentSplit;
  topTheme: { label: string; count: number } | null;
  topPositiveAuthors: TopAuthor[];
  topNegativeAuthors: TopAuthor[];
  authors: { handle: string; label: string; count: number }[];
  keywords: readonly string[];
  casoCounts: Record<CasoId, number>;
  rawCount: number;
  cards: ListeningCard[];
  error: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  rss: 'RSS',
  google_news: 'Google News',
  youtube: 'YouTube',
  x: 'X',
};

const CACHE_SECONDS = 300;

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function asMention(row: Record<string, unknown>): ListeningMention {
  return {
    id: String(row.id),
    text: String(row.text ?? ''),
    url: (row.url as string | null) ?? null,
    author_handle: (row.author_handle as string | null) ?? null,
    author_meta: (row.author_meta as ListeningMention['author_meta']) ?? {},
    source: String(row.source ?? ''),
    published_at: String(row.published_at),
    reach_score: Number(row.reach_score ?? 0),
    tipo_fuente: String(row.tipo_fuente ?? 'desconocido'),
    simhash: (row.simhash as number | null) ?? null,
    classifications: (row.classifications as ListeningMention['classifications']) ?? null,
  };
}

function canonicalBetter(a: ListeningMention, b: ListeningMention): boolean {
  const aOrig = !isRetweet(a.text);
  const bOrig = !isRetweet(b.text);
  if (aOrig !== bOrig) return aOrig;
  const af = followersOf(a.author_meta) ?? 0;
  const bf = followersOf(b.author_meta) ?? 0;
  if (af !== bf) return af > bf;
  if (a.reach_score !== b.reach_score) return a.reach_score > b.reach_score;
  return new Date(a.published_at).getTime() < new Date(b.published_at).getTime();
}

function rankScore(card: ListeningCard): number {
  let score = 0;
  if (card.isOriginal) score += 1_000_000;
  if (card.sentiment !== null && card.sentiment < 0) {
    score += (2 - card.sentiment) * 50_000;
  }
  score += card.urgencia * 8_000;
  score += Math.min(card.followers ?? 0, 400_000);
  score += card.combinedReach * 40;
  score += Math.min(card.reprintCount, 50) * 20;
  return score;
}

function dayBound(day: string, end: boolean): string {
  return new Date(`${day}T${end ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString();
}

function resolveRange(opts: ListeningQueryOpts): { start: string; end: string | null } {
  if (opts.dateFrom || opts.dateTo) {
    const start = opts.dateFrom ? dayBound(opts.dateFrom, false) : hoursAgo(24 * 90);
    const end = opts.dateTo ? dayBound(opts.dateTo, true) : new Date().toISOString();
    return { start, end };
  }
  if (opts.window === '24h') return { start: hoursAgo(24), end: null };
  return { start: hoursAgo(24 * 7), end: null };
}

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase('es').includes(needle.toLocaleLowerCase('es'));
}

function topAuthorsFrom(
  rows: { label: string; handle: string | null }[],
  limit = 3
): TopAuthor[] {
  const map = new Map<string, TopAuthor>();
  for (const row of rows) {
    const key = (row.handle || row.label).toLocaleLowerCase('es');
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { label: row.label, handle: row.handle, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

function sortCards(cards: ListeningCard[], sort: ListeningSort) {
  cards.sort((a, b) => {
    if (sort === 'tiempo') {
      return new Date(b.mention.published_at).getTime() - new Date(a.mention.published_at).getTime();
    }
    if (sort === 'urgencia') {
      const u = b.urgencia - a.urgencia;
      if (u !== 0) return u;
      return new Date(b.mention.published_at).getTime() - new Date(a.mention.published_at).getTime();
    }
    if (sort === 'engagement') {
      const reach = b.combinedReach - a.combinedReach;
      if (reach !== 0) return reach;
      return (b.followers ?? 0) - (a.followers ?? 0);
    }
    const diff = rankScore(b) - rankScore(a);
    if (diff !== 0) return diff;
    return new Date(b.mention.published_at).getTime() - new Date(a.mention.published_at).getTime();
  });
}

type WindowPayload = {
  mentions: ListeningMention[];
  volume: { h24: number; d7: number; total: number };
  sources: SourceMixItem[];
  fetchedAt: string;
  error: string | null;
};

async function fetchGuschmerWindow(rangeStart: string, rangeEnd: string): Promise<WindowPayload> {
  const supabase = createAnonClient();
  const end = rangeEnd || null;

  const countQuery = (since?: string) => {
    let q = supabase
      .schema('monitor')
      .from('mentions')
      .select('id', { count: 'exact', head: true })
      .eq('target_id', GUSCHMER_TARGET_ID);
    if (since) q = q.gt('published_at', since);
    return q;
  };

  let mentionQuery = supabase
    .schema('monitor')
    .from('mentions')
    .select(
      `id, text, url, author_handle, author_meta, source, published_at, reach_score, tipo_fuente, simhash,
       classifications (sentimiento, etiquetas, resumen, urgencia, confianza, temas, tipo_actor, model)`
    )
    .eq('target_id', GUSCHMER_TARGET_ID)
    .gt('published_at', rangeStart)
    .order('published_at', { ascending: false })
    .limit(400);
  if (end) mentionQuery = mentionQuery.lte('published_at', end);

  const [totalRes, h24Res, d7Res, sourceRes, mentionRes] = await Promise.all([
    countQuery(),
    countQuery(hoursAgo(24)),
    countQuery(hoursAgo(24 * 7)),
    (() => {
      let q = supabase
        .schema('monitor')
        .from('mentions')
        .select('source')
        .eq('target_id', GUSCHMER_TARGET_ID)
        .gt('published_at', rangeStart);
      if (end) q = q.lte('published_at', end);
      return q;
    })(),
    mentionQuery,
  ]);

  const error =
    mentionRes.error?.message ||
    totalRes.error?.message ||
    h24Res.error?.message ||
    d7Res.error?.message ||
    sourceRes.error?.message ||
    null;

  const sourceRows = (sourceRes.data ?? []) as { source: string }[];
  const sourceCounts: Record<string, number> = { rss: 0, youtube: 0, x: 0, google_news: 0 };
  for (const row of sourceRows) {
    sourceCounts[row.source] = (sourceCounts[row.source] ?? 0) + 1;
  }
  const sources: SourceMixItem[] = ['rss', 'youtube', 'x', 'google_news'].map((key) => ({
    key,
    label: SOURCE_LABELS[key] ?? key,
    count: sourceCounts[key] ?? 0,
  }));

  return {
    mentions: ((mentionRes.data ?? []) as Record<string, unknown>[]).map(asMention),
    volume: {
      total: totalRes.count ?? 0,
      h24: h24Res.count ?? 0,
      d7: d7Res.count ?? 0,
    },
    sources,
    fetchedAt: new Date().toISOString(),
    error,
  };
}

const fetchGuschmerWindowCached = unstable_cache(
  async (rangeStart: string, rangeEnd: string) => fetchGuschmerWindow(rangeStart, rangeEnd),
  ['guschmer-window-v1'],
  { revalidate: CACHE_SECONDS }
);

export async function getGuschmerListening(opts: ListeningQueryOpts): Promise<ListeningView> {
  const { start, end } = resolveRange(opts);
  const payload = await fetchGuschmerWindowCached(start, end ?? '');
  const mentions = opts.sourceFilter
    ? payload.mentions.filter((m) => m.source === opts.sourceFilter)
    : payload.mentions;

  const trollCtx = buildTrollContext(mentions);
  const groups = new Map<string, ListeningMention[]>();
  for (const mention of mentions) {
    const key = reprintKey(mention.text, mention.simhash);
    const list = groups.get(key);
    if (list) list.push(mention);
    else groups.set(key, [mention]);
  }

  let pos = 0;
  let neg = 0;
  let neu = 0;
  let classified = 0;
  let unclassified = 0;
  let skippedYoutube = 0;
  let fromRules = 0;
  let fromModel = 0;
  const modelNames = new Map<string, number>();
  const themeMap = new Map<string, number>();
  const casoCounts = Object.fromEntries(CASO_IDS.map((id) => [id, 0])) as Record<CasoId, number>;
  const positiveAuthors: { label: string; handle: string | null }[] = [];
  const negativeAuthors: { label: string; handle: string | null }[] = [];
  const authorCounts = new Map<string, { handle: string; label: string; count: number }>();

  const highlightTerms = [
    ...GUSCHMER_ALIASES,
    ...(opts.keywordFilter ? [opts.keywordFilter] : []),
  ];

  const cards: ListeningCard[] = [];

  for (const group of groups.values()) {
    const canonical = group.reduce((best, cur) => (canonicalBetter(cur, best) ? cur : best));
    const classification = getClassification(canonical.classifications);
    const youtube = isYoutubeExact(canonical.source);
    const author = resolveAuthor(canonical);
    const signal = trollSignal(canonical, trollCtx);
    const caso = assignCaso(canonical, youtube ? null : classification);

    let sentiment: number | null = null;
    let sentimentOrigin: ListeningCard['sentimentOrigin'] = 'sin_clasificar';
    if (youtube) {
      skippedYoutube += 1;
      sentimentOrigin = 'omitido_youtube';
    } else if (classification) {
      sentiment = classification.sentimiento;
      sentimentOrigin = 'clasificacion';
      classified += 1;
      if (sentiment > 0) {
        pos += 1;
        if (author.known) positiveAuthors.push({ label: author.label, handle: author.handle });
      } else if (sentiment < 0) {
        neg += 1;
        if (author.known) negativeAuthors.push({ label: author.label, handle: author.handle });
      } else {
        neu += 1;
      }
      const model = classification.model ?? '';
      if (isRulesModel(model)) fromRules += 1;
      else fromModel += 1;
      if (model) modelNames.set(model, (modelNames.get(model) ?? 0) + 1);
      for (const tema of classification.temas ?? []) {
        if (tema && tema !== 'otro') {
          themeMap.set(tema, (themeMap.get(tema) ?? 0) + 1);
        }
      }
    } else {
      unclassified += 1;
    }

    casoCounts[caso] += 1;

    if (author.known && author.handle) {
      const key = author.handle.toLocaleLowerCase('es');
      const prev = authorCounts.get(key);
      if (prev) prev.count += 1;
      else authorCounts.set(key, { handle: author.handle, label: author.label, count: 1 });
    }

    const text = stripHtml(canonical.text);
    if (opts.sentimentFilter === 'pos' && !(sentiment !== null && sentiment > 0)) continue;
    if (opts.sentimentFilter === 'neg' && !(sentiment !== null && sentiment < 0)) continue;
    if (opts.sentimentFilter === 'neu' && !(sentiment !== null && sentiment === 0)) continue;
    if (opts.casoFilter && caso !== opts.casoFilter) continue;
    if (opts.minUrgencia >= 2 && (youtube ? 0 : classification?.urgencia ?? 0) < opts.minUrgencia) {
      continue;
    }
    if (opts.query && !includesInsensitive(text, opts.query)) continue;
    if (opts.keywordFilter && !includesInsensitive(text, opts.keywordFilter)) continue;
    if (opts.authorFilter) {
      const hay = `${author.label} ${author.handle ?? ''} ${author.displayName ?? ''}`;
      if (!includesInsensitive(hay, opts.authorFilter)) continue;
    }

    const combinedReach = group.reduce((sum, m) => sum + (m.reach_score ?? 0), 0);
    const maxFollowers = group.reduce((max, m) => {
      const n = followersOf(m.author_meta) ?? 0;
      return n > max ? n : max;
    }, author.followers ?? 0);

    cards.push({
      mention: { ...canonical, text },
      authorLabel: author.label,
      authorHandle: author.handle,
      authorDisplayName: author.displayName,
      authorKnown: author.known,
      avatarUrl: avatarUrlOf(canonical.author_meta),
      followers: maxFollowers || author.followers,
      sentiment,
      sentimentOrigin,
      caso,
      etiquetas: youtube ? [] : classification?.etiquetas ?? [],
      temas: youtube ? [] : (classification?.temas ?? []).filter((t) => t && t !== 'otro'),
      resumen: youtube ? null : classification?.resumen ?? null,
      urgencia: youtube ? 0 : classification?.urgencia ?? 0,
      model: classification?.model ?? null,
      rulesOnly: isRulesModel(classification?.model),
      flagged: signal.flagged,
      trollReasons: signal.reasons,
      isOriginal: !isRetweet(canonical.text),
      reprintCount: group.length,
      combinedReach,
      highlightTerms,
    });
  }

  sortCards(cards, opts.sort);

  const topTema = [...themeMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCaso = [...CASO_IDS].sort((a, b) => casoCounts[b] - casoCounts[a])[0];
  const topTheme = topTema
    ? { label: labelTema(topTema[0]), count: topTema[1] }
    : topCaso && casoCounts[topCaso] > 0
      ? { label: CASO_META[topCaso].label, count: casoCounts[topCaso] }
      : null;

  const modelLabel =
    [...modelNames.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const sentiment: SentimentSplit = {
    positivo: { count: pos, pct: pct(pos, classified) },
    negativo: { count: neg, pct: pct(neg, classified) },
    neutro: { count: neu, pct: pct(neu, classified) },
    classified,
    unclassified,
    skippedYoutube,
    fromRules,
    fromModel,
    modelLabel,
    total: mentions.length,
  };

  return {
    ...opts,
    targetName: GUSCHMER_NAME,
    fetchedAt: payload.fetchedAt,
    cacheSeconds: CACHE_SECONDS,
    volume: payload.volume,
    sources: payload.sources,
    sentiment,
    topTheme,
    topPositiveAuthors: topAuthorsFrom(positiveAuthors),
    topNegativeAuthors: topAuthorsFrom(negativeAuthors),
    authors: [...authorCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    keywords: GUSCHMER_KEYWORD_CHIPS,
    casoCounts,
    rawCount: mentions.length,
    cards,
    error: payload.error,
  };
}
