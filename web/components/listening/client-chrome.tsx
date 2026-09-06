import Link from 'next/link';
import type { ReactNode } from 'react';

export function ClientChrome({
  title,
  subtitle,
  active,
  inboxHref,
  reportHref,
  children,
}: {
  title: string;
  subtitle: string;
  active: 'inbox' | 'informe';
  inboxHref: string;
  reportHref: string;
  children: ReactNode;
}) {
  const tab = (href: string, id: 'inbox' | 'informe', label: string) => (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium ${
        active === id ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50'
      }`}
    >
      {label}
    </Link>
  );

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
                Escucha · Andrés Guschmer
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
              <p className="text-xs text-zinc-500">{subtitle}</p>
            </div>
            <nav className="flex shrink-0 flex-wrap justify-end gap-2 print:hidden">
              {tab(inboxHref, 'inbox', 'Inbox')}
              {tab(reportHref, 'informe', 'Imprimir')}
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] min-w-0 px-4 py-4 sm:px-6">{children}</main>
    </div>
  );
}
