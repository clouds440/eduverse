'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AtSign, GraduationCap, Loader2, Megaphone, Users } from 'lucide-react';
import { fuzzyFilterAndRank } from '@/lib/fuzzySearch';
import {
    getScopeTypeLabel,
    getMentionAudienceLabel,
    makeEveryoneMentionTarget,
    makeRelatedScopeMentionTarget,
    makeRoleMentionTarget,
    makeUserMentionTarget,
} from '@/lib/chatMentions';
import { getRoleLabel } from '@/lib/roles';
import { ChatMentionAudience, ChatMentionOptions, ChatMentionScopeType, ChatMentionTarget, ChatParticipant } from '@/types';
import { ChatAvatar } from './ChatAvatar';

type MentionPickerStep =
    | 'ROOT'
    | 'PEOPLE'
    | 'ROLES'
    | 'RELATED_AUDIENCE'
    | 'RELATED_SCOPE_TYPE'
    | 'RELATED_SCOPE';

interface MentionPickerDrawerProps {
    isOpen: boolean;
    query: string;
    members: ChatParticipant[];
    options?: ChatMentionOptions;
    isLoadingOptions?: boolean;
    isMobile: boolean;
    composerHeight: number;
    selectedTargets: ChatMentionTarget[];
    currentUserId?: string;
    onlineUsers: Record<string, boolean>;
    onSelect: (target: ChatMentionTarget) => void;
    drawerRef?: React.RefObject<HTMLDivElement | null>;
}

