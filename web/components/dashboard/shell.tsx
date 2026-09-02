import { Sidebar } from './sidebar';
import { StatsBar } from './stats-bar';
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
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar
        targets={stats.targets}
        targetId={stats.target_id}
        targetName={stats.target_name}
        reviewCount={stats.review_queue}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-200 bg-white px-6 py-5 lg:px-8">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            {showStats && <StatsBar stats={stats} />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
