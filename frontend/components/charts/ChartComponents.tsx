'use client';

import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  ComposedChart,
  Line,
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

const CHART_THEME = {
  background: 'var(--background)',
  card: 'var(--card-bg)',
  text: 'var(--foreground)',
  mutedText: 'var(--muted-text)',
  muted: 'var(--muted-bg)',
  border: 'var(--border-color)',
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
    backgroundColor: CHART_THEME.card,
    border: `1px solid ${CHART_THEME.border}`,
    borderRadius: '8px',
    color: CHART_THEME.text,
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
    opacity: 1,
  };
}

function getTooltipLabelStyle() {
  return {
    color: CHART_THEME.text,
    fontWeight: 800,
  };
}

function getTooltipItemStyle() {
  return {
    color: CHART_THEME.text,
    fontWeight: 700,
  };
}

function getTooltipWrapperStyle() {
  return {
    outline: 'none',
    zIndex: 20,
  };
}

function getAxisTick(isCompact: boolean) {
  return {
    fontSize: isCompact ? 10 : 11,
    fill: CHART_THEME.mutedText,
  };
}

function getLegendStyle() {
  return {
    color: CHART_THEME.mutedText,
    fontSize: '11px',
    fontWeight: 700,
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
  const sourceData = useMemo(() => data || [], [data]);

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
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.border} strokeOpacity={0.5} vertical={!isCompact} />
          <XAxis
            dataKey="date"
            className="text-xs text-muted-foreground"
            tick={getAxisTick(isCompact)}
            interval={getTickInterval(formattedData.length, isCompact)}
            minTickGap={isCompact ? 12 : 20}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            tick={getAxisTick(isCompact)}
            width={isCompact ? 30 : 42}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={getTooltipStyle()}
            itemStyle={getTooltipItemStyle()}
            labelStyle={getTooltipLabelStyle()}
            wrapperStyle={getTooltipWrapperStyle()}
            formatter={(value) => [value ?? 0, 'Value']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#area-${color.replace('#', '')})`}
            dot={isCompact || dense ? false : { fill: color, strokeWidth: 2, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_THEME.background }}
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
  categoryAxisWidth?: number;
}

export function InsightBarChart({ data, dataKey, nameKey, height = 300, title, color = COLORS.primary, horizontal = false, disableHover = false, categoryAxisWidth }: BarChartProps) {
  const isCompact = useCompactChart();

  if (!data || data.length === 0) return null;

  const layout = horizontal ? 'vertical' : undefined;
  const chartHeight = isCompact ? Math.min(height, horizontal ? 260 : 220) : height;
  const resolvedCategoryAxisWidth = categoryAxisWidth ? (isCompact ? Math.min(categoryAxisWidth, 96) : categoryAxisWidth) : (isCompact ? 72 : 92);

  return (
    <div className="w-full">
      <ChartTitle title={title} detail={`${data.length} ${data.length === 1 ? 'item' : 'items'}`} />
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, left: horizontal ? 4 : -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.border} strokeOpacity={0.5} vertical={!horizontal && !isCompact} />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                className="text-xs text-muted-foreground"
                tick={getAxisTick(isCompact)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey={nameKey}
                type="category"
                className="text-xs text-muted-foreground"
                tick={getAxisTick(isCompact)}
                axisLine={false}
                tickLine={false}
                width={resolvedCategoryAxisWidth}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={nameKey}
                className="text-xs text-muted-foreground"
                tick={getAxisTick(isCompact)}
                axisLine={false}
                tickLine={false}
                interval={getTickInterval(data.length, isCompact)}
              />
              <YAxis
                className="text-xs text-muted-foreground"
                tick={getAxisTick(isCompact)}
                axisLine={false}
                tickLine={false}
                width={isCompact ? 30 : 42}
              />
            </>
          )}
          <Tooltip
            cursor={disableHover ? false : { fill: CHART_THEME.muted, opacity: 0.28 }}
            contentStyle={getTooltipStyle()}
            itemStyle={getTooltipItemStyle()}
            labelStyle={getTooltipLabelStyle()}
            wrapperStyle={getTooltipWrapperStyle()}
          />
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            isAnimationActive={false}
            {...(disableHover ? { activeShape: (props: SVGProps<SVGRectElement>) => <rect {...props} /> } : {})}
          >
            {data.map((entry, index) => (
              <Cell key={`bar-cell-${index}`} fill={typeof entry.color === 'string' ? entry.color : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface GroupedBarChartProps {
  data: Array<Record<string, string | number | boolean | null | undefined>>;
  nameKey: string;
  bars: Array<{ key: string; name: string; color: string }>;
  height?: number;
  title?: string;
  horizontal?: boolean;
  valueFormatter?: (value: number, key: string) => string;
}

export function GroupedBarChart({
  data,
  nameKey,
  bars,
  height = 320,
  title,
  horizontal = false,
  valueFormatter,
}: GroupedBarChartProps) {
  const isCompact = useCompactChart();

  if (!data || data.length === 0 || bars.length === 0) return null;

  const chartHeight = isCompact ? Math.min(height, horizontal ? 300 : 240) : height;

  return (
    <div className="w-full">
      <ChartTitle title={title} detail={`${data.length} ${data.length === 1 ? 'department' : 'departments'}`} />
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout={horizontal ? 'vertical' : undefined} margin={{ top: 8, right: 8, left: horizontal ? 4 : -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.border} strokeOpacity={0.5} vertical={!horizontal && !isCompact} horizontal={horizontal ? false : undefined} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={getAxisTick(isCompact)} axisLine={false} tickLine={false} />
              <YAxis
                dataKey={nameKey}
                type="category"
                tick={getAxisTick(isCompact)}
                axisLine={false}
                tickLine={false}
                width={isCompact ? 86 : 118}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={nameKey}
                tick={getAxisTick(isCompact)}
                axisLine={false}
                tickLine={false}
                interval={getTickInterval(data.length, isCompact)}
              />
              <YAxis tick={getAxisTick(isCompact)} axisLine={false} tickLine={false} width={isCompact ? 34 : 48} />
            </>
          )}
          <Tooltip
            cursor={{ fill: CHART_THEME.muted, opacity: 0.22 }}
            contentStyle={getTooltipStyle()}
            itemStyle={getTooltipItemStyle()}
            labelStyle={getTooltipLabelStyle()}
            wrapperStyle={getTooltipWrapperStyle()}
            formatter={(value, name, item) => {
              const numeric = Number(value || 0);
              const key = String(item.dataKey || '');
              return [valueFormatter ? valueFormatter(numeric, key) : numeric, name];
            }}
          />
          <Legend wrapperStyle={getLegendStyle()} />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} name={bar.name} fill={bar.color} radius={horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]} isAnimationActive={false} />
          ))}
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
        <div className="relative min-h-50">
          {visibleData.length === 0 ? (
            <div className="flex h-50 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/25 text-center">
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
                    itemStyle={getTooltipItemStyle()}
                    labelStyle={getTooltipLabelStyle()}
                    wrapperStyle={getTooltipWrapperStyle()}
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
  data: { section: string; courseName?: string; color?: string; completed: number; total: number }[];
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
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.border} strokeOpacity={0.5} vertical={!isCompact} />
          <XAxis
            dataKey="section"
            className="text-xs text-muted-foreground"
            tick={getAxisTick(isCompact)}
            axisLine={false}
            tickLine={false}
            interval={getTickInterval(chartData.length, isCompact)}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            tick={getAxisTick(isCompact)}
            axisLine={false}
            tickLine={false}
            width={isCompact ? 30 : 42}
          />
          <Tooltip
            cursor={{ fill: CHART_THEME.muted, opacity: 0.28 }}
            contentStyle={getTooltipStyle()}
            itemStyle={getTooltipItemStyle()}
            labelStyle={getTooltipLabelStyle()}
            wrapperStyle={getTooltipWrapperStyle()}
            formatter={(value) => [value ?? 0, 'Students']}
          />
          <Legend wrapperStyle={getLegendStyle()} />
          <Bar dataKey="completed" stackId="a" fill={COLORS.success} name="Submitted" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`completed-cell-${index}`} fill={entry.color || COLORS.success} />
            ))}
          </Bar>
          <Bar dataKey="remaining" stackId="a" fill={CHART_THEME.border} name="Pending" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Radar/Scatter-like chart for student performance
