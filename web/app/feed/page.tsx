import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getDashboardStats } from '@/lib/dashboard-stats';
import { resolveTargetId } from '@/lib/target-params';
import { DashboardShell } from '@/components/dashboard/shell';
import { MentionCard } from '@/components/mention-card';
import { FeedFilters } from '@/components/feed-filters';
import { getClassification } from '@/lib/mention-utils';
import type { Mention } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ source?: string; urgency?: string; q?: string; target?: string }>;

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const targetId = resolveTargetId(params);
  const stats = await getDashboardStats(targetId);
  const supabase = await createClient();

  let query = supabase
    .schema('monitor')
    .from('mentions')
    .select(
      `id, text, url, author_handle, source, published_at, reach_score, tipo_fuente,
       targets (nombre),
       classifications (sentimiento, etiquetas, resumen, urgencia, confianza)`
    )
    .order('published_at', { ascending: false })
    .limit(100);

  if (targetId) query = query.eq('target_id', targetId);
  if (params.source) query = query.eq('source', params.source);
  if (params.q) query = query.ilike('text', `%${params.q}%`);

  const { data: rows, error } = await query;

  const mentions: Mention[] = (rows ?? []).map((row) => {
    const target = row.targets as { nombre: string } | { nombre: string }[] | null;
    const targetName = Array.isArray(target) ? target[0]?.nombre : target?.nombre;
    const { targets: _t, ...rest } = row;
    return { ...rest, target_name: targetName };
  });

  let filtered = mentions;
  if (params.urgency) {
    const min = Number(params.urgency);
    filtered = filtered.filter((m) => (getClassification(m.classifications)?.urgencia ?? 0) >= min);
  }

  const subtitle = targetId
    ? `Menciones en vivo sobre ${stats.target_name} · actualizado al cargar`
    : `Menciones de ${stats.targets.length} políticos · actualizado al cargar`;

  return (
    <DashboardShell stats={stats} title="Inbox" subtitle={subtitle}>
      <Suspense fallback={<div className="h-14 animate-pulse rounded-xl bg-zinc-200" />}>
        <FeedFilters />
      </Suspense>

      {error ? (
        <p className="text-sm text-red-600">Error: {error.message}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-zinc-900">Sin menciones todavía</p>
          <p className="mt-1 text-sm text-zinc-500">Ejecuta el colector o ajusta los filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {filtered.length} menciones
          </p>
          {filtered.map((m) => (
            <MentionCard key={m.id} mention={m} showTarget={!targetId} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
