import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDashboardStats } from '@/lib/dashboard-stats';
import { resolveTargetId, withTargetQuery } from '@/lib/target-params';
import { DashboardShell } from '@/components/dashboard/shell';
import { NarrativeClusters } from '@/components/narrative-clusters';
import { SemanticNarratives } from '@/components/semantic-narratives';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ days?: string; target?: string }>;

export default async function NarrativesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const targetId = resolveTargetId(params);
  const days = params.days === '30' ? 30 : 7;
  const stats = await getDashboardStats(targetId);
  const supabase = await createClient();

  const { data: clusters, error } = await supabase.rpc('monitor_list_narrative_clusters', {
    p_days: days,
    p_target_id: targetId,
  });

  const { data: semantic } = await supabase.rpc('monitor_list_semantic_narratives', {
    p_limit: 15,
    p_target_id: targetId,
  });

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${
      active ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200'
    }`;

  const subtitle = targetId
    ? `Temas sobre ${stats.target_name}`
    : 'Temas agregados de todos los políticos';

  return (
    <DashboardShell stats={stats} title="Narrativas" subtitle={subtitle} showStats={false}>
      <div className="flex gap-2">
        <Link href={withTargetQuery('/narratives', targetId, { days: '7' })} className={tabClass(days === 7)}>
          7 días
        </Link>
        <Link
          href={withTargetQuery('/narratives', targetId, { days: '30' })}
          className={tabClass(days === 30)}
        >
          30 días
        </Link>
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-600">
              Clusters semánticos (pgvector)
            </h2>
            <SemanticNarratives items={semantic ?? []} />
          </section>
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Por temas y etiquetas IA
            </h2>
            <NarrativeClusters clusters={clusters ?? []} />
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
