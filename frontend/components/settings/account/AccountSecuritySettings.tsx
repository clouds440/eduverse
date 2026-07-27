import Image from 'next/image';
import { KeyRound, Link as LinkIcon, Unlink } from 'lucide-react';
import type { LinkedAccount } from '@/types';
import { TrustedEncryptionDevicesPanel } from '@/components/TrustedEncryptionDevicesPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SettingsActionLink } from '../SettingsActionLink';
import { SettingsSection } from '../SettingsSection';
import { TwoFactorEmailSettings } from './TwoFactorEmailSettings';

function GoogleIcon({ className }: { className?: string }) {
    return <Image src="/assets/svgs/google.svg" alt="" width={20} height={20} className={className} />;
}

export function AccountSecuritySettings({
    googleAccount,
    linkedAccountsLoading,
    changePasswordHref,
    onStartGoogleLink,
    onUnlinkGoogle,
}: {
    googleAccount?: LinkedAccount;
    linkedAccountsLoading: boolean;
    changePasswordHref: string;
    onStartGoogleLink: () => void;
    onUnlinkGoogle: () => void;
}) {
    return (
        <div className="space-y-6">
            <TwoFactorEmailSettings googleAccount={googleAccount ?? null} />
            <SettingsSection
                icon={KeyRound}
                title="Sign-in methods"
                description="Manage the ways you can sign in to your account."
            >
                <div className="grid gap-4 lg:grid-cols-2">
                    <div id="linked-accounts" className="scroll-mt-24 rounded-lg border border-border/70 bg-background/60 p-4">
                        <div className="mb-4 flex items-start gap-3">
                            <div className="rounded-lg bg-primary/10 p-2 text-primary"><LinkIcon className="h-5 w-5" /></div>
                            <div>
                                <h3 className="text-sm font-black text-foreground">Google sign-in</h3>
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">Use Google as a quick, secure way to sign in.</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card">
                                <Image src="/assets/svgs/google.svg" alt="" width={24} height={24} className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-black text-foreground">Google account</p>
                                    {googleAccount
                                        ? <Badge variant="success" size="sm" dot>Linked</Badge>
                                        : <Badge variant="secondary" size="sm">Not linked</Badge>}
                                </div>
                                {googleAccount ? (
                                    <div className="mt-1 space-y-0.5 text-xs font-semibold text-muted-foreground">
                                        {googleAccount.email && <p className="truncate">Linked as {googleAccount.email}</p>}
                                        <p>Linked on {new Date(googleAccount.createdAt).toLocaleDateString()}</p>
                                    </div>
                                ) : (
                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                        Link Google after signing in with your EduVerse password.
                                    </p>
                                )}
                            </div>
                        </div>
                        {googleAccount ? (
                            <Button
                                type="button"
                                variant="danger"
                                icon={Unlink}
                                onClick={onUnlinkGoogle}
                                loadingId="unlink-google"
                                disabled={linkedAccountsLoading}
                                className="w-full shrink-0 text-xs sm:w-auto"
                                px="px-4"
                                py="py-2.5"
                            >
                                Unlink Google
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="secondary"
                                icon={GoogleIcon}
                                onClick={onStartGoogleLink}
                                disabled={linkedAccountsLoading}
                                className="w-full shrink-0 text-xs sm:w-auto"
                                px="px-4"
                                py="py-2.5"
                            >
                                Link Google
                            </Button>
                        )}
                        </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                        <div className="mb-4 flex items-start gap-3">
                            <div className="rounded-lg bg-primary/10 p-2 text-primary"><KeyRound className="h-5 w-5" /></div>
                            <div>
                                <h3 className="text-sm font-black text-foreground">Password sign-in</h3>
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">Manage the password used to sign in directly.</p>
                            </div>
                        </div>
                        <div className="flex min-h-20 flex-col items-start justify-between gap-4 rounded-lg border border-border/60 bg-card/70 p-3 sm:flex-row sm:items-center">
                            <p className="text-sm font-semibold text-muted-foreground">
                                Updating your password signs out other active sessions.
                            </p>
                            <SettingsActionLink href={changePasswordHref}>Change Password</SettingsActionLink>
                        </div>
                    </div>
                </div>
            </SettingsSection>

            <div id="sessions" className="scroll-mt-24">
                <TrustedEncryptionDevicesPanel />
            </div>
        </div>
    );
}
