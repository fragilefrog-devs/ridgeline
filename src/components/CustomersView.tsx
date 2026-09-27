import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Calendar,
  ChevronRight,
  MoreVertical,
  History,
  Plus,
  TrendingUp,
  DollarSign
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
import { Customer, JobBooking } from '../types';
import { formatCurrency } from '../lib/utils';
import { calculateSevenDaysMetrics } from '../lib/chartUtils';
import { TabChartSkeleton } from './ChartSkeleton';

interface CustomersViewProps {
  customers: Customer[];
  bookings: JobBooking[];
  onSelectCustomer?: (customer: Customer) => void;
  isLoading?: boolean;
  isChartLoading?: boolean;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  bookings,
  isLoading = false,
  isChartLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    return calculateSevenDaysMetrics(bookings, [], []);
  }, [bookings]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerHistory = selectedCustomer 
    ? bookings.filter(b => b.customerPhone === selectedCustomer.phone)
    : [];

  if (isLoading && customers.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div>
            <div className="h-6 w-48 bg-neutral-200 rounded" />
            <div className="h-4 w-72 bg-neutral-100 rounded mt-1.5" />
          </div>
          <div className="h-9 w-36 bg-neutral-200 rounded-lg" />
        </div>

        {/* Skeleton for Recharts Component on Customers Tab */}
        <TabChartSkeleton
          title="7-Day Customer Revenue & Repeat Booking Velocity"
          subtitle="Cumulative revenue booked and completed work orders by client accounts over the rolling week."
          accentColor="bg-emerald-600"
          type="area"
          legendLabels={['Completed Revenue']}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
          <div className="lg:col-span-5 h-[400px] bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
            <div className="h-9 bg-neutral-100 rounded-lg" />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-neutral-50 rounded-lg border border-neutral-100" />
            ))}
          </div>
          <div className="lg:col-span-7 h-[400px] bg-white border border-neutral-200 rounded-xl p-6 flex items-center justify-center">
            <div className="h-8 w-48 bg-neutral-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2 font-head">
            <Users className="h-5 w-5 text-neutral-700" />
            Customer Profiles
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Manage your client base and view their service history.
          </p>
        </div>
        
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer">
          <Plus className="h-4 w-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* 7-Day Recharts Customer Volume & Revenue Velocity */}
      {isLoading || isChartLoading ? (
        <TabChartSkeleton
          title="7-Day Customer Revenue & Repeat Booking Velocity"
          badgeText="Updating revenue velocity..."
          subtitle="Cumulative revenue booked and completed work orders by client accounts over the rolling week."
          accentColor="bg-emerald-600"
          type="area"
          legendLabels={['Completed Revenue']}
        />
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-neutral-900 font-head">
                  7-Day Customer Revenue & Repeat Booking Velocity
                </h4>
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {formatCurrency(metrics.sevenDayBookedVolume)} 7-Day Volume
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Cumulative revenue booked and completed work orders by client accounts over the rolling week.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <span className="h-2.5 w-2.5 rounded bg-emerald-500 inline-block" />
                Completed Revenue
              </span>
            </div>
          </div>

          <div className="mt-3 h-48 sm:h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.days} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="custRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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
                          <div className="text-emerald-700 font-bold font-mono mt-1">
                            {formatCurrency(d.completedVolume)} completed revenue
                          </div>
                          <div className="text-neutral-500 text-[11px] font-mono">
                            {d.completedBookings} jobs completed
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="completedVolume" stroke="#10b981" strokeWidth={2.5} fill="url(#custRevenueGrad)" dot={{ r: 3.5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Customer List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, phone or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
            />
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm h-[600px] flex flex-col">
            <div className="overflow-y-auto flex-1">
              {filteredCustomers.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="h-12 w-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-neutral-300" />
                  </div>
                  <p className="text-sm text-neutral-500">No customers found.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left ${
                        selectedCustomerId === customer.id ? 'bg-neutral-50 border-l-2 border-neutral-900' : ''
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-bold shrink-0">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {customer.name}
                          </p>
                          <ChevronRight className="h-4 w-4 text-neutral-300" />
                        </div>
                        <p className="text-xs text-neutral-500 font-mono mt-0.5">
                          {customer.phone}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Customer Detail */}
        <div className="lg:col-span-7">
          {selectedCustomer ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-neutral-900 text-white flex items-center justify-center text-2xl font-bold">
                      {selectedCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-900 font-head">{selectedCustomer.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                        <span className="bg-neutral-100 px-2 py-0.5 rounded">Customer since <span className="font-mono">{new Date(selectedCustomer.createdAt).getFullYear()}</span></span>
                      </div>
                    </div>
                  </div>
                  <button className="p-2 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-50 cursor-pointer">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="h-8 w-8 rounded-lg bg-neutral-50 flex items-center justify-center shrink-0">
                        <Phone className="h-4 w-4 text-neutral-500" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Phone</p>
                        <p className="text-neutral-900 font-mono">{selectedCustomer.phone}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm">
                      <div className="h-8 w-8 rounded-lg bg-neutral-50 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-neutral-500" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Email</p>
                        <p className="text-neutral-900">{selectedCustomer.email || 'No email provided'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="h-8 w-8 rounded-lg bg-neutral-50 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-neutral-500" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Address</p>
                        <p className="text-neutral-900 leading-tight">{selectedCustomer.address || 'No address on file'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="h-8 w-8 rounded-lg bg-neutral-50 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-neutral-500" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Notes</p>
                        <p className="text-neutral-900 text-xs italic">{selectedCustomer.notes || 'No special instructions recorded.'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service History */}
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
                  <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2 font-head">
                    <History className="h-4 w-4" />
                    Service History ({customerHistory.length})
                  </h4>
                </div>
                
                <div className="divide-y divide-neutral-100">
                  {customerHistory.length === 0 ? (
                    <div className="p-8 text-center text-sm text-neutral-500 italic">
                      No past service bookings found for this customer.
                    </div>
                  ) : (
                    customerHistory.map((booking) => (
                      <div key={booking.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-neutral-50 flex flex-col items-center justify-center">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">{new Date(booking.date).toLocaleString('default', { month: 'short' })}</span>
                            <span className="text-sm font-bold text-neutral-900 font-mono">{new Date(booking.date).getDate()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-neutral-900 font-head">{booking.serviceTitle}</p>
                            <p className="text-[11px] text-neutral-500 mt-0.5"><span className="font-mono">{booking.timeSlot}</span> · {booking.status.toUpperCase()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-neutral-900 font-mono count-up tabular-nums">{formatCurrency(booking.estimateAmount)}</p>
                          <button className="text-[10px] font-bold text-neutral-400 hover:text-neutral-900 uppercase tracking-wider mt-1 cursor-pointer">View Details</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-neutral-200 rounded-2xl bg-neutral-50 p-12 text-center">
              <div>
                <div className="h-16 w-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-neutral-300" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 font-head">No Customer Selected</h3>
                <p className="text-sm text-neutral-500 mt-2 max-w-[280px]">
                  Select a customer from the list to view their detailed profile, address, and past service history.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
