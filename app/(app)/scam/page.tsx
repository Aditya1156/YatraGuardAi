import type { Metadata } from 'next';
import { PageHeader } from '@/components/app-shell/page-header';
import { ScamChecker } from './scam-checker';

export const metadata: Metadata = { title: 'Scam check' };
export const dynamic = 'force-dynamic';

export default function ScamPage() {
  return (
    <>
      <PageHeader
        title="Scam check"
        description="Paste a message, email or call transcript you are not sure about."
      />
      <ScamChecker />
    </>
  );
}
