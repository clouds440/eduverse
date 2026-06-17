import { InsightTone } from '../../common/enums';
import type { InsightInterval, InsightTimeRange } from './insights-date.util';

export interface InsightsUser {
  name: string | null | undefined;
  id: string;
  role?: string;
  email?: string;
  organizationId?: string | null;
  userName?: string;
}

export interface DashboardInsightCard {
  id: string;
  label: string;
  value: string;
  detail?: string;
  href?: string;
  tone?: InsightTone;
}

export interface DashboardInsightItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  href?: string;
  badge?: string;
  tone?: InsightTone;
}

export interface DashboardInsightGroup {
  id: string;
  title: string;
  description?: string;
  items: DashboardInsightItem[];
}

export interface DashboardInsightActivity {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  href?: string;
  tone?: InsightTone;
}

export interface DashboardInsightsResponse<TCharts = unknown> {
  role: string;
  filters?: {
    selectedRange?: InsightTimeRange;
    interval?: InsightInterval;
    from?: string;
    to?: string;
    selectedStudentId?: string | null;
  };
  headline: {
    eyebrow?: string;
    title: string;
    subtitle: string;
  };
  summaryCards: DashboardInsightCard[];
  spotlight: DashboardInsightItem | null;
  groups: DashboardInsightGroup[];
  recentActivity: DashboardInsightActivity[];
  charts?: TCharts;
}

export interface StandardInsightCharts {
  attendanceTrend?: { date: string; value: number }[];
  enrollmentTrend?: { date: string; value: number }[];
  gradeDistribution?: { range: string; count: number }[];
  sectionCapacity?: { name: string; courseName?: string; color?: string; enrolled: number; capacity?: number }[];
  mailStatus?: { status: string; count: number }[];
  assessmentCompletion?: { section: string; courseName?: string; color?: string; completed: number; total: number }[];
  teacherWorkload?: { name: string; sections: number; students: number }[];
  studentPerformance?: { subject: string; sectionName?: string; courseName?: string; color?: string; grade: number; attendance: number }[];
  departmentActivity?: { department: string; courses: number; sections: number; students: number; teachers: number; color?: string | null }[];
  departmentPerformance?: { department: string; averageGradePercent: number; attendanceRatePercent: number; gradedAssessments: number; attendanceMarks: number; color?: string | null }[];
  roomUsage?: { room: string; building: string; scheduledSlots: number; capacity?: number | null }[];
  buildingUsage?: { building: string; rooms: number; scheduledSlots: number }[];
  departmentFinance?: { departmentId: string; department: string; expectedAmount: number; collectedAmount: number; pendingAmount: number; overdueAmount: number; collectionRatePercent: number; estimated: boolean }[];
}

export type StandardDashboardInsightsResponse = DashboardInsightsResponse<StandardInsightCharts>;
