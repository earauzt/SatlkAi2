import { GuschmerListeningPage } from '@/components/listening/page-body';
export { metadata } from '@/components/listening/page-body';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ ventana?: string; fuente?: string; q?: string }>;

export default function GuschmerAliasPage({ searchParams }: { searchParams: SearchParams }) {
  return <GuschmerListeningPage searchParams={searchParams} basePath="/guschmer" />;
}
