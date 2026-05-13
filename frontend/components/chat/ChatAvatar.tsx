'use client';

import { Plus } from 'lucide-react';
import { BrandIcon } from '../ui/Brand';
import { Role } from '@/types';

interface ChatAvatarProps {
    targetUser?: {
        id?: string;
        name?: string | null;
        avatarUrl?: string | null;
        role?: Role;
        orgName?: string;
        orgLogoUrl?: string | null;
        avatarUpdatedAt?: string | null;
        userName?: string;
    };
    className?: string;
    groupIcon?: boolean;
    isOnline?: boolean;
    imageLoading?: 'eager' | 'lazy';
}

export function ChatAvatar({ targetUser, className = "w-8 h-8", groupIcon = false, isOnline = false, imageLoading }: ChatAvatarProps) {
    if (groupIcon) {
        return (
            <div className={`${className} rounded-full bg-primary/60 flex items-center justify-center text-primary font-bold border border-primary shadow-sm shrink-0`}>
                <Plus size={16} />
            </div>
        );
    }

    return (
        <div className="relative shrink-0">
            <BrandIcon
                variant="user"
                size="sm"
                user={targetUser}
                className={className}
                initialsFallback
                imageLoading={imageLoading}
            />
            {isOnline && (
                <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background shadow-sm" />
            )}
        </div>
    );
}
