import { CheckCircle, School } from 'lucide-react';
import type { Organization } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { DocsLink } from '@/components/ui/DocsLink';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { SettingsSection } from '../SettingsSection';

export function BrandingSettingsTab({
    organization,
    pendingLogoFile,
    onLogoReady,
}: {
    organization: Organization | null;
    pendingLogoFile: File | null;
    onLogoReady: (file: File) => void;
}) {
    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
            <SettingsSection
                icon={School}
                title="Organization Logo"
                description={<>Upload a square organization mark. <DocsLink href="/docs/settings#branding-logo">Logo details</DocsLink></>}
                contentClassName="sm:p-6"
            >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <PhotoUploadPicker
                        currentImageUrl={organization?.logoUrl}
                        updatedAt={organization?.avatarUpdatedAt}
                        onFileReady={onLogoReady}
                        type="org"
                        sizeClassName="h-32 w-32"
                        hint="Saved when you click Save Settings"
                    />
                    <div className="min-w-0 space-y-3">
                        <p className="text-sm font-semibold leading-6 text-muted-foreground">
                            Use a clear square mark that still reads well in small navigation and table views.
                        </p>
                        {pendingLogoFile && <Badge variant="primary" size="md" icon={CheckCircle}>New logo ready</Badge>}
                    </div>
                </div>
            </SettingsSection>
            <SettingsSection icon={CheckCircle} title="Logo Status" description="Saved logo state for this workspace.">
                <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
                        <span className="font-semibold text-muted-foreground">Current logo</span>
                        <Badge variant={organization?.logoUrl ? 'success' : 'secondary'} size="sm">
                            {organization?.logoUrl ? 'Available' : 'Not set'}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
                        <span className="font-semibold text-muted-foreground">Pending change</span>
                        <Badge variant={pendingLogoFile ? 'primary' : 'secondary'} size="sm">
                            {pendingLogoFile ? 'Ready to save' : 'None'}
                        </Badge>
                    </div>
                </div>
            </SettingsSection>
        </div>
    );
}
