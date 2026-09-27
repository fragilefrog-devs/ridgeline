import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  Tooltip, 
  XAxis 
} from 'recharts';
import { 
  DollarSign, 
  PhoneForwarded, 
  MessageSquareCode, 
  Clock, 
  TrendingUp, 
  ArrowUpRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { JobBooking, MissedCall, SmsThread } from '../types';
import { calculateSevenDaysMetrics } from '../lib/chartUtils';
import { MetricCardsSkeleton } from './ChartSkeleton';

interface MetricCardsProps {
  bookings: JobBooking[];
  missedCalls: MissedCall[];
  threads: SmsThread[];
  isLoading?: boolean;
}

// Compact sparkline custom tooltip
const SparklineTooltip = ({ active, payload, prefix = '', suffix = '', labelFormatter }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = payload[0].value;
    const label = labelFormatter ? labelFormatter(data) : data.dayName;
    return (
      <div className="rounded-md border border-neutral-200 bg-white/95 px-2.5 py-1.5 shadow-md text-xs backdrop-blur-xs z-50">
        <div className="font-semibold text-neutral-800 text-[11px] font-head">{label}</div>
        <div className="text-neutral-600 font-mono font-bold text-xs mt-0.5">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </div>
      </div>
    );
  }
  return null;
};

