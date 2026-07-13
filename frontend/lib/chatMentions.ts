import { ChatMentionAudience, ChatMentionScopeOption, ChatMentionScopeType, ChatMentionTarget, ChatMentionTargetType, Role, User } from '@/types';
import { getRoleLabel } from './roles';

export type MentionTrigger = {
    start: number;
    query: string;
};

const TARGET_ORDER: Record<ChatMentionTargetType, number> = {
    USER: 0,
    EVERYONE: 1,
    ROLE: 2,
    RELATED_SCOPE: 3,
};

export function getMentionTrigger(value: string, cursorIndex: number): MentionTrigger | null {
    const textBeforeCursor = value.slice(0, cursorIndex);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex === -1) return null;
    if (atIndex > 0 && !/\s/.test(textBeforeCursor[atIndex - 1])) return null;

    const query = textBeforeCursor.slice(atIndex + 1);
    if (query.includes(' ') || query.includes('\n')) return null;

    return { start: atIndex, query };
}

export function getMentionTargetKey(target: ChatMentionTarget) {
    if (target.type === 'USER') return `USER:${target.userId}`;
    if (target.type === 'EVERYONE') return 'EVERYONE';
    if (target.type === 'ROLE') return `ROLE:${target.role}`;
    return `RELATED_SCOPE:${target.audienceRole}:${target.scopeType}:${target.scopeId}`;
}

export function dedupeMentionTargets(targets: ChatMentionTarget[]) {
    const map = new Map<string, ChatMentionTarget>();
    targets.forEach(target => map.set(getMentionTargetKey(target), target));
    return Array.from(map.values()).sort((a, b) => TARGET_ORDER[a.type] - TARGET_ORDER[b.type]);
}

export function getMentionTargetLabel(target: ChatMentionTarget) {
    if (target.label) return target.label;
    if (target.type === 'EVERYONE') return 'everyone';
    if (target.type === 'ROLE') return `all ${getRoleLabel(target.role, 'users').toLowerCase()}s`;
    if (target.type === 'RELATED_SCOPE') {
        const audienceLabel = target.audienceRole === 'EVERYONE'
            ? 'everyone'
            : getRoleLabel(target.audienceRole, 'Users').toLowerCase();
        return `${audienceLabel} in ${target.scopeType?.toLowerCase()} ${target.scopeId}`;
    }
    return 'user';
}

export function makeUserMentionTarget(user: User): ChatMentionTarget {
    return {
        type: 'USER',
        userId: user.id,
        label: user.name || user.email || 'user',
    };
}

export function makeEveryoneMentionTarget(): ChatMentionTarget {
    return {
        type: 'EVERYONE',
        label: 'everyone',
    };
}

export function makeRoleMentionTarget(role: Role, count?: number): ChatMentionTarget {
    const roleLabel = getMentionAudienceLabel(role);
    return {
        type: 'ROLE',
        role,
        label: `all ${roleLabel}${count ? ` (${count})` : ''}`,
    };
}

export function makeRelatedScopeMentionTarget(scope: ChatMentionScopeOption): ChatMentionTarget {
    const roleLabel = scope.audienceRole === 'EVERYONE'
        ? 'everyone'
        : getRoleLabel(scope.audienceRole, 'Users').toLowerCase();
    return {
        type: 'RELATED_SCOPE',
        audienceRole: scope.audienceRole,
        scopeType: scope.type,
        scopeId: scope.id,
        label: `${roleLabel} in ${scope.name}`,
    };
}

export function getMentionAudienceLabel(audience: ChatMentionAudience) {
    if (audience === 'EVERYONE') return 'everyone';
    const label = getRoleLabel(audience, 'Users').toLowerCase();
    return label.endsWith('s') ? label : `${label}s`;
}

export function getScopeTypeLabel(scopeType: ChatMentionScopeType) {
    if (scopeType === 'SECTION') return 'Sections';
    if (scopeType === 'DEPARTMENT') return 'Departments';
    return 'Cohorts';
}

export function insertMentionToken(options: {
    draft: string;
    trigger: MentionTrigger;
    selectionStart: number;
    target: ChatMentionTarget;
}) {
    const label = getMentionTargetLabel(options.target).replace(/`/g, '\\`');
    const before = options.draft.slice(0, options.trigger.start);
    const after = options.draft.slice(options.selectionStart);
    const token = `\`@${label}\` `;
    const nextDraft = `${before}${token}${after.trimStart()}`;
    const cursorIndex = before.length + token.length;

    return { nextDraft, cursorIndex };
}

export function sanitizeMentionTargetsForApi(targets: ChatMentionTarget[]) {
    return dedupeMentionTargets(targets).map(target => ({
        type: target.type,
        userId: target.userId,
        role: target.role,
        scopeType: target.scopeType,
        scopeId: target.scopeId,
        audienceRole: target.audienceRole,
    }));
}

export function removeMentionTargetsMissingFromDraft(targets: ChatMentionTarget[], draft: string) {
    return targets.filter(target => draft.includes(`@${getMentionTargetLabel(target)}`));
}
