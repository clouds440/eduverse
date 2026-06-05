'use client';

import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { SVGProps } from 'react';
import { useEffect, useMemo, useState } from 'react';

// Color palette for charts
export const COLORS = {
  primary: '#6366f1', // primary
  success: '#10b981', // success
  warning: '#f59e0b', // warning
  danger: '#ef4444',  // danger
  info: '#3b82f6',    // info
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
  teal: '#14b8a6',
  border: '#e5e7eb',
  muted: '#94a3b8',
};

function useCompactChart() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)');
    const update = () => setIsCompact(query.matches);

    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isCompact;
}

function ChartTitle({ title, detail }: { title?: string; detail?: string }) {
  if (!title && !detail) return null;

  return (
    <div className="mb-3 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      {title && <h4 className="min-w-0 text-sm font-black tracking-tight text-foreground">{title}</h4>}
      {detail && <p className="text-xs font-semibold text-muted-foreground">{detail}</p>}
    </div>
  );
}

function getTooltipStyle() {
  return {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
  };
}

function getTickInterval(count: number, isCompact: boolean) {
  if (!isCompact) return 'preserveStartEnd' as const;
  if (count <= 6) return 0;
  return Math.max(0, Math.ceil(count / 5) - 1);
}

// Line Chart Component
interface LineChartProps {
  data: { date: string; value: number }[];
  height?: number;
  color?: string;
  title?: string;
}

