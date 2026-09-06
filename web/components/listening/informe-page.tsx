import { ClientChrome } from './client-chrome';
import { ReportView } from '@/components/report/report-view';
import { GUSCHMER_ALIASES, GUSCHMER_NAME, GUSCHMER_TARGET_ID } from '@/lib/constants';
import { getListeningReport } from '@/lib/listening-report';
import { parseReportRange } from '@/lib/report-range';

export type InformeSearchParams = Promise<{
  range?: string;
  desde?: string;
  hasta?: string;
  imprimir?: string;
}>;

export async function GuschmerInformePage({
  searchParams,
  inboxHref,
  reportPath,
}: {
  searchParams: InformeSearchParams;
  inboxHref: string;
  reportPath: string;
}) {
  const params = await searchParams;
  const range = parseReportRange(params);
  const report = await getListeningReport({
    targetId: GUSCHMER_TARGET_ID,
    targetName: GUSCHMER_NAME,
    aliases: [...GUSCHMER_ALIASES],
    range,
  });
  const corte = new Date(report.corteAt).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ClientChrome
      title="Informe de conversación"
      subtitle={`${report.periodLabel} · corte ${corte} · caché 3 min`}
      active="informe"
      inboxHref={inboxHref}
      reportHref={reportPath}
    >
      <ReportView report={report} basePath={reportPath} variant="client" inboxHref={inboxHref} />
    </ClientChrome>
  );
}
