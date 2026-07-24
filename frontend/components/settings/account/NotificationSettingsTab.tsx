import { BellRing, Mail, Megaphone, Smartphone } from 'lucide-react';
import type { UserSettings } from '@/types';
import { Toggle } from '@/components/ui/Toggle';
import { SettingsSection } from '../SettingsSection';

export type NotificationSettingKey =
    | 'loginNotificationEmail'
    | 'loginNotificationPush'
    | 'marketingEmails';

const NOTIFICATION_SETTINGS: Array<{
    key: NotificationSettingKey;
    label: string;
    description: string;
    icon: typeof Mail;
}> = [
    {
        key: 'loginNotificationEmail',
        label: 'Login email alerts',
        description: 'Allow security email alerts for login activity as email delivery options become available.',
        icon: Mail,
    },
    {
        key: 'loginNotificationPush',
        label: 'Login push alerts',
        description: 'Receive in-app or push notifications about account login activity.',
        icon: Smartphone,
    },
    {
        key: 'marketingEmails',
        label: 'Product and marketing email',
        description: 'Choose whether optional EduVerse product updates may be sent to your account email.',
        icon: Megaphone,
    },
];

export function NotificationSettingsTab({
    settings,
    savingKey,
    onChange,
}: {
    settings: UserSettings;
    savingKey?: NotificationSettingKey;
    onChange: (key: NotificationSettingKey, enabled: boolean) => void;
}) {
    return (
        <SettingsSection
            icon={BellRing}
            title="Notification Preferences"
            description="Control optional account and product notifications."
        >
            <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 bg-background/60">
                {NOTIFICATION_SETTINGS.map(({ key, label, description, icon: Icon }) => (
                    <div key={key} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-primary">
                                <Icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-foreground">{label}</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{description}</p>
                            </div>
                        </div>
                        <Toggle
                            checked={settings[key]}
                            onCheckedChange={(checked) => onChange(key, checked)}
                            disabled={Boolean(savingKey)}
                            size="lg"
                        />
                    </div>
                ))}
            </div>
        </SettingsSection>
    );
}
