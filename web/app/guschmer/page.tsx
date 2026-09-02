import { GuschmerListeningPage } from '@/components/listening/page-body';
export { metadata } from '@/components/listening/page-body';
import type { ListeningSearchParams } from '@/lib/listening-query';

export const dynamic = 'force-dynamic';

export default function GuschmerAliasPage({
  searchParams,
}: {
  searchParams: Promise<ListeningSearchParams>;
}) {
  return <GuschmerListeningPage searchParams={searchParams} basePath="/guschmer" />;
}
