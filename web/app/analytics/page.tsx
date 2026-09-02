import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDashboardStats } from '@/lib/dashboard-stats';
import { resolveTargetId, withTargetQuery } from '@/lib/target-params';
import { DashboardShell } from '@/components/dashboard/shell';
import { VolumeChart } from '@/components/volume-chart';
import { SourceBadge } from '@/components/source-badge';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ range?: string; target?: string }>;

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const targetId = resolveTargetId(params);
  const range = params.range === '30d' ? '30d' : '72h';
  const rangeHours = range === '30d' ? 24 * 30 : 72;
  const stats = await getDashboardStats(targetId);
  const supabase = await createClient();

  const { data: buckets, error } = await supabase.rpc('monitor_get_volume_timeline', {
    p_range_hours: rangeHours,
    p_target_id: targetId,
  });

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
    }`;

  const subtitle = targetId
    ? `Volumen y fuentes — ${stats.target_name}`
    : 'Volumen agregado de todos los políticos';

  return (
    <DashboardShell stats={stats} title="Analytics" subtitle={subtitle} showStats={false}>
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(stats.by_source).map(([source, count]) => (
          <div key={source} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <SourceBadge source={source} />
            <p className="mt-2 text-2xl font-semibold">{count}</p>
            <p className="text-xs text-zinc-500">menciones totales</p>
          </div>
        ))}
      </div>

      {!targetId && Object.keys(stats.by_target).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(stats.by_target).map(([name, count]) => (
            <div key={name} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-zinc-900">{name}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
              <p className="text-xs text-zinc-500">menciones</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Volumen de menciones</h2>
          <div className="flex gap-2">
            <Link
              href={withTargetQuery('/analytics', targetId, { range: '72h' })}
              className={tabClass(range === '72h')}
            >
              72 horas
            </Link>
            <Link
              href={withTargetQuery('/analytics', targetId, { range: '30d' })}
              className={tabClass(range === '30d')}
            >
              30 días
            </Link>
          </div>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : (
          <VolumeChart buckets={buckets ?? []} rangeHours={rangeHours} />
        )}
      </div>
    </DashboardShell>
  );
}
