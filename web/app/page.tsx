import { GuschmerListeningPage } from '@/components/listening/page-body';
import type { ListeningSearchParams } from '@/lib/listening-query';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Inbox — Andrés Guschmer',
  description: 'Inbox de menciones de Andrés Guschmer en prensa, YouTube y X',
};

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<ListeningSearchParams>;
}) {
  return <GuschmerListeningPage searchParams={searchParams} basePath="/" />;
}
