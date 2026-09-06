import { unstable_cache } from 'next/cache';
import { avatarUrlOf, followersOf, resolveAuthor, stripHtml } from './author-display';
import { GUSCHMER_ALIASES, GUSCHMER_TARGET_ID } from './constants';
import { isRulesModel, isYoutubeExact } from './inbox';
import { combinedReachOf, groupByReprint, pickCanonical } from './mention-dedupe';
import { getClassification } from './mention-utils';
import { KEYWORD_THEMES, labelTema } from './rules-listening';
import { createAnonClient } from './supabase/anon';
import type { ListeningMention } from './types';
import { eachDay, formatPeriodLabel, type ReportRange } from './report-range';

export type Availability = 'live' | 'nd';

export type ReportKpi = {
  key: string;
  label: string;
  value: string;
  hint: string;
  field: string;
  status: Availability;
};

export type SentimentMix = {
  negativo: { count: number; pct: number };
  neutro: { count: number; pct: number };
  positivo: { count: number; pct: number };
  classified: number;
  skippedYoutube: number;
  unclassified: number;
  fromRules: number;
  fromModel: number;
  modelLabel: string | null;
  n: number;
};

export type ThemeShare = {
  id: string;
  label: string;
  count: number;
  pct: number;
  field: string;
};

export type AuthorRow = {
  handle: string | null;
  label: string;
  count: number;
  engagement: number;
  followers: number | null;
  avatarUrl: string | null;
};

export type VolumePoint = {
  day: string;
  count: number;
};

export type NarrativeBullet = {
  id: string;
  title: string;
  body: string;
};

export type FieldNote = {
  metric: string;
  field: string;
  status: Availability;
  note: string;
};

export type ListeningReport = {
  targetId: string | null;
  targetName: string;
  aliases: string[];
  range: ReportRange;
  periodLabel: string;
  corteAt: string;
  fetchedAt: string;
  truncated: boolean;
  rawCount: number;
  resultados: number;
  engagement: number;
  uniqueAuthors: number;
  xMixPct: number;
  xCount: number;
  targetInTextPct: number;
  directCount: number;
  kpis: ReportKpi[];
  volume: VolumePoint[];
  sentimentAll: SentimentMix;
  sentimentDirect: SentimentMix;
  themes: ThemeShare[];
  keywordThemes: ThemeShare[];
  authorsPresence: AuthorRow[];
  authorsEngagement: AuthorRow[];
  formats: {
    videoPct: number | null;
    videoCount: number;
    imagePct: number | null;
    imageCount: number;
    unknownCount: number;
    note: string;
  };
  demographics: { gender: null; age: null; note: string };
  geo: { note: string };
  hallazgo: string;
  narrative: NarrativeBullet[];
  fields: FieldNote[];
  error: string | null;
};

type ReportRow = {
  id: string;
  text: string;
  url: string | null;
  author_handle: string | null;
  author_meta: ListeningMention['author_meta'];
  source: string;
  published_at: string;
  reach_score: number;
  tipo_fuente: string;
  simhash: number | null;
  target_nombre: string | null;
  target_aliases: string[] | null;
  sentimiento: number | null;
  temas: string[] | null;
  etiquetas: string[] | null;
  resumen: string | null;
  urgencia: number | null;
  model: string | null;
  tipo_actor: string | null;
};

