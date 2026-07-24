import { MonitorCog } from 'lucide-react';
import type { ThemeMode } from '@/types';
import { ThemeDropdown } from '@/components/ui/ThemeDropdown';
import { SettingsSection } from '../SettingsSection';

export function AccountAppearanceSettingsTab({
    themeMode,
    saving,
    onThemeModeChange,
}: {
    themeMode: ThemeMode;
    saving: boolean;
    onThemeModeChange: (mode: ThemeMode) => void;
}) {
    return (
        <SettingsSection
            icon={MonitorCog}
            title="Theme Mode"
            description="Choose the display mode used for your administrator account."
            action={saving ? <span className="text-xs font-semibold text-muted-foreground">Saving…</span> : undefined}
        >
            <div className="max-w-md space-y-4">
                <ThemeDropdown currentMode={themeMode} onModeChange={onThemeModeChange} />
                <p className="rounded-lg border border-border/70 bg-background/60 p-3 text-xs font-semibold leading-5 text-muted-foreground">
                    This preference follows your account across browsers after you sign in.
                </p>
            </div>
        </SettingsSection>
    );
}