interface PerformanceChartProps {
  data: { subject: string; sectionName?: string; courseName?: string; color?: string; grade: number; attendance: number }[];
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
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.border} strokeOpacity={0.5} horizontal={false} />
          <XAxis
            type="number"
            className="text-xs text-muted-foreground"
            tick={getAxisTick(isCompact)}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
          />
          <YAxis
            dataKey="subject"
            type="category"
            className="text-xs text-muted-foreground"
            tick={getAxisTick(isCompact)}
            width={isCompact ? 74 : 104}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: CHART_THEME.muted, opacity: 0.28 }}
            contentStyle={getTooltipStyle()}
            itemStyle={getTooltipItemStyle()}
            labelStyle={getTooltipLabelStyle()}
            wrapperStyle={getTooltipWrapperStyle()}
            formatter={(value, name) => [`${value ?? 0}%`, name === 'grade' ? 'Grade' : 'Attendance']}
          />
          <Legend wrapperStyle={getLegendStyle()} />
          <Bar dataKey="grade" fill={COLORS.primary} name="Grade" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={`grade-cell-${index}`} fill={entry.color || COLORS.primary} />
            ))}
          </Bar>
          <Bar dataKey="attendance" fill={COLORS.success} name="Attendance" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={`attendance-cell-${index}`} fill={entry.color || COLORS.success} fillOpacity={0.55} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MoneyFlowChartProps {
  data: Array<{ label: string; income: number; expense: number; netFlow: number }>;
  height?: number;
  title?: string;
}

