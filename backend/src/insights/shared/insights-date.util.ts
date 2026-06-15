export type InsightInterval = 'daily' | 'weekly' | 'monthly';
export type InsightTimeRange = '1D' | '3D' | '7D' | '15D' | '1M' | '3M' | '6M' | '1Y';

export const INSIGHT_TIME_RANGES: InsightTimeRange[] = ['1D', '3D', '7D', '15D', '1M', '3M', '6M', '1Y'];

export function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function countWeekdayOccurrences(start: Date, end: Date, targetDay: number) {
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  let count = 0;
  while (cursor <= endDate) {
    if (cursor.getDay() === targetDay) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

export function getIsoWeek(date: Date) {
  const cursor = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((cursor.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${cursor.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function getMonthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function getIntervalLabel(date: Date, interval: InsightInterval) {
  if (interval === 'daily') return toDateOnly(date);
  if (interval === 'weekly') return getIsoWeek(date);
  return getMonthLabel(date);
}

export function startOfInterval(date: Date, interval: InsightInterval) {
  const cursor = new Date(date);
  cursor.setHours(0, 0, 0, 0);

  if (interval === 'weekly') {
    const day = cursor.getDay() || 7;
    cursor.setDate(cursor.getDate() - day + 1);
  }

  if (interval === 'monthly') {
    cursor.setDate(1);
  }

  return cursor;
}

export function addInterval(date: Date, interval: InsightInterval, amount = 1) {
  const cursor = new Date(date);
  if (interval === 'daily') cursor.setDate(cursor.getDate() + amount);
  if (interval === 'weekly') cursor.setDate(cursor.getDate() + (7 * amount));
  if (interval === 'monthly') cursor.setMonth(cursor.getMonth() + amount);
  return cursor;
}

export function buildIntervalLabels(from: Date, to: Date, interval: InsightInterval) {
  const labels: string[] = [];
  let cursor = startOfInterval(from, interval);
  const end = startOfInterval(to, interval);

  while (cursor <= end) {
    labels.push(getIntervalLabel(cursor, interval));
    cursor = addInterval(cursor, interval);
  }

  return labels;
}

export function resolveDefaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 11);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function rangeToDays(range: InsightTimeRange) {
  switch (range) {
    case '1D':
      return 1;
    case '3D':
      return 3;
    case '7D':
      return 7;
    case '15D':
      return 15;
    case '1M':
      return 30;
    case '3M':
      return 90;
    case '6M':
      return 180;
    case '1Y':
      return 365;
  }
}

export function intervalForRange(range: InsightTimeRange): InsightInterval {
  if (range === '1D' || range === '3D' || range === '7D' || range === '15D' || range === '1M') {
    return 'daily';
  }
  if (range === '3M') return 'weekly';
  return 'monthly';
}

export function resolveInsightDateRange(query?: {
  range?: string;
  from?: string;
  to?: string;
  interval?: InsightInterval;
}) {
  const range = INSIGHT_TIME_RANGES.includes(query?.range as InsightTimeRange)
    ? query?.range as InsightTimeRange
    : '1M';
  const to = query?.to ? new Date(query.to) : new Date();
  const from = query?.from ? new Date(query.from) : new Date(to);

  if (!query?.from) {
    from.setDate(to.getDate() - rangeToDays(range) + 1);
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return {
    from,
    to,
    range,
    interval: query?.interval || intervalForRange(range),
  };
}

export function previousEqualRange(from: Date, to: Date) {
  const duration = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration);
  return { previousFrom, previousTo };
}
