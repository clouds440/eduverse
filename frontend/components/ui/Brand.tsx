'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { GraduationCap, User as UserIcon } from 'lucide-react';
import { PLATFORM_NAME, DASHBOARD_MODULES } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { getPublicUrl, getUserColor } from '@/lib/utils';
import Link from 'next/link';
import { Role } from '@/types';


type BrandSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';


type FlexibleUser = {
  id?: string;
  name?: string | null;
  userName?: string;
  orgName?: string;
  orgLogoUrl?: string | null;
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | null;
  role?: Role | string;
};

interface BrandIconProps {
  variant?: 'brand' | 'user';
  size?: BrandSize;
  className?: string;
  forcePlatform?: boolean;
  user?: FlexibleUser | null;
  initialsFallback?: boolean;
  imageLoading?: 'eager' | 'lazy';
}

const failedBrandImageUrls = new Set<string>();

export const BrandIcon = React.memo(function BrandIcon({
  variant = 'brand',
  size = 'md',
  className = "",
  forcePlatform = false,
  user: externalUser,
  initialsFallback = false,
  imageLoading,
}: BrandIconProps) {
  const { user: sessionUser } = useAuth();
  const pathname = usePathname();

  const user: FlexibleUser | null = externalUser || sessionUser;

  const segments = pathname?.split('/').filter(Boolean) || [];
  const isDashboardContext = segments.length >= 1 && DASHBOARD_MODULES.includes(segments[0]);
  const isOrgBrandingActive = !forcePlatform && isDashboardContext && user?.orgName;

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14',
    hero: 'w-20 h-20',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
    xl: 'w-8 h-8',
    hero: 'w-12 h-12',
  };
  const initialsTextClasses: Record<BrandSize, string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    hero: 'text-3xl',
  };

  // Logic for Logo/Avatar
  const FallbackIcon = variant === 'brand' ? (isOrgBrandingActive ? GraduationCap : BrandLogoIcon) : UserIcon;
  const displayLogo = variant === 'brand'
    ? (isOrgBrandingActive ? (user?.orgLogoUrl ? getPublicUrl(user.orgLogoUrl, user.avatarUpdatedAt) : null) : null)
    : (user?.avatarUrl || user?.orgLogoUrl ? getPublicUrl(user.avatarUrl || user.orgLogoUrl, user.avatarUpdatedAt) : null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const shouldShowImage = !!displayLogo && failedSrc !== displayLogo && !failedBrandImageUrls.has(displayLogo);

  return (
    <div className={`rounded-full ${sizeClasses[size]} flex items-center justify-center shrink-0 ${className}`}>
      {shouldShowImage ? (
        <div className={`relative w-full h-full rounded-full overflow-hidden shadow-sm shadow-black/5 transition-transform group-hover:scale-110`}>
          <Image
            src={displayLogo}
            alt="Identity"
            fill
            className="object-cover"
            sizes="96px"
            loading={imageLoading}
            onError={() => {
              if (displayLogo) failedBrandImageUrls.add(displayLogo);
              setFailedSrc(displayLogo);
            }}
          />
        </div>
      ) : (
        // When no image: if user variant and initialsFallback requested, render initials with deterministic color
        (variant === 'user' && (initialsFallback)) ? (
          (() => {
            const name = user?.name || user?.userName || '';
            const color = getUserColor(user?.id);

            const getInitials = (n: string) => {
              if (!n) return '?';
              const parts = n.trim().split(/\s+/).filter(Boolean);
              if (parts.length === 0) return '?';
              if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            };

            const initials = getInitials(name || user?.id || 'U');

            return (
              <div className={`w-full h-full flex items-center justify-center rounded-full shadow-lg shadow-primary/5 transition-transform group-hover:scale-110`} style={{ backgroundColor: color }}>
                <span className={`inline-flex items-center justify-center w-full h-full text-white font-bold ${initialsTextClasses[size]}`}>{initials}</span>
              </div>
            );
          })()
        ) : (
          <div className={`w-full h-full ${variant === 'brand' ? 'rotate-3 group-hover:rotate-0' : 'bg-primary/60'} flex items-center justify-center rounded-full shadow-lg shadow-primary/5 transition-transform group-hover:scale-110`}>
            <FallbackIcon className={`${iconSizes[size]} ${variant === 'brand' ? 'text-foreground' : 'text-primary'}`} />
          </div>
        )
      )}
    </div>
  );
});

interface BrandProps extends BrandIconProps {
  showName?: boolean;
  showLogo?: boolean;
  useGradient?: boolean;
  linkHref?: string;
  showNameOnly?: boolean;
}

export const Brand = React.memo(function Brand({
  variant = 'brand',
  showName = true,
  showLogo = true,
  useGradient = false,
  className = "",
  forcePlatform = false,
  size = 'md',
  linkHref,
  user,
}: BrandProps) {
  const { user: sessionUser } = useAuth();
  const pathname = usePathname();


  const activeUser = user || sessionUser;

  const segments = pathname?.split('/').filter(Boolean) || [];
  const isDashboardContext = segments.length >= 1 && DASHBOARD_MODULES.includes(segments[0]);
  const isOrgBrandingActive = !forcePlatform && isDashboardContext && activeUser?.orgName;

  const displayName = isOrgBrandingActive ? activeUser.orgName : PLATFORM_NAME;
  const nameStyles = isOrgBrandingActive ? 'text-primary' : (useGradient ? 'text-transparent bg-clip-text bg-linear-to-r from-primary via-primary to-primary/80' : 'text-foreground');

  const sizeTextClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    hero: 'text-5xl md:text-7xl',
  };

  const defaultHref = isDashboardContext ?
    activeUser?.orgName
      ? activeUser.role === Role.ORG_ADMIN
        ? '/overview'
        : activeUser.role === Role.TEACHER || activeUser.role === Role.ORG_MANAGER
          ? `/teachers/${activeUser.id}`
          : `/students/${activeUser.id}`
      : '/'
    : '/';

  const content = (
    <div className={`inline-flex items-center space-x-3 group ${className}`}>
      {showLogo && (
        <BrandIcon variant={variant} size={size} forcePlatform={forcePlatform} user={user} />
      )}

      {showName && (
        isOrgBrandingActive ? (
          <span className={`font-black tracking-tighter ${nameStyles} ${sizeTextClasses[size]} transition-all duration-300`}>
            {displayName}
          </span>
        ) : (
          <div className={`relative ${size === 'sm' ? 'w-24 h-5'
            : size === 'md' ? 'w-32 h-8'
              : size === 'lg' ? 'w-36 h-9'
                : size === 'xl' ? 'w-44 h-11'
                  : 'w-64 h-28 md:w-80 md:h-32'
            }`}>
            <Image
              src="/assets/eduverse.png"
              alt={PLATFORM_NAME}
              fill
              className="dark:invert object-contain transition-all duration-300"
              priority={size === 'hero' || size === 'xl'}
              sizes="(max-width: 768px) 150px, 300px"
            />
          </div>
        )
      )}
    </div>
  );

  if (linkHref === null) return content;

  return (
    <Link href={linkHref || defaultHref} className="outline-none">
      {content}
    </Link>
  );
});

/**
 * Our new custom platform logo icon
 */
export function BrandLogoIcon() {
  return (
    <div className={`relative flex items-center justify-center w-full h-full`}>
      <Image src="/assets/eduverse-icon-192.png" alt="Eduverse" fill className="object-contain" sizes="96px" />
    </div>
  )
}
