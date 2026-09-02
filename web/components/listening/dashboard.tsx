import Link from 'next/link';
import type { ReactNode } from 'react';
import { ListeningMentionCard } from './mention-card';
import { TROLL_DISCLAIMER } from '@/lib/constants';
import { CASO_IDS, CASO_META, type CasoId } from '@/lib/inbox';
import type { ListeningView } from '@/lib/listening-data';
import type { ListeningWindow } from '@/lib/types';

type ViewQuery = Pick<
  ListeningView,
  'window' | 'sourceFilter' | 'casoFilter' | 'sentimentFilter' | 'query'
>;

function href(
  basePath: string,
  view: ViewQuery,
  patch: {
    ventana?: ListeningWindow;
    fuente?: string;
    caso?: string;
    sentimiento?: string;
    q?: string;
  }
) {
  const sp = new URLSearchParams();
  const window = patch.ventana ?? view.window;
  const fuente = patch.fuente === undefined ? view.sourceFilter : patch.fuente;
  const caso = patch.caso === undefined ? view.casoFilter : patch.caso;
  const sentimiento = patch.sentimiento === undefined ? view.sentimentFilter : patch.sentimiento;
  const q = patch.q === undefined ? view.query : patch.q;
  if (window === '24h') sp.set('ventana', '24h');
  if (fuente) sp.set('fuente', fuente);
  if (caso) sp.set('caso', caso);
  if (sentimiento) sp.set('sentimiento', sentimiento);
  if (q) sp.set('q', q);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

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

export function ListeningDashboard({
  view,
  basePath,
}: {
  view: ListeningView;
  basePath: string;
}) {
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
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Chip href={href(basePath, view, { ventana: '7d' })} active={view.window === '7d'}>
                7 días
              </Chip>
              <Chip href={href(basePath, view, { ventana: '24h' })} active={view.window === '24h'}>
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

        <section className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Sentimiento
            </p>
            {sentiment.classified === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Sin tono en base de datos</p>
            ) : (
              <>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-zinc-100">
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
                <p className="mt-2 text-sm tabular-nums text-zinc-800">
                  <span className="text-emerald-700">{sentiment.positivo.count} pos</span>
                  {' · '}
                  <span className="text-rose-700">{sentiment.negativo.count} neg</span>
                  {' · '}
                  <span className="text-slate-600">{sentiment.neutro.count} neu</span>
                </p>
              </>
            )}
            <p className="mt-1 text-[11px] leading-snug text-zinc-400">{classifiedNote}</p>
          </div>

          <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Volumen 24 h</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{volume.h24}</p>
            <p className="text-[11px] text-zinc-400">
              {volume.d7} en 7 días · {view.rawCount} filas · {cards.length} en inbox
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Tema principal</p>
            {view.topTheme ? (
              <>
                <p className="mt-1 text-lg font-semibold leading-snug">{view.topTheme.label}</p>
                <p className="text-[11px] text-zinc-400">{view.topTheme.count} en clasificaciones</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Sin tema clasificado</p>
            )}
          </div>
        </section>

        <section className="mt-4 min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
          <div className="flex min-w-0 flex-col gap-3">
            <form action={basePath} method="get" className="flex min-w-0 flex-row gap-2">
              {view.window === '24h' && <input type="hidden" name="ventana" value="24h" />}
              {view.sourceFilter && <input type="hidden" name="fuente" value={view.sourceFilter} />}
              {view.casoFilter && <input type="hidden" name="caso" value={view.casoFilter} />}
              {view.sentimentFilter && (
                <input type="hidden" name="sentimiento" value={view.sentimentFilter} />
              )}
              <input
                type="search"
                name="q"
                defaultValue={view.query}
                placeholder="Buscar…"
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
                <Chip href={href(basePath, view, { sentimiento: '' })} active={!view.sentimentFilter}>
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
                    href={href(basePath, view, { sentimiento: id })}
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
                <Chip href={href(basePath, view, { caso: '' })} active={!view.casoFilter}>
                  Todos
                </Chip>
                {CASO_IDS.map((id: CasoId) => (
                  <Chip
                    key={id}
                    href={href(basePath, view, { caso: id })}
                    active={view.casoFilter === id}
                  >
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
                    href={href(basePath, view, { fuente: s.id })}
                    active={s.id === '' ? !view.sourceFilter : view.sourceFilter === s.id}
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 space-y-3">
          <p className="text-xs text-zinc-500">
            {cards.length} hilos
            {view.rawCount > cards.length ? ` · ${view.rawCount} menciones brutas` : ''}
            {' · '}originales y negativo primero
          </p>
          {cards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
              <p className="text-sm font-medium">Nada en este filtro</p>
              <p className="mt-1 text-sm text-zinc-500">Cambia caso, tono o fuente.</p>
            </div>
          ) : (
            cards.map((card) => <ListeningMentionCard key={card.mention.id} card={card} />)
          )}
        </section>

        <p className="mt-8 pb-8 text-[11px] leading-relaxed text-zinc-400">
          {TROLL_DISCLAIMER}. YouTube se muestra como mención exacta, sin tono derivado. Los % de
          sentimiento usan solo filas reales de classifications (YouTube queda fuera).{' '}
          <Link href="/feed" className="underline-offset-2 hover:underline">
            Inbox operador
          </Link>
        </p>
      </main>
    </div>
  );
}
