-- Row Level Security — mono-usuario con allowlist de email

-- Roles de Supabase (necesarios para políticas RLS; no-op si ya existen)
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE narratives ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

-- Helper: verifica si el usuario autenticado está en la allowlist.
-- Compatible con Supabase (auth.jwt) y Postgres local (sin JWT).
CREATE OR REPLACE FUNCTION is_allowed_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  BEGIN
    v_email := auth.jwt() ->> 'email';
  EXCEPTION
    WHEN undefined_function OR invalid_schema_name THEN
      v_email := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  END;

  RETURN EXISTS (
    SELECT 1 FROM app_config
    WHERE allowed_email = coalesce(v_email, '')
      AND v_email IS NOT NULL
      AND v_email <> ''
  );
END;
$$;

-- Lectura: solo usuario allowlisted
CREATE POLICY "allowlist_select" ON app_config
  FOR SELECT TO authenticated USING (is_allowed_user());

CREATE POLICY "allowlist_select" ON targets
  FOR SELECT TO authenticated USING (is_allowed_user());

CREATE POLICY "allowlist_select" ON sources
  FOR SELECT TO authenticated USING (is_allowed_user());

CREATE POLICY "allowlist_select" ON actors
  FOR SELECT TO authenticated USING (is_allowed_user());

CREATE POLICY "allowlist_select" ON mentions
  FOR SELECT TO authenticated USING (is_allowed_user());

CREATE POLICY "allowlist_select" ON classifications
  FOR SELECT TO authenticated USING (is_allowed_user());

CREATE POLICY "allowlist_select" ON alerts
  FOR SELECT TO authenticated USING (is_allowed_user());

CREATE POLICY "allowlist_select" ON narratives
  FOR SELECT TO authenticated USING (is_allowed_user());

CREATE POLICY "allowlist_select" ON timeline_events
  FOR SELECT TO authenticated USING (is_allowed_user());

-- Escritura dashboard: solo usuario allowlisted (futuro)
CREATE POLICY "allowlist_all" ON targets
  FOR ALL TO authenticated USING (is_allowed_user()) WITH CHECK (is_allowed_user());

CREATE POLICY "allowlist_all" ON sources
  FOR ALL TO authenticated USING (is_allowed_user()) WITH CHECK (is_allowed_user());

CREATE POLICY "allowlist_all" ON timeline_events
  FOR ALL TO authenticated USING (is_allowed_user()) WITH CHECK (is_allowed_user());

CREATE POLICY "allowlist_update_classifications" ON classifications
  FOR UPDATE TO authenticated USING (is_allowed_user()) WITH CHECK (is_allowed_user());

-- Service role (colectores n8n) inserta vía funciones SECURITY DEFINER.
-- Revocar acceso directo anon/authenticated a funciones de escritura.
REVOKE ALL ON FUNCTION upsert_mention FROM PUBLIC;
REVOKE ALL ON FUNCTION upsert_mentions_batch FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_mention TO service_role;
GRANT EXECUTE ON FUNCTION upsert_mentions_batch TO service_role;

REVOKE ALL ON FUNCTION purge_citizen_mentions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_citizen_mentions TO service_role;
