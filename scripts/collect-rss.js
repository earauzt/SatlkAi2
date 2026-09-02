#!/usr/bin/env node
/**
 * Colector RSS manual — equivalente al workflow n8n, ejecutable on-demand.
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/collect-rss.js
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function normalizeItems(feedJson, source) {
  const aliases = [source.nombre, ...(source.aliases || [])].map((a) =>
    a.toLowerCase()
  );
  const channel = feedJson.rss?.channel || feedJson.feed || feedJson;
  let items = channel?.item || channel?.entry || [];
  if (!Array.isArray(items)) items = [items];

  const mentions = [];
  for (const item of items) {
    if (!item) continue;
    const title = String(item.title?._text || item.title || '').trim();
    const description = String(
      item.description?._text ||
        item.description ||
        item.summary?._text ||
        item.summary ||
        ''
    ).trim();
    const text = [title, description].filter(Boolean).join(' — ');
    const textLower = text.toLowerCase();
    if (!aliases.some((a) => a && textLower.includes(a))) continue;

    const link = String(
      item.link?._attributes?.href || item.link?._text || item.link || item.guid || ''
    );
    const guid = String(item.guid?._text || item.guid || item.id || link).slice(0, 500);
    const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();
    const author = String(
      item.author?._text || item.author || item['dc:creator'] || source.name || ''
    );

    mentions.push({
      target_id: source.target_id,
      source: source.type === 'google_news' ? 'google_news' : 'rss',
      external_id: guid,
      url: link.slice(0, 2000),
      author_handle: author.slice(0, 255),
      author_meta: { feed_name: source.name, feed_url: source.url },
      text: text.slice(0, 10000),
      lang: 'es',
      published_at: new Date(pubDate).toISOString(),
      reach_score: 0,
      tipo_fuente: 'prensa',
    });
  }
  return mentions;
}

async function parseXml(xml) {
  const { XMLParser } = await import('fast-xml-parser');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '_', textNodeName: '_text' });
  return parser.parse(xml);
}

async function main() {
  const { data: sources, error } = await supabase.rpc('monitor_list_rss_sources');
  if (error) throw error;

  console.log(`Fuentes activas: ${sources?.length ?? 0}`);
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const source of sources || []) {
    console.log(`→ ${source.name}`);
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'MonitorPolitico/0.1' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const feedJson = await parseXml(xml);
      const mentions = normalizeItems(feedJson, source);

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

      const stats = batchResult?.stats || {};
      totalInserted += stats.inserted || 0;
      totalSkipped += stats.skipped || 0;
      console.log(`  ${mentions.length} items → +${stats.inserted || 0} nuevos, ${stats.skipped || 0} skip`);

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
