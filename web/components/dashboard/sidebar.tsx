'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Target } from '@/lib/types';
import { withTargetQuery } from '@/lib/target-params';

const NAV = [
  { href: '/feed', label: 'Inbox', desc: 'Menciones en vivo' },
  { href: '/analytics', label: 'Analytics', desc: 'Volumen y fuentes' },
  { href: '/narratives', label: 'Narrativas', desc: 'Temas activos' },
  { href: '/review', label: 'Revisión', desc: 'Cola manual' },
];

export function Sidebar({
  targets,
  targetId,
  targetName,
  reviewCount,
}: {
  targets: Target[];
  targetId: string | null;
  targetName: string;
  reviewCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  function navHref(href: string) {
    const extra: Record<string, string | undefined> = {};
    for (const key of ['range', 'days', 'source', 'urgency', 'q']) {
      const value = searchParams.get(key);
      if (value) extra[key] = value;
    }
    return withTargetQuery(href, targetId, extra);
  }

  const renderPanel = () => (
    <aside className="flex h-full w-72 max-w-[85vw] shrink-0 flex-col border-r border-zinc-200 bg-white lg:h-screen lg:w-64">
      <div className="border-b border-zinc-200 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
            M
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Monitor</p>
            <p className="text-xs text-zinc-500">estilo Stalkr</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <label
            htmlFor="target-select"
            className="text-[10px] font-medium uppercase tracking-wider text-zinc-400"
          >
            Político
          </label>
          <select
            id="target-select"
            value={targetId ?? 'all'}
            onChange={(e) => {
              const next = e.target.value === 'all' ? null : e.target.value;
              const href = withTargetQuery(pathname, next);
              window.location.href = href;
            }}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="all">Todos ({targets.length})</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 truncate text-xs text-zinc-500">{targetName}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={navHref(item.href)}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                active
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className={`text-xs ${active ? 'text-zinc-300' : 'text-zinc-400'}`}>
                  {item.desc}
                </p>
              </div>
              {item.href === '/review' && reviewCount > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    active ? 'bg-white text-zinc-900' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {reviewCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-4 text-xs text-zinc-400">
        <p>Inbox interno · no es la vista del candidato</p>
        <Link href="/" className="mt-2 inline-block text-zinc-700 underline-offset-2 hover:underline">
          Abrir escucha de Andrés Guschmer
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      <div className="flex w-full items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold">Operador</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl ring-1 ring-zinc-200"
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-50 h-full">{renderPanel()}</div>
        </div>
      )}
      <div className="hidden lg:flex lg:h-screen lg:shrink-0">{renderPanel()}</div>
    </>
  );
}
