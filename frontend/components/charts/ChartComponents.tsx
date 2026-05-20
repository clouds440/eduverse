'use client';

import {
  LineChart,
  Line,
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
};

// Line Chart Component
interface LineChartProps {
  data: { date: string; value: number }[];
  height?: number;
  color?: string;
  title?: string;
}

export function InsightLineChart({ data, height = 300, color = COLORS.primary, title }: LineChartProps) {
  if (!data || data.length === 0) return null;

  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-bold text-muted-foreground mb-3">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="date"
            className="text-xs text-muted-foreground"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
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
  if (!data || data.length === 0) return null;

  const ChartComponent = horizontal ? Bar : Bar;
  const layout = horizontal ? 'vertical' : undefined;

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-bold text-muted-foreground mb-3">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey={nameKey}
            className="text-xs text-muted-foreground"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          {!disableHover && (
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
          )}
          <ChartComponent
            dataKey={dataKey}
            fill={color}
            radius={[4, 4, 0, 0]}
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
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-bold text-muted-foreground mb-3">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px' }}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
        </PieChart>
      </ResponsiveContainer>
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
  if (!data || data.length === 0) return null;

  const chartData = data.map((item) => ({
    ...item,
    percentage: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0,
    remaining: item.total - item.completed,
  }));

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-bold text-muted-foreground mb-3">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="section"
            className="text-xs text-muted-foreground"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            className="text-xs text-muted-foreground"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
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
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full">
      {title && <h4 className="text-sm font-bold text-muted-foreground mb-3">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            type="number"
            className="text-xs text-muted-foreground"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
          />
          <YAxis
            dataKey="subject"
            type="category"
            className="text-xs text-muted-foreground"
            tick={{ fontSize: 11 }}
            width={80}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value, name) => [`${value ?? 0}%`, name === 'grade' ? 'Grade' : 'Attendance']}
          />
          <Legend />
          <Bar dataKey="grade" fill={COLORS.primary} name="Grade" radius={[0, 4, 4, 0]} />
          <Bar dataKey="attendance" fill={COLORS.success} name="Attendance" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
