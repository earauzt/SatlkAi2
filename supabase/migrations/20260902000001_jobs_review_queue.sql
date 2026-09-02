-- Jobs, digest helpers y cola de revisión manual

CREATE OR REPLACE FUNCTION public.monitor_check_volume_spike()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT monitor.check_volume_spike(NULL);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_check_volume_spike() TO service_role;

CREATE OR REPLACE FUNCTION public.monitor_purge_citizen_mentions(p_retention_days int DEFAULT 90)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT monitor.purge_citizen_mentions(p_retention_days);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_purge_citizen_mentions(int) TO service_role;

CREATE OR REPLACE FUNCTION monitor.list_review_queue(p_limit int DEFAULT 30)
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
  ORDER BY c.urgencia DESC, c.confianza ASC, m.published_at DESC
  LIMIT greatest(p_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.monitor_list_review_queue(p_limit int DEFAULT 30)
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
  SELECT * FROM monitor.list_review_queue(p_limit);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_review_queue(int) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION monitor.mark_reviewed(p_mention_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
BEGIN
  IF NOT monitor.is_allowed_user() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE monitor.classifications
  SET revisado_por_humano = true
  WHERE mention_id = p_mention_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.monitor_mark_reviewed(p_mention_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT monitor.mark_reviewed(p_mention_id);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_mark_reviewed(uuid) TO authenticated, service_role;

-- pg_cron (opcional): habilitar extensión en Dashboard → Database → Extensions
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('monitor_volume_spike', 'monitor_purge_citizens');

    PERFORM cron.schedule(
      'monitor_volume_spike',
      '15 * * * *',
      $$SELECT monitor.check_volume_spike(NULL)$$
    );

    PERFORM cron.schedule(
      'monitor_purge_citizens',
      '0 4 * * 0',
      $$SELECT monitor.purge_citizen_mentions(90)$$
    );
  END IF;
END;
$cron$;
