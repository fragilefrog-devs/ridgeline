import React, { useState, useMemo } from 'react';
import { 
  PhoneMissed, 
  Play, 
  Pause, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  PhoneCall,
  CalendarCheck,
  TrendingUp,
  Zap,
  CheckCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { MissedCall, JobBooking } from '../types';
import { calculateSevenDaysMetrics } from '../lib/chartUtils';
import { EmptyState } from './EmptyState';
import { AIIcon } from './AIIcon';
import { TabChartSkeleton } from './ChartSkeleton';

interface MissedCallsViewProps {
  missedCalls: MissedCall[];
  bookings: JobBooking[];
  onOpenSimulateCall: () => void;
  onOpenThreadForCaller: (phone: string) => void;
  isLoading?: boolean;
  isChartLoading?: boolean;
}

export const MissedCallsView: React.FC<MissedCallsViewProps> = ({
  missedCalls,
  bookings,
  onOpenSimulateCall,
  onOpenThreadForCaller,
  isLoading = false,
  isChartLoading = false,
}) => {
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    return calculateSevenDaysMetrics(bookings, missedCalls, []);
  }, [bookings, missedCalls]);

  const togglePlayVoicemail = (callId: string) => {
    if (playingCallId === callId) {
      setPlayingCallId(null);
    } else {
      setPlayingCallId(callId);
      // Auto reset after 5 seconds to simulate playback finish
      setTimeout(() => {
        setPlayingCallId(prev => prev === callId ? null : prev);
      }, 5000);
    }
  };

  const convertedCount = missedCalls.filter(m => m.convertedToBooking).length;

  if (isLoading && missedCalls.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs animate-pulse">
          <div className="h-5 w-56 bg-neutral-200 rounded mb-2" />
          <div className="h-3.5 w-full max-w-xl bg-neutral-100 rounded" />
        </div>

        {/* Skeleton for Recharts Component on Missed Calls Tab */}
        <TabChartSkeleton
          title="7-Day Call Recovery Velocity"
          subtitle="Daily missed calls captured and converted into scheduled revenue via automated Twilio SMS textback."
          accentColor="bg-amber-500"
          type="bar"
          legendLabels={['Missed', 'Recovered']}
        />

        {/* Skeleton for table */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 animate-pulse">
          <div className="h-4 w-36 bg-neutral-200 rounded" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-neutral-50 rounded border border-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner explaining the engine */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-neutral-900 font-head">
              Missed-Call-to-Job Pipeline
            </h3>
            <span className="text-xs bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 rounded">
              Twilio Powered
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-600 max-w-2xl leading-relaxed">
            When you're under a house or inside an electrical panel, you can't pick up. Instead of losing the customer to your competitor, RidgeLine detects the missed call and texts them within 10 seconds to secure the booking.
          </p>
        </div>

        <button
          onClick={onOpenSimulateCall}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs whitespace-nowrap cursor-pointer"
        >
          <PhoneCall className="h-3.5 w-3.5 text-amber-400" />
          <span>Simulate Incoming Missed Call</span>
        </button>
      </div>

      {/* 7-Day Recharts Missed Call Recovery Visualization */}
      {isLoading || isChartLoading ? (
        <TabChartSkeleton
          title="7-Day Call Recovery Velocity"
          badgeText="Updating recovery analytics..."
          subtitle="Daily missed calls captured and converted into scheduled revenue via automated Twilio SMS textback."
          accentColor="bg-amber-500"
          type="bar"
          legendLabels={['Missed', 'Recovered']}
        />
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-neutral-900 font-head">
                  7-Day Call Recovery Velocity
                </h4>
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {metrics.sevenDayRecoveryRate}% 7d Recovery
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Daily missed calls captured and converted into scheduled revenue via automated Twilio SMS textback.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <span className="h-2.5 w-2.5 rounded bg-neutral-300 inline-block" />
                Missed
              </span>
              <span className="flex items-center gap-1.5 text-neutral-900 font-medium">
                <span className="h-2.5 w-2.5 rounded bg-amber-500 inline-block" />
                Recovered
              </span>
            </div>
          </div>

          <div className="mt-3 h-48 sm:h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.days} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
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
                          <div className="text-amber-700 font-bold font-mono mt-1">
                            {d.recoveredCalls} of {d.missedCalls} recovered ({d.recoveryRate}%)
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="missedCalls" name="Total Missed" fill="#e2e8f0" radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="recoveredCalls" name="Auto-SMS Recovered" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Missed Calls Table */}
      {missedCalls.length === 0 ? (
        <EmptyState
          icon={PhoneMissed}
          title="Zero Missed Call Pipeline"
          description="Every incoming customer call has been answered or auto-converted into a scheduled service appointment! No revenue slipped through the cracks."
          primaryAction={{
            label: 'Simulate Inbound Missed Call',
            onClick: onOpenSimulateCall,
            icon: PhoneCall,
          }}
          tip="RidgeLine detects missed calls from your Twilio line and sends an immediate SMS within 10 seconds to lock in the job before the customer dials another contractor."
          badge="100% Lead Capture"
        />
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-neutral-900 font-head">
              Recent Inbound Call Attempts ({missedCalls.length})
            </h4>
            <span className="text-xs text-emerald-700 font-medium">
              <span className="font-mono count-up">{convertedCount}</span> of <span className="font-mono count-up">{missedCalls.length}</span> converted to booked work
            </span>
          </div>

          <div className="divide-y divide-neutral-100">
            {missedCalls.map((call) => {
            const isPlaying = playingCallId === call.id;
            const linkedBooking = bookings.find(b => b.id === call.bookingId);

            return (
              <div key={call.id} className="p-4 hover:bg-neutral-50/50 transition-colors">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                  
                  {/* Left: Caller info & timestamp */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600 shrink-0">
                      <PhoneMissed className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">
                          {call.callerName}
                        </span>
                        <span className="text-xs text-neutral-500 font-mono">
                          {call.callerPhone}
                        </span>
                        {call.urgency === 'emergency' && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded">
                            Emergency
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono mt-0.5">
                        <span>Missed at {call.timestamp}</span>
                        <span>·</span>
                        <span>{call.durationSeconds}s ring duration</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Conversion status & Quick Actions */}
                  <div className="flex items-center gap-3">
                    {call.convertedToBooking ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-semibold">Converted to Booked Job</span>
                        {linkedBooking && (
                          <span className="font-mono count-up text-[11px] text-emerald-700">
                            (${linkedBooking.estimateAmount})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-md">
                        <Clock className="h-3.5 w-3.5 text-neutral-400" />
                        <span>SMS Sent · Waiting for reply</span>
                      </div>
                    )}

                    <button
                      onClick={() => onOpenThreadForCaller(call.callerPhone)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>View SMS Thread</span>
                    </button>
                  </div>

                </div>

                {/* Voicemail transcription & Auto-SMS block */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-neutral-100 text-xs">
                  
                  {/* Voicemail audio player */}
                  <div className="bg-neutral-50 p-3 rounded-md border border-neutral-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-neutral-700 flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-neutral-400" />
                        Voicemail Audio ({call.durationSeconds}s)
                      </span>
                      <button
                        onClick={() => togglePlayVoicemail(call.id)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          isPlaying 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-100'
                        }`}
                      >
                        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        <span>{isPlaying ? 'Playing...' : 'Listen'}</span>
                      </button>
                    </div>

                    {/* Simulated Waveform */}
                    <div className="flex items-center gap-1 h-5 my-1.5 px-1 bg-white rounded border border-neutral-200">
                      {[40, 65, 80, 50, 95, 30, 70, 85, 45, 90, 60, 75, 40, 85, 55, 35, 70, 90, 60, 45, 80, 50, 30].map((h, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            isPlaying ? 'bg-amber-500 animate-pulse' : 'bg-neutral-300'
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>

                    <p className="mt-2 text-neutral-600 italic">
                      "{call.voicemailTranscript || 'Caller left no voicemail recording.'}"
                    </p>
                  </div>

                  {/* Auto-SMS Sent by RidgeLine */}
                  <div className="bg-neutral-900 text-white p-3 rounded-md">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1">
                        <AIIcon className="h-3 w-3 text-indigo-400" />
                        RidgeLine Auto-SMS Follow-up
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {call.autoSmsTimestamp || 'Sent immediately'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-200 leading-relaxed font-sans">
                      "Hey {call.callerName.split(' ')[0]}, sorry Mark missed your call! He is currently on a service call. What can we help you with today? Reply here to schedule directly."
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400 border-t border-neutral-800 pt-1.5">
                      <span>Delivered via Twilio</span>
                      <span className="text-emerald-400">Response time: ~10 seconds</span>
                    </div>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
};
