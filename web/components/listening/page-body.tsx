import { ListeningDashboard } from '@/components/listening/dashboard';
import { getGuschmerListening } from '@/lib/listening-data';
import { CASO_IDS } from '@/lib/inbox';
import type { ListeningWindow } from '@/lib/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inbox — Andrés Guschmer',
  description: 'Inbox de menciones de Andrés Guschmer en prensa, YouTube y X',
};

type SearchParams = Promise<{
  ventana?: string;
  fuente?: string;
  caso?: string;
  sentimiento?: string;
  q?: string;
}>;

export async function GuschmerListeningPage({
  searchParams,
  basePath,
}: {
  searchParams: SearchParams;
  basePath: string;
}) {
  const params = await searchParams;
  const window: ListeningWindow = params.ventana === '24h' ? '24h' : '7d';
  const fuente = params.fuente?.trim() ?? '';
  const caso = params.caso?.trim() ?? '';
  const sentimiento = params.sentimiento?.trim() ?? '';
  const allowedSource = new Set(['rss', 'youtube', 'x', 'google_news']);
  const allowedSent = new Set(['pos', 'neg', 'neu']);
  const allowedCaso = new Set<string>(CASO_IDS);

  const view = await getGuschmerListening({
    window,
    source: allowedSource.has(fuente) ? fuente : '',
    caso: allowedCaso.has(caso) ? caso : '',
    sentimiento: allowedSent.has(sentimiento) ? sentimiento : '',
    q: params.q,
  });

  return <ListeningDashboard view={view} basePath={basePath} />;
}
