import { createClient } from '@/lib/supabase/server';
import { getDashboardStats } from '@/lib/dashboard-stats';
import { resolveTargetId } from '@/lib/target-params';
import { DashboardShell } from '@/components/dashboard/shell';
import { ReviewQueue } from '@/components/review-queue';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ target?: string }>;

export default async function ReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const targetId = resolveTargetId(params);
  const stats = await getDashboardStats(targetId);
  const supabase = await createClient();
  const { data: items, error } = await supabase.rpc('monitor_list_review_queue', {
    p_limit: 30,
    p_target_id: targetId,
  });

  const subtitle = targetId
    ? `Cola de revisión — ${stats.target_name}`
    : 'Cola de revisión de todos los políticos';

  return (
    <DashboardShell stats={stats} title="Revisión" subtitle={subtitle} showStats={false}>
      {error ? (
        <p className="text-sm text-red-600">Error: {error.message}</p>
      ) : (
        <ReviewQueue items={items ?? []} />
      )}
    </DashboardShell>
  );
}
