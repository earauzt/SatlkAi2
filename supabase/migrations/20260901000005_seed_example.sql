-- Datos de ejemplo para desarrollo local y tests.
-- Reemplazar allowed_email y nombre del político antes de producción.

INSERT INTO app_config (allowed_email)
VALUES ('tu-email@ejemplo.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO targets (id, nombre, aliases, handles, adversarios)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Político Ejemplo',
  ARRAY['Apodo1', 'Apodo2'],
  '{"x": "@cuenta_oficial"}'::jsonb,
  '[{"nombre": "Adversario 1", "aliases": ["AliasAdv"]}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (target_id, type, name, url, config, poll_interval_minutes)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'google_news',
    'Google News — Político Ejemplo',
    'https://news.google.com/rss/search?q=Pol%C3%ADtico+Ejemplo&hl=es-419&gl=EC&ceid=EC:es',
    '{"query": "Político Ejemplo", "hl": "es-419", "gl": "EC"}'::jsonb,
    15
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'rss',
    'El Universo',
    'https://www.eluniverso.com/arc/outboundfeeds/rss/?outputType=xml',
    '{}'::jsonb,
    15
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'rss',
    'Primicias',
    'https://www.primicias.ec/feed/',
    '{}'::jsonb,
    15
  )
ON CONFLICT DO NOTHING;
