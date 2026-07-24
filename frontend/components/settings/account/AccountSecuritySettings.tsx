import Image from 'next/image';
import { KeyRound, Link as LinkIcon, Unlink } from 'lucide-react';
import type { LinkedAccount } from '@/types';
import { TrustedEncryptionDevicesPanel } from '@/components/TrustedEncryptionDevicesPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SettingsActionLink } from '../SettingsActionLink';
import { SettingsSection } from '../SettingsSection';

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
        <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-2">
                <SettingsSection
                    icon={LinkIcon}
                    id="linked-accounts"
                    title="Linked Accounts"
                    description="Use linked providers as alternate sign-in methods."
                >
                    <div className="flex flex-col gap-4 rounded-lg border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card">
                                <Image src="/assets/svgs/google.svg" alt="" width={24} height={24} className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-black text-foreground">Google</p>
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
                </SettingsSection>

                <SettingsSection
                    icon={KeyRound}
                    title="Password"
                    description="Change the password used for direct EduVerse sign-in."
                >
                    <div className="flex min-h-24 items-center justify-between gap-4 rounded-lg border border-border/70 bg-background/60 p-4">
                        <p className="text-sm font-semibold text-muted-foreground">
                            Updating your password signs out other active sessions.
                        </p>
                        <SettingsActionLink href={changePasswordHref}>Change Password</SettingsActionLink>
                    </div>
                </SettingsSection>
            </div>

            <div id="sessions" className="scroll-mt-24">
                <TrustedEncryptionDevicesPanel />
            </div>
        </div>
    );
}
