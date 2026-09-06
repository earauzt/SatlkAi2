import { getDashboardStats } from '@/lib/dashboard-stats';
import { resolveTargetId, withTargetQuery } from '@/lib/target-params';
import { DashboardShell } from '@/components/dashboard/shell';
import { ReportView } from '@/components/report/report-view';
import { getListeningReport } from '@/lib/listening-report';
import { parseReportRange } from '@/lib/report-range';
import { GUSCHMER_ALIASES, GUSCHMER_NAME, GUSCHMER_TARGET_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  range?: string;
  target?: string;
  desde?: string;
  hasta?: string;
}>;

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const targetId = resolveTargetId(params);
  const stats = await getDashboardStats(targetId);
  const range = parseReportRange(params);
  const aliases =
    targetId === GUSCHMER_TARGET_ID
      ? [...GUSCHMER_ALIASES]
      : stats.targets.find((t) => t.id === targetId)?.aliases ?? [];
  const targetName = targetId
    ? stats.target_name
    : 'Todos los objetivos';

  const report = await getListeningReport({
    targetId,
    targetName: targetId === GUSCHMER_TARGET_ID ? GUSCHMER_NAME : targetName,
    aliases,
    range,
  });

  const inboxHref = withTargetQuery('/feed', targetId);
  const extraQuery = targetId ? { target: targetId } : {};

  return (
    <DashboardShell
      stats={stats}
      title="Analytics"
      subtitle={`Informe ejecutivo · ${report.periodLabel} · ${report.targetName}`}
      showStats={false}
    >
      <ReportView
        report={report}
        basePath="/analytics"
        extraQuery={extraQuery}
        variant="ops"
        inboxHref={inboxHref}
      />
    </DashboardShell>
  );
}
