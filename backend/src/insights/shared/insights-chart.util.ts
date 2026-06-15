import { formatLocalDate } from './insights-date.util';

export function processDateTrendData(
  groupByData: { createdAt?: Date; date?: Date; _count: number }[],
  startDate: Date,
  endDate: Date,
): { date: string; value: number }[] {
  const result: { date: string; value: number }[] = [];
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  const endDateOnly = new Date(endDate);
  endDateOnly.setHours(23, 59, 59, 999);

  const dataMap = new Map<string, number>();
  groupByData.forEach((item) => {
    const dateKey = item.createdAt
      ? formatLocalDate(item.createdAt)
      : item.date
        ? formatLocalDate(item.date)
        : '';
    if (dateKey) {
      dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + item._count);
    }
  });

  while (currentDate.getTime() <= endDateOnly.getTime()) {
    const dateKey = formatLocalDate(currentDate);
    result.push({
      date: dateKey,
      value: dataMap.get(dateKey) || 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

export function processGradeDistribution(
  grades: Array<{ marksObtained: number; assessment: { totalMarks: number; section: { course: { name: string } } } }>,
): { range: string; count: number }[] {
  const distribution = {
    '90-100%': 0,
    '80-89%': 0,
    '70-79%': 0,
    '60-69%': 0,
    '50-59%': 0,
    '0-49%': 0,
  };

  grades.forEach((grade) => {
    const percentage = (grade.marksObtained / grade.assessment.totalMarks) * 100;
    if (percentage >= 90) distribution['90-100%']++;
    else if (percentage >= 80) distribution['80-89%']++;
    else if (percentage >= 70) distribution['70-79%']++;
    else if (percentage >= 60) distribution['60-69%']++;
    else if (percentage >= 50) distribution['50-59%']++;
    else distribution['0-49%']++;
  });

  return Object.entries(distribution).map(([range, count]) => ({ range, count }));
}
