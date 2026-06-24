import type { Metadata } from 'next';

import { createPublicMetadata } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata('/contact');

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
