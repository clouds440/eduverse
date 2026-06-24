
import { MoneyValue, toMoneyNumber } from '@/lib/money';

interface FinancialAmountProps {
    amount: MoneyValue;
    currency?: string;
    className?: string;
    showSymbol?: boolean;
}

export function FinancialAmount({ amount, currency = 'USD', className = '', showSymbol = true }: FinancialAmountProps) {
    const formatted = new Intl.NumberFormat('en-US', {
        style: showSymbol ? 'currency' : 'decimal',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(toMoneyNumber(amount));

    return (
        <span className={`font-mono font-bold tracking-tight ${className}`}>
            {showSymbol ? formatted : `${formatted} ${currency}`}
        </span>
    );
}
