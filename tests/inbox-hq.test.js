import test from 'node:test';
import assert from 'node:assert/strict';

function informeToInboxHref(inboxPath, params) {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const sp = new URLSearchParams();
  if (params.desde && DATE_RE.test(params.desde)) sp.set('desde', params.desde);
  if (params.hasta && DATE_RE.test(params.hasta)) sp.set('hasta', params.hasta);
  if (!params.desde && !params.hasta && params.range === '30d') {
    sp.set('ventana', '30d');
  }
  const qs = sp.toString();
  return qs ? `${inboxPath}?${qs}` : inboxPath;
}

function buildListeningHref(basePath, view, patch = {}) {
  const next = {
    window: patch.ventana ?? view.window,
    sourceFilter: patch.fuente === undefined ? view.sourceFilter : patch.fuente,
    sentimentFilter: patch.sentimiento === undefined ? view.sentimentFilter : patch.sentimiento,
    themeFilter: patch.tema === undefined ? view.themeFilter : patch.tema,
    ejeFilter: patch.eje === undefined ? view.ejeFilter : patch.eje,
    directOnly: patch.directo === undefined ? view.directOnly : patch.directo === '1',
    dateFrom: patch.desde === undefined ? view.dateFrom : patch.desde,
    dateTo: patch.hasta === undefined ? view.dateTo : patch.hasta,
  };
  if (patch.ventana === '24h' || patch.ventana === '7d' || patch.ventana === '30d') {
    next.window = patch.ventana;
    next.dateFrom = '';
    next.dateTo = '';
  }
  const sp = new URLSearchParams();
  if (next.window === '24h') sp.set('ventana', '24h');
  if (next.window === '30d') sp.set('ventana', '30d');
  if (next.sourceFilter) sp.set('fuente', next.sourceFilter);
  if (next.sentimentFilter) sp.set('sentimiento', next.sentimentFilter);
  if (next.themeFilter) sp.set('tema', next.themeFilter);
  if (next.ejeFilter) sp.set('eje', next.ejeFilter);
  if (next.directOnly) sp.set('directo', '1');
  if (next.window === 'rango') {
    if (next.dateFrom) sp.set('desde', next.dateFrom);
    if (next.dateTo) sp.set('hasta', next.dateTo);
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

const emptyView = {
  window: '7d',
  sourceFilter: '',
  sentimentFilter: '',
  themeFilter: '',
  ejeFilter: '',
  directOnly: false,
  dateFrom: '',
  dateTo: '',
};

test('informe 30d cae al inbox con ventana=30d', () => {
  assert.equal(informeToInboxHref('/guschmer', { range: '30d' }), '/guschmer?ventana=30d');
});

test('informe 7d cae al inbox sin query', () => {
  assert.equal(informeToInboxHref('/guschmer', { range: '7d' }), '/guschmer');
});

test('informe con fechas preserva desde/hasta', () => {
  assert.equal(
    informeToInboxHref('/', { desde: '2026-08-01', hasta: '2026-08-15' }),
    '/?desde=2026-08-01&hasta=2026-08-15'
  );
});

test('clic en tema y tono recortan el mismo href del inbox', () => {
  const themed = buildListeningHref('/guschmer', emptyView, { tema: 'seguridad', sentimiento: 'neg' });
  assert.equal(themed, '/guschmer?sentimiento=neg&tema=seguridad');
});

test('clic en eje + directo y 30d conviven', () => {
  const href = buildListeningHref('/guschmer', emptyView, {
    eje: 'prefectura_guayas',
    directo: '1',
    ventana: '30d',
  });
  assert.equal(href, '/guschmer?ventana=30d&eje=prefectura_guayas&directo=1');
});

test('prioridad tiene 6 criterios documentados', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../web/lib/listening-rank.ts', import.meta.url), 'utf8');
  const ids = [...src.matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['original', 'tono', 'urgencia', 'seguidores', 'alcance', 'visto']);
});
