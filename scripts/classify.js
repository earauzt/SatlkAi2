#!/usr/bin/env node
/** Clasifica menciones pendientes vía Edge Function classify-batch */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const limit = process.argv[2] ?? '20';

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const res = await fetch(`${url}/functions/v1/classify-batch?limit=${limit}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
});
const body = await res.json();
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
