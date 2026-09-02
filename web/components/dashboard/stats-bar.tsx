import type { DashboardStats } from '@/lib/types';
import { sentimentLabel } from '@/lib/mention-utils';

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${accent ?? 'text-zinc-900'}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function StatsBar({ stats }: { stats: DashboardStats }) {
  const sent = sentimentLabel(stats.avg_sentimiento);
  const targetEntries = Object.entries(stats.by_target);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total menciones" value={stats.total_mentions} hint="Histórico" />
        <StatCard
          label="Últimas 24h"
          value={stats.mentions_24h}
          hint="Actividad reciente"
          accent="text-zinc-900"
        />
        <StatCard
          label="Sentimiento medio"
          value={stats.avg_sentimiento.toFixed(1)}
          hint={sent.text}
          accent={
            stats.avg_sentimiento < 0
              ? 'text-red-600'
              : stats.avg_sentimiento > 0
                ? 'text-emerald-600'
                : 'text-zinc-900'
          }
        />
        <StatCard
          label="Urgentes"
          value={stats.urgent_count}
          hint={`${stats.review_queue} en cola revisión`}
          accent={stats.urgent_count > 0 ? 'text-red-600' : 'text-zinc-900'}
        />
      </div>

      {!stats.target_id && targetEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {targetEntries.map(([name, count]) => (
            <span
              key={name}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600"
            >
              <span className="font-medium text-zinc-900">{name}</span> · {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
