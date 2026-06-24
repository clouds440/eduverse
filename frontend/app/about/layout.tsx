import type { Metadata } from 'next';

import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata('/about');

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
