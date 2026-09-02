-- Colector X, embeddings pgvector y narrativas semánticas

CREATE OR REPLACE FUNCTION public.monitor_list_x_sources()
RETURNS TABLE(id uuid, target_id uuid, type text, name text, url text, config jsonb, nombre text, aliases text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT s.id, s.target_id, s.type::text, s.name, s.url, s.config, t.nombre, t.aliases
  FROM monitor.sources s
  JOIN monitor.targets t ON t.id = s.target_id
  WHERE s.enabled AND s.type = 'x' AND t.active;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_x_sources() TO service_role;

CREATE OR REPLACE FUNCTION public.monitor_update_source_config(p_source_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  UPDATE monitor.sources
  SET config = config || p_patch, updated_at = now()
  WHERE id = p_source_id;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_update_source_config(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.monitor_list_unembedded_mentions(p_limit int DEFAULT 30)
RETURNS TABLE(id uuid, text text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT m.id, m.text
  FROM monitor.mentions m
  WHERE m.embedding IS NULL
    AND length(trim(m.text)) > 10
  ORDER BY m.published_at DESC
  LIMIT greatest(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_unembedded_mentions(int) TO service_role;

CREATE OR REPLACE FUNCTION public.monitor_set_mention_embedding(p_mention_id uuid, p_embedding vector)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  UPDATE monitor.mentions SET embedding = p_embedding, updated_at = now()
  WHERE id = p_mention_id;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_set_mention_embedding(uuid, vector) TO service_role;

-- Agrupa menciones con embedding en narrativas por similitud coseno (umbral 0.82)
CREATE OR REPLACE FUNCTION monitor.sync_narratives_from_embeddings(
  p_similarity_threshold float DEFAULT 0.82,
  p_min_cluster int DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
DECLARE
  v_target uuid;
  v_updated int := 0;
  v_seed record;
  v_cluster_id uuid;
  v_count int;
BEGIN
  SELECT id INTO v_target FROM monitor.targets WHERE active LIMIT 1;
  IF v_target IS NULL THEN RETURN '{"updated":0}'::jsonb; END IF;

  FOR v_seed IN
    SELECT m.id, m.embedding, m.text, m.published_at
    FROM monitor.mentions m
    LEFT JOIN monitor.classifications c ON c.mention_id = m.id
    WHERE m.target_id = v_target
      AND m.embedding IS NOT NULL
      AND m.published_at > now() - interval '30 days'
    ORDER BY m.published_at DESC
    LIMIT 200
  LOOP
    SELECT count(*)::int INTO v_count
    FROM monitor.mentions m2
    WHERE m2.target_id = v_target
      AND m2.embedding IS NOT NULL
      AND m2.id <> v_seed.id
      AND 1 - (m2.embedding <=> v_seed.embedding) >= p_similarity_threshold;

    IF v_count + 1 < p_min_cluster THEN
      CONTINUE;
    END IF;

    SELECT n.id INTO v_cluster_id
    FROM monitor.narratives n
    WHERE n.target_id = v_target
      AND n.centroid IS NOT NULL
      AND 1 - (n.centroid <=> v_seed.embedding) >= p_similarity_threshold
    ORDER BY n.centroid <=> v_seed.embedding
    LIMIT 1;

    IF v_cluster_id IS NULL THEN
      INSERT INTO monitor.narratives (target_id, label, centroid, mention_count, last_seen_at)
      VALUES (
        v_target,
        left(v_seed.text, 80),
        v_seed.embedding,
        v_count + 1,
        v_seed.published_at
      )
      RETURNING id INTO v_cluster_id;
    ELSE
      UPDATE monitor.narratives n SET
        mention_count = (
          SELECT count(*)::int FROM monitor.mentions m
          WHERE m.target_id = v_target AND m.embedding IS NOT NULL
            AND 1 - (m.embedding <=> n.centroid) >= p_similarity_threshold
        ),
        last_seen_at = greatest(n.last_seen_at, v_seed.published_at),
        updated_at = now()
      WHERE n.id = v_cluster_id;
    END IF;

    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated);
END;
$$;

CREATE OR REPLACE FUNCTION public.monitor_sync_narratives()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'monitor', 'public'
AS $$
  SELECT monitor.sync_narratives_from_embeddings(0.82, 2);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_sync_narratives() TO service_role;

CREATE OR REPLACE FUNCTION public.monitor_list_semantic_narratives(p_limit int DEFAULT 20)
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
  ORDER BY n.last_seen_at DESC
  LIMIT greatest(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.monitor_list_semantic_narratives(int) TO anon, authenticated, service_role;

INSERT INTO monitor.sources (target_id, type, name, config, enabled)
SELECT id, 'x', 'X — Daniel Noboa',
  '{"query": "(Daniel Noboa OR Noboa) lang:es", "max_results": 25}'::jsonb,
  true
FROM monitor.targets WHERE nombre = 'Daniel Noboa' AND active
AND NOT EXISTS (SELECT 1 FROM monitor.sources WHERE type = 'x' AND name = 'X — Daniel Noboa');

-- Índice vectorial (crear cuando hay datos)
CREATE INDEX IF NOT EXISTS idx_monitor_mentions_embedding
  ON monitor.mentions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
