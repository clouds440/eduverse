import type { DashboardInsightActivity } from './insights.types';

export function sortActivities(activities: DashboardInsightActivity[], limit = 6) {
  return activities
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}
