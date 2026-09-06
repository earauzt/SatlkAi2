import { GUSCHMER_ALIASES, GUSCHMER_KEYWORD_CHIPS, GUSCHMER_NAME, GUSCHMER_TARGET_ID } from './constants';
import { avatarUrlOf, followersOf, resolveAuthor, stripHtml } from './author-display';
import { KEYWORD_THEMES, labelTema } from './rules-listening';
import { buildTrollContext, trollSignal } from './troll-heuristics';
import { getClassification } from './mention-utils';
import { assignCaso, CASO_IDS, CASO_META, isRetweet, isRulesModel, isYoutubeExact, type CasoId } from './inbox';
import { canonicalBetter, groupByReprint } from './mention-dedupe';
import type { ListeningQueryOpts, ListeningSort } from './listening-query';
import {
  buildListeningReport,
  loadListeningReportRows,
  mentionFromReportRow,
  textHasAlias,
  type ListeningReport,
  type ReportRow,
} from './listening-report';
import { listeningToReportRange } from './report-range';
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
  dedupedCount: number;
  engagementSum: number;
  uniqueAuthors: number;
  xMixPct: number;
  targetInTextPct: number;
  cards: ListeningCard[];
  report: ListeningReport;
  error: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  rss: 'RSS',
  google_news: 'Google News',
  youtube: 'YouTube',
  x: 'X',
};

const CACHE_SECONDS = 180;

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
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

function sourceMixFrom(mentions: ListeningMention[]): SourceMixItem[] {
  const sourceCounts: Record<string, number> = { rss: 0, youtube: 0, x: 0, google_news: 0 };
  for (const mention of mentions) {
    sourceCounts[mention.source] = (sourceCounts[mention.source] ?? 0) + 1;
  }
  return ['rss', 'youtube', 'x', 'google_news'].map((key) => ({
    key,
    label: SOURCE_LABELS[key] ?? key,
    count: sourceCounts[key] ?? 0,
  }));
}

export async function getGuschmerListening(opts: ListeningQueryOpts): Promise<ListeningView> {
  const range = listeningToReportRange(opts);
  const payload = await loadListeningReportRows({
    targetId: GUSCHMER_TARGET_ID,
    range,
  });
  const aliases =
    payload.aliases.length > 0 ? payload.aliases : [...GUSCHMER_ALIASES];
  const allMentions = payload.rows.map(mentionFromReportRow);
  const rowById = new Map<string, ReportRow>(payload.rows.map((row) => [row.id, row]));
  const sources = sourceMixFrom(allMentions);
  const mentions = opts.sourceFilter
    ? allMentions.filter((m) => m.source === opts.sourceFilter)
    : allMentions;

  const trollCtx = buildTrollContext(mentions);
  const groups = groupByReprint(mentions);

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
  const filteredRows: ReportRow[] = [];
  const ejeTheme = opts.ejeFilter
    ? KEYWORD_THEMES.find((theme) => theme.id === opts.ejeFilter)
    : undefined;

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
    const temas = youtube ? [] : (classification?.temas ?? []).filter((t) => t && t !== 'otro');
    if (opts.sentimentFilter === 'pos' && !(sentiment !== null && sentiment > 0)) continue;
    if (opts.sentimentFilter === 'neg' && !(sentiment !== null && sentiment < 0)) continue;
    if (opts.sentimentFilter === 'neu' && !(sentiment !== null && sentiment === 0)) continue;
    if (opts.casoFilter && caso !== opts.casoFilter) continue;
    if (opts.minUrgencia >= 2 && (youtube ? 0 : classification?.urgencia ?? 0) < opts.minUrgencia) {
      continue;
    }
    if (opts.query && !includesInsensitive(text, opts.query)) continue;
    if (opts.keywordFilter && !includesInsensitive(text, opts.keywordFilter)) continue;
    if (opts.themeFilter && !temas.includes(opts.themeFilter)) continue;
    if (ejeTheme && !ejeTheme.pattern.test(text)) continue;
    if (opts.directOnly && !textHasAlias(text, aliases)) continue;
    if (opts.authorFilter) {
      const hay = `${author.label} ${author.handle ?? ''} ${author.displayName ?? ''}`;
      if (!includesInsensitive(hay, opts.authorFilter)) continue;
    }

    const combinedReach = group.reduce((sum, m) => sum + (m.reach_score ?? 0), 0);
    const maxFollowers = group.reduce((max, m) => {
      const n = followersOf(m.author_meta) ?? 0;
      return n > max ? n : max;
    }, author.followers ?? 0);

    for (const mention of group) {
      const row = rowById.get(mention.id);
      if (row) filteredRows.push(row);
    }

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
      temas,
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

  const report = buildListeningReport({
    rows: filteredRows,
    range,
    targetId: GUSCHMER_TARGET_ID,
    targetName: payload.targetName || GUSCHMER_NAME,
    aliases,
    truncated: payload.truncated,
    fetchedAt: new Date().toISOString(),
    error: payload.error,
  });

  const topTema = [...themeMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCaso = [...CASO_IDS].sort((a, b) => casoCounts[b] - casoCounts[a])[0];
  const topTheme = topTema
    ? { label: labelTema(topTema[0]), count: topTema[1] }
    : topCaso && casoCounts[topCaso] > 0
      ? { label: CASO_META[topCaso].label, count: casoCounts[topCaso] }
      : null;

  const modelLabel =
    [...modelNames.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const lastDay = report.volume.at(-1)?.count ?? 0;
  const last7 = report.volume.slice(-7).reduce((sum, p) => sum + p.count, 0);

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
    fetchedAt: report.fetchedAt,
    cacheSeconds: CACHE_SECONDS,
    volume: { total: report.resultados, h24: lastDay, d7: last7 },
    sources,
    sentiment,
    topTheme,
    topPositiveAuthors: topAuthorsFrom(positiveAuthors),
    topNegativeAuthors: topAuthorsFrom(negativeAuthors),
    authors: [...authorCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    keywords: GUSCHMER_KEYWORD_CHIPS,
    casoCounts,
    rawCount: report.rawCount,
    dedupedCount: report.resultados,
    engagementSum: report.engagement,
    uniqueAuthors: report.uniqueAuthors,
    xMixPct: report.xMixPct,
    targetInTextPct: report.targetInTextPct,
    cards,
    report,
    error: payload.error,
  };
}
