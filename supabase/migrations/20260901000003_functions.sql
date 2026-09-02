-- Funciones de upsert, idempotencia y retención

-- Normaliza texto para comparación de duplicados
CREATE OR REPLACE FUNCTION normalize_mention_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')));
$$;

-- Calcula simhash simplificado (64 bits) para detección de near-duplicates
CREATE OR REPLACE FUNCTION compute_simhash(p_text text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_normalized text;
  v_words text[];
  v_word text;
  v_hash bigint;
  v_bits bigint[] := array_fill(0::bigint, ARRAY[64]);
  v_i int;
  v_result bigint := 0;
BEGIN
  v_normalized := normalize_mention_text(p_text);
  IF v_normalized = '' THEN
    RETURN 0;
  END IF;

  v_words := regexp_split_to_array(v_normalized, '\s+');

  FOREACH v_word IN ARRAY v_words LOOP
    v_hash := ('x' || left(md5(v_word), 16))::bit(64)::bigint;
    FOR v_i IN 0..63 LOOP
      IF (v_hash >> v_i) & 1 = 1 THEN
        v_bits[v_i + 1] := v_bits[v_i + 1] + 1;
      ELSE
        v_bits[v_i + 1] := v_bits[v_i + 1] - 1;
      END IF;
    END LOOP;
  END LOOP;

  FOR v_i IN 0..63 LOOP
    IF v_bits[v_i + 1] > 0 THEN
      v_result := v_result | (1::bigint << v_i);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- Upsert idempotente de menciones.
-- Retorna JSON: { action, mention_id, is_duplicate }
CREATE OR REPLACE FUNCTION upsert_mention(
  p_target_id       uuid,
  p_source          mention_source,
  p_external_id     text,
  p_url             text DEFAULT NULL,
  p_author_handle   text DEFAULT NULL,
  p_author_meta     jsonb DEFAULT '{}',
  p_text            text DEFAULT '',
  p_lang            text DEFAULT 'es',
  p_published_at    timestamptz DEFAULT now(),
  p_reach_score     int DEFAULT 0,
  p_simhash         bigint DEFAULT NULL,
  p_tipo_fuente     text DEFAULT 'prensa'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing      mentions%ROWTYPE;
  v_simhash       bigint;
  v_mention_id    uuid;
  v_action        text;
  v_is_duplicate  boolean := false;
BEGIN
  IF p_external_id IS NULL OR trim(p_external_id) = '' THEN
    RAISE EXCEPTION 'external_id es obligatorio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM targets WHERE id = p_target_id AND active = true) THEN
    RAISE EXCEPTION 'target_id inválido o inactivo: %', p_target_id;
  END IF;

  v_simhash := coalesce(p_simhash, compute_simhash(p_text));

  SELECT * INTO v_existing
  FROM mentions
  WHERE source = p_source AND external_id = p_external_id;

  IF FOUND THEN
    -- Idempotencia: si el contenido no cambió, solo actualizar fetched_at
    IF normalize_mention_text(v_existing.text) = normalize_mention_text(p_text)
       AND coalesce(v_existing.url, '') = coalesce(p_url, '')
       AND coalesce(v_existing.author_handle, '') = coalesce(p_author_handle, '') THEN
      UPDATE mentions
      SET fetched_at = now()
      WHERE id = v_existing.id;

      RETURN jsonb_build_object(
        'action', 'skipped',
        'mention_id', v_existing.id,
        'is_duplicate', true
      );
    END IF;

    UPDATE mentions SET
      url           = coalesce(p_url, url),
      author_handle = coalesce(p_author_handle, author_handle),
      author_meta   = coalesce(p_author_meta, author_meta),
      text          = p_text,
      lang          = coalesce(p_lang, lang),
      published_at  = p_published_at,
      reach_score   = p_reach_score,
      simhash       = v_simhash,
      tipo_fuente   = coalesce(p_tipo_fuente, tipo_fuente),
      fetched_at    = now(),
      updated_at    = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_mention_id;

    v_action := 'updated';
  ELSE
    INSERT INTO mentions (
      target_id, source, external_id, url, author_handle, author_meta,
      text, lang, published_at, reach_score, simhash, tipo_fuente
    ) VALUES (
      p_target_id, p_source, p_external_id, p_url, p_author_handle, p_author_meta,
      p_text, p_lang, p_published_at, p_reach_score, v_simhash, p_tipo_fuente
    )
    RETURNING id INTO v_mention_id;

    v_action := 'inserted';
  END IF;

  -- Detectar near-duplicate por simhash (mismo target, distinto external_id)
  IF EXISTS (
    SELECT 1 FROM mentions
    WHERE target_id = p_target_id
      AND id <> v_mention_id
      AND simhash = v_simhash
      AND simhash <> 0
      AND published_at > now() - interval '7 days'
  ) THEN
    v_is_duplicate := true;
  END IF;

  RETURN jsonb_build_object(
    'action', v_action,
    'mention_id', v_mention_id,
    'is_duplicate', v_is_duplicate
  );
END;
$$;

-- Upsert batch para colectores n8n (array JSON)
CREATE OR REPLACE FUNCTION upsert_mentions_batch(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    jsonb;
  v_result  jsonb;
  v_results jsonb[] := '{}';
  v_stats   jsonb := '{"inserted":0,"updated":0,"skipped":0,"errors":0}'::jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('results', '[]'::jsonb, 'stats', v_stats);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_result := upsert_mention(
        (v_item->>'target_id')::uuid,
        (v_item->>'source')::mention_source,
        v_item->>'external_id',
        v_item->>'url',
        v_item->>'author_handle',
        coalesce(v_item->'author_meta', '{}'::jsonb),
        coalesce(v_item->>'text', ''),
        coalesce(v_item->>'lang', 'es'),
        coalesce((v_item->>'published_at')::timestamptz, now()),
        coalesce((v_item->>'reach_score')::int, 0),
        (v_item->>'simhash')::bigint,
        coalesce(v_item->>'tipo_fuente', 'prensa')
      );

      v_results := array_append(v_results, v_result || jsonb_build_object('external_id', v_item->>'external_id'));

      v_stats := jsonb_set(
        v_stats,
        ARRAY[v_result->>'action'],
        to_jsonb(coalesce((v_stats->>(v_result->>'action'))::int, 0) + 1)
      );
    EXCEPTION WHEN OTHERS THEN
      v_stats := jsonb_set(v_stats, '{errors}', to_jsonb((v_stats->>'errors')::int + 1));
      v_results := array_append(v_results, jsonb_build_object(
        'action', 'error',
        'external_id', v_item->>'external_id',
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'results', to_jsonb(v_results),
    'stats', v_stats
  );
END;
$$;

-- Purga de menciones de ciudadanos > 90 días (política LOPDP)
CREATE OR REPLACE FUNCTION purge_citizen_mentions(p_retention_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM mentions m
  USING classifications c
  WHERE m.id = c.mention_id
    AND c.tipo_actor = 'ciudadano'
    AND m.published_at < now() - (p_retention_days || ' days')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_targets_updated_at
  BEFORE UPDATE ON targets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sources_updated_at
  BEFORE UPDATE ON sources FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_mentions_updated_at
  BEFORE UPDATE ON mentions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_narratives_updated_at
  BEFORE UPDATE ON narratives FOR EACH ROW EXECUTE FUNCTION set_updated_at();
