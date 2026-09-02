#!/usr/bin/env node
/**
 * Ejecuta jobs de mantenimiento: detección de picos (+ alerta Telegram si aplica).
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/run-jobs.js
 */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const res = await fetch(`${url}/functions/v1/monitor-jobs`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
});
const body = await res.json();
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
