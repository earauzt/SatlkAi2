-- Cuatro objetivos de monitoreo: Noboa, Guschmer, Olsen, Viteri

INSERT INTO monitor.targets (id, nombre, aliases, handles, adversarios, active)
VALUES
  (
    'a0000000-0000-4000-8000-000000000002',
    'Andrés Guschmer',
    ARRAY['Guschmer', 'Andrés Guschmer Tamariz', 'Marcelo Guschmer'],
    '{"x": "@andresguschmer"}'::jsonb,
    '[]'::jsonb,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'Niels Olsen',
    ARRAY['Niels Olsen', 'Olsen', 'Niels'],
    '{}'::jsonb,
    '[]'::jsonb,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'Cynthia Viteri',
    ARRAY['Viteri', 'Cynthia Viteri', 'alcaldesa Guayaquil'],
    '{"x": "@CynthiaViteri6"}'::jsonb,
    '[]'::jsonb,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  aliases = EXCLUDED.aliases,
  handles = EXCLUDED.handles,
  active = EXCLUDED.active,
  updated_at = now();

-- Actualizar aliases de Noboa si ya existe
UPDATE monitor.targets SET
  aliases = ARRAY['Noboa', 'Daniel Noboa', 'Daniel Noboa Azín'],
  nombre = 'Daniel Noboa'
WHERE id = 'a0000000-0000-4000-8000-000000000001';

-- Fuentes por político (Google News + X; RSS compartidos por target)
INSERT INTO monitor.sources (target_id, type, name, url, config, enabled)
SELECT t.id, 'google_news', 'Google News — ' || t.nombre,
  'https://news.google.com/rss/search?q=' || replace(t.nombre, ' ', '+') || '&hl=es-419&gl=EC&ceid=EC:es',
  jsonb_build_object('query', t.nombre), true
FROM monitor.targets t
WHERE t.active
  AND NOT EXISTS (
    SELECT 1 FROM monitor.sources s
    WHERE s.target_id = t.id AND s.type = 'google_news'
      AND s.name = 'Google News — ' || t.nombre
  );

INSERT INTO monitor.sources (target_id, type, name, config, enabled)
SELECT t.id, 'x', 'X — ' || t.nombre,
  jsonb_build_object(
    'query', CASE t.nombre
      WHEN 'Daniel Noboa' THEN '(Daniel Noboa OR Noboa) lang:es'
      WHEN 'Andrés Guschmer' THEN '("Andrés Guschmer" OR Guschmer) lang:es'
      WHEN 'Niels Olsen' THEN '("Niels Olsen" OR Niels) lang:es'
      WHEN 'Cynthia Viteri' THEN '("Cynthia Viteri" OR Viteri) lang:es'
      ELSE t.nombre || ' lang:es'
    END,
    'max_results', 25
  ),
  true
FROM monitor.targets t
WHERE t.active
  AND NOT EXISTS (
    SELECT 1 FROM monitor.sources s WHERE s.target_id = t.id AND s.type = 'x'
  );

INSERT INTO monitor.sources (target_id, type, name, url, config, enabled)
SELECT t.id, 'rss', 'El Universo', 'https://www.eluniverso.com/arc/outboundfeeds/rss/?outputType=xml', '{}'::jsonb, true
FROM monitor.targets t
WHERE t.active AND t.id <> 'a0000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM monitor.sources s WHERE s.target_id = t.id AND s.name = 'El Universo'
  );

INSERT INTO monitor.sources (target_id, type, name, url, config, enabled)
SELECT t.id, 'rss', 'Primicias', 'https://www.primicias.ec/feed/', '{}'::jsonb, true
FROM monitor.targets t
WHERE t.active AND t.id <> 'a0000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM monitor.sources s WHERE s.target_id = t.id AND s.name = 'Primicias'
  );

INSERT INTO monitor.sources (target_id, type, name, config, enabled)
SELECT t.id, 'youtube', 'YouTube — ' || t.nombre,
  jsonb_build_object('query', t.nombre || ' Ecuador', 'max_results', 25), true
FROM monitor.targets t
WHERE t.active AND t.id <> 'a0000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM monitor.sources s WHERE s.target_id = t.id AND s.type = 'youtube'
  );

