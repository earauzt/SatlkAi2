import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  formatCompact,
  formatPct,
  type AuthorRow,
  type ListeningReport,
  type SentimentMix,
  type ThemeShare,
} from '@/lib/listening-report';
import { withReportQuery } from '@/lib/report-range';

const KPI_ACCENT = ['bg-amber-400', 'bg-emerald-500', 'bg-sky-500', 'bg-rose-400', 'bg-violet-500', 'bg-zinc-400'];

function corteLabel(iso: string) {
  return new Date(iso).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium ${
        active ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50'
      }`}
    >
      {children}
    </Link>
  );
}

function Card({
  children,
  className = '',
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5 ${
        dark ? 'border-slate-800 bg-[#0b1e2d] text-white' : 'border-zinc-200 bg-white text-zinc-900'
      } ${className}`}
    >
      {children}
    </section>
  );
}

function FieldHint({ text }: { text: string }) {
  return <p className="mt-1 text-[11px] leading-snug text-zinc-400">{text}</p>;
}

function SentimentBar({ mix, title, highlight }: { mix: SentimentMix; title: string; highlight: string }) {
  const empty = mix.classified === 0;
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{highlight}</p>
      {empty ? (
        <p className="mt-2 text-sm text-zinc-500">Sin filas de classifications.sentimiento en este recorte.</p>
      ) : (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-zinc-100">
            {mix.negativo.count > 0 && (
              <div className="h-full bg-rose-500" style={{ width: `${mix.negativo.pct}%` }} />
            )}
            {mix.neutro.count > 0 && (
              <div className="h-full bg-slate-400" style={{ width: `${mix.neutro.pct}%` }} />
            )}
            {mix.positivo.count > 0 && (
              <div className="h-full bg-emerald-500" style={{ width: `${mix.positivo.pct}%` }} />
            )}
          </div>
          <p className="mt-2 text-sm tabular-nums text-zinc-600">
            <span className="text-rose-700">{formatPct(mix.negativo.pct)} neg</span>
            {' · '}
            <span className="text-slate-600">{formatPct(mix.neutro.pct)} neu</span>
            {' · '}
            <span className="text-emerald-700">{formatPct(mix.positivo.pct)} pos</span>
          </p>
        </>
      )}
      <FieldHint
        text={`n=${mix.n} · clasificadas ${mix.classified} · YouTube omitido ${mix.skippedYoutube} · campo classifications.sentimiento`}
      />
    </div>
  );
}

