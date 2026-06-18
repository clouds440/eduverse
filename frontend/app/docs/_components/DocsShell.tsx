import { DocsNavigation } from './DocsNavigation';

type DocsShellProps = {
  activeSlug?: string;
  children: React.ReactNode;
};

export function DocsShell({ activeSlug, children }: DocsShellProps) {
  return (
    <div className="min-h-full bg-background lg:flex">
      <DocsNavigation activeSlug={activeSlug} />
      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
