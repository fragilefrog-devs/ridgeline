import React from 'react';

/**
 * Skeleton placeholder for the 7-Day Completed Bookings Recharts component
 */
export const CompletedBookingsChartSkeleton: React.FC = () => {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-5 md:p-6 shadow-xs animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3.5 sm:pb-4">
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-neutral-200 shrink-0" />
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-4 w-44 sm:w-56 bg-neutral-200 rounded" />
              <div className="h-4 w-28 bg-emerald-100/70 rounded-full" />
              <div className="h-4 w-24 bg-neutral-100 rounded" />
            </div>
            <div className="h-3 w-64 sm:w-80 bg-neutral-100 rounded" />
          </div>
        </div>

        {/* Action Controls Skeleton */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 mt-1 sm:mt-0">
          <div className="h-7 w-28 bg-neutral-100 rounded-md" />
          <div className="h-7 w-20 bg-neutral-100 rounded-md" />
        </div>
      </div>

      {/* 4 Quick Stat Summary Badges Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 my-3 sm:my-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-md border border-neutral-100 bg-neutral-50/80 p-2.5 sm:p-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 rounded bg-neutral-200 shrink-0" />
              <div className="h-3 w-24 bg-neutral-200 rounded" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="h-6 sm:h-7 w-16 bg-neutral-300 rounded" />
              <div className="h-3 w-10 bg-neutral-200 rounded" />
            </div>
            <div className="h-2.5 w-28 bg-neutral-200/70 rounded mt-1.5" />
          </div>
        ))}
      </div>

      {/* Main Recharts Visualization Canvas Skeleton */}
      <div className="mt-2 sm:mt-3 pt-2">
        <div className="h-48 sm:h-56 w-full rounded-lg bg-neutral-50/70 border border-neutral-100/80 p-3 sm:p-4 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle simulated horizontal grid lines */}
          <div className="absolute inset-x-0 top-1/4 border-b border-neutral-200/40 border-dashed" />
          <div className="absolute inset-x-0 top-2/4 border-b border-neutral-200/40 border-dashed" />
          <div className="absolute inset-x-0 top-3/4 border-b border-neutral-200/40 border-dashed" />

          {/* SVG Wave Skeleton representing Recharts Area/Bar curve */}
          <div className="w-full h-full flex items-end justify-between gap-2 pt-6 pb-4 px-2 z-10">
            <svg className="w-full h-28 text-emerald-200/50" fill="none" viewBox="0 0 500 100" preserveAspectRatio="none">
              <path
                d="M 0 80 Q 80 20 160 60 T 320 30 T 420 50 T 500 15 L 500 100 L 0 100 Z"
                fill="currentColor"
                opacity="0.3"
              />
              <path
                d="M 0 80 Q 80 20 160 60 T 320 30 T 420 50 T 500 15"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeDasharray="4 2"
                opacity="0.4"
              />
            </svg>
          </div>

          {/* Bottom Day Ticks */}
          <div className="flex justify-between items-center pt-2 border-t border-neutral-100 px-2 text-[10px] text-neutral-400">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'].map((d, i) => (
              <div key={i} className="h-2.5 w-6 bg-neutral-200 rounded" />
            ))}
          </div>
        </div>

        {/* 7-Day Micro Pill Navigation Bar Skeleton */}
        <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5 border-t border-neutral-100 pt-3">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <div
              key={d}
              className="flex flex-col items-center justify-center rounded-md p-1 sm:p-1.5 bg-neutral-50/70 border border-neutral-100 text-center gap-1"
            >
              <div className="h-2.5 w-5 bg-neutral-200 rounded" />
              <div className="h-2 w-4 bg-neutral-100 rounded" />
              <div className="h-3 w-6 bg-neutral-200 rounded mt-0.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton placeholder for the 4 Metric Cards with Recharts mini-charts
 */
