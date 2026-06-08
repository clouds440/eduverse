import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocsLinkProps {
    href: string;
    children?: React.ReactNode;
    className?: string;
}

export function DocsLink({ href, children = 'Learn more', className }: DocsLinkProps) {
    return (
        <Link
            href={href}
            target="_blank"
            rel="noreferrer"
            className={cn(
                'inline-flex items-center gap-1 font-black text-primary underline-offset-3 transition-colors hover:text-primary-hover hover:underline',
                className,
            )}
        >
            <span>{children}</span>
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
        </Link>
    );
}