export function MentionPickerDrawer({
    isOpen,
    query,
    members,
    options,
    isLoadingOptions,
    isMobile,
    composerHeight,
    selectedTargets,
    currentUserId,
    onlineUsers,
    onSelect,
    drawerRef,
}: MentionPickerDrawerProps) {
    const [step, setStep] = useState<MentionPickerStep>('ROOT');
    const [audienceRole, setAudienceRole] = useState<ChatMentionAudience | null>(null);
    const [scopeType, setScopeType] = useState<ChatMentionScopeType | null>(null);

    useEffect(() => {
        if (isOpen) {
            setStep('ROOT');
            setAudienceRole(null);
            setScopeType(null);
        }
    }, [isOpen]);

    const filteredMembers = useMemo(() => {
        const activeMembers = members.filter(member => member.isActive && member.userId !== currentUserId && member.user);
        if (!query) return activeMembers;
        return fuzzyFilterAndRank(activeMembers, query, member => [
            member.user?.name,
            member.user?.email,
            member.user?.role,
        ]);
    }, [currentUserId, members, query]);

    const selectedKeys = useMemo(() => new Set(selectedTargets.map(target => {
        if (target.type === 'USER') return `USER:${target.userId}`;
        if (target.type === 'EVERYONE') return 'EVERYONE';
        if (target.type === 'ROLE') return `ROLE:${target.role}`;
        return `RELATED_SCOPE:${target.audienceRole}:${target.scopeType}:${target.scopeId}`;
    })), [selectedTargets]);

    const audienceRoles = useMemo(() => (
        Array.from(new Set((options?.scopes || []).map(scope => scope.audienceRole))).sort()
    ), [options?.scopes]);

    const scopeTypes = useMemo(() => {
        if (!audienceRole) return [];
        return Array.from(new Set((options?.scopes || [])
            .filter(scope => scope.audienceRole === audienceRole)
            .map(scope => scope.type))).sort();
    }, [audienceRole, options?.scopes]);

    const filteredScopes = useMemo(() => {
        if (!audienceRole || !scopeType) return [];
        const scopes = (options?.scopes || []).filter(scope => (
            scope.audienceRole === audienceRole && scope.type === scopeType
        ));
        if (!query) return scopes;
        return fuzzyFilterAndRank(scopes, query, scope => [scope.name, scope.code, scope.type]);
    }, [audienceRole, options?.scopes, query, scopeType]);

    if (!isOpen) return null;

    const rootOptions = [
        { key: 'PEOPLE', label: 'People', icon: AtSign, enabled: filteredMembers.length > 0, onClick: () => setStep('PEOPLE') },
        { key: 'EVERYONE', label: 'Everyone', icon: Megaphone, enabled: members.length > 1, onClick: () => onSelect(makeEveryoneMentionTarget()) },
        { key: 'ROLES', label: 'Roles', icon: Users, enabled: (options?.roles.length || 0) > 0, onClick: () => setStep('ROLES') },
        { key: 'RELATED', label: 'Related groups', icon: GraduationCap, enabled: audienceRoles.length > 0, onClick: () => setStep('RELATED_AUDIENCE') },
    ].filter(option => option.enabled);

    const title = step === 'ROOT'
        ? 'Mention'
        : step === 'PEOPLE'
            ? 'People'
            : step === 'ROLES'
                ? 'Roles'
                : step === 'RELATED_AUDIENCE'
                    ? 'Related groups'
                    : step === 'RELATED_SCOPE_TYPE'
                        ? getMentionAudienceLabel(audienceRole!)
                        : `${getMentionAudienceLabel(audienceRole!)} / ${getScopeTypeLabel(scopeType!)}`;

    const goBack = () => {
        if (step === 'RELATED_SCOPE') {
            setStep('RELATED_SCOPE_TYPE');
            setScopeType(null);
            return;
        }
        if (step === 'RELATED_SCOPE_TYPE') {
            setStep('RELATED_AUDIENCE');
            setAudienceRole(null);
            return;
        }
        setStep('ROOT');
    };

    return (
        <div
            className={[
                isMobile
                    ? 'fixed inset-x-3 mx-auto max-w-md'
                    : 'absolute bottom-full left-0 mb-2 w-72 max-w-[calc(100vw-2rem)]',
                'bg-card border border-border rounded-xl shadow-2xl z-500 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200',
            ].join(' ')}
            style={isMobile ? { bottom: `calc(${composerHeight}px + 0.5rem)` } : undefined}
        >
            <div className="flex items-center gap-2 border-b border-border p-2">
                {step !== 'ROOT' && (
                    <button
                        type="button"
                        onPointerDown={(event) => {
                            event.preventDefault();
                            goBack();
                        }}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Back"
                    >
                        <ArrowLeft size={14} />
                    </button>
                )}
                <p className="min-w-0 truncate px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {title}
                </p>
                {isLoadingOptions && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>

            <div ref={drawerRef} className="max-h-64 overflow-y-auto py-1 custom-scrollbar">
                {step === 'ROOT' && rootOptions.map(option => {
                    const Icon = option.icon;
                    return (
                        <button
                            key={option.key}
                            type="button"
                            onPointerDown={(event) => {
                                event.preventDefault();
                                option.onClick();
                            }}
                            className="mention-item flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                            <Icon size={16} className="text-primary" />
                            {option.label}
                        </button>
                    );
                })}

                {step === 'PEOPLE' && filteredMembers.map(member => {
                    const selected = selectedKeys.has(`USER:${member.userId}`);
                    return (
                        <button
                            key={member.userId}
                            type="button"
                            onPointerDown={(event) => {
                                event.preventDefault();
                                if (member.user) onSelect(makeUserMentionTarget(member.user));
                            }}
                            className={`mention-item flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${selected ? 'bg-primary/10' : 'hover:bg-muted'}`}
                        >
                            <ChatAvatar targetUser={member.user} className="h-8 w-8" isOnline={!!onlineUsers[member.userId]} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{member.user?.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{getRoleLabel(member.user?.role, '')}</p>
                            </div>
                        </button>
                    );
                })}

                {step === 'ROLES' && (options?.roles || []).map(roleOption => {
                    const selected = selectedKeys.has(`ROLE:${roleOption.role}`);
                    return (
                        <button
                            key={roleOption.role}
                            type="button"
                            onPointerDown={(event) => {
                                event.preventDefault();
                                onSelect(makeRoleMentionTarget(roleOption.role, roleOption.count));
                            }}
                            className={`mention-item flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${selected ? 'bg-primary/10' : 'hover:bg-muted'}`}
                        >
                            <span className="text-sm font-semibold text-foreground">All {getMentionAudienceLabel(roleOption.role)}</span>
                            <span className="text-xs font-bold text-muted-foreground">{roleOption.count}</span>
                        </button>
                    );
                })}

                {step === 'RELATED_AUDIENCE' && audienceRoles.map(role => (
                    <button
                        key={role}
                        type="button"
                        onPointerDown={(event) => {
                            event.preventDefault();
                            setAudienceRole(role);
                            setStep('RELATED_SCOPE_TYPE');
                        }}
                        className="mention-item flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                        {role === 'EVERYONE' ? 'Everyone' : `All ${getMentionAudienceLabel(role)}`}
                    </button>
                ))}

                {step === 'RELATED_SCOPE_TYPE' && scopeTypes.map(type => (
                    <button
                        key={type}
                        type="button"
                        onPointerDown={(event) => {
                            event.preventDefault();
                            setScopeType(type);
                            setStep('RELATED_SCOPE');
                        }}
                        className="mention-item flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                        {getScopeTypeLabel(type)}
                    </button>
                ))}

                {step === 'RELATED_SCOPE' && filteredScopes.map(scope => {
                    const selected = selectedKeys.has(`RELATED_SCOPE:${scope.audienceRole}:${scope.type}:${scope.id}`);
                    return (
                        <button
                            key={`${scope.audienceRole}:${scope.type}:${scope.id}`}
                            type="button"
                            onPointerDown={(event) => {
                                event.preventDefault();
                                onSelect(makeRelatedScopeMentionTarget(scope));
                            }}
                            className={`mention-item flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${selected ? 'bg-primary/10' : 'hover:bg-muted'}`}
                        >
                            <span className="min-w-0 truncate text-sm font-semibold text-foreground">{scope.name}</span>
                            <span className="text-xs font-bold text-muted-foreground">{scope.count}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
