const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = 'America/Guayaquil';

export type ReportPreset = '7d' | '30d' | 'rango';

export type ReportRange = {
  preset: ReportPreset;
  dateFrom: string;
  dateTo: string;
  startIso: string;
  endIso: string;
  days: number;
};

export function isDay(value: string | undefined | null): value is string {
  return Boolean(value && DATE_RE.test(value));
}

export function todayInGuayaquil(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + delta);
  return new Date(utc).toISOString().slice(0, 10);
}

function dayBoundGuayaquil(day: string, end: boolean): string {
  const suffix = end ? 'T23:59:59.999' : 'T00:00:00.000';
  const asLocal = new Date(`${day}${suffix}`);
  const shown = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(asLocal);
  // en-CA with time: "YYYY-MM-DD, HH:MM:SS" — usamos el instante UTC que
  // corresponde a ese reloj de Guayaquil.
  const offsetHours = 5;
  const isoLocal = `${day}T${end ? '23:59:59.999' : '00:00:00.000'}-0${offsetHours}:00`;
  void shown;
  return new Date(isoLocal).toISOString();
}

export function parseReportRange(params: {
  range?: string;
  desde?: string;
  hasta?: string;
}): ReportRange {
  const today = todayInGuayaquil();
  const dateFrom = isDay(params.desde) ? params.desde : '';
  const dateTo = isDay(params.hasta) ? params.hasta : '';
  if (dateFrom || dateTo) {
    const from = dateFrom || addDays(dateTo, -6);
    const to = dateTo || today;
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    return {
      preset: 'rango',
      dateFrom: start,
      dateTo: end,
      startIso: dayBoundGuayaquil(start, false),
      endIso: dayBoundGuayaquil(end, true),
      days: diffDays(start, end) + 1,
    };
  }
  const preset: ReportPreset = params.range === '30d' ? '30d' : '7d';
  const span = preset === '30d' ? 29 : 6;
  const from = addDays(today, -span);
  return {
    preset,
    dateFrom: from,
    dateTo: today,
    startIso: dayBoundGuayaquil(from, false),
    endIso: dayBoundGuayaquil(today, true),
    days: span + 1,
  };
}

function diffDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function formatDayEs(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatPeriodLabel(range: ReportRange): string {
  return `${formatDayEs(range.dateFrom)} — ${formatDayEs(range.dateTo)}`;
}

export function withReportQuery(
  path: string,
  extra: Record<string, string | undefined>
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) {
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}
