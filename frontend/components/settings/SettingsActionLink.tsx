import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function SettingsActionLink({
    href,
    icon: Icon,
    children,
}: {
    href: string;
    icon?: LucideIcon;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
            <span className="min-w-0 text-center">{children}</span>
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </Link>
    );
}
