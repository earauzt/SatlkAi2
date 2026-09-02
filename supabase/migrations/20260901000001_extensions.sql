-- Extensiones requeridas para el monitor político
-- Compatible con Supabase (schema extensions) y Postgres local (public)

DO $$ BEGIN
  CREATE SCHEMA IF NOT EXISTS extensions;
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
