import { BarChart3, CalendarClock, ClipboardCheck, Coins, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Role } from '@/types';

export interface AIPromptSuggestion {
    id: string;
    label: string;
    prompt: string;
    icon: LucideIcon;
    tone: 'primary' | 'success' | 'warning' | 'info' | 'neutral';
}

export interface AIRoleHomeConfig {
    eyebrow: string;
    title: string;
    description: string;
    suggestions: AIPromptSuggestion[];
}

const STUDENT_PROMPTS: AIPromptSuggestion[] = [
    { id: 'study-today', label: 'Study Today', prompt: 'What should I study today?', icon: GraduationCap, tone: 'primary' },
    { id: 'tomorrow-classes', label: 'Tomorrow', prompt: 'What classes do I have tomorrow?', icon: CalendarClock, tone: 'info' },
    { id: 'deadlines', label: 'Deadlines', prompt: 'What deadlines are coming up?', icon: ClipboardCheck, tone: 'warning' },
    { id: 'attendance-risk', label: 'Attendance', prompt: 'Why is my attendance at risk?', icon: BarChart3, tone: 'success' },
    { id: 'weakest-course', label: 'Weakest Course', prompt: 'Explain my weakest course.', icon: Sparkles, tone: 'neutral' },
];

const TEACHER_PROMPTS: AIPromptSuggestion[] = [
    { id: 'teach-next', label: 'Next Class', prompt: 'What do I teach next?', icon: CalendarClock, tone: 'primary' },
    { id: 'summarize-week', label: 'My Week', prompt: 'Summarize my week.', icon: BarChart3, tone: 'info' },
    { id: 'pending-grading', label: 'Grading', prompt: 'What grading is pending?', icon: ClipboardCheck, tone: 'warning' },
    { id: 'students-attention', label: 'Attention', prompt: 'Which students need attention?', icon: GraduationCap, tone: 'success' },
];

const MANAGER_PROMPTS: AIPromptSuggestion[] = [
    { id: 'today-activity', label: 'Today', prompt: "Summarize today's academic activity.", icon: BarChart3, tone: 'primary' },
    { id: 'workload-issues', label: 'Workload', prompt: 'Show workload issues.', icon: CalendarClock, tone: 'warning' },
    { id: 'departments-attention', label: 'Departments', prompt: 'Which departments need attention?', icon: ShieldCheck, tone: 'info' },
    { id: 'schedule-bottlenecks', label: 'Bottlenecks', prompt: 'Identify scheduling bottlenecks.', icon: ClipboardCheck, tone: 'success' },
];

const ADMIN_PROMPTS: AIPromptSuggestion[] = [
    { id: 'ai-usage', label: 'AI Usage', prompt: 'Show AI usage this month.', icon: Sparkles, tone: 'primary' },
    { id: 'credits-left', label: 'Credits', prompt: 'How many AI Credits are left?', icon: Coins, tone: 'success' },
    { id: 'role-usage', label: 'Roles', prompt: 'Which roles use Copilot most?', icon: BarChart3, tone: 'info' },
    { id: 'org-health', label: 'Org Health', prompt: 'Summarize organization health.', icon: ShieldCheck, tone: 'neutral' },
    { id: 'students-ai', label: 'Students', prompt: 'Should we enable Copilot for students?', icon: GraduationCap, tone: 'warning' },
];

export function getAIRoleHomeConfig(role?: Role | string | null): AIRoleHomeConfig {
    if (role === Role.STUDENT) {
        return {
            eyebrow: 'Study coach',
            title: 'Plan the next smart move.',
            description: 'Use your schedule, deadlines, attendance, and course progress to focus your study time.',
            suggestions: STUDENT_PROMPTS,
        };
    }

    if (role === Role.TEACHER) {
        return {
            eyebrow: 'Teaching copilot',
            title: 'Prep faster. Miss less.',
            description: 'See your next classes, grading load, attendance signals, and students who may need attention.',
            suggestions: TEACHER_PROMPTS,
        };
    }

    if (role === Role.ORG_MANAGER) {
        return {
            eyebrow: 'Academic operations',
            title: 'Spot pressure before it spreads.',
            description: 'Review workload, department attention areas, attendance trends, evaluations, and schedule bottlenecks.',
            suggestions: MANAGER_PROMPTS,
        };
    }

    if (role === Role.ORG_ADMIN) {
        return {
            eyebrow: 'Organization command',
            title: 'Run Copilot with control.',
            description: 'Track AI usage, credits, costs, role access, and organization health from one role-aware assistant.',
            suggestions: ADMIN_PROMPTS,
        };
    }

    return {
        eyebrow: 'EduVerse Copilot',
        title: 'Ask with your role context.',
        description: 'Use Copilot for focused help across the EduVerse areas you already have permission to access.',
        suggestions: [
            { id: 'summary', label: 'Summary', prompt: 'Summarize what needs my attention today.', icon: Sparkles, tone: 'primary' },
            { id: 'schedule', label: 'Schedule', prompt: 'What is on my schedule?', icon: CalendarClock, tone: 'info' },
            { id: 'help', label: 'Help', prompt: 'What can you help me with?', icon: Sparkles, tone: 'neutral' },
        ],
    };
}
