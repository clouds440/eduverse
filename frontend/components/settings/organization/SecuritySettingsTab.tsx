import { CheckCircle, ExternalLink, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { LinkedAccount, Organization } from '@/types';
import { AccountSecuritySettings } from '@/components/settings/account/AccountSecuritySettings';
import { Badge } from '@/components/ui/Badge';
import { SettingsActionLink } from '../SettingsActionLink';
import { SettingsSection } from '../SettingsSection';

export function SecuritySettingsTab({
    organization,
    contactEmail,
    googleAccount,
    linkedAccountsLoading,
    onStartGoogleLink,
    onUnlinkGoogle,
}: {
    organization: Organization | null;
    contactEmail: string;
    googleAccount?: LinkedAccount;
    linkedAccountsLoading: boolean;
    onStartGoogleLink: () => void;
    onUnlinkGoogle: () => void;
}) {
    return (
        <div className="space-y-5">
            <SettingsSection
                icon={ShieldCheck}
                title="Contact Verification"
                description="Password recovery uses the verified contact email."
                action={organization?.contactEmailVerifiedAt
                    ? <Badge variant="success" size="md" icon={CheckCircle}>Verified</Badge>
                    : <Badge variant="warning" size="md" icon={TriangleAlert}>Pending</Badge>}
            >
                <div className="flex flex-col gap-4 rounded-lg border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{contactEmail || 'No contact email'}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                            Update this from the Profile tab when the organization contact changes.
                        </p>
                    </div>
                    <SettingsActionLink href="/change-password" icon={ExternalLink}>Change Password</SettingsActionLink>
                </div>
            </SettingsSection>

            <AccountSecuritySettings
                googleAccount={googleAccount}
                linkedAccountsLoading={linkedAccountsLoading}
                changePasswordHref="/change-password"
                onStartGoogleLink={onStartGoogleLink}
                onUnlinkGoogle={onUnlinkGoogle}
            />
        </div>
    );
}
