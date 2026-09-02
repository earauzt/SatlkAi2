import { GuschmerListeningPage } from '@/components/listening/page-body';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

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

export default function HomePage({ searchParams }: { searchParams: SearchParams }) {
  return <GuschmerListeningPage searchParams={searchParams} basePath="/" />;
}
