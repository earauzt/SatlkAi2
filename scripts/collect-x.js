#!/usr/bin/env node
/**
 * Colector X (Twitter API v2) — búsqueda reciente por query.
 * Uso: X_BEARER_TOKEN=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/collect-x.js
 *
 * Requiere acceso Elevated a la API de X (Bearer token).
 * Docs: https://developer.x.com/en/docs/twitter-api/tweets/search/integrate/build-a-query
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bearer = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!bearer) {
  console.error('Falta X_BEARER_TOKEN (o TWITTER_BEARER_TOKEN)');
  process.exit(1);
}

const supabase = createClient(url, key);

function matchesAliases(text, source) {
  const aliases = [source.nombre, ...(source.aliases || [])].map((a) => a.toLowerCase());
  const lower = text.toLowerCase();
  return aliases.some((a) => a && lower.includes(a));
}

async function searchRecent(query, maxResults, sinceId) {
  const params = new URLSearchParams({
    query,
    max_results: String(Math.min(Math.max(maxResults, 10), 100)),
    'tweet.fields': 'created_at,author_id,public_metrics,lang',
    expansions: 'author_id',
    'user.fields': 'username,name,public_metrics',
  });
  if (sinceId) params.set('since_id', sinceId);

  const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${bearer}` },
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 429) {
    const reset = res.headers.get('x-rate-limit-reset');
    throw new Error(`Rate limit X API. Reset: ${reset ? new Date(Number(reset) * 1000).toISOString() : 'unknown'}`);
  }
  if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`);

  return res.json();
}

function normalizeTweets(data, source) {
  const users = new Map();
  for (const u of data.includes?.users ?? []) {
    users.set(u.id, u);
  }

  const mentions = [];
  for (const tweet of data.data ?? []) {
    const user = users.get(tweet.author_id);
    const text = tweet.text ?? '';
    if (!matchesAliases(text, source)) continue;

    const metrics = tweet.public_metrics ?? {};
    const reach =
      (metrics.like_count ?? 0) +
      (metrics.retweet_count ?? 0) * 2 +
      (metrics.reply_count ?? 0);

    mentions.push({
      target_id: source.target_id,
      source: 'x',
      external_id: tweet.id,
      url: user?.username
        ? `https://x.com/${user.username}/status/${tweet.id}`
        : `https://x.com/i/web/status/${tweet.id}`,
      author_handle: user ? `@${user.username}` : tweet.author_id,
      author_meta: {
        name: user?.name,
        followers: user?.public_metrics?.followers_count,
      },
      text: text.slice(0, 10000),
      lang: tweet.lang ?? 'es',
      published_at: new Date(tweet.created_at).toISOString(),
      reach_score: Math.min(Math.floor(reach / 10), 100),
      tipo_fuente: 'red_social',
    });
  }
  return mentions;
}

async function main() {
  const { data: sources, error } = await supabase.rpc('monitor_list_x_sources');
  if (error) throw error;

  console.log(`Fuentes X activas: ${sources?.length ?? 0}`);
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const source of sources || []) {
    const query = source.config?.query ?? `"${source.nombre}"`;
    const maxResults = Number(source.config?.max_results ?? 25);
    const sinceId = source.config?.since_id;
    console.log(`→ ${source.name} (q=${query})`);

    try {
      const data = await searchRecent(query, maxResults, sinceId);
      const mentions = normalizeTweets(data, source);

      if (mentions.length === 0) {
        console.log('  0 menciones (filtro aliases o sin resultados)');
        await supabase.rpc('monitor_mark_source_fetched', { p_source_id: source.id });
        continue;
      }

      const { data: batchResult, error: upsertError } = await supabase.rpc(
        'monitor_upsert_mentions_batch',
        { p_items: mentions }
      );
      if (upsertError) throw upsertError;

      const stats = batchResult?.stats || {};
      totalInserted += stats.inserted || 0;
      totalSkipped += stats.skipped || 0;
      console.log(
        `  ${mentions.length} tweets → +${stats.inserted || 0} nuevos, ${stats.skipped || 0} skip`
      );

      const newestId = data.meta?.newest_id;
      if (newestId) {
        await supabase.rpc('monitor_update_source_config', {
          p_source_id: source.id,
          p_patch: { since_id: newestId },
        });
      }

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
