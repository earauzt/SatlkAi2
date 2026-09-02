-- Esquema principal del monitor político (mono-usuario)
-- Basado en informe de research secciones 2.3, 3.3 y 4

-- ---------------------------------------------------------------------------
-- Configuración de la app (allowlist mono-usuario)
-- ---------------------------------------------------------------------------
CREATE TABLE app_config (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  allowed_email text NOT NULL,
  retention_days_citizen int NOT NULL DEFAULT 90,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE app_config IS 'Configuración singleton. Solo un email autorizado.';

-- ---------------------------------------------------------------------------
-- Objetivo de monitoreo (un político + alias + adversarios)
-- ---------------------------------------------------------------------------
CREATE TABLE targets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  aliases     text[] NOT NULL DEFAULT '{}',
  handles     jsonb NOT NULL DEFAULT '{}',
  adversarios jsonb NOT NULL DEFAULT '[]',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN targets.handles IS 'Ej: {"x": "@cuenta", "youtube": "UCxxx"}';
COMMENT ON COLUMN targets.adversarios IS 'Array de {nombre, aliases[], handles{}}';

-- ---------------------------------------------------------------------------
-- Fuentes de recolección (RSS, YouTube, X, Telegram…)
-- ---------------------------------------------------------------------------
CREATE TYPE source_type AS ENUM (
  'rss',
  'google_news',
  'youtube',
  'x',
  'telegram',
  'reddit'
);

CREATE TABLE sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id     uuid NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  type          source_type NOT NULL,
  name          text NOT NULL,
  url           text,
  config        jsonb NOT NULL DEFAULT '{}',
  poll_interval_minutes int NOT NULL DEFAULT 15,
  enabled       boolean NOT NULL DEFAULT true,
  last_fetched_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sources_target_enabled ON sources (target_id) WHERE enabled = true;

-- ---------------------------------------------------------------------------
-- Actores recurrentes (autores de menciones)
-- ---------------------------------------------------------------------------
CREATE TYPE actor_type AS ENUM (
  'medio',
  'periodista',
  'politico',
  'influencer',
  'ciudadano',
  'cuenta_sospechosa',
  'desconocido'
);

CREATE TABLE actors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      text NOT NULL,
  handle        text NOT NULL,
  display_name  text,
  actor_type    actor_type NOT NULL DEFAULT 'desconocido',
  is_public     boolean NOT NULL DEFAULT false,
  meta          jsonb NOT NULL DEFAULT '{}',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, handle)
);

-- ---------------------------------------------------------------------------
-- Menciones recolectadas
-- ---------------------------------------------------------------------------
CREATE TYPE mention_source AS ENUM (
  'rss',
  'google_news',
  'youtube',
  'x',
  'telegram',
  'reddit'
);

CREATE TABLE mentions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id     uuid NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  source        mention_source NOT NULL,
  external_id   text NOT NULL,
  url           text,
  author_handle text,
  author_meta   jsonb NOT NULL DEFAULT '{}',
  text          text NOT NULL,
  lang          text DEFAULT 'es',
  published_at  timestamptz NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  reach_score   int NOT NULL DEFAULT 0,
  simhash       bigint,
  embedding     vector(1536),
  tipo_fuente   text NOT NULL DEFAULT 'prensa'
    CHECK (tipo_fuente IN ('prensa', 'red_social', 'institucional', 'desconocido')),
  actor_id      uuid REFERENCES actors(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX idx_mentions_target_published ON mentions (target_id, published_at DESC);
CREATE INDEX idx_mentions_source ON mentions (source);
CREATE INDEX idx_mentions_simhash ON mentions (simhash) WHERE simhash IS NOT NULL;
-- Índice ivfflat: crear tras tener datos (migración separada o manual en producción)
-- CREATE INDEX idx_mentions_embedding ON mentions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON COLUMN mentions.tipo_fuente IS 'Dimensión fija; la asigna el colector, no el LLM.';

-- ---------------------------------------------------------------------------
-- Clasificaciones LLM (1:1 con mención, versionable)
-- ---------------------------------------------------------------------------
CREATE TABLE classifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id          uuid NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
  sentimiento         smallint NOT NULL CHECK (sentimiento BETWEEN -2 AND 2),
  tipo_actor          actor_type NOT NULL DEFAULT 'desconocido',
  temas               text[] NOT NULL DEFAULT '{}',
  etiquetas           text[] NOT NULL DEFAULT '{}',
  resumen             text,
  urgencia            smallint NOT NULL DEFAULT 0 CHECK (urgencia BETWEEN 0 AND 3),
  confianza           real NOT NULL DEFAULT 0 CHECK (confianza BETWEEN 0 AND 1),
  model               text NOT NULL DEFAULT 'claude-haiku-4-5',
  revisado_por_humano boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mention_id)
);

CREATE INDEX idx_classifications_confianza ON classifications (confianza)
  WHERE confianza < 0.6 AND revisado_por_humano = false;
CREATE INDEX idx_classifications_etiquetas ON classifications USING gin (etiquetas);

-- ---------------------------------------------------------------------------
-- Alertas técnicas (picos, coordinación, narrativas nuevas)
-- ---------------------------------------------------------------------------
CREATE TYPE alert_type AS ENUM (
  'pico_volumen',
  'actividad_coordinada',
  'nueva_narrativa',
  'amenaza_o_odio'
);

CREATE TABLE alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id       uuid NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  tipo            alert_type NOT NULL,
  ventana_inicio  timestamptz NOT NULL,
  ventana_fin     timestamptz NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  enviada_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_target_created ON alerts (target_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Narrativas (clusters de embeddings)
-- ---------------------------------------------------------------------------
CREATE TABLE narratives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id     uuid NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  label         text NOT NULL,
  centroid      vector(1536),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  mention_count int NOT NULL DEFAULT 0,
  trend         smallint NOT NULL DEFAULT 0 CHECK (trend BETWEEN -1 AND 1),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_narratives_target ON narratives (target_id, last_seen_at DESC);

-- ---------------------------------------------------------------------------
-- Eventos manuales para anotar timeline (entrevistas, votaciones…)
-- ---------------------------------------------------------------------------
CREATE TABLE timeline_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id   uuid NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  label       text NOT NULL,
  occurred_at timestamptz NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_timeline_events_target ON timeline_events (target_id, occurred_at DESC);
