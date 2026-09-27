import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Phone, 
  Clock, 
  Truck, 
  CheckCircle, 
  MessageSquare, 
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Zap
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { JobBooking, BookingStatus } from '../types';
import { calculateSevenDaysMetrics } from '../lib/chartUtils';
import { formatCurrency } from '../lib/utils';
import { EmptyState } from './EmptyState';
import { AIIcon } from './AIIcon';
import { TabChartSkeleton } from './ChartSkeleton';

interface DispatchBoardProps {
  bookings: JobBooking[];
  onUpdateStatus: (id: string, newStatus: BookingStatus) => void;
  onSendEtaSms: (booking: JobBooking) => void;
  onOpenThread: (threadId?: string) => void;
  onOpenNewBooking: () => void;
  onOpenSimulateSms?: () => void;
  isLoading?: boolean;
  isChartLoading?: boolean;
}

export const DispatchBoard: React.FC<DispatchBoardProps> = ({
  bookings,
  onUpdateStatus,
  onSendEtaSms,
  onOpenThread,
  onOpenNewBooking,
  onOpenSimulateSms,
  isLoading = false,
  isChartLoading = false,
}) => {
  const [selectedDay, setSelectedDay] = useState<'all' | 'today' | 'tomorrow'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = useMemo(() => {
    return calculateSevenDaysMetrics(bookings, [], []);
  }, [bookings]);

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const filteredBookings = bookings.filter((job) => {
    // Day filter
    if (selectedDay === 'today' && job.date !== todayStr) return false;
    if (selectedDay === 'tomorrow' && job.date !== tomorrowStr) return false;

    // Status filter
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = job.customerName.toLowerCase().includes(q);
      const matchAddress = job.address.toLowerCase().includes(q);
      const matchService = job.serviceTitle.toLowerCase().includes(q);
      const matchPhone = job.customerPhone.includes(q);
      if (!matchName && !matchAddress && !matchService && !matchPhone) return false;
    }

    return true;
  });

  if (isLoading && bookings.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-neutral-200 animate-pulse">
          <div className="h-8 w-64 bg-neutral-100 rounded" />
          <div className="h-8 w-48 bg-neutral-100 rounded" />
        </div>

        {/* Skeleton for Recharts Component on Dispatch Tab */}
        <TabChartSkeleton
          title="7-Day Dispatch Workload & Execution"
          subtitle="Work order completion throughput and dispatch capacity distribution across the rolling week."
          accentColor="bg-blue-600"
          type="area"
          legendLabels={['Total Dispatched', 'Completed']}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-44 rounded-lg border border-neutral-200 bg-white p-4 shadow-xs animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-28 bg-neutral-200 rounded" />
                <div className="h-4 w-16 bg-neutral-100 rounded" />
              </div>
              <div className="h-4 w-40 bg-neutral-300 rounded" />
              <div className="h-3 w-32 bg-neutral-100 rounded" />
              <div className="h-8 w-full bg-neutral-50 rounded mt-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Controls: Filter tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-neutral-200">
        
        {/* Day segmented tabs */}
        <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-md">
          <button
            onClick={() => setSelectedDay('all')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              selectedDay === 'all'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            All Scheduled ({bookings.length})
          </button>
          <button
            onClick={() => setSelectedDay('today')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              selectedDay === 'today'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Today ({bookings.filter(b => b.date === todayStr).length})
          </button>
          <button
            onClick={() => setSelectedDay('tomorrow')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              selectedDay === 'tomorrow'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Tomorrow ({bookings.filter(b => b.date === tomorrowStr).length})
          </button>
        </div>

        {/* Status Filter buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search customer, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1.5 text-neutral-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="en_route">En Route</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* 7-Day Recharts Dispatch Velocity & Capacity Visualization */}
      {isLoading || isChartLoading ? (
        <TabChartSkeleton
          title="7-Day Dispatch Workload & Execution"
          badgeText="Updating dispatch velocity..."
          subtitle="Work order completion throughput and dispatch capacity distribution across the rolling week."
          accentColor="bg-blue-600"
          type="area"
          legendLabels={['Total Dispatched', 'Completed']}
        />
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-neutral-900 font-head">
                  7-Day Dispatch Workload & Execution
                </h4>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                  {metrics.totalCompletedBookings} Completed of {metrics.totalBookings} Dispatched
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Work order completion throughput and dispatch capacity distribution across the rolling week.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <span className="h-2.5 w-2.5 rounded bg-indigo-200 inline-block" />
                Total Dispatched
              </span>
              <span className="flex items-center gap-1.5 text-neutral-900 font-medium">
                <span className="h-2.5 w-2.5 rounded bg-blue-600 inline-block" />
                Completed
              </span>
            </div>
          </div>

          <div className="mt-3 h-48 sm:h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.days} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="dispatchCompletedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="dispatchTotalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dayName" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-neutral-200 bg-white/95 p-2.5 shadow-md text-xs">
                          <div className="font-semibold text-neutral-900 font-head">{d.dayName}, {d.shortDate}</div>
                          <div className="text-blue-700 font-bold font-mono mt-1">
                            {d.completedBookings} jobs completed
                          </div>
                          <div className="text-neutral-500 text-[11px] font-mono">
                            {d.totalBookings} total appointments scheduled
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="totalBookings" stroke="#818cf8" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#dispatchTotalGrad)" />
                <Area type="monotone" dataKey="completedBookings" stroke="#2563eb" strokeWidth={2.5} fill="url(#dispatchCompletedGrad)" dot={{ r: 3.5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Dispatch Cards Grid */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="No Scheduled Dispatch Jobs"
          description={
            searchQuery || statusFilter !== 'all' || selectedDay !== 'all'
              ? 'No appointments matched your current search filters or date range. Reset filters to view all jobs.'
              : 'Your dispatch schedule is wide open. RidgeLine autonomously converts incoming homeowner SMS texts into scheduled appointments.'
          }
          primaryAction={{
            label: '+ Book Manual Job',
            onClick: onOpenNewBooking,
          }}
          secondaryAction={
            searchQuery || statusFilter !== 'all' || selectedDay !== 'all'
              ? {
                  label: 'Clear Filters',
                  onClick: () => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setSelectedDay('all');
                  },
                }
              : undefined
          }
          tip="When a client texts 'can you come tomorrow morning?', RidgeLine cross-references your price book, proposes an open window, and auto-adds it right here."
          badge="Dispatch Calendar Ready"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookings.map((job) => {
            const isToday = job.date === todayStr;
            const isTomorrow = job.date === tomorrowStr;

            return (
              <div 
                key={job.id} 
                className="flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-4 shadow-xs hover:border-neutral-300 transition-colors"
              >
                <div>
                  {/* Header: Date/Time + Urgency & Status */}
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                        <Clock className="h-3.5 w-3.5 text-neutral-500" />
                        <span className="font-mono">{job.timeSlot}</span>
                      </div>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : job.date}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {/* Status indicator */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        job.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : job.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : job.status === 'en_route'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-neutral-100 text-neutral-800'
                      }`}>
                        {job.status === 'in_progress' ? 'On Site' : job.status.replace('_', ' ').toUpperCase()}
                      </span>

                      {job.urgency === 'emergency' && (
                        <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Emergency
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer & Service Info */}
                  <div className="mt-3 space-y-1.5">
                    <h4 className="text-sm font-semibold text-neutral-900 leading-snug font-head">
                      {job.serviceTitle}
                    </h4>

                    <div className="text-xs text-neutral-600 flex items-center gap-2">
                      <span className="font-medium text-neutral-900">{job.customerName}</span>
                      <span>·</span>
                      <a 
                        href={`tel:${job.customerPhone}`} 
                        className="hover:underline text-neutral-600 font-mono"
                      >
                        {job.customerPhone}
                      </a>
                    </div>

                    <div className="flex items-start gap-1.5 text-xs text-neutral-500 pt-1">
                      <MapPin className="h-3.5 w-3.5 text-neutral-400 shrink-0 mt-0.5" />
                      <span className="truncate">{job.address}</span>
                    </div>

                    {job.notes && (
                      <p className="mt-2 text-xs text-neutral-600 bg-neutral-50 p-2 rounded border border-neutral-100 italic">
                        "{job.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-xs font-bold text-neutral-900 font-mono count-up tabular-nums">
                      {formatCurrency(job.estimateAmount)}
                    </span>
                    <span className="block text-[10px] text-neutral-500">
                      {job.createdFrom === 'sms' ? 'Booked via AI SMS' : job.createdFrom === 'missed_call' ? 'Missed Call converted' : 'Manual entry'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Send ETA SMS button */}
                    {job.status === 'scheduled' && (
                      <button
                        onClick={() => onSendEtaSms(job)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 transition-colors"
                        title="Send 15-minute arrival SMS to customer"
                      >
                        <Truck className="h-3 w-3 text-amber-600" />
                        <span>En Route</span>
                      </button>
                    )}

                    {job.status === 'en_route' && (
                      <button
                        onClick={() => onUpdateStatus(job.id, 'in_progress')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-neutral-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <span>Arrived</span>
                      </button>
                    )}

                    {job.status === 'in_progress' && (
                      <button
                        onClick={() => onUpdateStatus(job.id, 'completed')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle className="h-3 w-3" />
                        <span>Complete</span>
                      </button>
                    )}

                    {/* Open SMS Thread */}
                    {job.smsThreadId && (
                      <button
                        onClick={() => onOpenThread(job.smsThreadId)}
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded"
                        title="Open SMS Thread"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
