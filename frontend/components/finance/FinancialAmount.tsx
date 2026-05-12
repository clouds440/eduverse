
interface FinancialAmountProps {
    amount: number;
    currency?: string;
    className?: string;
    showSymbol?: boolean;
}

export function FinancialAmount({ amount, currency = 'USD', className = '', showSymbol = true }: FinancialAmountProps) {
    const formatted = new Intl.NumberFormat('en-US', {
        style: showSymbol ? 'currency' : 'decimal',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);

    return (
        <span className={`font-mono font-bold tracking-tight ${className}`}>
            {showSymbol ? formatted : `${formatted} ${currency}`}
        </span>
    );
}
