-- Timeline de volumen + fuentes YouTube (producción usa schema monitor vía MCP)

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
      coalesce(p_target_id, (SELECT id FROM monitor.targets WHERE active LIMIT 1)) AS tid,
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
    WHERE m.target_id = p.tid
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

CREATE OR REPLACE FUNCTION public.monitor_get_volume_timeline(p_range_hours int DEFAULT 72)
RETURNS TABLE(bucket_start timestamptz, mention_count bigint, avg_sentimiento numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT * FROM monitor.get_volume_timeline(NULL, p_range_hours);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_get_volume_timeline(int) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.monitor_list_youtube_sources()
RETURNS TABLE(id uuid, target_id uuid, type text, name text, url text, config jsonb, nombre text, aliases text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT s.id, s.target_id, s.type::text, s.name, s.url, s.config, t.nombre, t.aliases
  FROM monitor.sources s
  JOIN monitor.targets t ON t.id = s.target_id
  WHERE s.enabled AND s.type = 'youtube' AND t.active;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_youtube_sources() TO service_role;
