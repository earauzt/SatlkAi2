import { GuschmerInformePage, type InformeSearchParams } from '@/components/listening/informe-page';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Informe — Andrés Guschmer',
  description: 'KPIs, sentimiento, temas y cuentas de la conversación digital sobre Andrés Guschmer',
};

export default function InformePage({ searchParams }: { searchParams: InformeSearchParams }) {
  return <GuschmerInformePage searchParams={searchParams} inboxHref="/" reportPath="/informe" />;
}
