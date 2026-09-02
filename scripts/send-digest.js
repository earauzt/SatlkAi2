#!/usr/bin/env node
/**
 * Envía digest Telegram de las últimas N horas (on-demand).
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/send-digest.js
 */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hours = process.argv[2] ?? '24';

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const res = await fetch(`${url}/functions/v1/telegram-digest?hours=${hours}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
});
const body = await res.json();
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