function HBarList({
  items,
  empty,
}: {
  items: { id: string; label: string; right: string; pct: number; color?: string }[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  const colors = ['bg-rose-400', 'bg-amber-400', 'bg-violet-400', 'bg-sky-500', 'bg-emerald-500', 'bg-zinc-500', 'bg-pink-400', 'bg-indigo-400'];
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={item.id} className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium text-zinc-800">{item.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-500">{item.right}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full ${item.color ?? colors[i % colors.length]}`}
              style={{ width: `${Math.max(item.pct, item.pct > 0 ? 4 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function VolumeBars({ points }: { points: { day: string; count: number }[] }) {
  const max = Math.max(...points.map((p) => p.count), 1);
  return (
    <div className="min-w-0">
      <div className="flex h-36 items-end gap-1 sm:gap-1.5">
        {points.map((p) => {
          const h = p.count === 0 ? 4 : Math.max(8, (p.count / max) * 100);
          return (
            <div key={p.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-zinc-400">{p.count || ''}</span>
              <div
                title={`${p.day}: ${p.count}`}
                className={`w-full rounded-t ${p.count === 0 ? 'bg-zinc-100' : 'bg-sky-400'}`}
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
        <span>{points[0]?.day ?? ''}</span>
        <span>{points.at(-1)?.day ?? ''}</span>
      </div>
    </div>
  );
}

function AuthorTable({ rows, empty, mode }: { rows: AuthorRow[]; empty: string; mode: 'presencia' | 'engagement' }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[280px] text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
            <th className="pb-2 font-medium">Cuenta</th>
            <th className="pb-2 text-right font-medium">{mode === 'presencia' ? 'Hilos' : 'Reach'}</th>
            <th className="pb-2 text-right font-medium">Seguidores</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.handle || row.label} className="border-t border-zinc-100">
              <td className="max-w-[180px] truncate py-2 font-medium text-zinc-800">{row.label}</td>
              <td className="py-2 text-right tabular-nums text-zinc-600">
                {mode === 'presencia' ? row.count : formatCompact(row.engagement)}
              </td>
              <td className="py-2 text-right tabular-nums text-zinc-500">
                {row.followers != null ? formatCompact(row.followers) : 'N/D'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function themeItems(themes: ThemeShare[]) {
  return themes.map((t) => ({
    id: t.id,
    label: t.label,
    right: `${formatPct(t.pct)} · ${t.count}`,
    pct: t.pct,
  }));
}

export function ReportView({
  report,
  basePath,
  extraQuery = {},
  variant = 'client',
  inboxHref,
}: {
  report: ListeningReport;
  basePath: string;
  extraQuery?: Record<string, string | undefined>;
  variant?: 'client' | 'ops';
  inboxHref: string;
}) {
  const href = (patch: Record<string, string | undefined>) =>
    withReportQuery(basePath, { ...extraQuery, ...patch });

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {variant === 'client' && (
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              Social listening · informe
            </p>
          )}
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            {report.targetName} en la conversación digital
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Periodo {report.periodLabel} · corte {corteLabel(report.corteAt)} (America/Guayaquil)
            {report.truncated ? ' · muestra limitada a 2.000 filas' : ''}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Chip href={href({ range: '7d', desde: '', hasta: '' })} active={report.range.preset === '7d'}>
            7 días
          </Chip>
          <Chip href={href({ range: '30d', desde: '', hasta: '' })} active={report.range.preset === '30d'}>
            30 días
          </Chip>
          <Link
            href={inboxHref}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            Inbox
          </Link>
        </div>
      </div>

      <form action={basePath} method="get" className="flex min-w-0 flex-wrap items-end gap-2">
        {Object.entries(extraQuery).map(([key, value]) =>
          value && key !== 'desde' && key !== 'hasta' && key !== 'range' ? (
            <input key={key} type="hidden" name={key} value={value} />
          ) : null
        )}
        <label className="min-w-0 text-[11px] text-zinc-500">
          Desde
          <input
            type="date"
            name="desde"
            defaultValue={report.range.dateFrom}
            lang="es-EC"
            className="mt-1 block min-h-11 w-full min-w-[10rem] rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900 focus:ring-2"
          />
        </label>
        <label className="min-w-0 text-[11px] text-zinc-500">
          Hasta
          <input
            type="date"
            name="hasta"
            defaultValue={report.range.dateTo}
            lang="es-EC"
            className="mt-1 block min-h-11 w-full min-w-[10rem] rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900 focus:ring-2"
          />
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white">
          Aplicar fechas
        </button>
      </form>

      {report.error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {report.error} · el informe usa la consulta directa a monitor.mentions si la RPC no está aplicada.
        </p>
      )}

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {report.kpis.map((kpi, i) => (
          <div key={kpi.key} className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 h-8 w-0.5 shrink-0 rounded ${KPI_ACCENT[i % KPI_ACCENT.length]}`} />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{kpi.label}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums sm:text-2xl">{kpi.value}</p>
                <p className="text-[10px] leading-snug text-zinc-400">
                  {kpi.status === 'nd' ? 'N/D · ' : ''}
                  {kpi.hint}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600">Hallazgo central</p>
        <p className="mt-2 text-base leading-relaxed text-zinc-800">{report.hallazgo}</p>
        <FieldHint text="Derivado solo de los KPIs de este recorte. No se copian cifras de informes externos." />
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Volumen diario</h3>
        <p className="text-[11px] text-zinc-400">Hilos deduplicados por día (America/Guayaquil) · mismo reprintKey que el inbox</p>
        {report.resultados === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Sin hilos en el periodo.</p>
        ) : (
          <div className="mt-4">
            <VolumeBars points={report.volume} />
          </div>
        )}
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <SentimentBar
            mix={report.sentimentAll}
            title={`Muestra del periodo · n=${report.sentimentAll.n}`}
            highlight={
              report.sentimentAll.classified > 0
                ? `${formatPct(report.sentimentAll.negativo.pct)} negativo`
                : 'N/D'
            }
          />
        </Card>
        <Card>
          <SentimentBar
            mix={report.sentimentDirect}
            title={`Menciones directas al objetivo · n=${report.sentimentDirect.n}`}
            highlight={
              report.sentimentDirect.classified > 0
                ? `${formatPct(report.sentimentDirect.negativo.pct)} negativo`
                : report.directCount === 0
                  ? 'Sin menciones directas'
                  : 'N/D'
            }
          />
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold">Participación en temas (texto)</h3>
          <FieldHint text="Porcentaje de hilos cuyo texto coincide con KEYWORD_THEMES" />
          <div className="mt-3">
            <HBarList
              items={themeItems(report.keywordThemes)}
              empty="Ningún tema de reglas coincidió en este recorte."
            />
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Temas etiquetados</h3>
          <FieldHint text="classifications.temas · participación sobre etiquetas distintas de “otro”" />
          <div className="mt-3">
            <HBarList
              items={themeItems(report.themes)}
              empty="Sin temas en classifications para este recorte."
            />
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold">Cuentas por presencia</h3>
          <FieldHint text="Hilos canónicos por author_handle resuelto" />
          <div className="mt-3">
            <AuthorTable
              rows={report.authorsPresence}
              mode="presencia"
              empty="No hay cuentas identificadas en el periodo."
            />
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Influencia por engagement</h3>
          <FieldHint text="Suma de reach_score del hilo · seguidores = author_meta.followers" />
          <div className="mt-3">
            <AuthorTable
              rows={report.authorsEngagement}
              mode="engagement"
              empty="No hay cuentas con reach_score en el periodo."
            />
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="text-sm font-semibold">Audiencia (género y edad)</h3>
          <p className="mt-3 text-3xl font-semibold">N/D</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{report.demographics.note}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Origen geográfico</h3>
          <p className="mt-3 text-3xl font-semibold">N/D</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{report.geo.note}</p>
        </Card>
        <Card dark>
          <h3 className="text-sm font-semibold text-white">Formatos del contenido</h3>
          <p className="mt-4 text-3xl font-semibold text-amber-300">
            {report.formats.videoPct != null ? formatPct(report.formats.videoPct) : 'N/D'}
          </p>
          <p className="text-sm text-slate-300">video · {report.formats.videoCount} hilos YouTube</p>
          <p className="mt-4 text-3xl font-semibold text-pink-300">N/D</p>
          <p className="text-sm text-slate-300">imagen · adjuntos de X no se guardan</p>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">{report.formats.note}</p>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card dark>
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300">Subcorpus directo</p>
          <p className="mt-3 text-4xl font-semibold tabular-nums">
            {report.directCount} de {report.resultados}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            hilos cuyo texto contiene el nombre o un alias de {report.targetName}
          </p>
          <div className="my-4 h-px bg-amber-400/80" />
          <p className="text-sm font-medium text-amber-300">
            {report.resultados > 0 ? formatPct(report.targetInTextPct) : 'N/D'} del recorte deduplicado
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Cómo se construye la lectura</h3>
          <ol className="mt-3 space-y-3">
            {report.narrative.map((item, i) => (
              <li key={item.id} className="flex min-w-0 gap-3">
                <span className="w-6 shrink-0 text-sm font-semibold text-amber-600">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-zinc-600">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-semibold">Campos y disponibilidad</h3>
        <div className="mt-3 min-w-0 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                <th className="pb-2 font-medium">Métrica</th>
                <th className="pb-2 font-medium">Campo</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {report.fields.map((row) => (
                <tr key={row.metric} className="border-t border-zinc-100 align-top">
                  <td className="py-2 font-medium text-zinc-800">{row.metric}</td>
                  <td className="py-2 font-mono text-[11px] text-zinc-500">{row.field}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                        row.status === 'live' ? 'bg-emerald-50 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {row.status === 'live' ? 'En vivo' : 'N/D'}
                    </span>
                  </td>
                  <td className="py-2 text-zinc-600">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
