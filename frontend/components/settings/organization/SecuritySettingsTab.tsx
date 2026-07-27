import type { LinkedAccount, Organization } from '@/types';
import { AccountSecuritySettings } from '@/components/settings/account/AccountSecuritySettings';

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
