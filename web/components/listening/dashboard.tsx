import Link from 'next/link';
import type { ReactNode } from 'react';
import { ListeningMentionCard } from './mention-card';
import { TROLL_DISCLAIMER } from '@/lib/constants';
import type { ListeningView } from '@/lib/listening-data';
import type { ListeningWindow } from '@/lib/types';

function href(
  basePath: string,
  view: Pick<ListeningView, 'window' | 'sourceFilter' | 'query'>,
  patch: { ventana?: ListeningWindow; fuente?: string; q?: string }
) {
  const sp = new URLSearchParams();
  const window = patch.ventana ?? view.window;
  const fuente = patch.fuente === undefined ? view.sourceFilter : patch.fuente;
  const q = patch.q === undefined ? view.query : patch.q;
  if (window === '24h') sp.set('ventana', '24h');
  if (fuente) sp.set('fuente', fuente);
  if (q) sp.set('q', q);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function Tab({
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
      className={`inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors ${
        active
          ? 'bg-zinc-900 text-white'
          : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50'
      }`}
    >
      {children}
    </Link>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function ListeningDashboard({
  view,
  basePath,
}: {
  view: ListeningView;
  basePath: string;
}) {
  const { sentiment, volume, sources, themes, authors, cards } = view;
  const sourceTotal = sources.reduce((s, x) => s + x.count, 0);
  const updated = new Date(view.fetchedAt).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#f4f5f7] text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] min-w-0 flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-bold text-white">
              AG
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Escucha pública
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Andrés Guschmer
              </h1>
              <p className="text-xs text-zinc-500">
                Cómo se habla de ti en prensa, YouTube y X · actualizado {updated}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            <Tab href={href(basePath, view, { ventana: '7d' })} active={view.window === '7d'}>
              7 días
            </Tab>
            <Tab href={href(basePath, view, { ventana: '24h' })} active={view.window === '24h'}>
              24 horas
            </Tab>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          Las banderas de cuentas inauténticas son heurísticas automáticas, no una afirmación.
          No hay detección de bots con certeza.
        </p>

        {view.error && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudieron leer todas las tablas: {view.error}
          </p>
        )}

        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:gap-6">
          <div className="flex min-w-0 flex-col gap-4 xl:w-[26rem] xl:shrink-0">
            <Card
              title="Sentimiento"
              hint={
                sentiment.total === 0
                  ? 'Sin menciones en esta ventana.'
                  : sentiment.fromDb === 0
                    ? `Sobre ${sentiment.total} menciones tuyas en la ventana. Todavía no hay clasificación guardada: el tono se estima con reglas de palabras clave, no con un modelo de IA.`
                    : `Sobre ${sentiment.total} menciones. ${sentiment.fromDb} con clasificación guardada; ${sentiment.fromRules} estimadas por reglas de palabras clave.`
              }
            >
              {sentiment.total === 0 ? (
                <p className="text-sm text-zinc-500">No hay datos para partir.</p>
              ) : (
                <>
                  <div className="flex h-3 min-w-0 overflow-hidden rounded-full bg-zinc-100">
                    {sentiment.positivo.count > 0 && (
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${sentiment.positivo.pct}%` }}
                      />
                    )}
                    {sentiment.neutro.count > 0 && (
                      <div
                        className="h-full bg-slate-400"
                        style={{ width: `${sentiment.neutro.pct}%` }}
                      />
                    )}
                    {sentiment.negativo.count > 0 && (
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${sentiment.negativo.pct}%` }}
                      />
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
                    {(
                      [
                        ['Positivo', sentiment.positivo, 'text-emerald-700'],
                        ['Negativo', sentiment.negativo, 'text-rose-700'],
                        ['Neutro', sentiment.neutro, 'text-slate-700'],
                      ] as const
                    ).map(([label, bucket, color]) => (
                      <div
                        key={label}
                        className="flex items-baseline justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2"
                      >
                        <dt className={`text-sm font-medium ${color}`}>{label}</dt>
                        <dd className="text-sm tabular-nums text-zinc-900">
                          <span className="text-lg font-semibold">{bucket.count}</span>
                          <span className="ml-1 text-xs text-zinc-500">{bucket.pct}%</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </Card>

            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Card title="Volumen" hint="Cuántas menciones hay sobre ti en las últimas 24 horas y 7 días.">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-50 px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      24 h
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{volume.h24}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-50 px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      7 días
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{volume.d7}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-500">Histórico: {volume.total} menciones</p>
              </Card>

              <Card
                title="Fuentes"
                hint="Mezcla de RSS, YouTube y X (más Google News si hay notas de prensa)."
              >
                <ul className="space-y-2">
                  {sources.map((s) => {
                    const width = sourceTotal > 0 ? (s.count / sourceTotal) * 100 : 0;
                    return (
                      <li key={s.key} className="min-w-0">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{s.label}</span>
                          <span className="shrink-0 tabular-nums text-zinc-600">{s.count}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-zinc-800"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
              <Card
                title="De qué hablan"
                hint={
                  view.semanticCount > 0
                    ? 'Incluye narrativas semánticas cuando el sistema de embeddings tiene datos, más temas y palabras clave reales.'
                    : 'No hay agrupaciones por IA. Temas según etiquetas existentes o palabras clave ya definidas — no se inventan clusters.'
                }
              >
                {themes.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No hay temas etiquetados ni coincidencias de palabras clave en esta ventana.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {themes.map((theme) => (
                      <li key={theme.key} className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm leading-snug font-medium text-zinc-800">
                            {theme.label}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                            {theme.count}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {theme.origin === 'narrativa'
                            ? 'narrativa semántica'
                            : theme.origin === 'clasificacion'
                              ? 'tema clasificado'
                              : theme.origin === 'etiqueta'
                                ? 'etiqueta / reglas'
                                : 'palabras clave'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card
                title="Quién habla"
                hint="Cuentas, canales u outlets con menciones. Si no hay autor en la fila, se dice explícitamente."
              >
                {authors.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin autores en esta ventana.</p>
                ) : (
                  <ul className="space-y-3">
                    {authors.map((author) => (
                      <li key={author.key} className="min-w-0 border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 text-sm font-medium leading-snug break-words">
                            {author.label}
                          </p>
                          <span className="shrink-0 text-sm tabular-nums text-zinc-600">
                            {author.count}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {author.kind}
                          {author.followers !== null ? ` · ${author.followers} seguidores` : ''}
                          {author.source ? ` · ${author.source}` : ''}
                        </p>
                        {author.flagged && (
                          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                            {TROLL_DISCLAIMER}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <section className="min-w-0 flex-1 space-y-4">
            <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">Menciones</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {cards.length} en la ventana
                {view.sourceFilter ? ` · filtro ${view.sourceFilter}` : ''}
              </p>
              <form action={basePath} method="get" className="mt-3 flex min-w-0 flex-row gap-2">
                {view.window === '24h' && <input type="hidden" name="ventana" value="24h" />}
                {view.sourceFilter && <input type="hidden" name="fuente" value={view.sourceFilter} />}
                <input
                  type="search"
                  name="q"
                  defaultValue={view.query}
                  placeholder="Buscar en el texto…"
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm outline-none ring-zinc-900 focus:ring-2"
                />
                <button
                  type="submit"
                  className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white"
                >
                  Buscar
                </button>
              </form>
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                {[
                  { id: '', label: 'Todas' },
                  { id: 'x', label: 'X' },
                  { id: 'youtube', label: 'YouTube' },
                  { id: 'rss', label: 'RSS' },
                  { id: 'google_news', label: 'Google News' },
                ].map((s) => (
                  <Link
                    key={s.id || 'all'}
                    href={href(basePath, view, { fuente: s.id })}
                    className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium ${
                      view.sourceFilter === s.id
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200'
                    }`}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>

            {cards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="text-sm font-medium text-zinc-900">Sin menciones en esta vista</p>
                <p className="mt-1 text-sm text-zinc-500">Cambia la ventana o el filtro de fuente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cards.map((card) => (
                  <ListeningMentionCard key={card.mention.id} card={card} />
                ))}
              </div>
            )}
          </section>
        </div>

        <p className="mt-8 pb-6 text-center text-[11px] text-zinc-400">
          Vista para Andrés Guschmer · los otros objetivos no aparecen aquí ·{' '}
          <Link href="/feed" className="underline-offset-2 hover:underline">
            inbox operador
          </Link>
        </p>
      </main>
    </div>
  );
}
