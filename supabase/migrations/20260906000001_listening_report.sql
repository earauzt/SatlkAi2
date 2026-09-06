-- Ventana de informe: menciones + clasificación, sin embeddings.
-- La deduplicación (reprintKey) se aplica en el servidor web para
-- coincidir con el inbox. Esta RPC solo recorta la ventana y omite vector.

CREATE OR REPLACE FUNCTION public.monitor_list_report_window(
  p_target_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT now() - interval '7 days',
  p_to timestamptz DEFAULT now(),
  p_limit int DEFAULT 2000
)
RETURNS TABLE(
  id uuid,
  text text,
  url text,
  author_handle text,
  author_meta jsonb,
  source text,
  published_at timestamptz,
  reach_score int,
  tipo_fuente text,
  simhash bigint,
  target_nombre text,
  target_aliases text[],
  sentimiento smallint,
  temas text[],
  etiquetas text[],
  resumen text,
  urgencia smallint,
  model text,
  tipo_actor text
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
    m.author_handle,
    m.author_meta,
    m.source::text,
    m.published_at,
    m.reach_score,
    m.tipo_fuente,
    m.simhash,
    t.nombre,
    t.aliases,
    c.sentimiento,
    c.temas,
    c.etiquetas,
    c.resumen,
    c.urgencia,
    c.model,
    c.tipo_actor::text
  FROM monitor.mentions m
  JOIN monitor.targets t ON t.id = m.target_id
  LEFT JOIN monitor.classifications c ON c.mention_id = m.id
  WHERE (p_target_id IS NULL OR m.target_id = p_target_id)
    AND m.published_at >= p_from
    AND m.published_at <= p_to
  ORDER BY m.published_at DESC
  LIMIT greatest(least(coalesce(p_limit, 2000), 5000), 1);
$$;

COMMENT ON FUNCTION public.monitor_list_report_window(uuid, timestamptz, timestamptz, int) IS
  'Filas slim para el informe de escucha. Sin embedding. Dedup en la app (reprintKey).';

GRANT EXECUTE ON FUNCTION public.monitor_list_report_window(uuid, timestamptz, timestamptz, int)
  TO anon, authenticated, service_role;
