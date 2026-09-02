import { createClient } from '@/lib/supabase/server';
import { GUSCHMER_NAME, GUSCHMER_TARGET_ID } from './constants';
import { resolveAuthor, stripHtml } from './author-display';
import {
  bucketFromSentimiento,
  keywordThemes,
  labelTema,
  rulesV1FromText,
} from './rules-listening';
import { buildTrollContext, trollSignal } from './troll-heuristics';
import { getClassification } from './mention-utils';
import type { ListeningMention, ListeningWindow } from './types';

export type SourceMixItem = {
  key: string;
  label: string;
  count: number;
};

export type SentimentSplit = {
  positivo: { count: number; pct: number };
  negativo: { count: number; pct: number };
  neutro: { count: number; pct: number };
  fromDb: number;
  fromRules: number;
  total: number;
};

export type ThemeItem = {
  key: string;
  label: string;
  count: number;
  origin: 'clasificacion' | 'etiqueta' | 'keyword' | 'narrativa';
};

export type AuthorItem = {
  key: string;
  label: string;
  known: boolean;
  kind: string;
  count: number;
  source: string;
  followers: number | null;
  flagged: boolean;
};

export type ListeningCard = {
  mention: ListeningMention;
  authorLabel: string;
  authorKnown: boolean;
  sentiment: number;
  sentimentOrigin: 'clasificacion' | 'reglas';
  themes: string[];
  flagged: boolean;
  trollReasons: string[];
};

export type ListeningView = {
  targetName: typeof GUSCHMER_NAME;
  window: ListeningWindow;
  sourceFilter: string;
  query: string;
  fetchedAt: string;
  volume: { h24: number; d7: number; total: number };
  sources: SourceMixItem[];
  sentiment: SentimentSplit;
  themes: ThemeItem[];
  authors: AuthorItem[];
  cards: ListeningCard[];
  semanticCount: number;
  error: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  rss: 'RSS',
  google_news: 'Google News',
  youtube: 'YouTube',
  x: 'X',
};

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

