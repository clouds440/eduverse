import { DocsNavigation } from './_components/DocsNavigation';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-background lg:flex">
      <DocsNavigation />
      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
