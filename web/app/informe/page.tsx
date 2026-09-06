import { redirect } from 'next/navigation';
import { GuschmerInformePage, type InformeSearchParams } from '@/components/listening/informe-page';
import { informeToInboxHref } from '@/lib/report-range';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Inbox — Andrés Guschmer',
  description: 'El informe vive en el inbox: menciones, KPIs y análisis en una sola página',
};

export default async function InformePage({ searchParams }: { searchParams: InformeSearchParams }) {
  const params = await searchParams;
  if (params.imprimir === '1') {
    return (
      <GuschmerInformePage
        searchParams={Promise.resolve(params)}
        inboxHref="/"
        reportPath="/informe"
      />
    );
  }
  redirect(informeToInboxHref('/', params));
}
