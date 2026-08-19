import type { OnlineAdmissionEmailTemplates, ThemeMode } from '@/types';

export interface OrganizationSettingsFormData {
    name: string;
    location: string;
    contactEmail: string;
    phone: string;
    currency: string;
    accentColor: {
        primary: string;
        mode: ThemeMode;
    };
    onlineAdmissionsEnabled: boolean;
    onlineAdmissionEmailTemplates: OnlineAdmissionEmailTemplates;
}

export interface OrganizationSettingsFormErrors {
    name?: string;
    location?: string;
    contactEmail?: string;
    phone?: string;
    currency?: string;
    accentColor?: string;
    onlineAdmissionsEnabled?: string;
    onlineAdmissionEmailTemplates?: string;
    general?: string;
}
