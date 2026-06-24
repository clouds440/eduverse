import type { Metadata } from 'next';

import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata('/pricing');

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
