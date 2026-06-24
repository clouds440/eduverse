import type { Metadata } from 'next';

import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata('/privacy');

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