export const MetricCardsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-4 md:p-5 shadow-xs"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-28 bg-neutral-200 rounded" />
              <div className="h-7 w-7 rounded-md bg-neutral-100 shrink-0" />
            </div>

            <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
              <div className="h-7 w-24 bg-neutral-300 rounded" />
              <div className="h-4 w-12 bg-neutral-100 rounded" />
            </div>

            <div className="h-3 w-36 bg-neutral-100 rounded mt-2" />
          </div>

          {/* Mini Recharts Sparkline Canvas Skeleton */}
          <div className="mt-3 pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-1.5">
              <div className="h-2.5 w-20 bg-neutral-200 rounded" />
              <div className="h-2.5 w-16 bg-neutral-100 rounded" />
            </div>

            <div className="h-12 sm:h-14 w-full bg-neutral-50/80 rounded border border-neutral-100 flex items-end justify-between px-2 pb-1 gap-1">
              {[40, 65, 30, 80, 55, 90, 70].map((h, idx) => (
                <div
                  key={idx}
                  className="w-full bg-neutral-200/70 rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>

            <div className="flex justify-between px-0.5 text-[9px] text-neutral-300 font-mono mt-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                <span key={idx}>{day}</span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Generic Recharts Chart Card Skeleton for other tabs (Dispatch, Missed Calls, Customers)
 */
export interface TabChartSkeletonProps {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  heightClass?: string;
  accentColor?: string;
  type?: 'area' | 'bar';
  legendLabels?: string[];
}

export const TabChartSkeleton: React.FC<TabChartSkeletonProps> = ({
  title = 'Analytics Overview',
  subtitle,
  badgeText,
  heightClass = 'h-48 sm:h-52',
  accentColor = 'bg-neutral-200',
  type = 'bar',
  legendLabels,
}) => {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs animate-pulse">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className={`h-4 w-4 rounded shrink-0 ${accentColor}`} />
            <span className="text-sm font-bold text-neutral-900 font-head tracking-tight">
              {title}
            </span>
            {badgeText ? (
              <span className="text-[10px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full border border-neutral-200/60">
                {badgeText}
              </span>
            ) : (
              <div className="h-4 w-16 bg-neutral-100 rounded-full" />
            )}
          </div>
          {subtitle ? (
            <p className="text-xs text-neutral-400 line-clamp-1">{subtitle}</p>
          ) : (
            <div className="h-3 w-56 sm:w-80 bg-neutral-100 rounded" />
          )}
        </div>

        {/* Legend Skeletons */}
        {legendLabels && legendLabels.length > 0 ? (
          <div className="flex items-center gap-3 text-xs shrink-0 mt-1 sm:mt-0">
            {legendLabels.map((lbl, idx) => (
              <span key={idx} className="flex items-center gap-1.5 text-neutral-400">
                <span className={`h-2.5 w-2.5 rounded ${idx === 0 ? 'bg-neutral-300' : 'bg-neutral-400'} inline-block`} />
                <span className="text-[11px]">{lbl}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="h-7 w-28 bg-neutral-100 rounded-md shrink-0" />
        )}
      </div>

      {/* Chart Canvas */}
      <div className={`mt-4 ${heightClass} w-full rounded-md bg-neutral-50/70 border border-neutral-100 p-3 flex flex-col justify-between relative overflow-hidden`}>
        {/* Horizontal grid guide lines */}
        <div className="absolute inset-x-0 top-1/4 border-b border-neutral-200/40 border-dashed" />
        <div className="absolute inset-x-0 top-2/4 border-b border-neutral-200/40 border-dashed" />
        <div className="absolute inset-x-0 top-3/4 border-b border-neutral-200/40 border-dashed" />

        {type === 'area' ? (
          // Recharts AreaChart Wave Silhouette
          <div className="w-full h-full flex flex-col justify-between z-10">
            <div className="w-full flex-1 flex items-end px-2 pt-4">
              <svg className="w-full h-28 text-neutral-300/40" fill="none" viewBox="0 0 500 100" preserveAspectRatio="none">
                <path
                  d="M 0 75 Q 80 25 160 55 T 320 35 T 420 60 T 500 20 L 500 100 L 0 100 Z"
                  fill="currentColor"
                  opacity="0.35"
                />
                <path
                  d="M 0 75 Q 80 25 160 55 T 320 35 T 420 60 T 500 20"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  opacity="0.5"
                />
              </svg>
            </div>
            {/* Day Ticks */}
            <div className="flex justify-between items-center pt-2 border-t border-neutral-100 px-2 text-[10px] text-neutral-400">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'].map((d, i) => (
                <div key={i} className="h-2.5 w-6 bg-neutral-200 rounded" />
              ))}
            </div>
          </div>
        ) : (
          // Recharts BarChart Dual/Single Columns
          <div className="w-full h-full flex flex-col justify-between z-10">
            <div className="w-full flex-1 flex items-end justify-between gap-2 sm:gap-4 px-2 sm:px-4 pb-2">
              {[
                { h1: 35, h2: 25 },
                { h1: 65, h2: 45 },
                { h1: 45, h2: 30 },
                { h1: 85, h2: 70 },
                { h1: 50, h2: 40 },
                { h1: 95, h2: 80 },
                { h1: 70, h2: 55 },
              ].map((bar, i) => (
                <div key={i} className="flex-1 flex items-end justify-center gap-1 sm:gap-1.5 h-full">
                  <div
                    className="w-full max-w-[14px] sm:max-w-[18px] bg-neutral-200 rounded-t"
                    style={{ height: `${bar.h1}%` }}
                  />
                  <div
                    className="w-full max-w-[14px] sm:max-w-[18px] bg-neutral-300 rounded-t"
                    style={{ height: `${bar.h2}%` }}
                  />
                </div>
              ))}
            </div>
            {/* Day Ticks */}
            <div className="flex justify-between items-center pt-2 border-t border-neutral-100 px-2 text-[10px] text-neutral-400">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'].map((d, i) => (
                <div key={i} className="h-2.5 w-6 bg-neutral-200 rounded" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
