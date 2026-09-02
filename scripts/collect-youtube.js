#!/usr/bin/env node
/**
 * Colector YouTube manual — búsqueda por query en fuentes monitor.sources (type=youtube).
 * Uso: YOUTUBE_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/collect-youtube.js
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ytKey = process.env.YOUTUBE_API_KEY;

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!ytKey) {
  console.error('Falta YOUTUBE_API_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function matchesAliases(text, source) {
  const aliases = [source.nombre, ...(source.aliases || [])].map((a) => a.toLowerCase());
  const lower = text.toLowerCase();
  return aliases.some((a) => a && lower.includes(a));
}

async function searchVideos(query, maxResults) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    order: 'date',
    maxResults: String(maxResults),
    relevanceLanguage: 'es',
    regionCode: 'EC',
    key: ytKey,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.items ?? [];
}

async function fetchVideoStats(videoIds) {
  if (videoIds.length === 0) return {};
  const params = new URLSearchParams({
    part: 'statistics',
    id: videoIds.join(','),
    key: ytKey,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return {};
  const data = await res.json();
  const map = {};
  for (const v of data.items ?? []) {
    map[v.id] = Number(v.statistics?.viewCount ?? 0);
  }
  return map;
}

function normalizeItems(items, stats, source) {
  const mentions = [];
  for (const item of items) {
    const id = item.id?.videoId;
    const snippet = item.snippet;
    if (!id || !snippet) continue;

    const title = snippet.title ?? '';
    const description = snippet.description ?? '';
    const text = [title, description].filter(Boolean).join(' — ');
    if (!matchesAliases(text, source)) continue;

    const views = stats[id] ?? 0;
    mentions.push({
      target_id: source.target_id,
      source: 'youtube',
      external_id: id,
      url: `https://www.youtube.com/watch?v=${id}`,
      author_handle: snippet.channelTitle?.slice(0, 255) ?? '',
      author_meta: {
        channel_id: snippet.channelId,
        thumbnails: snippet.thumbnails,
      },
      text: text.slice(0, 10000),
      lang: snippet.defaultAudioLanguage?.startsWith('es') ? 'es' : 'es',
      published_at: new Date(snippet.publishedAt).toISOString(),
      reach_score: Math.min(Math.floor(views / 1000), 100),
      tipo_fuente: 'red_social',
    });
  }
  return mentions;
}

async function main() {
  const { data: sources, error } = await supabase.rpc('monitor_list_youtube_sources');
  if (error) throw error;

  console.log(`Fuentes YouTube activas: ${sources?.length ?? 0}`);
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const source of sources || []) {
    const query = source.config?.query ?? source.nombre;
    const maxResults = Math.min(Number(source.config?.max_results ?? 25), 50);
    console.log(`→ ${source.name} (q="${query}")`);

    try {
      const items = await searchVideos(query, maxResults);
      const videoIds = items.map((i) => i.id?.videoId).filter(Boolean);
      const stats = await fetchVideoStats(videoIds);
      const mentions = normalizeItems(items, stats, source);

      if (mentions.length === 0) {
        console.log('  0 menciones (filtro aliases)');
        await supabase.rpc('monitor_mark_source_fetched', { p_source_id: source.id });
        continue;
      }

      const { data: batchResult, error: upsertError } = await supabase.rpc(
        'monitor_upsert_mentions_batch',
        { p_items: mentions }
      );
      if (upsertError) throw upsertError;

      const statsResult = batchResult?.stats || {};
      totalInserted += statsResult.inserted || 0;
      totalSkipped += statsResult.skipped || 0;
      console.log(
        `  ${mentions.length} videos → +${statsResult.inserted || 0} nuevos, ${statsResult.skipped || 0} skip`
      );

      await supabase.rpc('monitor_mark_source_fetched', { p_source_id: source.id });
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  console.log(`\nListo. Insertados: ${totalInserted}, omitidos: ${totalSkipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
