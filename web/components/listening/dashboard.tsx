import Link from 'next/link';
import type { ReactNode } from 'react';
import { InboxFeed } from './inbox-feed';
import { TROLL_DISCLAIMER } from '@/lib/constants';
import { CASO_IDS, CASO_META, type CasoId } from '@/lib/inbox';
import { buildListeningHref, type ListeningSort } from '@/lib/listening-query';
import type { ListeningView, TopAuthor } from '@/lib/listening-data';
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

function AuthorList({ title, authors, empty }: { title: string; authors: TopAuthor[]; empty: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-2.5 sm:p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 sm:text-[11px]">
        {title}
      </p>
      {authors.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {authors.map((a) => (
            <li key={a.handle || a.label} className="truncate text-xs text-zinc-800 sm:text-sm">
              {a.label}
              <span className="ml-1 tabular-nums text-zinc-400">{a.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
      {view.minUrgencia >= 2 && !skip.has('urgencia') && (
        <input type="hidden" name="urgencia" value={String(view.minUrgencia)} />
      )}
      {view.sort !== 'ranking' && !skip.has('orden') && (
        <input type="hidden" name="orden" value={view.sort} />
      )}
    </>
  );
}

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

  const { sentiment, volume, cards } = view;
  const updated = new Date(view.fetchedAt).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const classifiedNote =
    sentiment.classified === 0
      ? 'Aún no hay filas de clasificación en esta ventana.'
      : sentiment.fromRules > 0 && sentiment.fromModel === 0
        ? `${sentiment.classified} clasificadas con reglas · no es un modelo`
        : `${sentiment.classified} clasificadas${sentiment.modelLabel ? ` · ${sentiment.modelLabel}` : ''}`;

  const sorts: { id: ListeningSort; label: string }[] = [
    { id: 'ranking', label: 'Prioridad' },
    { id: 'tiempo', label: 'Reciente' },
    { id: 'urgencia', label: 'Urgencia' },
    { id: 'engagement', label: 'Alcance' },
  ];

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#f4f5f7] text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] min-w-0 flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-bold text-white">
              AG
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Inbox
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Andrés Guschmer
              </h1>
              <p className="text-xs text-zinc-500">
                Menciones ranqueadas · actualizado {updated}
                {view.cacheSeconds ? ` · caché ${view.cacheSeconds / 60} min` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Chip href={href({ ventana: '7d' })} active={view.window === '7d'}>
                7 días
              </Chip>
              <Chip href={href({ ventana: '24h' })} active={view.window === '24h'}>
                24 h
              </Chip>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] min-w-0 px-4 py-4 sm:px-6">
        {view.error && (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {view.error}
          </p>
        )}

        <section className="grid min-w-0 grid-cols-3 gap-2">
          <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-2.5 sm:p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 sm:text-[11px]">
              Sentimiento
            </p>
            {sentiment.classified === 0 ? (
              <p className="mt-1 text-xs text-zinc-500 sm:text-sm">Sin tono en BD</p>
            ) : (
              <>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-zinc-100 sm:h-2">
                  {sentiment.positivo.count > 0 && (
                    <div className="h-full bg-emerald-500" style={{ width: `${sentiment.positivo.pct}%` }} />
                  )}
                  {sentiment.neutro.count > 0 && (
                    <div className="h-full bg-slate-400" style={{ width: `${sentiment.neutro.pct}%` }} />
                  )}
                  {sentiment.negativo.count > 0 && (
                    <div className="h-full bg-rose-500" style={{ width: `${sentiment.negativo.pct}%` }} />
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug tabular-nums text-zinc-800 sm:text-sm">
                  <span className="text-emerald-700">{sentiment.positivo.count}</span>
                  {' / '}
                  <span className="text-rose-700">{sentiment.negativo.count}</span>
                  {' / '}
                  <span className="text-slate-600">{sentiment.neutro.count}</span>
                </p>
              </>
            )}
            <p className="mt-1 hidden text-[11px] leading-snug text-zinc-400 sm:block">{classifiedNote}</p>
          </div>

          <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-2.5 sm:p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 sm:text-[11px]">
              Volumen
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{volume.h24}</p>
            <p className="text-[10px] leading-snug text-zinc-400 sm:text-[11px]">
              24 h · {volume.d7} / 7d · {cards.length} hilos
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-2.5 sm:p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 sm:text-[11px]">
              Tema
            </p>
            {view.topTheme ? (
              <>
                <p className="mt-1 text-sm font-semibold leading-snug sm:text-lg">{view.topTheme.label}</p>
                <p className="text-[10px] text-zinc-400 sm:text-[11px]">{view.topTheme.count} clasif.</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-zinc-500 sm:text-sm">Sin tema</p>
            )}
          </div>
        </section>
        <p className="mt-1.5 text-[11px] text-zinc-400 sm:hidden">{classifiedNote}</p>

        <section className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <AuthorList
            title="Autores +"
            authors={view.topPositiveAuthors}
            empty="Nadie con tono positivo en esta ventana"
          />
          <AuthorList
            title="Autores −"
            authors={view.topNegativeAuthors}
            empty="Nadie con tono negativo en esta ventana"
          />
        </section>

        <section className="mt-4 min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
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
            </div>

            <details
              className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2"
              open={
                Boolean(
                  view.keywordFilter ||
                    view.authorFilter ||
                    view.minUrgencia >= 2 ||
                    view.window === 'rango'
                ) || undefined
              }
            >
              <summary className="min-h-11 cursor-pointer list-none text-sm font-medium text-zinc-800 [&::-webkit-details-marker]:hidden">
                Más filtros · alias, autor, urgencia, fechas
              </summary>
              <div className="mt-3 flex min-w-0 flex-col gap-3 pb-1">
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
                      {a.count > 1 ? ` ${a.count}` : ''}
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
                    defaultValue={view.dateFrom}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none ring-zinc-900 focus:ring-2"
                  />
                </label>
                <label className="min-w-0 text-[11px] text-zinc-500">
                  Hasta
                  <input
                    type="date"
                    name="hasta"
                    defaultValue={view.dateTo}
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

        <InboxFeed cards={cards} />

        <p className="mt-8 pb-8 text-[11px] leading-relaxed text-zinc-400">
          {TROLL_DISCLAIMER}. YouTube se muestra como mención exacta, sin tono derivado. Los % de
          sentimiento usan solo filas reales de classifications (YouTube queda fuera). Alcance es el
          reach_score del colector, no likes sueltos. El estado abierto/visto/seguimiento queda en
          este navegador.{' '}
          <Link href="/feed" className="underline-offset-2 hover:underline">
            Inbox operador
          </Link>
        </p>
      </main>
    </div>
  );
}
