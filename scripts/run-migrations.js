#!/usr/bin/env node
/**
 * Ejecuta migraciones SQL en orden.
 * Usa DATABASE_URL o conexión local peer (postgres sin password vía socket).
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

function getClientConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.PGHOST || '/var/run/postgresql',
    database: process.env.PGDATABASE || 'monitor_politico_test',
    user: process.env.PGUSER || 'postgres',
  };
}

async function run() {
  const client = new pg.Client(getClientConfig());
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM _migrations WHERE name = $1',
      [file]
    );
    if (rows.length > 0) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8');
    console.log(`apply ${file}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  await client.end();
  console.log('migrations complete');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
