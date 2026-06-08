import type { Metadata } from 'next';
import { DocsIndex } from './_components/DocsIndex';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'EduVerse documentation for setup, roles, academics, GPA policies, transcripts, finance, and operations.',
};

export default function DocsPage() {
  return <DocsIndex />;
}
