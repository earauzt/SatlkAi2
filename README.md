# Monitor político personal

Clon mono-usuario de Stalkr para monitorear menciones de un político ecuatoriano.

**Repositorio:** https://github.com/earauzt/SatlkAi2

## Estado actual

- [x] Esquema SQL + migraciones Supabase (`monitor.*` en rushr-ea)
- [x] Colector RSS manual (n8n o `npm run collect`)
- [x] Colector YouTube (`npm run collect:youtube`)
- [x] Colector X (`npm run collect:x` — requiere `X_BEARER_TOKEN`)
- [x] Embeddings pgvector (`npm run embeddings` — requiere `OPENAI_API_KEY`)
- [x] **Dashboard estilo Stalkr:** sidebar, inbox, analytics, narrativas, revisión
- [x] Clasificación (`classify-batch` — reglas por defecto; LLM opcional vía OpenAI/OpenRouter/Anthropic)
- [x] Detección de picos (`monitor.check_volume_spike`)
- [ ] Telegram (digest/alertas) — **pendiente, no prioritario**
- [x] MCP server de solo lectura (`mcp-server/`)
- [x] Jobs de picos on-demand (`monitor-jobs` + `npm run jobs`)
- [x] Cola de revisión manual (`/review`)
- [x] Vista de narrativas (`/narratives` — agrupación por temas/etiquetas)

> El deploy Vercel es temporal (~60 min). Para fijarlo: [claim deployment](https://vercel.com/claim-deployment?code=102a9a88-439d-4465-af15-bcb7a354b5c0)

## Requisitos

- Node.js 20+
- Docker (para tests locales)
- Proyecto Supabase (hosted o CLI)
- n8n Cloud con variables de entorno configuradas

### Push a GitHub

```bash
git remote add origin https://github.com/earauzt/SatlkAi2.git
git push -u origin main
```

En Cloud Agent, configura el secret `GH_TOKEN` (Personal Access Token con scope `repo`) para que el agente pueda hacer push automáticamente.

## Setup Supabase

1. Crear proyecto en [Supabase](https://supabase.com).
2. Ejecutar migraciones en orden desde `supabase/migrations/` (SQL Editor o CLI).
3. Editar `20260901000005_seed_example.sql` o insertar manualmente:
   - `app_config.allowed_email` → tu email
   - `targets` → nombre, aliases y adversarios del político
   - `sources` → URLs RSS de medios ecuatorianos

## Setup n8n

1. Importar `n8n/workflows/rss-collector.json`.
2. Configurar variables de entorno en n8n:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Crear credencial HTTP Header Auth: `Authorization: Bearer <service_role_key>`.
4. Activar workflow — **solo ejecución manual** (sin cron).

El colector:
- Lee fuentes `rss` y `google_news` habilitadas en la tabla `sources`
- Filtra items que mencionan al político o sus aliases
- Hace upsert vía RPC `upsert_mentions_batch` (idempotente por `source + external_id`)

## Tests locales

```bash
cp .env.example .env
npm install

# Opción A: Docker (pgvector incluido)
npm run db:reset

# Opción B: PostgreSQL local (16+ con extensión pgvector)
sudo apt install postgresql-16-pgvector
createdb monitor_politico_test  # o vía psql
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/monitor_politico_test npm run db:migrate

npm run test:db
```

## Esquema principal

| Tabla | Propósito |
|---|---|
| `targets` | Político monitoreado + aliases + adversarios |
| `sources` | Feeds RSS, Google News, etc. |
| `mentions` | Menciones recolectadas (`UNIQUE(source, external_id)`) |
| `classifications` | Salida del clasificador LLM |
| `alerts` | Picos, coordinación, narrativas nuevas |
| `narratives` | Clusters de embeddings |

## Colectores manuales

```bash
# Solo RSS
npm run collect

# Solo YouTube (requiere YOUTUBE_API_KEY)
npm run collect:youtube

# Ambos colectores + embeddings si hay keys
npm run collect:all

# Solo X
npm run collect:x

# Embeddings + sync narrativas semánticas
npm run embeddings
```

## Clasificación

Por defecto **no requiere ningún LLM**: `classify-batch` usa reglas heurísticas (`rules-v1`).

Para activar un modelo, configura secrets en Supabase:

| Variable | Descripción |
|---|---|
| `CLASSIFY_PROVIDER` | `rules` (default), `openai`, `openrouter`, `anthropic`, o `auto` |
| `OPENAI_API_KEY` | API key para OpenAI u OpenRouter |
| `OPENAI_BASE_URL` | Default `https://api.openai.com/v1`; para OpenRouter: `https://openrouter.ai/api/v1` |
| `CLASSIFY_MODEL` | Ej. `gpt-4o-mini`, `google/gemini-2.0-flash-001` |
| `ANTHROPIC_API_KEY` | Solo si `CLASSIFY_PROVIDER=anthropic` |

Prioridad en modo `auto`: OpenAI → Anthropic → reglas.

## Jobs (on-demand)

```bash
# Detectar picos de volumen (sin Telegram por ahora)
npm run jobs
```

> Telegram (digest y alertas) está implementado en Edge Functions pero **no es prioritario**. No hace falta configurar `TELEGRAM_BOT_TOKEN` hasta que lo pidas.

## Próximos pasos

1. Push a GitHub + deploy Vercel permanente
2. Telegram (cuando lo pidas)
3. pg_cron automático (opcional)

## Políticas fijas

- Retención 90 días para menciones de ciudadanos (`purge_citizen_mentions`)
- Facebook / TikTok fuera del MVP
- Sin etiqueta "desinformación" — usar `afirmacion_verificable`
- Handles truncados para cuentas no públicas (pendiente en frontend)
