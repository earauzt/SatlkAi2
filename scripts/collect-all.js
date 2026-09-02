#!/usr/bin/env node
/**
 * Ejecuta todos los colectores manuales en secuencia.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, script)], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

async function main() {
  console.log('=== Colector RSS ===');
  await run('collect-rss.js');

  if (process.env.YOUTUBE_API_KEY) {
    console.log('\n=== Colector YouTube ===');
    await run('collect-youtube.js');
  } else {
    console.log('\n(Omitiendo YouTube: sin YOUTUBE_API_KEY)');
  }

  if (process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN) {
    console.log('\n=== Colector X ===');
    await run('collect-x.js');
  } else {
    console.log('\n(Omitiendo X: sin X_BEARER_TOKEN)');
  }

  if (process.env.OPENAI_API_KEY) {
    console.log('\n=== Embeddings ===');
    await run('sync-embeddings.js');
  } else {
    console.log('\n(Omitiendo embeddings: sin OPENAI_API_KEY)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
