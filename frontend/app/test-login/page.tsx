'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    BriefcaseBusiness,
    GraduationCap,
    ShieldCheck,
    UserCog,
    Users,
    WalletCards,
    type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { decodeAuthToken } from '@/lib/authSession';
import { getDeviceId, getDeviceInfo } from '@/lib/deviceUtils';
import { getRoleDashboardPath } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface TestAccount {
    email: string;
    password: string;
    label: string;
    roleHint: string;
    group: string;
    icon: LucideIcon;
    tone: 'primary' | 'info' | 'success' | 'warning' | 'neutral';
}

const ORG_PASSWORD = '123456aA';
const PROD_DEMO_PASSWORD = 'Demo@12345';

const localTestAccounts: TestAccount[] = [
    {
        email: 'admin@numl.edu.pk',
        password: ORG_PASSWORD,
        label: 'Admin',
        roleHint: 'Main organization admin',
        group: 'Organization Users',
        icon: ShieldCheck,
        tone: 'primary',
    },
    {
        email: 'subadmin@numl.edu.pk',
        password: ORG_PASSWORD,
        label: 'Sub Admin',
        roleHint: 'Delegated organization admin',
        group: 'Organization Users',
        icon: UserCog,
        tone: 'info',
    },
    {
        email: 'finance@numl.edu.pk',
        password: ORG_PASSWORD,
        label: 'Finance Manager',
        roleHint: 'Finance-only operator',
        group: 'Organization Users',
        icon: WalletCards,
        tone: 'warning',
    },
    {
        email: 'alex@numl.edu.pk',
        password: ORG_PASSWORD,
        label: 'Student',
        roleHint: 'Student portal',
        group: 'Organization Users',
        icon: GraduationCap,
        tone: 'success',
    },
    {
        email: 'ahmed@numls.edu.pk',
        password: ORG_PASSWORD,
        label: 'Teacher',
        roleHint: 'Teacher workspace',
        group: 'Organization Users',
        icon: UserCog,
        tone: 'success',
    },
    {
        email: 'sarah@numl.edu.pk',
        password: ORG_PASSWORD,
        label: 'Manager',
        roleHint: 'Academic manager',
        group: 'Organization Users',
        icon: BriefcaseBusiness,
        tone: 'info',
    },
    {
        email: 'guardian@numl.edu.pk',
        password: ORG_PASSWORD,
        label: 'Guardian',
        roleHint: 'Guardian linked-student view',
        group: 'Organization Users',
        icon: Users,
        tone: 'neutral',
    },
    {
        email: 'admin@system.com',
        password: 'admin123',
        label: 'Super Admin',
        roleHint: 'System administration',
        group: 'System Users',
        icon: ShieldCheck,
        tone: 'primary',
    },
];