export const MetricCards: React.FC<MetricCardsProps> = ({
  bookings,
  missedCalls,
  threads,
  isLoading = false,
}) => {
  // Compute 7-day rolling metrics and all-time stats
  const metrics = useMemo(() => {
    return calculateSevenDaysMetrics(bookings, missedCalls, threads);
  }, [bookings, missedCalls, threads]);

  if (isLoading) {
    return <MetricCardsSkeleton />;
  }

  const {
    days,
    sevenDayBookedVolume,
    avgDailyVolume,
    sevenDayMissedCalls,
    sevenDayRecoveredCalls,
    sevenDayRecoveryRate,
    sevenDayTimeSavedHours,
    avgDailyTimeSavedHours,
    sevenDaySmsThreads,
  } = metrics;

  // Monthly / All-time baseline totals for high-level context
  const totalRevenue = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.estimateAmount || 0), 0);

  const convertedCalls = missedCalls.filter(m => m.convertedToBooking).length;
  const totalCalls = missedCalls.length || 1;
  const conversionRate = Math.round((convertedCalls / totalCalls) * 100);

  const aiHandledThreads = threads.length;

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* ========================================================================= */}
      {/* Metric 1: Total Booked Volume (with 7-Day Recharts Sparkline) */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-4 md:p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 font-head tracking-tight">
              Total Booked Volume
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 shrink-0">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
              {formatCurrency(sevenDayBookedVolume > 0 ? sevenDayBookedVolume : totalRevenue)}
            </span>
            <span className="text-xs font-medium text-emerald-600 flex items-center font-mono">
              <TrendingUp className="h-3 w-3 mr-0.5 inline shrink-0" />
              +24.5%
            </span>
          </div>

          <p className="mt-0.5 text-[11px] text-neutral-500">
            Last 7 days • <span className="font-mono text-neutral-700 font-medium">{formatCurrency(totalRevenue)}</span> monthly
          </p>
        </div>

        {/* 7-Day Recharts Area Visualization */}
        <div className="mt-3 pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
            <span className="font-medium text-neutral-600">7-Day Daily Trend</span>
            <span className="font-mono text-[10px] text-emerald-700 font-medium">Avg {formatCurrency(avgDailyVolume)}/d</span>
          </div>
          <div className="h-12 sm:h-14 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricVolGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Tooltip 
                  content={
                    <SparklineTooltip 
                      prefix="$" 
                      labelFormatter={(d: any) => `${d.dayName} (${d.shortDate})`} 
                    />
                  } 
                />
                <Area 
                  type="monotone" 
                  dataKey="bookedVolume" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#metricVolGrad)" 
                  dot={false}
                  activeDot={{ r: 4, fill: '#059669', stroke: '#fff', strokeWidth: 1.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Day markers */}
          <div className="flex justify-between px-0.5 text-[9px] text-neutral-400 font-mono mt-0.5">
            {days.map(d => (
              <span key={d.dateStr} className={d.isToday ? 'text-emerald-700 font-bold' : ''}>
                {d.dayName[0]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Metric 2: Missed Call Recovery (with 7-Day Recharts Bar Visualization) */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-4 md:p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 font-head tracking-tight">
              Missed Call Recovery
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700 shrink-0">
              <PhoneForwarded className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
              {sevenDayRecoveryRate}%
            </span>
            <span className="text-xs text-neutral-500 font-medium">
              (<span className="font-mono text-neutral-900 font-bold">{sevenDayRecoveredCalls}</span> of <span className="font-mono">{sevenDayMissedCalls || 1}</span> saved)
            </span>
          </div>

          <p className="mt-0.5 text-[11px] text-neutral-500">
            Instant SMS textback sent $\le$ 12s of hangup
          </p>
        </div>

        {/* 7-Day Recharts Bar Visualization */}
        <div className="mt-3 pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
            <span className="font-medium text-neutral-600">7-Day Calls Recovered</span>
            <span className="font-mono text-[10px] text-amber-700 font-medium">{sevenDayRecoveredCalls} bookings won</span>
          </div>
          <div className="h-12 sm:h-14 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                <Tooltip 
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-md border border-neutral-200 bg-white/95 px-2.5 py-1.5 shadow-md text-xs backdrop-blur-xs z-50">
                          <div className="font-semibold text-neutral-800 text-[11px] font-head">
                            {data.dayName} ({data.shortDate})
                          </div>
                          <div className="text-emerald-700 font-mono font-bold text-xs mt-0.5">
                            {data.recoveredCalls} of {data.missedCalls} recovered
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="recoveredCalls" 
                  name="Recovered Calls" 
                  fill="#f59e0b" 
                  radius={[3, 3, 0, 0]} 
                  maxBarSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Day markers */}
          <div className="flex justify-between px-0.5 text-[9px] text-neutral-400 font-mono mt-0.5">
            {days.map(d => (
              <span key={d.dateStr} className={d.isToday ? 'text-amber-700 font-bold' : ''}>
                {d.dayName[0]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Metric 3: AI SMS Dispatch Conversations (with 7-Day Recharts Bar Chart) */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-4 md:p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 font-head tracking-tight">
              AI SMS Conversations
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 shrink-0">
              <MessageSquareCode className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
              {aiHandledThreads} Threads
            </span>
            <span className="text-xs font-medium text-emerald-600 font-mono">
              94% resolved
            </span>
          </div>

          <p className="mt-0.5 text-[11px] text-neutral-500">
            Autonomous multi-turn calendar coordination
          </p>
        </div>

        {/* 7-Day Recharts Visualization */}
        <div className="mt-3 pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
            <span className="font-medium text-neutral-600">7-Day Chat Volume</span>
            <span className="font-mono text-[10px] text-indigo-700 font-medium">Zero phone tag</span>
          </div>
          <div className="h-12 sm:h-14 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricThreadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Tooltip 
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-md border border-neutral-200 bg-white/95 px-2.5 py-1.5 shadow-md text-xs backdrop-blur-xs z-50">
                          <div className="font-semibold text-neutral-800 text-[11px] font-head">
                            {data.dayName} ({data.shortDate})
                          </div>
                          <div className="text-indigo-700 font-mono font-bold text-xs mt-0.5">
                            {data.totalBookings + data.recoveredCalls} customer inquiries
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="totalBookings" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#metricThreadGrad)" 
                  dot={false}
                  activeDot={{ r: 4, fill: '#4f46e5', stroke: '#fff', strokeWidth: 1.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Day markers */}
          <div className="flex justify-between px-0.5 text-[9px] text-neutral-400 font-mono mt-0.5">
            {days.map(d => (
              <span key={d.dateStr} className={d.isToday ? 'text-indigo-700 font-bold' : ''}>
                {d.dayName[0]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Metric 4: Total Time Saved (with 7-Day Recharts Area Visualization) */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-4 md:p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 font-head tracking-tight">
              Total Time Saved
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700 shrink-0">
              <Clock className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
              {sevenDayTimeSavedHours} hrs
            </span>
            <span className="text-xs text-neutral-500 font-medium">
              last 7 days
            </span>
          </div>

          <p className="mt-0.5 text-[11px] text-neutral-500">
            ~<span className="font-mono text-neutral-800 font-semibold">{avgDailyTimeSavedHours} hrs/day</span> saved on phone tag &amp; triage
          </p>
        </div>

        {/* 7-Day Recharts Area Visualization */}
        <div className="mt-3 pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
            <span className="font-medium text-neutral-600">7-Day Hours Saved</span>
            <span className="font-mono text-[10px] text-blue-700 font-medium">{(sevenDayTimeSavedHours * 1.5).toFixed(0)} calls deflected</span>
          </div>
          <div className="h-12 sm:h-14 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricTimeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Tooltip 
                  content={
                    <SparklineTooltip 
                      suffix=" hrs saved" 
                      labelFormatter={(d: any) => `${d.dayName} (${d.shortDate})`} 
                    />
                  } 
                />
                <Area 
                  type="monotone" 
                  dataKey="timeSavedHours" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#metricTimeGrad)" 
                  dot={false}
                  activeDot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 1.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Day markers */}
          <div className="flex justify-between px-0.5 text-[9px] text-neutral-400 font-mono mt-0.5">
            {days.map(d => (
              <span key={d.dateStr} className={d.isToday ? 'text-blue-700 font-bold' : ''}>
                {d.dayName[0]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
