import type { Dispatch, SetStateAction } from 'react';
import { Palette, Settings } from 'lucide-react';
import type { ThemeMode } from '@/types';
import { ColorSelector } from '@/components/ui/ColorSelector';
import { DocsLink } from '@/components/ui/DocsLink';
import { ThemeDropdown } from '@/components/ui/ThemeDropdown';
import { SettingsSection } from '../SettingsSection';
import type { OrganizationSettingsFormData } from './types';

export function AppearanceSettingsTab({
    formData,
    setFormData,
    currentThemeMode,
    onPrimaryColorChange,
    onThemeModeChange,
}: {
    formData: OrganizationSettingsFormData;
    setFormData: Dispatch<SetStateAction<OrganizationSettingsFormData>>;
    currentThemeMode: ThemeMode;
    onPrimaryColorChange: (color: string) => void;
    onThemeModeChange: (mode: ThemeMode) => void;
}) {
    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <SettingsSection
                icon={Palette}
                title="Accent Color"
                description={<>Choose the primary accent for this workspace. <DocsLink href="/docs/settings#appearance-theme">Appearance details</DocsLink></>}
            >
                <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                    <ColorSelector value={formData.accentColor.primary} onChange={onPrimaryColorChange} ariaLabelPrefix="accent color" />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                        <p className="font-mono text-sm font-black uppercase text-foreground">{formData.accentColor.primary}</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Selected</span>
                            <span className="h-6 w-6 rounded-md border border-border/60 bg-primary shadow-xs" />
                        </div>
                    </div>
                </div>
            </SettingsSection>
            <SettingsSection icon={Settings} title="Theme Mode" description="Set the preferred display mode for your account.">
                <div className="space-y-4">
                    <ThemeDropdown
                        currentMode={currentThemeMode}
                        onModeChange={(mode) => {
                            setFormData((current) => ({
                                ...current,
                                accentColor: { ...current.accentColor, mode },
                            }));
                            onThemeModeChange(mode);
                        }}
                    />
                    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Preview</p>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: formData.accentColor.primary }} />
                            <span className="h-3 w-12 rounded-full bg-muted" />
                            <span className="h-3 w-8 rounded-full bg-foreground/20" />
                        </div>
                    </div>
                </div>
            </SettingsSection>
        </div>
    );
}
