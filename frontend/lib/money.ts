export type MoneyValue = string | number | null | undefined;

export function toMoneyNumber(value: MoneyValue): number {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function moneySubtract(left: MoneyValue, right: MoneyValue): number {
    return Math.max(0, Number((toMoneyNumber(left) - toMoneyNumber(right)).toFixed(2)));
}

export function moneyAdd(values: MoneyValue[]): number {
    const total = values.reduce<number>((sum, value) => sum + toMoneyNumber(value), 0);
    return Number(total.toFixed(2));
}

export function compareMoney(left: MoneyValue, right: MoneyValue) {
    return toMoneyNumber(left) - toMoneyNumber(right);
}

export function toMoneyInput(value: MoneyValue) {
    return toMoneyNumber(value).toFixed(2);
}
