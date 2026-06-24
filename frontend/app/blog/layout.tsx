import type { Metadata } from 'next';

import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata('/blog');

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
