import { ListeningDashboard } from '@/components/listening/dashboard';
import { getGuschmerListening } from '@/lib/listening-data';
import type { ListeningWindow } from '@/lib/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Escucha — Andrés Guschmer',
  description: 'Cómo se habla de Andrés Guschmer en prensa, YouTube y X',
};

type SearchParams = Promise<{ ventana?: string; fuente?: string; q?: string }>;

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
  const allowed = new Set(['rss', 'youtube', 'x', 'google_news']);
  const view = await getGuschmerListening({
    window,
    source: allowed.has(fuente) ? fuente : '',
    q: params.q,
  });

  return <ListeningDashboard view={view} basePath={basePath} />;
}