export async function getGuschmerListening(opts: {
  window: ListeningWindow;
  source?: string;
  q?: string;
}): Promise<ListeningView> {
  const supabase = await createClient();
  const window = opts.window;
  const sourceFilter = opts.source ?? '';
  const query = opts.q?.trim() ?? '';
  const windowStart = window === '24h' ? hoursAgo(24) : hoursAgo(24 * 7);

  const countQuery = (since?: string) => {
    let q = supabase
      .schema('monitor')
      .from('mentions')
      .select('id', { count: 'exact', head: true })
      .eq('target_id', GUSCHMER_TARGET_ID);
    if (since) q = q.gt('published_at', since);
    return q;
  };

  const [totalRes, h24Res, d7Res, sourceRes, semanticRes, mentionRes] =
    await Promise.all([
      countQuery(),
      countQuery(hoursAgo(24)),
      countQuery(hoursAgo(24 * 7)),
      supabase
        .schema('monitor')
        .from('mentions')
        .select('source')
        .eq('target_id', GUSCHMER_TARGET_ID)
        .gt('published_at', windowStart),
      supabase.rpc('monitor_list_semantic_narratives', {
        p_limit: 15,
        p_target_id: GUSCHMER_TARGET_ID,
      }),
      (async () => {
        let q = supabase
          .schema('monitor')
          .from('mentions')
          .select(
            `id, text, url, author_handle, author_meta, source, published_at, reach_score, tipo_fuente, simhash,
             classifications (sentimiento, etiquetas, resumen, urgencia, confianza, temas, tipo_actor)`
          )
          .eq('target_id', GUSCHMER_TARGET_ID)
          .gt('published_at', windowStart)
          .order('published_at', { ascending: false })
          .limit(250);
        if (sourceFilter) q = q.eq('source', sourceFilter);
        if (query) q = q.ilike('text', `%${query}%`);
        return q;
      })(),
    ]);

  const error =
    mentionRes.error?.message ||
    totalRes.error?.message ||
    h24Res.error?.message ||
    d7Res.error?.message ||
    null;

  const volume = {
    total: totalRes.count ?? 0,
    h24: h24Res.count ?? 0,
    d7: d7Res.count ?? 0,
  };

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

  const mentions = ((mentionRes.data ?? []) as Record<string, unknown>[]).map(asMention);
  const trollCtx = buildTrollContext(mentions);

  let pos = 0;
  let neg = 0;
  let neu = 0;
  let fromDb = 0;
  let fromRules = 0;

  const themeMap = new Map<string, ThemeItem>();
  const bumpTheme = (key: string, label: string, origin: ThemeItem['origin']) => {
    const prev = themeMap.get(key);
    if (prev) prev.count += 1;
    else themeMap.set(key, { key, label, count: 1, origin });
  };

  const semantic = (semanticRes.data ?? []) as { id: string; label: string; mention_count: number }[];
  for (const item of semantic) {
    if (item.label) {
      themeMap.set(`sem:${item.id}`, {
        key: `sem:${item.id}`,
        label: item.label,
        count: Number(item.mention_count ?? 0),
        origin: 'narrativa',
      });
    }
  }

  const authorMap = new Map<string, AuthorItem>();
  const cards: ListeningCard[] = mentions.map((mention) => {
    const classification = getClassification(mention.classifications);
    const rules = rulesV1FromText(mention.text);
    const sentimentOrigin: 'clasificacion' | 'reglas' = classification ? 'clasificacion' : 'reglas';
    const sentiment = classification ? classification.sentimiento : rules.sentimiento;
    if (sentimentOrigin === 'clasificacion') fromDb += 1;
    else fromRules += 1;
    const bucket = bucketFromSentimiento(sentiment);
    if (bucket === 'positivo') pos += 1;
    else if (bucket === 'negativo') neg += 1;
    else neu += 1;

    const themes: string[] = [];
    if (classification?.temas?.length) {
      for (const tema of classification.temas) {
        themes.push(labelTema(tema));
        bumpTheme(`tema:${tema}`, labelTema(tema), 'clasificacion');
      }
    } else {
      for (const tema of keywordThemes(mention.text)) {
        themes.push(tema.label);
        bumpTheme(`kw:${tema.id}`, tema.label, 'keyword');
      }
    }
    if (classification?.etiquetas?.length) {
      for (const tag of classification.etiquetas) {
        bumpTheme(`et:${tag}`, labelTema(tag), 'etiqueta');
      }
    } else {
      for (const tag of rules.etiquetas) {
        bumpTheme(`et:${tag}`, labelTema(tag), 'etiqueta');
      }
    }

    const author = resolveAuthor(mention);
    const signal = trollSignal(mention, trollCtx);
    const authorKey = `${mention.source}:${author.label}`;
    const prev = authorMap.get(authorKey);
    if (prev) {
      prev.count += 1;
      prev.flagged = prev.flagged || signal.flagged;
    } else {
      authorMap.set(authorKey, {
        key: authorKey,
        label: author.label,
        known: author.known,
        kind: author.kind,
        count: 1,
        source: mention.source,
        followers: author.followers,
        flagged: signal.flagged,
      });
    }

    return {
      mention: { ...mention, text: stripHtml(mention.text) },
      authorLabel: author.label,
      authorKnown: author.known,
      sentiment,
      sentimentOrigin,
      themes,
      flagged: signal.flagged,
      trollReasons: signal.reasons,
    };
  });

  const n = mentions.length;
  const sentiment: SentimentSplit = {
    positivo: { count: pos, pct: pct(pos, n) },
    negativo: { count: neg, pct: pct(neg, n) },
    neutro: { count: neu, pct: pct(neu, n) },
    fromDb,
    fromRules,
    total: n,
  };

  const themes = [...themeMap.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  const authors = [...authorMap.values()].sort((a, b) => b.count - a.count).slice(0, 12);

  return {
    targetName: GUSCHMER_NAME,
    window,
    sourceFilter,
    query,
    fetchedAt: new Date().toISOString(),
    volume,
    sources,
    sentiment,
    themes,
    authors,
    cards,
    semanticCount: semantic.length,
    error,
  };
}