export function MoneyFlowChart({ data, height = 320, title }: MoneyFlowChartProps) {
  const isCompact = useCompactChart();

  if (!data || data.length === 0) return null;

  const chartHeight = isCompact ? Math.min(height, 260) : height;

  return (
    <div className="w-full">
      <ChartTitle title={title} detail={`${data.length} periods`} />
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={data} margin={{ top: 8, right: isCompact ? 6 : 16, left: isCompact ? -24 : -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.border} strokeOpacity={0.5} vertical={!isCompact} />
          <XAxis
            dataKey="label"
            tick={getAxisTick(isCompact)}
            interval={getTickInterval(data.length, isCompact)}
            minTickGap={isCompact ? 12 : 20}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={getAxisTick(isCompact)}
            width={isCompact ? 34 : 48}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: CHART_THEME.muted, opacity: 0.22 }}
            contentStyle={getTooltipStyle()}
            itemStyle={getTooltipItemStyle()}
            labelStyle={getTooltipLabelStyle()}
            wrapperStyle={getTooltipWrapperStyle()}
          />
          <Legend wrapperStyle={getLegendStyle()} />
          <Bar dataKey="income" fill={COLORS.success} name="Income" radius={[5, 5, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expense" fill={COLORS.danger} name="Expense" radius={[5, 5, 0, 0]} isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="netFlow"
            stroke={COLORS.primary}
            strokeWidth={2.5}
            name="Net Flow"
            dot={isCompact || data.length > 14 ? false : { r: 3, fill: COLORS.primary }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_THEME.background }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MultiLineChartProps {
  data: Array<{ label: string; [seriesName: string]: string | number }>;
  height?: number;
  title?: string;
}

export function MultiLineChart({ data, height = 300, title }: MultiLineChartProps) {
  const isCompact = useCompactChart();

  if (!data || data.length === 0) return null;

  const series = Object.keys(data[0] || {}).filter((key) => key !== 'label');
  if (series.length === 0) return null;

  const chartHeight = isCompact ? Math.min(height, 240) : height;
  const palette = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.info, COLORS.purple];

  return (
    <div className="w-full">
      <ChartTitle title={title} detail={`${series.length} sources`} />
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={data} margin={{ top: 8, right: isCompact ? 6 : 16, left: isCompact ? -24 : -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.border} strokeOpacity={0.5} vertical={!isCompact} />
          <XAxis
            dataKey="label"
            tick={getAxisTick(isCompact)}
            interval={getTickInterval(data.length, isCompact)}
            minTickGap={isCompact ? 12 : 20}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={getAxisTick(isCompact)}
            width={isCompact ? 34 : 48}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={getTooltipStyle()}
            itemStyle={getTooltipItemStyle()}
            labelStyle={getTooltipLabelStyle()}
            wrapperStyle={getTooltipWrapperStyle()}
          />
          <Legend wrapperStyle={getLegendStyle()} />
          {series.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={palette[index % palette.length]}
              strokeWidth={2}
              fill={palette[index % palette.length]}
              fillOpacity={0.08}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: CHART_THEME.background }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