-- RPC: listar todos los targets activos
CREATE OR REPLACE FUNCTION public.monitor_list_targets()
RETURNS TABLE(id uuid, nombre text, aliases text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT id, nombre, aliases FROM monitor.targets WHERE active ORDER BY nombre;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_targets() TO anon, authenticated, service_role;

-- Stats agregadas con filtro opcional por target
CREATE OR REPLACE FUNCTION public.monitor_get_dashboard_stats(p_target_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  WITH filtered_mentions AS (
    SELECT m.* FROM monitor.mentions m
    WHERE p_target_id IS NULL OR m.target_id = p_target_id
  ),
  filtered_class AS (
    SELECT c.* FROM monitor.classifications c
    JOIN monitor.mentions m ON m.id = c.mention_id
    WHERE p_target_id IS NULL OR m.target_id = p_target_id
  )
  SELECT jsonb_build_object(
    'total_mentions', (SELECT count(*)::int FROM filtered_mentions),
    'mentions_24h', (SELECT count(*)::int FROM filtered_mentions WHERE published_at > now() - interval '24 hours'),
    'avg_sentimiento', coalesce((SELECT round(avg(sentimiento)::numeric, 2) FROM filtered_class), 0),
    'urgent_count', coalesce((SELECT count(*)::int FROM filtered_class WHERE urgencia >= 2), 0),
    'review_queue', (
      SELECT count(*)::int FROM filtered_class
      WHERE revisado_por_humano = false AND (confianza < 0.6 OR urgencia >= 2)
    ),
    'by_source', coalesce((
      SELECT jsonb_object_agg(source, cnt) FROM (
        SELECT source::text, count(*)::int AS cnt FROM filtered_mentions GROUP BY source
      ) s
    ), '{}'::jsonb),
    'by_target', coalesce((
      SELECT jsonb_object_agg(nombre, cnt) FROM (
        SELECT t.nombre, count(*)::int AS cnt
        FROM monitor.mentions m
        JOIN monitor.targets t ON t.id = m.target_id
        WHERE p_target_id IS NULL OR m.target_id = p_target_id
        GROUP BY t.nombre
      ) x
    ), '{}'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.monitor_get_dashboard_stats(uuid) TO anon, authenticated, service_role;

-- Timeline: NULL = todos los objetivos
CREATE OR REPLACE FUNCTION monitor.get_volume_timeline(
  p_target_id uuid DEFAULT NULL,
  p_range_hours int DEFAULT 72
)
RETURNS TABLE(
  bucket_start timestamptz,
  mention_count bigint,
  avg_sentimiento numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  WITH params AS (
    SELECT
      p_target_id AS tid,
      greatest(p_range_hours, 1) AS hours,
      CASE WHEN p_range_hours <= 96 THEN 'hour' ELSE 'day' END AS trunc_unit,
      CASE WHEN p_range_hours <= 96 THEN interval '1 hour' ELSE interval '1 day' END AS bucket
  ),
  series AS (
    SELECT generate_series(
      date_trunc((SELECT trunc_unit FROM params),
        now() - ((SELECT hours FROM params) || ' hours')::interval),
      date_trunc((SELECT trunc_unit FROM params), now()),
      (SELECT bucket FROM params)
    ) AS bucket_start
  ),
  counts AS (
    SELECT
      date_trunc(p.trunc_unit, m.published_at) AS bucket_start,
      count(*)::bigint AS mention_count,
      round(avg(c.sentimiento)::numeric, 2) AS avg_sentimiento
    FROM monitor.mentions m
    LEFT JOIN monitor.classifications c ON c.mention_id = m.id
    CROSS JOIN params p
    WHERE (p.tid IS NULL OR m.target_id = p.tid)
      AND m.published_at >= now() - (p.hours || ' hours')::interval
    GROUP BY 1
  )
  SELECT
    s.bucket_start,
    coalesce(ct.mention_count, 0) AS mention_count,
    coalesce(ct.avg_sentimiento, 0) AS avg_sentimiento
  FROM series s
  LEFT JOIN counts ct ON ct.bucket_start = s.bucket_start
  ORDER BY s.bucket_start;
$$;

DROP FUNCTION IF EXISTS public.monitor_get_volume_timeline(int);
CREATE OR REPLACE FUNCTION public.monitor_get_volume_timeline(
  p_range_hours int DEFAULT 72,
  p_target_id uuid DEFAULT NULL
)
RETURNS TABLE(bucket_start timestamptz, mention_count bigint, avg_sentimiento numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT * FROM monitor.get_volume_timeline(p_target_id, p_range_hours);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_get_volume_timeline(int, uuid) TO anon, authenticated, service_role;

-- Narrativas y cola de revisión con filtro opcional
CREATE OR REPLACE FUNCTION monitor.list_narrative_clusters(
  p_target_id uuid DEFAULT NULL,
  p_days int DEFAULT 7
)
RETURNS TABLE(
  cluster_key text,
  cluster_type text,
  mention_count bigint,
  avg_sentimiento numeric,
  sample_resumen text,
  last_seen timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  WITH params AS (
    SELECT p_target_id AS tid, greatest(p_days, 1) AS days
  ),
  base AS (
    SELECT
      m.id,
      m.published_at,
      c.sentimiento,
      c.resumen,
      c.temas,
      c.etiquetas
    FROM monitor.mentions m
    JOIN monitor.classifications c ON c.mention_id = m.id
    CROSS JOIN params p
    WHERE (p.tid IS NULL OR m.target_id = p.tid)
      AND m.published_at > now() - (p.days || ' days')::interval
  ),
  by_tema AS (
    SELECT
      tema AS cluster_key,
      'tema'::text AS cluster_type,
      count(*)::bigint AS mention_count,
      round(avg(sentimiento)::numeric, 2) AS avg_sentimiento,
      (array_agg(resumen ORDER BY published_at DESC))[1] AS sample_resumen,
      max(published_at) AS last_seen
    FROM base, unnest(temas) AS tema
    GROUP BY tema
  ),
  by_etiqueta AS (
    SELECT
      etiqueta AS cluster_key,
      'etiqueta'::text AS cluster_type,
      count(*)::bigint AS mention_count,
      round(avg(sentimiento)::numeric, 2) AS avg_sentimiento,
      (array_agg(resumen ORDER BY published_at DESC))[1] AS sample_resumen,
      max(published_at) AS last_seen
    FROM base, unnest(etiquetas) AS etiqueta
    GROUP BY etiqueta
  )
  SELECT * FROM by_tema
  UNION ALL
  SELECT * FROM by_etiqueta
  ORDER BY mention_count DESC, last_seen DESC;
$$;

DROP FUNCTION IF EXISTS public.monitor_list_narrative_clusters(int);
CREATE OR REPLACE FUNCTION public.monitor_list_narrative_clusters(
  p_days int DEFAULT 7,
  p_target_id uuid DEFAULT NULL
)
RETURNS TABLE(
  cluster_key text,
  cluster_type text,
  mention_count bigint,
  avg_sentimiento numeric,
  sample_resumen text,
  last_seen timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT * FROM monitor.list_narrative_clusters(p_target_id, p_days);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_narrative_clusters(int, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION monitor.list_review_queue(
  p_limit int DEFAULT 30,
  p_target_id uuid DEFAULT NULL
)
RETURNS TABLE(
  mention_id uuid,
  text text,
  url text,
  source text,
  published_at timestamptz,
  sentimiento smallint,
  etiquetas text[],
  resumen text,
  urgencia smallint,
  confianza real,
  model text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT
    m.id,
    m.text,
    m.url,
    m.source::text,
    m.published_at,
    c.sentimiento,
    c.etiquetas,
    c.resumen,
    c.urgencia,
    c.confianza,
    c.model
  FROM monitor.classifications c
  JOIN monitor.mentions m ON m.id = c.mention_id
  WHERE c.revisado_por_humano = false
    AND (c.confianza < 0.6 OR c.urgencia >= 2)
    AND (p_target_id IS NULL OR m.target_id = p_target_id)
  ORDER BY c.urgencia DESC, c.confianza ASC, m.published_at DESC
  LIMIT greatest(p_limit, 1);
$$;

DROP FUNCTION IF EXISTS public.monitor_list_review_queue(int);
CREATE OR REPLACE FUNCTION public.monitor_list_review_queue(
  p_limit int DEFAULT 30,
  p_target_id uuid DEFAULT NULL
)
RETURNS TABLE(
  mention_id uuid,
  text text,
  url text,
  source text,
  published_at timestamptz,
  sentimiento smallint,
  etiquetas text[],
  resumen text,
  urgencia smallint,
  confianza real,
  model text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT * FROM monitor.list_review_queue(p_limit, p_target_id);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_review_queue(int, uuid) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.monitor_list_semantic_narratives(int);
CREATE OR REPLACE FUNCTION public.monitor_list_semantic_narratives(
  p_limit int DEFAULT 20,
  p_target_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  label text,
  mention_count int,
  last_seen_at timestamptz,
  trend smallint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT n.id, n.label, n.mention_count, n.last_seen_at, n.trend
  FROM monitor.narratives n
  JOIN monitor.targets t ON t.id = n.target_id AND t.active
  WHERE n.centroid IS NOT NULL
    AND (p_target_id IS NULL OR n.target_id = p_target_id)
  ORDER BY n.last_seen_at DESC
  LIMIT greatest(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_semantic_narratives(int, uuid) TO anon, authenticated, service_role;
