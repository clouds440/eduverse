export function normalizeFuzzyText(value?: string | number | null) {
    return String(value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function fuzzyTokens(value: string) {
    return normalizeFuzzyText(value).split(/\s+/).filter(Boolean);
}

function editDistance(a: string, b: string, maxDistance = 2) {
    if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
        let diagonal = previous[0];
        previous[0] = i;

        for (let j = 1; j <= b.length; j += 1) {
            const temp = previous[j];
            previous[j] = Math.min(
                previous[j] + 1,
                previous[j - 1] + 1,
                diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
            diagonal = temp;
        }
    }

    return previous[b.length];
}

function isTransposition(a: string, b: string) {
    if (a.length !== b.length) return false;
    let firstDiff = -1;
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] === b[index]) continue;
        if (firstDiff !== -1) {
            return (
                index === firstDiff + 1 &&
                a[firstDiff] === b[index] &&
                a[index] === b[firstDiff] &&
                a.slice(index + 1) === b.slice(index + 1)
            );
        }
        firstDiff = index;
    }
    return false;
}

function tokenMatchScore(queryToken: string, fieldToken: string) {
    if (!queryToken || !fieldToken) return 0;
    if (fieldToken === queryToken) return 120;
    if (fieldToken.startsWith(queryToken)) return 90;
    if (fieldToken.includes(queryToken)) return 72;
    if (queryToken.length < 4 || fieldToken.length < 4) return 0;
    if (isTransposition(queryToken, fieldToken)) return 58;

    const maxDistance = queryToken.length >= 7 && fieldToken.length >= 7 ? 2 : 1;
    const sameAnchor = queryToken[0] === fieldToken[0] || queryToken.slice(0, 2) === fieldToken.slice(0, 2);
    if (!sameAnchor) return 0;

    const distance = editDistance(queryToken, fieldToken, maxDistance);
    return distance <= maxDistance ? 48 - distance * 12 : 0;
}

export function fuzzySearchScore(query: string, values: Array<string | number | null | undefined>) {
    const queryTokens = fuzzyTokens(query);
    if (!queryTokens.length) return 0;

    const fieldText = normalizeFuzzyText(values.filter(Boolean).join(' '));
    if (!fieldText) return 0;
    const fieldTokens = fieldText.split(/\s+/).filter(Boolean);

    let total = 0;
    for (const queryToken of queryTokens) {
        const wholeTextScore = fieldText.includes(queryToken) ? 66 : 0;
        const tokenScore = fieldTokens.reduce(
            (best, fieldToken) => Math.max(best, tokenMatchScore(queryToken, fieldToken)),
            wholeTextScore,
        );
        if (tokenScore <= 0) return 0;
        total += tokenScore;
    }

    const normalizedQuery = normalizeFuzzyText(query);
    if (fieldText === normalizedQuery) total += 160;
    if (fieldText.startsWith(normalizedQuery)) total += 90;
    return total;
}

export function fuzzyIncludes(query: string, values: Array<string | number | null | undefined>) {
    return fuzzySearchScore(query, values) > 0;
}

export function fuzzyFilterAndRank<T>(
    items: T[],
    query: string,
    getValues: (item: T) => Array<string | number | null | undefined>,
) {
    const trimmed = query.trim();
    if (!trimmed) return items;

    return items
        .map((item) => ({ item, score: fuzzySearchScore(trimmed, getValues(item)) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item);
}
