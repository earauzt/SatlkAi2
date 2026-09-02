-- Agrupación de narrativas por temas y etiquetas (sin embeddings)

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
    SELECT
      coalesce(p_target_id, (SELECT id FROM monitor.targets WHERE active LIMIT 1)) AS tid,
      greatest(p_days, 1) AS days
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
    WHERE m.target_id = p.tid
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

CREATE OR REPLACE FUNCTION public.monitor_list_narrative_clusters(p_days int DEFAULT 7)
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
  SELECT * FROM monitor.list_narrative_clusters(NULL, p_days);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_narrative_clusters(int) TO anon, authenticated, service_role;
