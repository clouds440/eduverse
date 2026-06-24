import type { Metadata } from 'next';
import { DocsIndex } from './_components/DocsIndex';
import { DocsShell } from './_components/DocsShell';
import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata('/docs');

export default function DocsPage() {
  return (
    <DocsShell>
      <DocsIndex />
    </DocsShell>
  );
}