const prodTestAccounts: TestAccount[] = [
    {
        email: 'demo.org.admin@example.test',
        password: PROD_DEMO_PASSWORD,
        label: 'Ayesha Rahman',
        roleHint: 'Org Admin',
        group: 'Admins',
        icon: ShieldCheck,
        tone: 'primary',
    },
    {
        email: 'demo.subadmin.academics@example.test',
        password: PROD_DEMO_PASSWORD,
        label: 'Hassan Qureshi',
        roleHint: 'Sub Admin - Academics',
        group: 'Admins',
        icon: UserCog,
        tone: 'info',
    },
    {
        email: 'demo.subadmin.studentlife@example.test',
        password: PROD_DEMO_PASSWORD,
        label: 'Mariam Sheikh',
        roleHint: 'Sub Admin - Student Life',
        group: 'Admins',
        icon: UserCog,
        tone: 'info',
    },
    {
        email: 'demo.finance.manager.01@example.test',
        password: PROD_DEMO_PASSWORD,
        label: 'Omar Siddiqui',
        roleHint: 'Finance Manager',
        group: 'Finance',
        icon: WalletCards,
        tone: 'warning',
    },
    {
        email: 'demo.finance.manager.02@example.test',
        password: PROD_DEMO_PASSWORD,
        label: 'Nadia Iqbal',
        roleHint: 'Finance Manager',
        group: 'Finance',
        icon: WalletCards,
        tone: 'warning',
    },
    ...[
        ['demo.manager.academics@example.test', 'Dr. Sara Malik', 'Academic Manager'],
        ['demo.manager.programs@example.test', 'Bilal Ahmed', 'Programs Manager'],
    ].map(([email, label, roleHint]) => ({
        email,
        password: PROD_DEMO_PASSWORD,
        label,
        roleHint,
        group: 'Managers',
        icon: BriefcaseBusiness,
        tone: 'info' as const,
    })),
    ...[
        ['demo.teacher.asad.khan@example.test', 'Asad Khan', 'Algorithms'],
        ['demo.teacher.fatima.noor@example.test', 'Fatima Noor', 'Web Engineering'],
        ['demo.teacher.zubair.ali@example.test', 'Zubair Ali', 'Biology'],
        ['demo.teacher.sana.javed@example.test', 'Sana Javed', 'Physics'],
        ['demo.teacher.hamza.farooq@example.test', 'Hamza Farooq', 'Accounting'],
        ['demo.teacher.laiba.saeed@example.test', 'Laiba Saeed', 'Academic Writing'],
        ['demo.teacher.daniyal.mir@example.test', 'Daniyal Mir', 'Project Studio'],
        ['demo.teacher.mehwish.raza@example.test', 'Mehwish Raza', 'Student Research'],
    ].map(([email, label, subject]) => ({
        email,
        password: PROD_DEMO_PASSWORD,
        label,
        roleHint: `Teacher - ${subject}`,
        group: 'Teachers',
        icon: UserCog,
        tone: 'success' as const,
    })),
    ...[
        ['demo.guardian.01@example.test', 'Khalid Hussain'],
        ['demo.guardian.02@example.test', 'Samina Tariq'],
        ['demo.guardian.03@example.test', 'Rashid Mehmood'],
        ['demo.guardian.04@example.test', 'Amina Yusuf'],
        ['demo.guardian.05@example.test', 'Farhan Akram'],
        ['demo.guardian.06@example.test', 'Sadia Imran'],
        ['demo.guardian.07@example.test', 'Jawad Raza'],
        ['demo.guardian.08@example.test', 'Noreen Shah'],
        ['demo.guardian.09@example.test', 'Tahir Abbas'],
        ['demo.guardian.10@example.test', 'Uzma Farid'],
        ['demo.guardian.11@example.test', 'Imran Baig'],
        ['demo.guardian.12@example.test', 'Rabia Nadeem'],
    ].map(([email, label]) => ({
        email,
        password: PROD_DEMO_PASSWORD,
        label,
        roleHint: 'Guardian',
        group: 'Guardians',
        icon: Users,
        tone: 'neutral' as const,
    })),
    ...[
        'Ali Raza',
        'Zoya Khan',
        'Usman Tariq',
        'Hina Saleem',
        'Dua Fatima',
        'Rayyan Ali',
        'Musa Ahmed',
        'Areeba Noor',
        'Ahmed Bilal',
        'Maryam Iqbal',
        'Saad Qureshi',
        'Eman Rauf',
        'Taha Malik',
        'Noor Fatima',
        'Ibrahim Shah',
        'Maham Javed',
        'Haris Nadeem',
        'Ayesha Mir',
        'Yusuf Rehman',
        'Anaya Sheikh',
        'Danish Aslam',
        'Saira Amin',
        'Arham Zafar',
        'Kinza Rafiq',
    ].map((label, index) => {
        const serial = String(index + 1).padStart(3, '0');
        const grade = index < 8 ? 'Grade 8' : index < 16 ? 'Grade 9' : 'Grade 10';
        return {
            email: `demo.student.${serial}@example.test`,
            password: PROD_DEMO_PASSWORD,
            label,
            roleHint: `Student - ${grade}`,
            group: 'Students',
            icon: GraduationCap,
            tone: 'success' as const,
        };
    }),
];

const toneClasses: Record<TestAccount['tone'], { icon: string; strip: string; badge: 'primary' | 'info' | 'success' | 'warning' | 'neutral' }> = {
    primary: { icon: 'border-primary/20 bg-primary/10 text-primary', strip: 'bg-primary', badge: 'primary' },
    info: { icon: 'border-info/20 bg-info/10 text-info', strip: 'bg-info', badge: 'info' },
    success: { icon: 'border-success/20 bg-success/10 text-success', strip: 'bg-success', badge: 'success' },
    warning: { icon: 'border-warning/25 bg-warning/10 text-warning', strip: 'bg-warning', badge: 'warning' },
    neutral: { icon: 'border-border bg-muted/50 text-muted-foreground', strip: 'bg-muted-foreground', badge: 'neutral' },
};

