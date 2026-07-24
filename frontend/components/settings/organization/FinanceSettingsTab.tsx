import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Label } from '@/components/ui/Label';
import { SUPPORTED_CURRENCY_OPTIONS } from '@/lib/currencies';
import { SettingsSection } from '../SettingsSection';
import type {
    OrganizationSettingsFormData,
    OrganizationSettingsFormErrors,
} from './types';

export function FinanceSettingsTab({
    formData,
    setFormData,
    formErrors,
    setFormErrors,
}: {
    formData: OrganizationSettingsFormData;
    setFormData: Dispatch<SetStateAction<OrganizationSettingsFormData>>;
    formErrors: OrganizationSettingsFormErrors;
    setFormErrors: Dispatch<SetStateAction<OrganizationSettingsFormErrors>>;
}) {
    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
            <SettingsSection icon={Coins} title="Organization Currency" description="Set the default currency used across finance structures, salary records, fee book amounts, and finance dashboards.">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] md:items-start">
                    <div className="space-y-2">
                        <Label htmlFor="settings-currency" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Default Currency</Label>
                        <CustomSelect
                            value={formData.currency}
                            onChange={(value) => {
                                setFormErrors((current) => ({ ...current, currency: undefined }));
                                setFormData((current) => ({ ...current, currency: value }));
                            }}
                            options={SUPPORTED_CURRENCY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                            placeholder="Choose currency"
                            searchable
                            error={!!formErrors.currency}
                        />
                        {formErrors.currency && <p className="mt-1.5 text-xs font-semibold text-danger">{formErrors.currency}</p>}
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Current setting</p>
                        <p className="mt-2 text-2xl font-black text-foreground">{formData.currency}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">Existing financial structures are updated to this currency when settings are saved.</p>
                    </div>
                </div>
            </SettingsSection>
            <SettingsSection icon={CheckCircle} title="Finance Coverage" description="Where this currency appears after saving.">
                <div className="space-y-3 text-sm">
                    {['Finance structures', 'Student fee book', 'Teacher salary overview', 'Finance dashboard insights'].map((item) => (
                        <div key={item} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
                            <span className="font-semibold text-muted-foreground">{item}</span>
                            <Badge variant="success" size="sm" dot>{formData.currency}</Badge>
                        </div>
                    ))}
                </div>
            </SettingsSection>
        </div>
    );
}
