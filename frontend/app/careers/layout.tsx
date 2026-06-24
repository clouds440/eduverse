import type { Metadata } from 'next';

import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata('/careers');

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
