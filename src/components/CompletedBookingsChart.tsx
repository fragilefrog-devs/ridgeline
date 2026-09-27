import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Bar,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { 
  CheckCircle2, 
  TrendingUp, 
  Calendar, 
  CheckCheck, 
  Clock, 
  Zap, 
  Sparkles,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { JobBooking, AssistantSettings } from '../types';
import { calculateSevenDaysMetrics } from '../lib/chartUtils';
import { formatCurrency } from '../lib/utils';
import { AIIcon } from './AIIcon';
import { CompletedBookingsChartSkeleton } from './ChartSkeleton';

interface CompletedBookingsChartProps {
  bookings: JobBooking[];
  settings?: AssistantSettings;
  onSelectBookingDay?: (dateStr: string) => void;
  isLoading?: boolean;
}

export const CompletedBookingsChart: React.FC<CompletedBookingsChartProps> = ({
  bookings,
  settings,
  onSelectBookingDay,
  isLoading = false,
}) => {
  const [chartMode, setChartMode] = useState<'area' | 'bar'>('area');
  const [showScheduledComparison, setShowScheduledComparison] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  // Compute 7-day metrics dynamically
  const metrics = useMemo(() => {
    return calculateSevenDaysMetrics(bookings, [], []);
  }, [bookings]);

  if (isLoading) {
    return <CompletedBookingsChartSkeleton />;
  }

  const {
    days,
    totalCompletedBookings,
    totalBookings,
    overallCompletionRate,
    avgCompletedPerDay,
    peakCompletedDay,
    sevenDayBookedVolume,
  } = metrics;

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-xs text-xs min-w-[180px]">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2 mb-2">
            <span className="font-semibold text-neutral-900 font-head flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-neutral-500" />
              {data.dayName}, {data.shortDate}
            </span>
            {data.isToday && (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                Today
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-neutral-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Completed Jobs:
              </span>
              <span className="font-bold text-neutral-900 font-mono text-sm">
                {data.completedBookings}
              </span>
            </div>

            {showScheduledComparison && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral-500 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
                  Total Dispatched:
                </span>
                <span className="font-semibold text-neutral-700 font-mono">
                  {data.totalBookings}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-1 border-t border-neutral-100">
              <span className="text-neutral-500 flex items-center gap-1.5">
                <DollarSign className="h-3 w-3 text-neutral-400" />
                Completed Revenue:
              </span>
              <span className="font-semibold text-emerald-700 font-mono">
                {formatCurrency(data.completedVolume)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-5 md:p-6 shadow-xs transition-all">
      {/* Top Banner: Dispatcher Status + Key Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3.5 sm:pb-4">
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-xs">
            <AIIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-neutral-900 font-head tracking-tight">
                Bookings Completed (Last 7 Days)
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                RidgeLine AI Active
              </span>
              {settings?.twilioPhoneNumber && (
                <span className="text-[10px] sm:text-[11px] text-neutral-500 font-mono bg-neutral-100 px-1.5 sm:px-2 py-0.5 rounded">
                  {settings.twilioPhoneNumber}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
              Autonomous schedule execution, automated appointment confirmations &amp; completed work orders over the rolling week.
            </p>
          </div>
        </div>

        {/* Chart View Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0 mt-1 sm:mt-0">
          <button
            type="button"
            onClick={() => setShowScheduledComparison(!showScheduledComparison)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              showScheduledComparison 
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
            }`}
            title="Toggle completed vs total dispatched bookings"
          >
            <Sparkles className="h-3 w-3" />
            <span>Compare Total</span>
          </button>

          <div className="flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setChartMode('area')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                chartMode === 'area'
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Curve
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                chartMode === 'bar'
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Bars
            </button>
          </div>
        </div>
      </div>

      {/* 4 Quick Stat Summary Badges - Stack on mobile, 2 cols on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 my-3 sm:my-4">
        <div className="rounded-md border border-neutral-100 bg-neutral-50/60 p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>7-Day Completed</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-neutral-900">
              {totalCompletedBookings}
            </span>
            <span className="text-xs text-neutral-500">jobs</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">
            100% verified complete
          </span>
        </div>

        <div className="rounded-md border border-neutral-100 bg-neutral-50/60 p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <span>Completion Rate</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-neutral-900">
              {overallCompletionRate}%
            </span>
          </div>
          <span className="text-[11px] text-neutral-500">
            of total jobs dispatched
          </span>
        </div>

        <div className="rounded-md border border-neutral-100 bg-neutral-50/60 p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Zap className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Peak Completion Day</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-neutral-900">
              {peakCompletedDay.dayName}
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              ({peakCompletedDay.count} jobs)
            </span>
          </div>
          <span className="text-[11px] text-neutral-500">
            Highest daily throughput
          </span>
        </div>

        <div className="rounded-md border border-neutral-100 bg-neutral-50/60 p-2.5 sm:p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>Daily Velocity</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-neutral-900">
              {avgCompletedPerDay}
            </span>
            <span className="text-xs text-neutral-500">jobs / day</span>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">
            {formatCurrency(sevenDayBookedVolume)} 7d vol
          </span>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="mt-2 sm:mt-3 pt-2">
        <div className="h-48 sm:h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'area' ? (
              <AreaChart
                data={days}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                onMouseMove={(state: any) => {
                  if (state && state.activePayload) {
                    setHoveredDay(state.activePayload[0].payload.dateStr);
                  }
                }}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <defs>
                  <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                
                <XAxis 
                  dataKey="dayName" 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  dy={6}
                />
                
                <YAxis 
                  allowDecimals={false} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  domain={[0, (dataMax: number) => Math.max(dataMax + 1, 4)]}
                />
                
                <Tooltip content={<CustomTooltip />} />

                {avgCompletedPerDay > 0 && (
                  <ReferenceLine 
                    y={avgCompletedPerDay} 
                    stroke="#94a3b8" 
                    strokeDasharray="4 4" 
                    label={{ 
                      value: `Avg: ${avgCompletedPerDay}`, 
                      fill: '#94a3b8', 
                      fontSize: 10, 
                      position: 'insideTopRight' 
                    }} 
                  />
                )}

                {showScheduledComparison && (
                  <Area
                    type="monotone"
                    dataKey="totalBookings"
                    name="Total Dispatched"
                    stroke="#818cf8"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    fillOpacity={1}
                    fill="url(#totalGradient)"
                  />
                )}

                <Area
                  type="monotone"
                  dataKey="completedBookings"
                  name="Completed Bookings"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#completedGradient)"
                  dot={{ r: 3.5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 5.5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <ComposedChart
                data={days}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                onMouseMove={(state: any) => {
                  if (state && state.activePayload) {
                    setHoveredDay(state.activePayload[0].payload.dateStr);
                  }
                }}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                
                <XAxis 
                  dataKey="dayName" 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  dy={6}
                />
                
                <YAxis 
                  allowDecimals={false} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  domain={[0, (dataMax: number) => Math.max(dataMax + 1, 4)]}
                />
                
                <Tooltip content={<CustomTooltip />} />

                {showScheduledComparison && (
                  <Bar
                    dataKey="totalBookings"
                    name="Total Dispatched"
                    fill="#c7d2fe"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                )}

                <Bar
                  dataKey="completedBookings"
                  name="Completed Bookings"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* 7-Day Micro Pill Navigation Bar */}
        <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5 border-t border-neutral-100 pt-3">
          {days.map((day) => {
            const isHovered = hoveredDay === day.dateStr;
            return (
              <div
                key={day.dateStr}
                onClick={() => onSelectBookingDay && onSelectBookingDay(day.dateStr)}
                className={`flex flex-col items-center justify-center rounded-md p-1 sm:p-1.5 transition-all text-center cursor-default ${
                  day.isToday 
                    ? 'bg-emerald-50/80 border border-emerald-200/80 shadow-2xs' 
                    : isHovered 
                    ? 'bg-neutral-100 border border-neutral-300' 
                    : 'bg-neutral-50/50 hover:bg-neutral-100/70 border border-transparent'
                }`}
              >
                <span className={`text-[9px] sm:text-[10px] font-medium ${day.isToday ? 'text-emerald-700 font-semibold' : 'text-neutral-500'}`}>
                  {day.dayName}
                </span>
                <span className="text-[9px] sm:text-[10px] text-neutral-400 font-mono">
                  {day.shortDate.split(' ')[1]}
                </span>
                <div className="mt-0.5 sm:mt-1 flex items-center gap-0.5 sm:gap-1">
                  <span className={`font-mono text-[11px] sm:text-xs font-bold ${
                    day.completedBookings > 0 
                      ? day.isToday ? 'text-emerald-700' : 'text-neutral-900' 
                      : 'text-neutral-400'
                  }`}>
                    {day.completedBookings}
                  </span>
                  {day.completedBookings > 0 && (
                    <CheckCheck className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${day.isToday ? 'text-emerald-600' : 'text-emerald-500'}`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