const CACHE_SECONDS = 180;
const ROW_LIMIT = 2000;

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString('es-EC', { maximumFractionDigits: 1 })}M`;
  }
  if (Math.abs(n) >= 10_000) {
    return `${(n / 1000).toLocaleString('es-EC', { maximumFractionDigits: 1 })}K`;
  }
  return n.toLocaleString('es-EC');
}

export function formatPct(n: number): string {
  return `${n.toLocaleString('es-EC', { maximumFractionDigits: 1 })}%`;
}

function emptySentiment(n: number): SentimentMix {
  return {
    negativo: { count: 0, pct: 0 },
    neutro: { count: 0, pct: 0 },
    positivo: { count: 0, pct: 0 },
    classified: 0,
    skippedYoutube: 0,
    unclassified: 0,
    fromRules: 0,
    fromModel: 0,
    modelLabel: null,
    n,
  };
}

function mixSentiment(
  items: { youtube: boolean; sentimiento: number | null; model: string | null }[]
): SentimentMix {
  const mix = emptySentiment(items.length);
  const models = new Map<string, number>();
  for (const item of items) {
    if (item.youtube) {
      mix.skippedYoutube += 1;
      continue;
    }
    if (item.sentimiento === null) {
      mix.unclassified += 1;
      continue;
    }
    mix.classified += 1;
    if (item.sentimiento < 0) mix.negativo.count += 1;
    else if (item.sentimiento > 0) mix.positivo.count += 1;
    else mix.neutro.count += 1;
    if (isRulesModel(item.model)) mix.fromRules += 1;
    else if (item.model) {
      mix.fromModel += 1;
      models.set(item.model, (models.get(item.model) ?? 0) + 1);
    }
  }
  mix.negativo.pct = pct(mix.negativo.count, mix.classified);
  mix.neutro.pct = pct(mix.neutro.count, mix.classified);
  mix.positivo.pct = pct(mix.positivo.count, mix.classified);
  mix.modelLabel = [...models.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return mix;
}

function textHasAlias(text: string, aliases: string[]): boolean {
  const hay = stripHtml(text).toLocaleLowerCase('es');
  return aliases.some((alias) => alias && hay.includes(alias.toLocaleLowerCase('es')));
}

function asMention(row: ReportRow): ListeningMention {
  const classification =
    row.sentimiento === null && !row.temas && !row.etiquetas && !row.model
      ? null
      : {
          sentimiento: row.sentimiento ?? 0,
          etiquetas: row.etiquetas ?? [],
          resumen: row.resumen,
          urgencia: row.urgencia ?? 0,
          confianza: 0,
          temas: row.temas ?? [],
          tipo_actor: row.tipo_actor ?? undefined,
          model: row.model ?? undefined,
        };
  return {
    id: row.id,
    text: row.text ?? '',
    url: row.url,
    author_handle: row.author_handle,
    author_meta: row.author_meta ?? {},
    source: row.source,
    published_at: row.published_at,
    reach_score: Number(row.reach_score ?? 0),
    tipo_fuente: row.tipo_fuente ?? 'desconocido',
    simhash: row.simhash,
    classifications: classification,
  };
}

function dayInGuayaquil(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function buildListeningReport(opts: {
  rows: ReportRow[];
  range: ReportRange;
  targetId: string | null;
  targetName: string;
  aliases: string[];
  truncated: boolean;
  fetchedAt: string;
  error: string | null;
}): ListeningReport {
  const mentions = opts.rows.map(asMention);
  const aliasById = new Map<string, string[]>();
  for (const row of opts.rows) {
    const list = [...(row.target_aliases ?? [])];
    if (row.target_nombre && !list.includes(row.target_nombre)) list.push(row.target_nombre);
    aliasById.set(row.id, list.filter(Boolean));
  }
  const groups = groupByReprint(mentions);
  const aliases =
    opts.aliases.length > 0
      ? opts.aliases
      : opts.targetId === GUSCHMER_TARGET_ID
        ? [...GUSCHMER_ALIASES]
        : opts.targetName
          ? [opts.targetName]
          : [];

  type Thread = {
    canonical: ListeningMention;
    group: ListeningMention[];
    combinedReach: number;
    youtube: boolean;
    classification: ReturnType<typeof getClassification>;
    author: ReturnType<typeof resolveAuthor>;
    direct: boolean;
    sentimiento: number | null;
    model: string | null;
  };

  const threads: Thread[] = [];
  for (const group of groups.values()) {
    const canonical = pickCanonical(group);
    const classification = getClassification(canonical.classifications);
    const youtube = isYoutubeExact(canonical.source);
    const author = resolveAuthor(canonical);
    const directAliases = aliasById.get(canonical.id)?.length ? aliasById.get(canonical.id)! : aliases;
    const direct = textHasAlias(canonical.text, directAliases);
    threads.push({
      canonical,
      group,
      combinedReach: combinedReachOf(group),
      youtube,
      classification,
      author,
      direct,
      sentimiento: youtube ? null : (classification?.sentimiento ?? null),
      model: classification?.model ?? null,
    });
  }

  const resultados = threads.length;
  const rawCount = mentions.length;
  const engagement = mentions.reduce((sum, m) => sum + (m.reach_score ?? 0), 0);
  const xCount = mentions.filter((m) => m.source === 'x').length;
  const xMixPct = pct(xCount, rawCount);
  const knownAuthors = new Map<string, AuthorRow>();
  const themeMap = new Map<string, number>();
  const keywordMap = new Map<string, number>();

  for (const thread of threads) {
    if (thread.author.known) {
      const key = (thread.author.handle || thread.author.label).toLocaleLowerCase('es');
      const prev = knownAuthors.get(key);
      const followers = followersOf(thread.canonical.author_meta);
      const avatar = avatarUrlOf(thread.canonical.author_meta);
      if (prev) {
        prev.count += 1;
        prev.engagement += thread.combinedReach;
        if ((followers ?? 0) > (prev.followers ?? 0)) prev.followers = followers;
        if (!prev.avatarUrl && avatar) prev.avatarUrl = avatar;
      } else {
        knownAuthors.set(key, {
          handle: thread.author.handle,
          label: thread.author.label,
          count: 1,
          engagement: thread.combinedReach,
          followers,
          avatarUrl: avatar,
        });
      }
    }

    if (!thread.youtube && thread.classification) {
      for (const tema of thread.classification.temas ?? []) {
        if (tema && tema !== 'otro') {
          themeMap.set(tema, (themeMap.get(tema) ?? 0) + 1);
        }
      }
    }

    const text = stripHtml(thread.canonical.text);
    for (const theme of KEYWORD_THEMES) {
      if (theme.pattern.test(text)) {
        keywordMap.set(theme.id, (keywordMap.get(theme.id) ?? 0) + 1);
      }
    }
  }

  const uniqueAuthors = knownAuthors.size;
  const directThreads = threads.filter((t) => t.direct);
  const targetInTextPct = pct(directThreads.length, resultados);
  const sentimentAll = mixSentiment(threads);
  const sentimentDirect = mixSentiment(directThreads);

  const classifiedThemeBase = [...themeMap.values()].reduce((s, n) => s + n, 0);
  const themes: ThemeShare[] = [...themeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, count]) => ({
      id,
      label: labelTema(id),
      count,
      pct: pct(count, classifiedThemeBase || resultados),
      field: 'classifications.temas',
    }));

  const keywordThemes: ThemeShare[] = [...keywordMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, count]) => ({
      id,
      label: KEYWORD_THEMES.find((t) => t.id === id)?.label ?? labelTema(id),
      count,
      pct: pct(count, resultados),
      field: 'mentions.text (reglas KEYWORD_THEMES)',
    }));

  const authorList = [...knownAuthors.values()];
  const authorsPresence = [...authorList].sort((a, b) => b.count - a.count || b.engagement - a.engagement).slice(0, 8);
  const authorsEngagement = [...authorList]
    .sort((a, b) => b.engagement - a.engagement || b.count - a.count)
    .slice(0, 8);

  const dayCounts = new Map<string, number>();
  for (const thread of threads) {
    const day = dayInGuayaquil(thread.canonical.published_at);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const volume = eachDay(opts.range.dateFrom, opts.range.dateTo).map((day) => ({
    day,
    count: dayCounts.get(day) ?? 0,
  }));

  const videoCount = threads.filter((t) => t.canonical.source === 'youtube').length;
  const imageCount = 0;
  const unknownCount = resultados - videoCount;

  const fields: FieldNote[] = [
    {
      metric: 'Resultados',
      field: 'mentions (dedupe reprintKey / simhash, igual que el inbox)',
      status: 'live',
      note: rawCount === resultados
        ? `${resultados} hilos en el periodo.`
        : `${resultados} hilos deduplicados de ${rawCount} registros brutos.`,
    },
    {
      metric: 'Engagement',
      field: 'mentions.reach_score',
      status: 'live',
      note: 'Suma de reach_score del colector. En X es likes+respuestas+2×RTs / 10 (tope 100). No guardamos likes sueltos.',
    },
    {
      metric: 'Autores únicos',
      field: 'author_handle + author_meta.name (cuentas identificadas)',
      status: 'live',
      note: 'Solo handles/medios resueltos; “Autor no identificado” no cuenta.',
    },
    {
      metric: 'X en el mix',
      field: 'mentions.source',
      status: 'live',
      note: 'Porcentaje de registros brutos con source = x.',
    },
    {
      metric: 'Objetivo en el texto',
      field: 'mentions.text ∩ targets.aliases',
      status: 'live',
      note: 'Hilos cuyo texto contiene el nombre o un alias del objetivo (mención directa vs ruido de query).',
    },
    {
      metric: 'Sentimiento',
      field: 'classifications.sentimiento',
      status: sentimentAll.classified > 0 ? 'live' : 'nd',
      note: 'YouTube se omite (mención exacta, sin tono derivado). Escala −2…+2.',
    },
    {
      metric: 'Temas IA / reglas',
      field: 'classifications.temas',
      status: themes.length > 0 ? 'live' : 'nd',
      note: 'Participación sobre etiquetas de tema distintas de “otro”.',
    },
    {
      metric: 'Temas en texto',
      field: 'mentions.text',
      status: keywordThemes.length > 0 ? 'live' : 'nd',
      note: 'Participación sobre hilos deduplicados que coinciden con KEYWORD_THEMES.',
    },
    {
      metric: 'Género / edad',
      field: '—',
      status: 'nd',
      note: 'El colector no enriquece demografía. No se inventan cifras de Talkwalker.',
    },
    {
      metric: 'Origen geográfico',
      field: '—',
      status: 'nd',
      note: 'No hay columnas de país, provincia ni coordenadas en mentions.',
    },
    {
      metric: 'Formatos',
      field: 'mentions.source + author_meta',
      status: videoCount > 0 ? 'live' : 'nd',
      note: 'Video = source youtube. Imagen/adjuntos de X no se persisten.',
    },
  ];

  const kpis: ReportKpi[] = [
    {
      key: 'resultados',
      label: 'Resultados',
      value: formatCompact(resultados),
      hint: rawCount !== resultados ? `${rawCount} brutos` : 'hilos deduplicados',
      field: 'reprintKey',
      status: 'live',
    },
    {
      key: 'engagement',
      label: 'Engagement',
      value: formatCompact(engagement),
      hint: 'suma reach_score',
      field: 'mentions.reach_score',
      status: 'live',
    },
    {
      key: 'autores',
      label: 'Autores únicos',
      value: formatCompact(uniqueAuthors),
      hint: 'cuentas identificadas',
      field: 'author_handle',
      status: 'live',
    },
    {
      key: 'xmix',
      label: 'X en el mix',
      value: formatPct(xMixPct),
      hint: `${xCount} de ${rawCount} registros`,
      field: 'mentions.source',
      status: 'live',
    },
    {
      key: 'directo',
      label: 'Objetivo en el texto',
      value: resultados > 0 ? formatPct(targetInTextPct) : 'N/D',
      hint: `${directThreads.length} de ${resultados} hilos`,
      field: 'targets.aliases',
      status: resultados > 0 ? 'live' : 'nd',
    },
    {
      key: 'genero',
      label: 'Género',
      value: 'N/D',
      hint: 'sin dato en el colector',
      field: '—',
      status: 'nd',
    },
  ];

  const narrative = buildNarrative({
    targetName: opts.targetName,
    resultados,
    rawCount,
    engagement,
    uniqueAuthors,
    xMixPct,
    targetInTextPct,
    directCount: directThreads.length,
    sentimentAll,
    sentimentDirect,
    keywordThemes,
    themes,
    authorsPresence,
    videoCount,
  });

  return {
    targetId: opts.targetId,
    targetName: opts.targetName,
    aliases,
    range: opts.range,
    periodLabel: formatPeriodLabel(opts.range),
    corteAt: opts.fetchedAt,
    fetchedAt: opts.fetchedAt,
    truncated: opts.truncated,
    rawCount,
    resultados,
    engagement,
    uniqueAuthors,
    xMixPct,
    xCount,
    targetInTextPct,
    directCount: directThreads.length,
    kpis,
    volume,
    sentimentAll,
    sentimentDirect,
    themes,
    keywordThemes,
    authorsPresence,
    authorsEngagement,
    formats: {
      videoPct: resultados > 0 ? pct(videoCount, resultados) : null,
      videoCount,
      imagePct: null,
      imageCount,
      unknownCount,
      note: 'Video se infiere de source=youtube. No hay metadato de imagen/adjunto en X ni RSS.',
    },
    demographics: {
      gender: null,
      age: null,
      note: 'Sin campos de género ni edad en mentions ni author_meta.',
    },
    geo: {
      note: 'Sin campos geo (país, provincia, lat/lon) en el esquema actual.',
    },
    hallazgo: narrative[0]?.body ?? 'No hay hilos en el periodo seleccionado.',
    narrative,
    fields,
    error: opts.error,
  };
}

function buildNarrative(input: {
  targetName: string;
  resultados: number;
  rawCount: number;
  engagement: number;
  uniqueAuthors: number;
  xMixPct: number;
  targetInTextPct: number;
  directCount: number;
  sentimentAll: SentimentMix;
  sentimentDirect: SentimentMix;
  keywordThemes: ThemeShare[];
  themes: ThemeShare[];
  authorsPresence: AuthorRow[];
  videoCount: number;
}): NarrativeBullet[] {
  const bullets: NarrativeBullet[] = [];
  const name = input.targetName || 'el objetivo';

  if (input.resultados === 0) {
    return [
      {
        id: 'vacio',
        title: 'Sin muestra',
        body: `No hay hilos deduplicados para ${name} en este periodo. El informe no inventa cifras.`,
      },
    ];
  }

  if (input.targetInTextPct < 40) {
    bullets.push({
      id: 'marco',
      title: 'La conversación no gira solo alrededor del objetivo',
      body: `${input.directCount} de ${input.resultados} hilos (${formatPct(input.targetInTextPct)}) mencionan el nombre o un alias de ${name} en el texto. El resto entra por la query de recolección (ruido de contexto). Campo: mentions.text ∩ targets.aliases.`,
    });
  } else {
    bullets.push({
      id: 'marco',
      title: 'El nombre del objetivo estructura la muestra',
      body: `${input.directCount} de ${input.resultados} hilos (${formatPct(input.targetInTextPct)}) nombran a ${name}. La lectura de tono y temas puede anclarse en este subcorpus directo.`,
    });
  }

  if (input.sentimentAll.classified > 0) {
    const s = input.sentimentAll;
    const origin =
      s.fromRules > 0 && s.fromModel === 0
        ? 'reglas (classifications.model ~ rules)'
        : s.modelLabel ?? 'classifications.sentimiento';
    bullets.push({
      id: 'tono',
      title: 'Tono de la muestra clasificada',
      body: `${formatPct(s.negativo.pct)} negativo, ${formatPct(s.neutro.pct)} neutro y ${formatPct(s.positivo.pct)} positivo sobre ${s.classified} hilos con fila de clasificación (${origin}). YouTube queda fuera (${s.skippedYoutube} omitidos).`,
    });
  }

  if (input.sentimentDirect.classified > 0 && input.directCount !== input.resultados) {
    const d = input.sentimentDirect;
    bullets.push({
      id: 'directo',
      title: 'El subcorpus directo no copia el tono ambiental',
      body: `En las ${d.n} menciones directas, el mix es ${formatPct(d.negativo.pct)} negativo / ${formatPct(d.neutro.pct)} neutro / ${formatPct(d.positivo.pct)} positivo (${d.classified} clasificadas). No se atribuye el tono del ruido de query al candidato.`,
    });
  }

  const topKw = input.keywordThemes[0];
  if (topKw) {
    bullets.push({
      id: 'tema',
      title: 'Puerta de entrada temática',
      body: `“${topKw.label}” aparece en ${topKw.count} de ${input.resultados} hilos (${formatPct(topKw.pct)}). Detección sobre mentions.text con KEYWORD_THEMES; no es un cluster de embeddings.`,
    });
  } else if (input.themes[0]) {
    const top = input.themes[0];
    bullets.push({
      id: 'tema',
      title: 'Tema etiquetado más frecuente',
      body: `“${top.label}” suma ${top.count} etiquetas (${formatPct(top.pct)} de classifications.temas).`,
    });
  }

  if (input.xMixPct >= 40) {
    bullets.push({
      id: 'x',
      title: 'Peso de X en el mix',
      body: `X aporta ${formatPct(input.xMixPct)} de los ${input.rawCount} registros (mentions.source). La muestra visible no es un sondeo ciudadano: es el mix que recolecta el pipeline.`,
    });
  }

  const topAuthor = input.authorsPresence[0];
  if (topAuthor) {
    bullets.push({
      id: 'autor',
      title: 'Cuenta con más presencia',
      body: `${topAuthor.label} concentra ${topAuthor.count} hilos y ${formatCompact(topAuthor.engagement)} de reach_score. Los seguidores salen de author_meta.followers cuando el colector X los trajo.`,
    });
  }

  if (input.videoCount > 0) {
    bullets.push({
      id: 'formato',
      title: 'Formato observable',
      body: `${input.videoCount} hilos son YouTube (source=youtube). No hay campo de adjunto imagen/video para X; ese slot queda N/D.`,
    });
  }

  return bullets.slice(0, 5);
}

async function fetchReportRows(
  targetId: string | null,
  startIso: string,
  endIso: string
): Promise<{ rows: ReportRow[]; truncated: boolean; error: string | null; targetName: string; aliases: string[] }> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc('monitor_list_report_window', {
    p_target_id: targetId,
    p_from: startIso,
    p_to: endIso,
    p_limit: ROW_LIMIT,
  });

  if (!error && Array.isArray(data)) {
    const rows = (data as ReportRow[]).map((row) => ({
      ...row,
      published_at: String(row.published_at),
    }));
    const first = rows[0];
    return {
      rows,
      truncated: rows.length >= ROW_LIMIT,
      error: null,
      targetName: first?.target_nombre ?? '',
      aliases: first?.target_aliases ?? [],
    };
  }

  let query = supabase
    .schema('monitor')
    .from('mentions')
    .select(
      `id, text, url, author_handle, author_meta, source, published_at, reach_score, tipo_fuente, simhash, target_id,
       targets (nombre, aliases),
       classifications (sentimiento, temas, etiquetas, resumen, urgencia, model, tipo_actor)`
    )
    .gte('published_at', startIso)
    .lte('published_at', endIso)
    .order('published_at', { ascending: false })
    .limit(ROW_LIMIT);
  if (targetId) query = query.eq('target_id', targetId);

  const fallback = await query;
  const rawRows = (fallback.data ?? []) as Record<string, unknown>[];
  const rows: ReportRow[] = rawRows.map((row) => {
    const target = row.targets as { nombre?: string; aliases?: string[] } | { nombre?: string; aliases?: string[] }[] | null;
    const t = Array.isArray(target) ? target[0] : target;
    const classification = getClassification(row.classifications as ListeningMention['classifications']);
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
      target_nombre: t?.nombre ?? null,
      target_aliases: t?.aliases ?? null,
      sentimiento: classification?.sentimiento ?? null,
      temas: classification?.temas ?? null,
      etiquetas: classification?.etiquetas ?? null,
      resumen: classification?.resumen ?? null,
      urgencia: classification?.urgencia ?? null,
      model: classification?.model ?? null,
      tipo_actor: classification?.tipo_actor ?? null,
    };
  });

  const first = rows[0];
  return {
    rows,
    truncated: rows.length >= ROW_LIMIT,
    error: fallback.error?.message ?? null,
    targetName: first?.target_nombre ?? '',
    aliases: first?.target_aliases ?? [],
  };
}

const fetchReportRowsCached = unstable_cache(
  async (targetId: string, startIso: string, endIso: string) => fetchReportRows(targetId || null, startIso, endIso),
  ['listening-report-window-v1'],
  { revalidate: CACHE_SECONDS }
);

export async function getListeningReport(opts: {
  targetId?: string | null;
  targetName?: string;
  aliases?: string[];
  range: ReportRange;
}): Promise<ListeningReport> {
  const targetId = opts.targetId ?? null;
  const payload = await fetchReportRowsCached(targetId ?? '', opts.range.startIso, opts.range.endIso);
  const aliases =
    opts.aliases && opts.aliases.length > 0
      ? opts.aliases
      : payload.aliases.length > 0
        ? payload.aliases
        : targetId === GUSCHMER_TARGET_ID
          ? [...GUSCHMER_ALIASES]
          : [];
  const targetName =
    opts.targetName ||
    payload.targetName ||
    (targetId === GUSCHMER_TARGET_ID ? 'Andrés Guschmer' : targetId ? 'Objetivo' : 'Todos los objetivos');

  return buildListeningReport({
    rows: payload.rows,
    range: opts.range,
    targetId,
    targetName,
    aliases: targetId ? aliases : aliases,
    truncated: payload.truncated,
    fetchedAt: new Date().toISOString(),
    error: payload.error,
  });
}
