'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  formatCompact,
  formatPct,
  type AuthorRow,
  type ListeningReport,
  type SentimentMix,
  type ThemeShare,
} from '@/lib/listening-report';
import { CASO_IDS, CASO_META, type CasoId } from '@/lib/inbox';
import { RANKING_STEPS } from '@/lib/listening-rank';
import type { ListeningView } from '@/lib/listening-data';
import type { ListeningHrefState } from '@/lib/listening-query';
import { buildListeningHref } from '@/lib/listening-query';

type HrefFn = (patch: Parameters<typeof buildListeningHref>[2]) => string;

const MODULES = [
  { id: 'volumen', label: 'Volumen' },
  { id: 'tono', label: 'Tono' },
  { id: 'temas', label: 'Temas' },
  { id: 'casos', label: 'Casos' },
  { id: 'cuentas', label: 'Cuentas' },
  { id: 'formatos', label: 'Formatos' },
  { id: 'prioridad', label: 'Prioridad' },
] as const;

function FieldHint({ text }: { text: string }) {
  return <p className="mt-1 text-[11px] leading-snug text-zinc-400">{text}</p>;
}

function Card({ children, className = '', dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border p-3 shadow-sm sm:p-4 ${
        dark ? 'border-slate-800 bg-[#0b1e2d] text-white' : 'border-zinc-200 bg-white text-zinc-900'
      } ${className}`}
    >
      {children}
    </section>
  );
}

function VolumeBars({ points, hrefForDay }: { points: { day: string; count: number }[]; hrefForDay?: (day: string) => string }) {
  const max = Math.max(...points.map((p) => p.count), 1);
  return (
    <div className="min-w-0">
      <div className="flex h-28 items-end gap-0.5 sm:h-32 sm:gap-1">
        {points.map((p) => {
          const h = p.count === 0 ? 4 : Math.max(8, (p.count / max) * 100);
          const bar = (
            <div
              title={`${p.day}: ${p.count}`}
              className={`w-full rounded-t ${p.count === 0 ? 'bg-zinc-100' : 'bg-sky-400'} ${hrefForDay ? 'hover:bg-sky-500' : ''}`}
              style={{ height: `${h}%` }}
            />
          );
          return (
            <div key={p.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-zinc-400">{p.count || ''}</span>
              {hrefForDay ? (
                <Link href={hrefForDay(p.day)} className="flex h-full w-full items-end" aria-label={`${p.day}: ${p.count} hilos`}>
                  {bar}
                </Link>
              ) : (
                bar
              )}
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

function SentimentBlock({
  mix,
  title,
  highlight,
  href,
}: {
  mix: SentimentMix;
  title: string;
  highlight: string;
  href: (sent: 'neg' | 'neu' | 'pos') => string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{title}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{highlight}</p>
      {mix.classified === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Sin classifications.sentimiento en este recorte.</p>
      ) : (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-zinc-100">
            {mix.negativo.count > 0 && <div className="h-full bg-rose-500" style={{ width: `${mix.negativo.pct}%` }} />}
            {mix.neutro.count > 0 && <div className="h-full bg-slate-400" style={{ width: `${mix.neutro.pct}%` }} />}
            {mix.positivo.count > 0 && <div className="h-full bg-emerald-500" style={{ width: `${mix.positivo.pct}%` }} />}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Link href={href('neg')} className="rounded-lg bg-rose-50 px-2 py-1 font-medium text-rose-800 hover:bg-rose-100">
              {formatPct(mix.negativo.pct)} neg
            </Link>
            <Link href={href('neu')} className="rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200">
              {formatPct(mix.neutro.pct)} neu
            </Link>
            <Link href={href('pos')} className="rounded-lg bg-emerald-50 px-2 py-1 font-medium text-emerald-800 hover:bg-emerald-100">
              {formatPct(mix.positivo.pct)} pos
            </Link>
          </div>
        </>
      )}
      <FieldHint
        text={`n=${mix.n} · clasificadas ${mix.classified} · YouTube omitido ${mix.skippedYoutube} · classifications.sentimiento`}
      />
    </div>
  );
}

function ClickRows({
  items,
  empty,
}: {
  items: { id: string; href: string; active: boolean; label: string; right: string; pct: number }[];
  empty: string;
}) {
  if (items.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  const colors = ['bg-rose-400', 'bg-amber-400', 'bg-violet-400', 'bg-sky-500', 'bg-emerald-500', 'bg-zinc-500'];
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={item.id}>
          <Link href={item.href} className={`block min-w-0 rounded-xl p-1.5 ${item.active ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium text-zinc-800">{item.label}</span>
              <span className="shrink-0 tabular-nums text-zinc-500">{item.right}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${colors[i % colors.length]}`}
                style={{ width: `${Math.max(item.pct, item.pct > 0 ? 4 : 0)}%` }}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AuthorLinks({
  rows,
  empty,
  mode,
  href,
  activeHandle,
}: {
  rows: AuthorRow[];
  empty: string;
  mode: 'presencia' | 'engagement';
  href: (handle: string) => string;
  activeHandle: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const key = row.handle || row.label;
        const active = Boolean(row.handle && activeHandle && row.handle.toLocaleLowerCase('es') === activeHandle.toLocaleLowerCase('es'));
        const inner = (
          <>
            <span className="min-w-0 truncate font-medium text-zinc-800">{row.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-500">
              {mode === 'presencia' ? `${row.count} hilos` : formatCompact(row.engagement)}
              {row.followers != null ? ` · ${formatCompact(row.followers)} seg.` : ' · N/D seg.'}
            </span>
          </>
        );
        const className = `flex min-h-10 items-center justify-between gap-2 rounded-xl px-2 text-sm ${
          active ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50'
        }`;
        return (
          <li key={key}>
            {row.handle ? (
              <Link href={href(row.handle)} className={className}>
                {inner}
              </Link>
            ) : (
              <div className={className}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function themeItems(
  themes: ThemeShare[],
  href: HrefFn,
  kind: 'eje' | 'tema',
  active: string
) {
  return themes.map((t) => ({
    id: t.id,
    href: href(kind === 'eje' ? { eje: active === t.id ? '' : t.id } : { tema: active === t.id ? '' : t.id }),
    active: active === t.id,
    label: t.label,
    right: `${formatPct(t.pct)} · ${t.count}`,
    pct: t.pct,
  }));
}

export function HqModules({
  view,
  href,
}: {
  view: ListeningView;
  href: HrefFn;
}) {
  const report = view.report;
  const casoBase = Math.max(...CASO_IDS.map((id) => view.casoCounts[id]), 1);

  return (
    <div className="space-y-3">
      <Card>
        <h3 id="hq-volumen" className="scroll-mt-2 text-sm font-semibold">Volumen diario</h3>
        <p className="text-[11px] text-zinc-400">Hilos deduplicados · mismo reprintKey que el feed · clic en un día recorta fechas</p>
        {report.resultados === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Sin hilos en este recorte.</p>
        ) : (
          <div className="mt-3">
            <VolumeBars
              points={report.volume}
              hrefForDay={(day) => href({ desde: day, hasta: day })}
            />
          </div>
        )}
      </Card>

      <div id="hq-tono" className="grid min-w-0 scroll-mt-2 gap-3">
        <Card>
          <SentimentBlock
            mix={report.sentimentAll}
            title={`Muestra del recorte · n=${report.sentimentAll.n}`}
            highlight={report.sentimentAll.classified > 0 ? `${formatPct(report.sentimentAll.negativo.pct)} negativo` : 'N/D'}
            href={(sent) => href({ sentimiento: view.sentimentFilter === sent ? '' : sent })}
          />
        </Card>
        <Card>
          <SentimentBlock
            mix={report.sentimentDirect}
            title={`Menciones directas · n=${report.sentimentDirect.n}`}
            highlight={
              report.sentimentDirect.classified > 0
                ? `${formatPct(report.sentimentDirect.negativo.pct)} negativo`
                : report.directCount === 0
                  ? 'Sin menciones directas'
                  : 'N/D'
            }
            href={(sent) => href({ sentimiento: view.sentimentFilter === sent ? '' : sent, directo: '1' })}
          />
          <Link
            href={href({ directo: view.directOnly ? '' : '1' })}
            className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-zinc-800 underline-offset-2 hover:underline"
          >
            {view.directOnly ? 'Quitar filtro de nombre en el texto' : 'Ver solo hilos que nombran al objetivo'}
          </Link>
        </Card>
      </div>

      <Card>
        <h3 id="hq-temas" className="scroll-mt-2 text-sm font-semibold">Temas en el texto</h3>
        <FieldHint text="KEYWORD_THEMES sobre mentions.text · clic filtra el inbox y los KPIs" />
        <div className="mt-3">
          <ClickRows
            items={themeItems(report.keywordThemes, href, 'eje', view.ejeFilter)}
            empty="Ningún eje de reglas coincidió en este recorte."
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Temas etiquetados</h3>
        <FieldHint text="classifications.temas · sin “otro”" />
        <div className="mt-3">
          <ClickRows
            items={themeItems(report.themes, href, 'tema', view.themeFilter)}
            empty="Sin temas en classifications para este recorte."
          />
        </div>
      </Card>

      <Card>
        <h3 id="hq-casos" className="scroll-mt-2 text-sm font-semibold">Casos del inbox</h3>
        <FieldHint text="Agrupación política (ataque, rumor, elogio, territorio, deporte, ruido). Conteos de la ventana, antes de otros filtros." />
        <div className="mt-3">
          <ClickRows
            items={CASO_IDS.filter((id) => view.casoCounts[id] > 0).map((id: CasoId) => ({
              id,
              href: href({ caso: view.casoFilter === id ? '' : id }),
              active: view.casoFilter === id,
              label: CASO_META[id].label,
              right: String(view.casoCounts[id]),
              pct: (view.casoCounts[id] / casoBase) * 100,
            }))}
            empty="Sin casos en esta ventana."
          />
        </div>
      </Card>

      <Card>
        <h3 id="hq-cuentas" className="scroll-mt-2 text-sm font-semibold">Cuentas por presencia</h3>
        <FieldHint text="Hilos canónicos · clic filtra por autor" />
        <div className="mt-3">
          <AuthorLinks
            rows={report.authorsPresence}
            mode="presencia"
            empty="No hay cuentas identificadas."
            href={(handle) => href({ autor: view.authorFilter === handle ? '' : handle })}
            activeHandle={view.authorFilter}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Influencia por engagement</h3>
        <FieldHint text="Suma reach_score · seguidores = author_meta.followers o N/D" />
        <div className="mt-3">
          <AuthorLinks
            rows={report.authorsEngagement}
            mode="engagement"
            empty="No hay cuentas con reach_score."
            href={(handle) => href({ autor: view.authorFilter === handle ? '' : handle })}
            activeHandle={view.authorFilter}
          />
        </div>
      </Card>

      <div id="hq-formatos" className="grid min-w-0 scroll-mt-2 gap-3">
        <Card>
          <h3 className="text-sm font-semibold">Audiencia (género y edad)</h3>
          <p className="mt-2 text-2xl font-semibold">N/D</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">{report.demographics.note}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Origen geográfico</h3>
          <p className="mt-2 text-2xl font-semibold">N/D</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">{report.geo.note}</p>
        </Card>
        <Card dark>
          <h3 className="text-sm font-semibold text-white">Formatos</h3>
          <p className="mt-3 text-2xl font-semibold text-amber-300">
            {report.formats.videoPct != null ? formatPct(report.formats.videoPct) : 'N/D'}
          </p>
          <p className="text-sm text-slate-300">video · {report.formats.videoCount} hilos YouTube</p>
          {report.formats.videoCount > 0 && (
            <Link
              href={href({ fuente: view.sourceFilter === 'youtube' ? '' : 'youtube' })}
              className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-amber-200 underline-offset-2 hover:underline"
            >
              Filtrar YouTube
            </Link>
          )}
          <p className="mt-3 text-2xl font-semibold text-pink-300">N/D</p>
          <p className="text-sm text-slate-300">imagen · adjuntos de X no se guardan</p>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{report.formats.note}</p>
        </Card>
      </div>

      <Card>
        <h3 id="hq-prioridad" className="scroll-mt-2 text-sm font-semibold">Cómo se prioriza el feed</h3>
        <p className="mt-1 text-[11px] text-zinc-400">
          Orden «Prioridad». Cambia a Reciente, Urgencia o Alcance arriba del feed.
        </p>
        <ol className="mt-3 space-y-2">
          {RANKING_STEPS.map((step, i) => (
            <li key={step.id} className="flex min-w-0 gap-2">
              <span className="w-5 shrink-0 text-xs font-semibold text-amber-600">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900">{step.title}</p>
                <p className="text-xs leading-relaxed text-zinc-500">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <details className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <summary className="min-h-11 cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Campos y disponibilidad
        </summary>
        <div className="mt-3 min-w-0 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                <th className="pb-2 font-medium">Métrica</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {report.fields.map((row) => (
                <tr key={row.metric} className="border-t border-zinc-100 align-top">
                  <td className="py-2 font-medium text-zinc-800">{row.metric}</td>
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
      </details>
    </div>
  );
}

export function ProgressiveAnalysis({
  view,
  basePath,
  variant,
}: {
  view: ListeningView;
  basePath: string;
  variant: 'sheet' | 'rail';
}) {
  const href: HrefFn = (patch) => buildListeningHref(basePath, view as ListeningHrefState, patch);
  const [open, setOpen] = useState<string | 'todos' | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (variant === 'rail') {
    return (
      <aside className="min-w-0">
        <div className="sticky top-40 max-h-[calc(100vh-11rem)] space-y-3 overflow-y-auto pb-8 pr-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Análisis · mismo recorte que el feed
          </p>
          <HqModules view={view} href={href} />
        </div>
      </aside>
    );
  }

  return (
    <div>
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setOpen(open === 'todos' ? null : 'todos')}
          className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium ${
            open === 'todos' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200'
          }`}
        >
          Análisis
        </button>
        {MODULES.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => setOpen(open === mod.id ? null : mod.id)}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium ${
              open === mod.id ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200'
            }`}
          >
            {mod.label}
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-30">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Cerrar análisis" onClick={() => setOpen(null)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl bg-[#f4f5f7] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                {open === 'todos' ? 'Análisis del recorte' : MODULES.find((m) => m.id === open)?.label}
              </p>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium ring-1 ring-zinc-200"
              >
                Cerrar
              </button>
            </div>
            <div
              ref={(node) => {
                if (!node || open === 'todos') return;
                node.querySelector(`#hq-${open}`)?.scrollIntoView({ block: 'start' });
              }}
            >
              <HqModules view={view} href={href} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-zinc-700 underline-offset-2 hover:underline"
    >
      Imprimir / exportar
    </button>
  );
}
