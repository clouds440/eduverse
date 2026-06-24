import type { Metadata } from 'next';

import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata('/terms');

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
