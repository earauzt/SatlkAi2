import { Sidebar } from './sidebar';
import { StatsBar } from './stats-bar';
import { Suspense } from 'react';
import type { DashboardStats } from '@/lib/types';

export function DashboardShell({
  stats,
  title,
  subtitle,
  children,
  showStats = true,
}: {
  stats: DashboardStats;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showStats?: boolean;
}) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-zinc-50 lg:flex-row">
      <Suspense fallback={<div className="h-12 w-full bg-white lg:h-screen lg:w-64" />}>
        <Sidebar
          targets={stats.targets}
          targetId={stats.target_id}
          targetName={stats.target_name}
          reviewCount={stats.review_queue}
        />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Vista operador
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl min-w-0 space-y-6">
            {showStats && <StatsBar stats={stats} />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
