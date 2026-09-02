import { ListeningDashboard } from '@/components/listening/dashboard';
import { getGuschmerListening } from '@/lib/listening-data';
import { parseListeningParams, type ListeningSearchParams } from '@/lib/listening-query';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inbox — Andrés Guschmer',
  description: 'Inbox de menciones de Andrés Guschmer en prensa, YouTube y X',
};

export async function GuschmerListeningPage({
  searchParams,
  basePath,
}: {
  searchParams: Promise<ListeningSearchParams>;
  basePath: string;
}) {
  const params = await searchParams;
  const view = await getGuschmerListening(parseListeningParams(params));
  return <ListeningDashboard view={view} basePath={basePath} />;
}
