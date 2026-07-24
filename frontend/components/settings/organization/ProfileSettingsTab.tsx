import type { ChangeEvent } from 'react';
import { Building2, Mail, MapPin, Phone, School } from 'lucide-react';
import { DocsLink } from '@/components/ui/DocsLink';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { SettingsSection } from '../SettingsSection';
import type {
    OrganizationSettingsFormData,
    OrganizationSettingsFormErrors,
} from './types';

function FieldError({ children }: { children?: string }) {
    if (!children) return null;
    return <p className="mt-1.5 text-xs font-semibold text-danger">{children}</p>;
}

export function ProfileSettingsTab({
    formData,
    formErrors,
    onChange,
}: {
    formData: OrganizationSettingsFormData;
    formErrors: OrganizationSettingsFormErrors;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <div className="grid gap-4">
            <SettingsSection
                icon={Building2}
                title="Organization Profile"
                description={<>These details identify the organization across dashboards and records. <DocsLink href="/docs/settings#organization-profile">Profile details</DocsLink></>}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="settings-name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Organization Name</Label>
                        <Input id="settings-name" type="text" name="name" value={formData.name} onChange={onChange} required icon={School} placeholder="School Name" error={!!formErrors.name} className="h-11 border-border/60 bg-background/70 font-medium" />
                        <FieldError>{formErrors.name}</FieldError>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="settings-location" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Location</Label>
                        <Input id="settings-location" type="text" name="location" value={formData.location} onChange={onChange} required icon={MapPin} placeholder="City, State" error={!!formErrors.location} className="h-11 border-border/60 bg-background/70 font-medium" />
                        <FieldError>{formErrors.location}</FieldError>
                    </div>
                    <div id="contact-email" className="space-y-2 scroll-mt-24">
                        <Label htmlFor="settings-contact-email" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Contact Email</Label>
                        <Input id="settings-contact-email" type="email" name="contactEmail" value={formData.contactEmail} onChange={onChange} icon={Mail} placeholder="contact@example.com" error={!!formErrors.contactEmail} className="h-11 border-border/60 bg-background/70 font-medium" />
                        <FieldError>{formErrors.contactEmail}</FieldError>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="settings-phone" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Phone Number</Label>
                        <Input id="settings-phone" type="text" name="phone" value={formData.phone} onChange={onChange} icon={Phone} placeholder="+1 (555) 000-0000" error={!!formErrors.phone} className="h-11 border-border/60 bg-background/70 font-medium" />
                        <FieldError>{formErrors.phone}</FieldError>
                    </div>
                </div>
            </SettingsSection>
        </div>
    );
}
