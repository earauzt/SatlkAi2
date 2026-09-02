import { createClient } from '@/lib/supabase/server';
import type { DashboardStats, Target } from './types';

export type { Target };

export async function listTargets(): Promise<Target[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('monitor_list_targets');
  return data ?? [];
}

export async function getDashboardStats(targetId?: string | null): Promise<DashboardStats> {
  const supabase = await createClient();

  const { data: targets } = await supabase.rpc('monitor_list_targets');
  const targetList = targets ?? [];

  const { data: statsJson } = await supabase.rpc('monitor_get_dashboard_stats', {
    p_target_id: targetId || null,
  });

  const stats = (statsJson ?? {}) as Record<string, unknown>;
  const selected = targetId
    ? targetList.find((t: Target) => t.id === targetId)
    : null;

  return {
    target_id: targetId ?? null,
    target_name: selected?.nombre ?? (targetId ? 'Político' : 'Todos los objetivos'),
    targets: targetList,
    total_mentions: Number(stats.total_mentions ?? 0),
    mentions_24h: Number(stats.mentions_24h ?? 0),
    avg_sentimiento: Number(stats.avg_sentimiento ?? 0),
    urgent_count: Number(stats.urgent_count ?? 0),
    review_queue: Number(stats.review_queue ?? 0),
    by_source: (stats.by_source as Record<string, number>) ?? {},
    by_target: (stats.by_target as Record<string, number>) ?? {},
  };
}
