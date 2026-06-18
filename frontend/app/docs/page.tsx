import type { Metadata } from 'next';
import { DocsIndex } from './_components/DocsIndex';
import { DocsShell } from './_components/DocsShell';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'EduVerse documentation for setup, roles, academics, GPA policies, transcripts, finance, and operations.',
};

export default function DocsPage() {
  return (
    <DocsShell>
      <DocsIndex />
    </DocsShell>
  );
}
