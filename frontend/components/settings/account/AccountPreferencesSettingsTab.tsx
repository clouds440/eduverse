import { ThemeMode, type UserSettings } from '@/types';
import { AccountAppearanceSettingsTab } from './AccountAppearanceSettingsTab';
import {
    NotificationSettingsTab,
    type NotificationSettingKey,
} from './NotificationSettingsTab';

export function AccountPreferencesSettingsTab({
    settings,
    themeMode,
    savingTheme,
    savingNotification,
    onThemeModeChange,
    onNotificationChange,
}: {
    settings: UserSettings;
    themeMode: ThemeMode;
    savingTheme: boolean;
    savingNotification?: NotificationSettingKey;
    onThemeModeChange: (mode: ThemeMode) => void;
    onNotificationChange: (key: NotificationSettingKey, enabled: boolean) => void;
}) {
    return (
        <div className="space-y-6">
            <AccountAppearanceSettingsTab
                themeMode={themeMode}
                saving={savingTheme}
                onThemeModeChange={onThemeModeChange}
            />
            <NotificationSettingsTab
                settings={settings}
                savingKey={savingNotification}
                onChange={onNotificationChange}
            />
        </div>
    );
}
