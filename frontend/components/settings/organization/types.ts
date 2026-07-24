import type { ThemeMode } from '@/types';

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
}

export interface OrganizationSettingsFormErrors {
    name?: string;
    location?: string;
    contactEmail?: string;
    phone?: string;
    currency?: string;
    accentColor?: string;
    general?: string;
}
