import { GuschmerListeningPage } from '@/components/listening/page-body';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Escucha — Andrés Guschmer',
  description: 'Cómo se habla de Andrés Guschmer en prensa, YouTube y X',
};

type SearchParams = Promise<{ ventana?: string; fuente?: string; q?: string }>;

export default function HomePage({ searchParams }: { searchParams: SearchParams }) {
  return <GuschmerListeningPage searchParams={searchParams} basePath="/" />;
}
