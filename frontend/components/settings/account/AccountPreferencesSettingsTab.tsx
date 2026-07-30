import type { UserSettings } from '@/types';
import {
    NotificationSettingsTab,
    type NotificationSettingKey,
} from './NotificationSettingsTab';

export function AccountPreferencesSettingsTab({
    settings,
    onNotificationChange,
}: {
    settings: UserSettings;
    onNotificationChange: (key: NotificationSettingKey, enabled: boolean) => void;
}) {
    return (
        <NotificationSettingsTab
            settings={settings}
            onChange={onNotificationChange}
        />
    );
}