export function InsightLineChart({ data, height = 300, color = COLORS.primary, title }: LineChartProps) {
  const isCompact = useCompactChart();
  const sourceData = data || [];

  const formattedData = useMemo(() => sourceData.map((item) => {
    const date = new Date(item.date);
    return {
      ...item,
      fullDate: Number.isNaN(date.getTime()) ? item.date : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      date: Number.isNaN(date.getTime())
        ? item.date
        : date.toLocaleDateString('en-US', isCompact ? { day: 'numeric' } : { month: 'short', day: 'numeric' }),
    };
  }), [sourceData, isCompact]);

  if (sourceData.length === 0) return null;

  const chartHeight = isCompact ? Math.min(height, 220) : height;
  const dense = formattedData.length > 14;

  return (
    <div className="w-full">
      <ChartTitle title={title} detail={formattedData.length > 1 ? `${formattedData.length} points` : 'Single point'} />
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={formattedData} margin={{ top: 8, right: isCompact ? 4 : 14, left: isCompact ? -24 : -8, bottom: 0 }}>
          <defs>
            <linearGradient id={`area-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={!isCompact} />
          <XAxis
            dataKey="date"
            className="text-xs text-muted-foreground"
            tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
            interval={getTickInterval(formattedData.length, isCompact)}
            minTickGap={isCompact ? 12 : 20}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
            width={isCompact ? 30 : 42}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={getTooltipStyle()}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value) => [value ?? 0, 'Value']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#area-${color.replace('#', '')})`}
            dot={isCompact || dense ? false : { fill: color, strokeWidth: 2, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Bar Chart Component
interface BarChartProps {
  data: Array<Record<string, string | number | null | undefined>>;
  dataKey: string;
  nameKey: string;
  height?: number;
  title?: string;
  color?: string;
  horizontal?: boolean;
  disableHover?: boolean;
}

export function InsightBarChart({ data, dataKey, nameKey, height = 300, title, color = COLORS.primary, horizontal = false, disableHover = false }: BarChartProps) {
  const isCompact = useCompactChart();

  if (!data || data.length === 0) return null;

  const layout = horizontal ? 'vertical' : undefined;
  const chartHeight = isCompact ? Math.min(height, horizontal ? 260 : 220) : height;

  return (
    <div className="w-full">
      <ChartTitle title={title} detail={`${data.length} ${data.length === 1 ? 'item' : 'items'}`} />
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, left: horizontal ? 4 : -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={!horizontal && !isCompact} />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                className="text-xs text-muted-foreground"
                tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey={nameKey}
                type="category"
                className="text-xs text-muted-foreground"
                tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={isCompact ? 72 : 92}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={nameKey}
                className="text-xs text-muted-foreground"
                tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval={getTickInterval(data.length, isCompact)}
              />
              <YAxis
                className="text-xs text-muted-foreground"
                tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={isCompact ? 30 : 42}
              />
            </>
          )}
          <Tooltip
            cursor={disableHover ? false : { fill: 'hsl(var(--muted))', opacity: 0.18 }}
            contentStyle={getTooltipStyle()}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            isAnimationActive={false}
            {...(disableHover ? { activeShape: (props: SVGProps<SVGRectElement>) => <rect {...props} /> } : {})}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Pie Chart Component
interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
  title?: string;
  showLegend?: boolean;
}

const PIE_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.info, COLORS.purple, COLORS.pink];

export function InsightPieChart({ data, height = 300, title, showLegend = true }: PieChartProps) {
  const isCompact = useCompactChart();

  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const visibleData = data.filter((item) => Number(item.value || 0) > 0);
  const dominant = visibleData.length > 0
    ? visibleData.reduce((best, item) => (item.value > best.value ? item : best), visibleData[0])
    : null;
  const chartHeight = isCompact ? Math.min(height, 230) : height;

  return (
    <div className="w-full">
      <ChartTitle title={title} detail={total > 0 ? `${total} total` : 'No recorded values'} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
        <div className="relative min-h-[12.5rem]">
          {visibleData.length === 0 ? (
            <div className="flex h-[12.5rem] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/25 text-center">
              <div>
                <p className="text-sm font-black text-foreground">No chartable values</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Labels are still listed for context.</p>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart>
                  <Pie
                    data={visibleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={isCompact ? 48 : 62}
                    outerRadius={isCompact ? 78 : 96}
                    paddingAngle={visibleData.length > 1 ? 2 : 0}
                    cornerRadius={visibleData.length > 1 ? 5 : 0}
                    labelLine={false}
                    label={false}
                    fill="#8884d8"
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {visibleData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={getTooltipStyle()}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value, name) => {
                      const numeric = Number(value || 0);
                      const percentage = total > 0 ? Math.round((numeric / total) * 100) : 0;
                      return [`${numeric} (${percentage}%)`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-card/80 px-4 py-3 text-center shadow-sm ring-1 ring-border/70 backdrop-blur">
                  <p className="text-2xl font-black text-foreground">{total}</p>
                  <p className="mt-0.5 max-w-28 truncate text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                    {dominant?.name || 'Total'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
        {showLegend && (
          <div className="grid gap-2">
            {data.map((entry, index) => {
              const value = Number(entry.value || 0);
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/55 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="truncate text-xs font-bold text-foreground">{entry.name}</span>
                  </div>
                  <span className="shrink-0 text-xs font-black text-muted-foreground">{value} - {percentage}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Stacked Bar Chart for completion rates
interface StackedBarChartProps {
  data: { section: string; completed: number; total: number }[];
  height?: number;
  title?: string;
}

export function CompletionBarChart({ data, height = 300, title }: StackedBarChartProps) {
  const isCompact = useCompactChart();

  if (!data || data.length === 0) return null;

  const chartData = data.map((item) => ({
    ...item,
    percentage: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0,
    remaining: item.total - item.completed,
  }));

  return (
    <div className="w-full">
      <ChartTitle title={title} detail={`${chartData.length} sections`} />
      <ResponsiveContainer width="100%" height={isCompact ? Math.min(height, 230) : height}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: isCompact ? -24 : -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={!isCompact} />
          <XAxis
            dataKey="section"
            className="text-xs text-muted-foreground"
            tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            interval={getTickInterval(chartData.length, isCompact)}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={isCompact ? 30 : 42}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.18 }}
            contentStyle={getTooltipStyle()}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value) => [value ?? 0, 'Students']}
          />
          <Legend />
          <Bar dataKey="completed" stackId="a" fill={COLORS.success} name="Submitted" radius={[4, 4, 0, 0]} />
          <Bar dataKey="remaining" stackId="a" fill={COLORS.border} name="Pending" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Radar/Scatter-like chart for student performance
interface PerformanceChartProps {
  data: { subject: string; grade: number; attendance: number }[];
  height?: number;
  title?: string;
}

export function PerformanceChart({ data, height = 300, title }: PerformanceChartProps) {
  const isCompact = useCompactChart();

  if (!data || data.length === 0) return null;

  const chartHeight = isCompact ? Math.max(240, Math.min(320, data.length * 56)) : height;

  return (
    <div className="w-full">
      <ChartTitle title={title} detail="Grade vs attendance" />
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: isCompact ? -12 : 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
          <XAxis
            type="number"
            className="text-xs text-muted-foreground"
            tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
          />
          <YAxis
            dataKey="subject"
            type="category"
            className="text-xs text-muted-foreground"
            tick={{ fontSize: isCompact ? 10 : 11, fill: 'hsl(var(--muted-foreground))' }}
            width={isCompact ? 74 : 104}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.16 }}
            contentStyle={getTooltipStyle()}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value, name) => [`${value ?? 0}%`, name === 'grade' ? 'Grade' : 'Attendance']}
          />
          <Legend />
          <Bar dataKey="grade" fill={COLORS.primary} name="Grade" radius={[0, 6, 6, 0]} isAnimationActive={false} />
          <Bar dataKey="attendance" fill={COLORS.success} name="Attendance" radius={[0, 6, 6, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
