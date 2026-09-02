#!/usr/bin/env node
/**
 * Genera embeddings (OpenAI-compatible) para menciones sin vector.
 * Uso: OPENAI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-embeddings.js
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
const model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!apiKey) {
  console.error('Falta OPENAI_API_KEY para embeddings');
  process.exit(1);
}

const supabase = createClient(url, key);
const limit = Math.min(Number(process.argv[2] ?? '30'), 100);

async function embedTexts(texts) {
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Embeddings ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.data.map((d) => d.embedding);
}

async function main() {
  const { data: rows, error } = await supabase.rpc('monitor_list_unembedded_mentions', {
    p_limit: limit,
  });
  if (error) throw error;

  console.log(`Menciones sin embedding: ${rows?.length ?? 0}`);
  if (!rows?.length) return;

  const texts = rows.map((r) => (r.text || '').slice(0, 8000));
  const vectors = await embedTexts(texts);

  for (let i = 0; i < rows.length; i++) {
    const { error: setErr } = await supabase.rpc('monitor_set_mention_embedding', {
      p_mention_id: rows[i].id,
      p_embedding: vectors[i],
    });
    if (setErr) console.error(`  skip ${rows[i].id}: ${setErr.message}`);
    else console.log(`  ✓ ${rows[i].id.slice(0, 8)}…`);
  }

  const { data: synced, error: syncErr } = await supabase.rpc('monitor_sync_narratives');
  if (syncErr) console.error('sync narratives:', syncErr.message);
  else console.log(`Narrativas sincronizadas: ${synced?.updated ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
