import Link from 'next/link';
import type { ReactNode } from 'react';
import { InboxFeed } from './inbox-feed';
import { PrintButton, ProgressiveAnalysis } from './hq-analytics';
import { TROLL_DISCLAIMER } from '@/lib/constants';
import { formatCompact, formatPct } from '@/lib/listening-report';
import { CASO_IDS, CASO_META, type CasoId } from '@/lib/inbox';
import { activeListeningFilters, buildListeningHref, type ListeningSort } from '@/lib/listening-query';
import type { ListeningView } from '@/lib/listening-data';
import type { ListeningWindow } from '@/lib/types';

function Chip({
  href: to,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={to}
      className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium ${
        active
          ? 'bg-zinc-900 text-white'
          : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50'
      }`}
    >
      {children}
    </Link>
  );
}

function HiddenFields({
  view,
  omit,
}: {
  view: ListeningView;
  omit: string[];
}) {
  const skip = new Set(omit);
  return (
    <>
      {view.window === '24h' && !skip.has('ventana') && (
        <input type="hidden" name="ventana" value="24h" />
      )}
      {view.window === '30d' && !skip.has('ventana') && (
        <input type="hidden" name="ventana" value="30d" />
      )}
      {view.window === 'rango' && view.dateFrom && !skip.has('desde') && (
        <input type="hidden" name="desde" value={view.dateFrom} />
      )}
      {view.window === 'rango' && view.dateTo && !skip.has('hasta') && (
        <input type="hidden" name="hasta" value={view.dateTo} />
      )}
      {view.sourceFilter && !skip.has('fuente') && (
        <input type="hidden" name="fuente" value={view.sourceFilter} />
      )}
      {view.casoFilter && !skip.has('caso') && (
        <input type="hidden" name="caso" value={view.casoFilter} />
      )}
      {view.sentimentFilter && !skip.has('sentimiento') && (
        <input type="hidden" name="sentimiento" value={view.sentimentFilter} />
      )}
      {view.query && !skip.has('q') && <input type="hidden" name="q" value={view.query} />}
      {view.authorFilter && !skip.has('autor') && (
        <input type="hidden" name="autor" value={view.authorFilter} />
      )}
      {view.keywordFilter && !skip.has('kw') && (
        <input type="hidden" name="kw" value={view.keywordFilter} />
      )}
      {view.themeFilter && !skip.has('tema') && (
        <input type="hidden" name="tema" value={view.themeFilter} />
      )}
      {view.ejeFilter && !skip.has('eje') && (
        <input type="hidden" name="eje" value={view.ejeFilter} />
      )}
      {view.directOnly && !skip.has('directo') && <input type="hidden" name="directo" value="1" />}
      {view.minUrgencia >= 2 && !skip.has('urgencia') && (
        <input type="hidden" name="urgencia" value={String(view.minUrgencia)} />
      )}
      {view.sort !== 'ranking' && !skip.has('orden') && (
        <input type="hidden" name="orden" value={view.sort} />
      )}
    </>
  );
}

function corteLabel(iso: string) {
  return new Date(iso).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const KPI_ACCENT = ['bg-amber-400', 'bg-emerald-500', 'bg-sky-500', 'bg-rose-400', 'bg-violet-500', 'bg-zinc-400'];

export function ListeningDashboard({
  view,
  basePath,
}: {
  view: ListeningView;
  basePath: string;
}) {
  const href = (
    patch: Parameters<typeof buildListeningHref>[2]
  ) => buildListeningHref(basePath, view, patch);
  const { report } = view;
  const updated = corteLabel(view.fetchedAt);
  const active = activeListeningFilters(view);
  const printHref = `${basePath === '/guschmer' ? '/guschmer/informe' : '/informe'}?imprimir=1`;

  const sorts: { id: ListeningSort; label: string }[] = [
    { id: 'ranking', label: 'Prioridad' },
    { id: 'tiempo', label: 'Reciente' },
    { id: 'urgencia', label: 'Urgencia' },
    { id: 'engagement', label: 'Alcance' },
  ];

  const kpis = [
    {
      key: 'resultados',
      label: 'Resultados',
      value: formatCompact(report.resultados),
      hint: report.rawCount !== report.resultados ? `${report.rawCount} brutos` : 'hilos deduplicados',
      href: null as string | null,
    },
    {
      key: 'engagement',
      label: 'Engagement',
      value: formatCompact(report.engagement),
      hint: 'suma reach_score',
      href: href({ orden: 'engagement' }),
    },
    {
      key: 'autores',
      label: 'Autores únicos',
      value: formatCompact(report.uniqueAuthors),
      hint: 'cuentas identificadas',
      href: null,
    },
    {
      key: 'xmix',
      label: 'X en el mix',
      value: formatPct(report.xMixPct),
      hint: `${report.xCount} de ${report.rawCount}`,
      href: href({ fuente: view.sourceFilter === 'x' ? '' : 'x' }),
    },
    {
      key: 'directo',
      label: 'Objetivo en el texto',
      value: report.resultados > 0 ? formatPct(report.targetInTextPct) : 'N/D',
      hint: `${report.directCount} de ${report.resultados} hilos`,
      href: href({ directo: view.directOnly ? '' : '1' }),
    },
    {
      key: 'periodo',
      label: 'Periodo + corte',
      value: report.periodLabel,
      hint: `corte ${updated}`,
      href: null,
    },
  ];

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#f4f5f7] text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur print:static">
        <div className="mx-auto flex max-w-[1280px] min-w-0 flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-bold text-white">
              AG
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Escucha · inbox
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Andrés Guschmer
              </h1>
              <p className="text-xs text-zinc-500">
                Menciones + análisis · {report.periodLabel} · corte {updated}
                {view.cacheSeconds ? ` · caché ${view.cacheSeconds / 60} min` : ''}
                {report.truncated ? ' · muestra 2.000 filas' : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 print:hidden">
              <Chip href={href({ ventana: '7d' })} active={view.window === '7d'}>
                7 días
              </Chip>
              <Chip href={href({ ventana: '24h' })} active={view.window === '24h'}>
                24 h
              </Chip>
              <Chip href={href({ ventana: '30d' })} active={view.window === '30d'}>
                30 días
              </Chip>
            </div>
          </div>

          <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6">
            {kpis.map((kpi, i) => {
              const body = (
                <>
                  <span className={`mt-0.5 h-8 w-0.5 shrink-0 rounded ${KPI_ACCENT[i % KPI_ACCENT.length]}`} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{kpi.label}</p>
                    <p className="mt-0.5 truncate text-lg font-semibold tabular-nums sm:text-xl">{kpi.value}</p>
                    <p className="truncate text-[10px] leading-snug text-zinc-400">{kpi.hint}</p>
                  </div>
                </>
              );
              const className =
                'flex min-w-[9.5rem] shrink-0 items-start gap-2 rounded-2xl border border-zinc-200 bg-white p-2.5 sm:min-w-0';
              return kpi.href ? (
                <Link key={kpi.key} href={kpi.href} className={`${className} hover:bg-zinc-50`}>
                  {body}
                </Link>
              ) : (
                <div key={kpi.key} className={className}>
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] min-w-0 px-4 py-4 sm:px-6">
        {view.error && (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {view.error}
          </p>
        )}

        <section className="mb-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600">
            Lectura del periodo
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-800">{report.hallazgo}</p>
          <ol className="mt-3 space-y-2">
            {report.narrative.slice(0, 5).map((item, i) => (
              <li key={item.id} className="flex min-w-0 gap-2">
                <span className="w-5 shrink-0 text-xs font-semibold text-amber-600">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                  <p className="text-sm leading-relaxed text-zinc-600">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-zinc-400">
            Se recalcula con los mismos filtros que el feed. No se copian cifras de informes externos.
          </p>
        </section>

        {active.length > 0 && (
          <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 print:hidden">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Recorte activo · feed y KPIs
            </p>
            {active.map((item) => (
              <Link
                key={item.key + item.label}
                href={href(item.clear)}
                className="inline-flex min-h-9 items-center rounded-lg bg-zinc-900 px-2.5 text-xs font-medium text-white"
              >
                {item.label} ×
              </Link>
            ))}
            <Link href={basePath} className="text-xs text-zinc-600 underline-offset-2 hover:underline">
              Quitar todos
            </Link>
          </div>
        )}

        <div className="mb-3 xl:hidden print:hidden">
          <ProgressiveAnalysis view={{ ...view, cards: [] }} basePath={basePath} variant="sheet" />
        </div>

        <div className="min-w-0 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-4">
          <div className="min-w-0">
            <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4 print:hidden">
              <div className="flex min-w-0 flex-col gap-3">
                <form action={basePath} method="get" className="flex min-w-0 flex-row gap-2">
                  <HiddenFields view={view} omit={['q']} />
                  <input
                    type="search"
                    name="q"
                    defaultValue={view.query}
                    placeholder="Buscar en el texto…"
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm outline-none ring-zinc-900 focus:ring-2"
                  />
                  <button type="submit" className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white">
                    Buscar
                  </button>
                </form>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Sentimiento
                  </p>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Chip href={href({ sentimiento: '' })} active={!view.sentimentFilter}>
                      Todos
                    </Chip>
                    {(
                      [
                        ['neg', 'Negativo'],
                        ['neu', 'Neutro'],
                        ['pos', 'Positivo'],
                      ] as const
                    ).map(([id, label]) => (
                      <Chip
                        key={id}
                        href={href({ sentimiento: id })}
                        active={view.sentimentFilter === id}
                      >
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Caso
                  </p>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Chip href={href({ caso: '' })} active={!view.casoFilter}>
                      Todos
                    </Chip>
                    {CASO_IDS.map((id: CasoId) => (
                      <Chip key={id} href={href({ caso: id })} active={view.casoFilter === id}>
                        {CASO_META[id].label}
                        {view.casoCounts[id] > 0 ? ` ${view.casoCounts[id]}` : ''}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Fuente
                  </p>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {[
                      { id: '', label: 'Todas' },
                      { id: 'x', label: 'X' },
                      { id: 'youtube', label: 'YouTube' },
                      { id: 'rss', label: 'RSS' },
                      { id: 'google_news', label: 'Google News' },
                    ].map((s) => (
                      <Chip
                        key={s.id || 'src'}
                        href={href({ fuente: s.id })}
                        active={s.id === '' ? !view.sourceFilter : view.sourceFilter === s.id}
                      >
                        {s.label}
                        {s.id && view.sources.find((x) => x.key === s.id)?.count
                          ? ` ${view.sources.find((x) => x.key === s.id)?.count}`
                          : ''}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Orden
                  </p>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {sorts.map((s) => (
                      <Chip key={s.id} href={href({ orden: s.id })} active={view.sort === s.id}>
                        {s.label}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    Prioridad: original → tono negativo → urgencia → seguidores → reach → reprints.
                  </p>
                </div>

                <details
                  className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2"
                  open={
                    Boolean(
                      view.keywordFilter ||
                        view.authorFilter ||
                        view.minUrgencia >= 2 ||
                        view.window === 'rango' ||
                        view.themeFilter ||
                        view.ejeFilter ||
                        view.directOnly
                    ) || undefined
                  }
                >
                  <summary className="min-h-11 cursor-pointer list-none text-sm font-medium text-zinc-800 [&::-webkit-details-marker]:hidden">
                    Más filtros · alias, autor, urgencia, fechas, nombre en texto
                  </summary>
                  <div className="mt-3 flex min-w-0 flex-col gap-3 pb-1">
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                        Nombre en el texto
                      </p>
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <Chip href={href({ directo: '' })} active={!view.directOnly}>
                          Todos
                        </Chip>
                        <Chip href={href({ directo: '1' })} active={view.directOnly}>
                          Solo alias del objetivo
                        </Chip>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                        Alias
                      </p>
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <Chip href={href({ kw: '' })} active={!view.keywordFilter}>
                          Todos
                        </Chip>
                        {view.keywords.map((kw) => (
                          <Chip key={kw} href={href({ kw })} active={view.keywordFilter === kw}>
                            {kw}
                          </Chip>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                        Autor
                      </p>
                      <form action={basePath} method="get" className="mb-2 flex min-w-0 flex-row gap-2">
                        <HiddenFields view={view} omit={['autor']} />
                        <input
                          type="search"
                          name="autor"
                          defaultValue={view.authorFilter}
                          placeholder="Handle o medio…"
                          className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm outline-none ring-zinc-900 focus:ring-2"
                        />
                        <button type="submit" className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white">
                          Filtrar
                        </button>
                      </form>
                      {view.authors.length > 0 && (
                        <div className="flex min-w-0 flex-wrap gap-2">
                          <Chip href={href({ autor: '' })} active={!view.authorFilter}>
                            Todos
                          </Chip>
                          {view.authors.map((a) => (
                            <Chip
                              key={a.handle}
                              href={href({ autor: a.handle })}
                              active={view.authorFilter === a.handle}
                            >
                              {a.handle}
                              {a.count > 1 ? ` ` + a.count : ''}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                        Urgencia
                      </p>
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <Chip href={href({ urgencia: 0 })} active={view.minUrgencia < 2}>
                          Todas
                        </Chip>
                        <Chip href={href({ urgencia: 2 })} active={view.minUrgencia === 2}>
                          2 o más
                        </Chip>
                        <Chip href={href({ urgencia: 3 })} active={view.minUrgencia === 3}>
                          3
                        </Chip>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                        Fechas
                      </p>
                      <form action={basePath} method="get" className="flex min-w-0 flex-wrap items-end gap-2">
                        <HiddenFields view={view} omit={['desde', 'hasta', 'ventana']} />
                        <label className="min-w-0 text-[11px] text-zinc-500">
                          Desde
                          <input
                            type="date"
                            name="desde"
                            defaultValue={view.dateFrom || report.range.dateFrom}
                            lang="es-EC"
                            className="mt-1 block min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none ring-zinc-900 focus:ring-2"
                          />
                        </label>
                        <label className="min-w-0 text-[11px] text-zinc-500">
                          Hasta
                          <input
                            type="date"
                            name="hasta"
                            defaultValue={view.dateTo || report.range.dateTo}
                            lang="es-EC"
                            className="mt-1 block min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none ring-zinc-900 focus:ring-2"
                          />
                        </label>
                        <button type="submit" className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white">
                          Aplicar
                        </button>
                        {view.window === 'rango' && (
                          <Link
                            href={href({ ventana: '7d' as ListeningWindow, desde: '', hasta: '' })}
                            className="inline-flex min-h-11 items-center text-sm text-zinc-600 underline-offset-2 hover:underline"
                          >
                            Quitar rango
                          </Link>
                        )}
                      </form>
                    </div>
                  </div>
                </details>
              </div>
            </section>

            <InboxFeed cards={view.cards} basePath={basePath} hrefState={view} />
          </div>

          <div className="hidden min-w-0 xl:block print:block">
            <ProgressiveAnalysis view={{ ...view, cards: [] }} basePath={basePath} variant="rail" />
          </div>
        </div>

        <p className="mt-8 pb-8 text-[11px] leading-relaxed text-zinc-400 print:hidden">
          {TROLL_DISCLAIMER}. YouTube se muestra como mención exacta, sin tono derivado. Los % de
          sentimiento usan solo filas reales de classifications (YouTube queda fuera). Alcance es el
          reach_score del colector, no likes sueltos. El estado abierto/visto/seguimiento queda en
          este navegador. Género, edad, geo e imagen son N/D: el colector no los guarda.{' '}
          <PrintButton />
          {' · '}
          <Link href={printHref} className="underline-offset-2 hover:underline">
            Versión para imprimir
          </Link>
          {' · '}
          <Link href="/feed" className="underline-offset-2 hover:underline">
            Inbox operador
          </Link>
        </p>
      </main>
    </div>
  );
}