const accountSets = {
    local: {
        label: 'Local',
        description: 'Local development accounts',
        accounts: localTestAccounts,
    },
    prod: {
        label: 'Prod Demo',
        description: 'Seeded demo organization accounts',
        accounts: prodTestAccounts,
    },
};

export default function TestLoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const { dispatch } = useGlobal();
    const [accountSet, setAccountSet] = useState<keyof typeof accountSets>('local');
    const [activeEmail, setActiveEmail] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const selectedSet = accountSets[accountSet];
    const groups = Array.from(new Set(selectedSet.accounts.map((account) => account.group)));

    const handleLogin = async (account: TestAccount) => {
        if (activeEmail) return;

        setError(null);
        setActiveEmail(account.email);

        try {
            const deviceId = getDeviceId();
            const deviceInfo = getDeviceInfo();
            const response = await api.auth.login({
                email: account.email,
                password: account.password,
                rememberMe: true,
                deviceId,
                deviceName: deviceInfo?.deviceName,
                deviceType: deviceInfo?.deviceType,
                browser: deviceInfo?.browser,
                os: deviceInfo?.os,
            });

            if (!response.access_token) {
                throw new Error('Login response did not include an access token.');
            }

            const decoded = decodeAuthToken(response.access_token);
            await login(response.access_token);
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: `Signed in as ${decoded.name || account.label}`,
                    type: 'success',
                },
            });
            router.replace(getRoleDashboardPath(decoded));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Test login failed');
        } finally {
            setActiveEmail(null);
        }
    };

    return (
        <main className="min-h-screen overflow-y-auto bg-background p-4 sm:p-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                <header className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-black tracking-tight text-foreground">Test Login</h1>
                                <Badge variant="warning" size="sm">Manual path</Badge>
                                <Badge variant="neutral" size="sm">{selectedSet.description}</Badge>
                            </div>
                            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
                                One-click test accounts for QA. This page is intentionally hidden from navigation.
                            </p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                            <div className="inline-flex rounded-lg border border-border bg-background p-1">
                                {(Object.keys(accountSets) as Array<keyof typeof accountSets>).map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            setAccountSet(key);
                                            setError(null);
                                        }}
                                        className={cn(
                                            'rounded-md px-3 py-1.5 text-xs font-black transition-colors',
                                            accountSet === key
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                        )}
                                        aria-pressed={accountSet === key}
                                    >
                                        {accountSets[key].label}
                                    </button>
                                ))}
                            </div>
                            <Badge variant="neutral" size="sm">{selectedSet.accounts.length} accounts</Badge>
                        </div>
                    </div>
                    {error && (
                        <div className="mt-4 rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
                            {error}
                        </div>
                    )}
                </header>

                {groups.map((group) => (
                    <section key={group} className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{group}</h2>
                            <Badge variant="neutral" size="sm">
                                {selectedSet.accounts.filter((account) => account.group === group).length}
                            </Badge>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {selectedSet.accounts.filter((account) => account.group === group).map((account) => {
                                const Icon = account.icon;
                                const tone = toneClasses[account.tone];
                                const isActive = activeEmail === account.email;

                                return (
                                    <article key={account.email} className="relative overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                                        <div className={cn('absolute inset-y-0 left-0 w-1', tone.strip)} aria-hidden="true" />
                                        <div className="flex h-full min-w-0 flex-col gap-4 p-4 pl-5">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-md border', tone.icon)}>
                                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-base font-black text-foreground">{account.label}</h3>
                                                        <Badge variant={tone.badge} size="sm">{account.roleHint}</Badge>
                                                    </div>
                                                    <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">{account.email}</p>
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                className="mt-auto w-full"
                                                disabled={!!activeEmail}
                                                onClick={() => handleLogin(account)}
                                            >
                                                {isActive ? 'Signing in...' : `Login as ${account.label}`}
                                            </Button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </main>
    );
}
