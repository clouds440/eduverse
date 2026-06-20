export const SUPPORTED_CURRENCY_OPTIONS = [
    { value: 'PKR', label: 'PKR - Pakistani Rupee' },
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'INR', label: 'INR - Indian Rupee' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'SAR', label: 'SAR - Saudi Riyal' },
    { value: 'AED', label: 'AED - UAE Dirham' },
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCY_OPTIONS[number]['value'];
