import { CASO_IDS } from './inbox';
import type { ListeningWindow } from './types';

export type ListeningSort = 'ranking' | 'tiempo' | 'urgencia' | 'engagement';

export type ListeningSearchParams = {
  ventana?: string;
  fuente?: string;
  caso?: string;
  sentimiento?: string;
  q?: string;
  autor?: string;
  kw?: string;
  urgencia?: string;
  desde?: string;
  hasta?: string;
  orden?: string;
};

export type ListeningHrefState = {
  window: ListeningWindow;
  sourceFilter: string;
  casoFilter: string;
  sentimentFilter: string;
  query: string;
  authorFilter: string;
  keywordFilter: string;
  minUrgencia: number;
  dateFrom: string;
  dateTo: string;
  sort: ListeningSort;
};

export type ListeningQueryOpts = ListeningHrefState;

const ALLOWED_SOURCE = new Set(['rss', 'youtube', 'x', 'google_news']);
const ALLOWED_SENT = new Set(['pos', 'neg', 'neu']);
const ALLOWED_CASO = new Set<string>(CASO_IDS);
const ALLOWED_SORT = new Set<ListeningSort>(['ranking', 'tiempo', 'urgencia', 'engagement']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value: string | undefined): value is string {
  return Boolean(value && DATE_RE.test(value));
}

export function parseListeningParams(params: ListeningSearchParams): ListeningQueryOpts {
  const dateFrom = isDay(params.desde) ? params.desde : '';
  const dateTo = isDay(params.hasta) ? params.hasta : '';
  const hasRange = Boolean(dateFrom || dateTo);
  const window: ListeningWindow = hasRange
    ? 'rango'
    : params.ventana === '24h'
      ? '24h'
      : '7d';
  const fuente = params.fuente?.trim() ?? '';
  const caso = params.caso?.trim() ?? '';
  const sentimiento = params.sentimiento?.trim() ?? '';
  const orden = (params.orden?.trim() ?? '') as ListeningSort;
  const urgenciaRaw = Number(params.urgencia);
  const minUrgencia = urgenciaRaw === 2 || urgenciaRaw === 3 ? urgenciaRaw : 0;

  return {
    window,
    sourceFilter: ALLOWED_SOURCE.has(fuente) ? fuente : '',
    casoFilter: ALLOWED_CASO.has(caso) ? caso : '',
    sentimentFilter: ALLOWED_SENT.has(sentimiento) ? sentimiento : '',
    query: params.q?.trim() ?? '',
    authorFilter: params.autor?.trim() ?? '',
    keywordFilter: params.kw?.trim() ?? '',
    minUrgencia,
    dateFrom,
    dateTo,
    sort: ALLOWED_SORT.has(orden) ? orden : 'ranking',
  };
}

export function buildListeningHref(
  basePath: string,
  view: ListeningHrefState,
  patch: Partial<{
    ventana: ListeningWindow;
    fuente: string;
    caso: string;
    sentimiento: string;
    q: string;
    autor: string;
    kw: string;
    urgencia: number;
    desde: string;
    hasta: string;
    orden: ListeningSort;
  }> = {}
) {
  const next: ListeningHrefState = {
    window: patch.ventana ?? view.window,
    sourceFilter: patch.fuente === undefined ? view.sourceFilter : patch.fuente,
    casoFilter: patch.caso === undefined ? view.casoFilter : patch.caso,
    sentimentFilter: patch.sentimiento === undefined ? view.sentimentFilter : patch.sentimiento,
    query: patch.q === undefined ? view.query : patch.q,
    authorFilter: patch.autor === undefined ? view.authorFilter : patch.autor,
    keywordFilter: patch.kw === undefined ? view.keywordFilter : patch.kw,
    minUrgencia: patch.urgencia === undefined ? view.minUrgencia : patch.urgencia,
    dateFrom: patch.desde === undefined ? view.dateFrom : patch.desde,
    dateTo: patch.hasta === undefined ? view.dateTo : patch.hasta,
    sort: patch.orden === undefined ? view.sort : patch.orden,
  };

  if (patch.ventana === '24h' || patch.ventana === '7d') {
    next.window = patch.ventana;
    next.dateFrom = '';
    next.dateTo = '';
  }
  if (patch.desde !== undefined || patch.hasta !== undefined) {
    next.window = next.dateFrom || next.dateTo ? 'rango' : next.window === 'rango' ? '7d' : next.window;
  }

  const sp = new URLSearchParams();
  if (next.window === '24h') sp.set('ventana', '24h');
  if (next.window === 'rango') {
    if (next.dateFrom) sp.set('desde', next.dateFrom);
    if (next.dateTo) sp.set('hasta', next.dateTo);
  }
  if (next.sourceFilter) sp.set('fuente', next.sourceFilter);
  if (next.casoFilter) sp.set('caso', next.casoFilter);
  if (next.sentimentFilter) sp.set('sentimiento', next.sentimentFilter);
  if (next.query) sp.set('q', next.query);
  if (next.authorFilter) sp.set('autor', next.authorFilter);
  if (next.keywordFilter) sp.set('kw', next.keywordFilter);
  if (next.minUrgencia >= 2) sp.set('urgencia', String(next.minUrgencia));
  if (next.sort !== 'ranking') sp.set('orden', next.sort);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
