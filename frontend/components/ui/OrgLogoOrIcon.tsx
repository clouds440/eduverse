import { School } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { getPublicUrl } from '@/lib/utils';

interface OrgLogoOrIconProps {
    logoUrl?: string | null;
    updatedAt?: string | Date | null;
    orgName?: string | null;
    className?: string;
}

/**
 * Renders an organization logo if available, otherwise a fallback icon.
 * Standardized to use getPublicUrl for consistent image serving.
 */
export function OrgLogoOrIcon({ logoUrl, updatedAt, orgName, className }: OrgLogoOrIconProps) {
    const resolvedUrl = getPublicUrl(logoUrl, updatedAt);
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const shouldShowImage = !!resolvedUrl && failedSrc !== resolvedUrl;

    if (shouldShowImage) {
        return (
            <div className={`relative shrink-0 overflow-hidden ${className || "w-8 h-8 md:w-9 md:h-9 rounded-full ring-2 ring-primary/20"}`}>
                <Image
                    src={resolvedUrl}
                    alt={orgName ?? 'Org logo'}
                    fill
                    className="object-cover"
                    sizes="96px"
                    onError={() => setFailedSrc(resolvedUrl)}
                />
            </div>
        );
    }

    return (
        <div className={className || "bg-primary/10 p-2 md:p-3 rounded-full group-hover:bg-primary/20 group-hover:scale-105 group-focus-visible:ring-2 ring-primary transition-all duration-300 shrink-0"}>
            <School className={className ? "w-full h-full text-primary" : "w-6 h-6 md:w-7 md:h-7 text-primary"} />
        </div>
    );
}
