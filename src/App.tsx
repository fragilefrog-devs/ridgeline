import React, { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset } from './components/ui/sidebar';
import { AppSidebar } from './components/AppSidebar';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { CompletedBookingsChart } from './components/CompletedBookingsChart';
import { DispatchBoard } from './components/DispatchBoard';
import { SmsInbox } from './components/SmsInbox';
import { MissedCallsView } from './components/MissedCallsView';
import { CustomersView } from './components/CustomersView';
import { ServiceCatalog } from './components/ServiceCatalog';
import { SettingsView } from './components/SettingsView';
import { OrganizationSettings, SettingsSubTab } from './components/OrganizationSettings';
import { NewBookingModal } from './components/NewBookingModal';
import { 
  initialBookings, 
  initialThreads, 
  initialMissedCalls, 
  initialServices, 
  initialSettings,
  initialOrganizations,
  initialCustomers
} from './mockData';
import { JobBooking, SmsThread, SmsMessage, MissedCall, TradeService, AssistantSettings, BookingStatus, Organization, User, Customer } from './types';
import { 
  Calendar, 
  MessageSquare, 
  PhoneMissed, 
  ArrowRight, 
  CheckCircle2, 
  Truck, 
  Clock, 
  AlertTriangle,
  MapPin,
  Plus
} from 'lucide-react';
import { formatCurrency } from './lib/utils';
import { apiFetch } from './lib/apiFetch';

import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { AIIcon } from './components/AIIcon';

// Protected Route Component
const ProtectedRoute = ({ children, user, isLoading }: { children: React.ReactNode, user: User | null, isLoading: boolean }) => {
  const location = useLocation();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
          <p className="text-sm font-medium text-neutral-500">Securing your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!user.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'dispatch' | 'sms' | 'missed_calls' | 'customers' | 'services' | 'settings'>('overview');
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('general');
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);
  const [currentOrg, setCurrentOrg] = useState<Organization>(initialOrganizations[0]);
  const [bookings, setBookings] = useState<JobBooking[]>(initialBookings);
  const [threads, setThreads] = useState<SmsThread[]>(initialThreads);
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>(initialMissedCalls);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [services, setServices] = useState<TradeService[]>(initialServices);
  const [settings, setSettings] = useState<AssistantSettings>(initialSettings);
  const [selectedThreadId, setSelectedThreadId] = useState<string>(initialThreads[0].id);
  const [tradespersonStatus, setTradespersonStatus] = useState<'on_call' | 'available' | 'driving'>('available');
  const [neonConnected, setNeonConnected] = useState<boolean>(true);
  const [neonLatency, setNeonLatency] = useState<number>(780);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  // User Auth & Onboarding State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Sync state from live Neon Lakebase Postgres
  const syncFromNeon = async (showLoading = true) => {
    if (showLoading) setIsDataLoading(true);
    const start = Date.now();
    try {
      const storedToken = localStorage.getItem('ridgeline_session_token');
      const headers: Record<string, string> = {};
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const [data, status] = await Promise.all([
        apiFetch('/api/neon/data', { headers }).catch(() => null),
        apiFetch('/api/neon/status').catch(() => null)
      ]);

      if (status) {
        setNeonConnected(status.connected);
        if (status.latencyMs) setNeonLatency(status.latencyMs);
      }

      if (data) {
        if (data.organizations?.length > 0) {
          setOrganizations(data.organizations);
          setCurrentOrg(data.organizations[0]);
        }
        if (data.bookings?.length > 0) {
          setBookings(data.bookings);
        }
        if (data.threads?.length > 0) {
          setThreads(data.threads);
          setSelectedThreadId(data.threads[0].id);
        }
        if (data.services?.length > 0) {
          setServices(data.services);
        }
        if (data.missedCalls?.length > 0) {
          setMissedCalls(data.missedCalls);
        }
        if (data.customers?.length > 0) {
          setCustomers(data.customers);
        }
        if (data.assistantSettings) {
          setSettings(data.assistantSettings);
        }
      }
    } catch (err) {
      console.warn('Neon initial sync skipped, using memory cache:', err);
    } finally {
      if (showLoading) {
        const elapsed = Date.now() - start;
        const delay = Math.max(0, 500 - elapsed);
        setTimeout(() => {
          setIsDataLoading(false);
        }, delay);
      }
    }
  };

  useEffect(() => {
    async function checkAuth() {
      setIsAuthLoading(true);
      try {
        const storedToken = localStorage.getItem('ridgeline_session_token');
        const headers: Record<string, string> = {};
        if (storedToken) {
          headers['Authorization'] = `Bearer ${storedToken}`;
        }

        const data = await apiFetch('/api/auth/me', { headers });
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('ridgeline_user_email', data.user.email);
          if (data.token) {
            localStorage.setItem('ridgeline_session_token', data.token);
          }
        } else {
          setCurrentUser(null);
          localStorage.removeItem('ridgeline_session_token');
          localStorage.removeItem('ridgeline_user_email');
        }
      } catch (e) {
        console.warn('Auth check skipped:', e);
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    }

    syncFromNeon(true);
    checkAuth();
  }, []);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('ridgeline_user_email', user.email);
    syncFromNeon(true);
    if (!user.onboardingCompleted) {
      navigate('/onboarding');
    } else {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    try {
      const storedToken = localStorage.getItem('ridgeline_session_token');
      const headers: Record<string, string> = {};
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }
      await fetch('/api/auth/logout', { method: 'POST', headers, credentials: 'include' });
    } catch (e) {
      console.warn('Logout error:', e);
    }
    setCurrentUser(null);
    localStorage.removeItem('ridgeline_session_token');
    localStorage.removeItem('ridgeline_user_email');
    showToast('Signed out of RidgeLine.');
    navigate('/auth');
  };

  const handleOnboardingComplete = (newOrg: Organization, newSettings: AssistantSettings, newServices: TradeService[]) => {
    setCurrentOrg(newOrg);
    setOrganizations(prev => [newOrg, ...prev.filter(o => o.id !== newOrg.id)]);
    setSettings(newSettings);
    setServices(newServices);
    if (currentUser) {
      setCurrentUser({ ...currentUser, onboardingCompleted: true });
    }
    showToast(`Setup complete! Dispatch engine online for ${newOrg.name}.`);
    navigate('/');
  };

  // Handle Organization switching
  const handleSelectOrg = async (org: Organization) => {
    setCurrentOrg(org);
    setSettings(prev => ({
      ...prev,
      businessName: org.name,
      tradeType: org.trade,
      tradespersonName: org.technicianName,
      twilioPhoneNumber: org.twilioPhoneNumber,
    }));
    try {
      await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organizationId: org.id }),
      });
    } catch (e) {
      console.warn('Organization switch error:', e);
    }
    showToast(`Switched workspace to ${org.name}`);
    syncFromNeon(true);
  };

  const handleAddOrg = (newOrg: Omit<Organization, 'id'>) => {
    const id = `org-${Date.now().toString().slice(-4)}`;
    const created: Organization = { ...newOrg, id };
    setOrganizations(prev => [...prev, created]);
    handleSelectOrg(created);
    showToast(`Organization "${newOrg.name}" created!`);
  };

  // Modals
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);

  // Live Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const unreadSmsCount = threads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);
  const unconvertedCallsCount = missedCalls.filter(m => !m.convertedToBooking).length;

  // Process customer SMS via backend Gemini endpoint
  const handleProcessCustomerSms = async (
    threadId: string, 
    incomingText: string
  ) => {
    const thread = threads.find(t => t.id === threadId);
    
    try {
      const data = await apiFetch('/api/sms/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomingText,
          customerName: thread?.customerName || 'Customer',
          customerPhone: thread?.customerPhone || '+1 (555) 000-0000',
          address: thread?.address || '',
          conversationHistory: thread?.messages || [],
          existingBookings: bookings,
          services,
          settings,
        }),
      });

      return {
        replyText: data.replyText,
        actionTag: data.actionTag,
        shouldConfirmBooking: data.shouldConfirmBooking,
        extractedDetails: {
          serviceTitle: data.serviceTitle,
          suggestedSlot: data.suggestedSlot,
          address: data.extractedAddress || thread?.address,
          price: data.estimatedPrice,
          urgency: data.urgency,
          intent: data.intent,
        },
      };
    } catch (err) {
      console.warn('Backend call failed, using intelligent rule-based trade engine fallback:', err);
      const lower = incomingText.toLowerCase();
      const techName = settings.tradespersonName || currentUser?.fullName || 'Technician';
      let replyText = `Thanks for reaching out! ${techName} is on a service call. Can you share your street address and what issue you're having?`;
      let actionTag: any = 'info_requested';
      let shouldConfirm = false;

      if (lower.includes('flood') || lower.includes('burst') || lower.includes('leak') || lower.includes('emergency')) {
        replyText = `Urgent alert: Please shut off your main water valve clockwise! ${techName} has an opening today at 1:30 PM. What is your street address?`;
        actionTag = 'emergency_escalated';
      } else if (lower.includes('reschedule') || lower.includes('push') || lower.includes('can we do')) {
        replyText = `No problem! I have updated ${techName}'s calendar and moved your appointment to tomorrow from 9:00 AM - 11:00 AM. See you then!`;
        actionTag = 'rescheduled';
        shouldConfirm = true;
      } else if (lower.includes('yes') || lower.includes('confirm') || lower.includes('works') || lower.includes('book')) {
        replyText = `You're all set! We have you confirmed on ${techName}'s dispatch schedule. ${techName} will text when 15 minutes away with the truck.`;
        actionTag = 'auto_booked';
        shouldConfirm = true;
      } else if (lower.includes('how much') || lower.includes('cost') || lower.includes('quote')) {
        replyText = `Our diagnostic & basic service call is $195-$285 depending on parts required. ${techName} has an opening tomorrow morning at 9:00 AM or 1:00 PM if you'd like a slot!`;
        actionTag = 'quote_given';
      }

      return {
        replyText,
        actionTag,
        shouldConfirmBooking: shouldConfirm,
        extractedDetails: {
          serviceTitle: 'Main Line Drain Snaking / Hydrojet',
          suggestedSlot: 'Tomorrow 09:00 AM - 11:00 AM',
          address: thread?.address || '742 Evergreen Terrace',
          price: 285,
          urgency: 'routine',
          intent: 'book',
        },
      };
    }
  };

  // Add message to thread
  const handleSendMessage = (
    threadId: string,
    text: string,
    sender: 'customer' | 'assistant' | 'tradesperson',
    actionTag?: any,
    senderName?: string
  ) => {
    const currentUserName = currentUser?.fullName || settings.tradespersonName || 'Technician';
    const resolvedSenderName = 
      senderName ||
      (sender === 'assistant' 
        ? 'RidgeLine AI Dispatcher' 
        : sender === 'tradesperson' 
        ? currentUserName 
        : (threads.find(t => t.id === threadId)?.customerName || 'Customer'));

    const newMsg: SmsMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      threadId,
      sender,
      senderName: resolvedSenderName,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'delivered' as const,
      actionTag,
      parsedIntent: { senderName: resolvedSenderName },
    };

    const thread = threads.find(t => t.id === threadId);

    setThreads(prev => prev.map(t => {
      if (t.id === threadId) {
        return {
          ...t,
          lastActivity: newMsg.timestamp,
          messages: [...t.messages, newMsg],
          unreadCount: sender === 'customer' ? (t.unreadCount || 0) + 1 : 0,
        };
      }
      return t;
    }));

    // Persist message to Neon Postgres
    try {
      fetch('/api/sms/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          threadId,
          sender,
          senderName: resolvedSenderName,
          text,
          actionTag,
          customerName: thread?.customerName,
          customerPhone: thread?.customerPhone,
          address: thread?.address,
          tradeType: thread?.tradeType || settings.tradeType,
        }),
      }).catch(err => console.warn('Neon message persist err:', err));
    } catch (e) {
      // ignore
    }
  };

  // Toggle human takeover for a thread
  const handleToggleTakeover = (threadId: string, forceStatus?: boolean) => {
    const currentUserName = currentUser?.fullName || settings.tradespersonName || 'Technician';
    setThreads(prev => prev.map(t => {
      if (t.id === threadId) {
        const newTaken = forceStatus !== undefined ? forceStatus : !t.isTakenOver;
        return {
          ...t,
          isTakenOver: newTaken,
          takenOverBy: newTaken ? currentUserName : undefined,
        };
      }
      return t;
    }));
  };

  // Auto-confirm or reschedule booking from SMS
  const handleAutoConfirmFromSms = async (thread: SmsThread, details: any) => {
    const isReschedule = details?.intent === 'reschedule';
    
    if (isReschedule && thread.bookingId) {
      const nextDay = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const slot = details?.suggestedSlot || '09:00 AM - 11:00 AM';
      setBookings(prev => prev.map(b => {
        if (b.id === thread.bookingId) {
          return {
            ...b,
            date: nextDay,
            timeSlot: slot,
            notes: `${b.notes} (Rescheduled via SMS)`,
          };
        }
        return b;
      }));

      // Update in Neon
      fetch(`/api/bookings/${thread.bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date: nextDay, timeSlot: slot }),
      }).catch(e => console.warn(e));

      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, status: 'rescheduled' } : t));
      showToast(`Appointment for ${thread.customerName} was rescheduled via SMS.`);
    } else {
      const newBookingData = {
        customerName: thread.customerName,
        customerPhone: thread.customerPhone,
        address: details?.address || thread.address || '312 Elm Street, Springfield',
        tradeType: thread.tradeType || 'plumbing',
        serviceTitle: details?.serviceTitle || 'General Service Diagnostic & Repair',
        date: new Date().toISOString().split('T')[0],
        timeSlot: details?.suggestedSlot || '01:30 PM - 03:30 PM',
        status: 'scheduled' as const,
        estimateAmount: details?.price || 285,
        notes: `Auto-booked by RidgeLine AI Assistant via SMS thread.`,
        urgency: details?.urgency || 'routine',
        createdFrom: 'sms' as const,
        smsThreadId: thread.id,
      };

      try {
        const data = await apiFetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(newBookingData),
        });
        if (data.booking) {
          setBookings(prev => [data.booking, ...prev]);
          setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, bookingId: data.booking.id, status: 'booked' } : t));
          showToast(`Job auto-confirmed for ${thread.customerName} & saved to Neon Postgres!`);
          return;
        }
      } catch (err) {
        console.warn('Neon booking save fallback', err);
      }

      const newBookingId = `bk-${Date.now().toString().slice(-4)}`;
      const newBooking: JobBooking = {
        id: newBookingId,
        organizationId: currentOrg?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ...newBookingData,
        createdAt: new Date().toISOString(),
      };

      setBookings(prev => [newBooking, ...prev]);
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, bookingId: newBookingId, status: 'booked' } : t));
      showToast(`New Job auto-confirmed for ${thread.customerName} on dispatch calendar!`);
    }
  };

  // Send 15-minute ETA SMS to customer
  const handleSendEtaSms = (booking: JobBooking) => {
    const etaText = `Hey ${booking.customerName.split(' ')[0]}! Mark is currently en route in the service van. Estimated arrival is ~15 minutes. See you soon!`;
    
    let thread = threads.find(t => t.id === booking.smsThreadId || t.customerPhone === booking.customerPhone);
    if (thread) {
      handleSendMessage(thread.id, etaText, 'tradesperson');
    }

    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'en_route' } : b));
    fetch(`/api/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'en_route' }),
    }).catch(e => console.warn(e));
    showToast(`15-min ETA text sent to ${booking.customerName} (${booking.customerPhone})`);
  };

  // Update status directly
  const handleUpdateStatus = (id: string, newStatus: BookingStatus) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus }),
    }).catch(e => console.warn(e));
    showToast(`Job status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
  };

  // Test SMS Simulator handler
  const handleSendTestSms = async (text: string, customerName = 'Homeowner', customerPhone = '+1 (555) 777-1234') => {
    let thread = threads.find(t => t.customerPhone === customerPhone);
    if (!thread) {
      const threadId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `th-sim-${Date.now().toString().slice(-4)}`;
      thread = {
        id: threadId,
        customerName,
        customerPhone,
        tradeType: settings.tradeType,
        unreadCount: 0,
        lastActivity: 'Just now',
        status: 'active',
        messages: [],
      };
      setThreads(prev => [thread!, ...prev]);
    }

    const result = await handleProcessCustomerSms(thread.id, text);
    handleSendMessage(thread.id, text, 'customer');
    handleSendMessage(thread.id, result.replyText, 'assistant', result.actionTag);

    if (result.shouldConfirmBooking) {
      handleAutoConfirmFromSms(thread, result.extractedDetails);
    }

    return result.replyText;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter(b => b.date === todayStr);

  return (
    <Routes>
      <Route path="/auth" element={
        <AuthPage 
          onAuthSuccess={handleAuthSuccess} 
          showToast={showToast} 
          currentUser={currentUser}
        />
      } />
      <Route path="/onboarding" element={
        <ProtectedRoute user={currentUser} isLoading={isAuthLoading}>
          {currentUser && (
            <OnboardingPage
              user={currentUser}
              onComplete={handleOnboardingComplete}
              showToast={showToast}
            />
          )}
        </ProtectedRoute>
      } />
      <Route path="*" element={
        <ProtectedRoute user={currentUser} isLoading={isAuthLoading}>
          <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen w-full bg-neutral-50/70 text-neutral-900 font-sans">
              
              {/* Toast alert banner */}
              {toastMessage && (
                <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-xs text-white shadow-xl border border-neutral-700 animate-in fade-in slide-in-from-bottom-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{toastMessage}</span>
                </div>
              )}

              {/* Canonical shadcn Sidebar Navigation */}
              <AppSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                settingsSubTab={settingsSubTab}
                setSettingsSubTab={setSettingsSubTab}
                settings={settings}
                organizations={organizations}
                currentOrg={currentOrg}
                onSelectOrg={handleSelectOrg}
                onAddOrg={handleAddOrg}
                unreadSmsCount={unreadSmsCount}
                unconvertedCallsCount={unconvertedCallsCount}
                totalBookingsCount={bookings.length}
                onOpenNewBooking={() => setIsNewBookingOpen(true)}
                tradespersonStatus={tradespersonStatus}
                setTradespersonStatus={setTradespersonStatus}
                user={currentUser}
                onLogout={handleLogout}
                onOpenOnboarding={() => navigate('/onboarding')}
              />

              {/* Sidebar Inset: Header + Main Content Area */}
              <SidebarInset className="flex flex-col flex-1 overflow-x-hidden min-w-0">
                
                <Header
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  settingsSubTab={settingsSubTab}
                  settings={settings}
                  unreadSmsCount={unreadSmsCount}
                  unconvertedCallsCount={unconvertedCallsCount}
                  onOpenNewBooking={() => setIsNewBookingOpen(true)}
                  neonConnected={neonConnected}
                  neonLatency={neonLatency}
                  user={currentUser}
                  onLogout={handleLogout}
                  isDataLoading={isDataLoading}
                  onRefreshData={() => {
                    showToast('Syncing live data from database...');
                    syncFromNeon(true);
                  }}
                />

                <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
                  {/* ... existing tabs content ... */}
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-4 sm:space-y-6">
                
                {/* 7-Day Completed Bookings Visualization (Replacing RidgeLine AI Dispatcher card) */}
                <CompletedBookingsChart 
                  bookings={bookings} 
                  settings={settings} 
                  isLoading={isDataLoading}
                />

                {/* 4 Metric Cards */}
                <MetricCards 
                  bookings={bookings} 
                  missedCalls={missedCalls} 
                  threads={threads} 
                  isLoading={isDataLoading}
                />

                {/* Main Split Grid: Today's Route */}
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  
                  {/* Today's Dispatch Timeline & Priority Jobs */}
                  <div className="space-y-4">
                    <div className="rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2 font-head">
                            <Calendar className="h-4 w-4 text-neutral-700 shrink-0" />
                            <span>Today's Dispatches ({todayBookings.length} jobs)</span>
                          </h3>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Route optimization for {settings.tradespersonName}
                          </p>
                        </div>

                        <button
                          onClick={() => setActiveTab('dispatch')}
                          className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                        >
                          <span>Full Schedule</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="divide-y divide-neutral-100 mt-2">
                        {todayBookings.length === 0 ? (
                          <div className="py-8 text-center text-xs text-neutral-500">
                            No jobs scheduled for today. AI is monitoring for incoming bookings!
                          </div>
                        ) : (
                          todayBookings.map((job) => (
                            <div key={job.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                              <div className="space-y-1 w-full sm:w-auto min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold text-neutral-900 font-mono">
                                    {job.timeSlot}
                                  </span>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                    job.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : job.status === 'in_progress'
                                      ? 'bg-blue-100 text-blue-800'
                                      : job.status === 'en_route'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-neutral-100 text-neutral-800'
                                  }`}>
                                    {job.status === 'in_progress' ? 'ON SITE' : job.status.toUpperCase()}
                                  </span>
                                  {job.urgency === 'emergency' && (
                                    <span className="text-[10px] text-red-600 font-bold flex items-center gap-0.5">
                                      <AlertTriangle className="h-2.5 w-2.5" />
                                      Emergency
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-xs font-semibold text-neutral-900">
                                  {job.serviceTitle}
                                </h4>

                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                                  <span>{job.customerName}</span>
                                  <span>·</span>
                                  <span className="inline-flex items-center gap-1 min-w-0">
                                    <MapPin className="h-3 w-3 text-neutral-400 shrink-0" />
                                    <span className="truncate max-w-[200px] sm:max-w-xs">{job.address}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                                <span className="text-xs font-bold font-mono count-up tabular-nums text-neutral-900 mr-2">
                                  {formatCurrency(job.estimateAmount)}
                                </span>

                                {job.status === 'scheduled' && (
                                  <button
                                    onClick={() => handleSendEtaSms(job)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 cursor-pointer"
                                    title="Send 15m ETA text to customer"
                                  >
                                    <Truck className="h-3 w-3 text-amber-600" />
                                    <span>En Route</span>
                                  </button>
                                )}

                                {job.status === 'en_route' && (
                                  <button
                                    onClick={() => handleUpdateStatus(job.id, 'in_progress')}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-blue-50 text-blue-800 border border-blue-200 cursor-pointer"
                                  >
                                    Arrived
                                  </button>
                                )}

                                {job.status === 'in_progress' && (
                                  <button
                                    onClick={() => handleUpdateStatus(job.id, 'completed')}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-neutral-500">
                        <span>Next opening today: <span className="font-mono font-medium text-neutral-700">03:45 PM - 05:00 PM</span></span>
                        <button
                          onClick={() => setIsNewBookingOpen(true)}
                          className="text-neutral-900 font-semibold hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Manual Job
                        </button>
                      </div>
                    </div>

                    {/* Missed Call Quick Triage Bar */}
                    <div className="rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
                        <h3 className="text-xs font-bold text-neutral-900 flex items-center gap-2 font-head">
                          <PhoneMissed className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span>Recent Missed Calls ({unconvertedCallsCount} pending reply)</span>
                        </h3>
                        <button
                          onClick={() => setActiveTab('missed_calls')}
                          className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                        >
                          <span>All Calls</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="divide-y divide-neutral-100 mt-2 text-xs">
                        {missedCalls.slice(0, 3).map((call) => (
                          <div key={call.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 w-full sm:w-auto">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-neutral-900">{call.callerName}</span>
                                <span className="font-mono text-[11px] text-neutral-500">{call.callerPhone}</span>
                              </div>
                              <p className="text-[11px] text-neutral-500 line-clamp-1 italic mt-0.5">
                                "{call.voicemailTranscript}"
                              </p>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                              {call.convertedToBooking ? (
                                <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                                  Converted
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-medium">
                                  Auto-SMS Sent
                                </span>
                              )}

                              <button
                                onClick={() => {
                                  const t = threads.find(th => th.customerPhone === call.callerPhone);
                                  if (t) {
                                    setSelectedThreadId(t.id);
                                    setActiveTab('sms');
                                  }
                                }}
                                className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
                                title="Open SMS Thread"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DISPATCH BOARD */}
            {activeTab === 'dispatch' && (
              <DispatchBoard
                bookings={bookings}
                onUpdateStatus={handleUpdateStatus}
                onSendEtaSms={handleSendEtaSms}
                onOpenThread={(threadId) => {
                  if (threadId) {
                    setSelectedThreadId(threadId);
                    setActiveTab('sms');
                  }
                }}
                onOpenNewBooking={() => setIsNewBookingOpen(true)}
                isLoading={isDataLoading}
              />
            )}

            {/* TAB 3: SMS INBOX */}
            {activeTab === 'sms' && (
              <SmsInbox
                threads={threads}
                activeThreadId={selectedThreadId}
                onSelectThread={(id) => setSelectedThreadId(id)}
                onSendMessage={handleSendMessage}
                onProcessCustomerSms={handleProcessCustomerSms}
                bookings={bookings}
                settings={settings}
                services={services}
                onAutoConfirmFromSms={handleAutoConfirmFromSms}
                tradespersonStatus={tradespersonStatus}
                setTradespersonStatus={setTradespersonStatus}
                user={currentUser}
                onToggleTakeover={handleToggleTakeover}
              />
            )}

            {/* TAB 4: MISSED CALLS */}
            {activeTab === 'missed_calls' && (
              <MissedCallsView
                missedCalls={missedCalls}
                bookings={bookings}
                onOpenSimulateCall={() => {}} // Simulation disabled
                onOpenThreadForCaller={(phone) => {
                  const match = threads.find(t => t.customerPhone === phone);
                  if (match) {
                    setSelectedThreadId(match.id);
                    setActiveTab('sms');
                  }
                }}
                isLoading={isDataLoading}
              />
            )}

            {/* TAB 4.5: CUSTOMERS */}
            {activeTab === 'customers' && (
              <CustomersView
                customers={customers}
                bookings={bookings}
                isLoading={isDataLoading}
              />
            )}

            {/* TAB 5 & 6: ORGANIZATION SETTINGS (INCLUDING SERVICE RATES, TWILIO & AI, GENERAL) */}
            {(activeTab === 'settings' || activeTab === 'services') && (
              <OrganizationSettings
                currentOrg={currentOrg}
                onUpdateOrg={(updated) => {
                  setCurrentOrg(updated);
                  setOrganizations(prev => prev.map(o => o.id === updated.id ? updated : o));
                  fetch('/api/organizations', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updated),
                  }).catch(e => console.warn('Org update err:', e));
                }}
                settings={settings}
                onUpdateSettings={(newSettings) => {
                  setSettings(newSettings);
                  fetch('/api/assistant-settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(newSettings),
                  }).catch(e => console.warn('Settings update err:', e));
                }}
                services={services}
                onAddService={async (newSrv) => {
                  const id = `srv-${Date.now()}`;
                  setServices(prev => [...prev, { ...newSrv, id }]);
                  try {
                    const data = await apiFetch('/api/services', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(newSrv),
                    });
                    if (data.service) {
                      setServices(prev => prev.map(s => s.id === id ? data.service : s));
                    }
                  } catch (e) {
                    console.warn('Service add err:', e);
                  }
                }}
                onDeleteService={(id) => {
                  setServices(prev => prev.filter(s => s.id !== id));
                  fetch(`/api/services/${id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                  }).catch(e => console.warn('Service delete err:', e));
                  showToast('Service removed from catalog.');
                }}
                activeSubTab={activeTab === 'services' ? 'rates' : settingsSubTab}
                onChangeSubTab={(sub) => setSettingsSubTab(sub)}
                showToast={showToast}
                onOpenOnboarding={() => navigate('/onboarding')}
                onLogout={handleLogout}
              />
            )}

          </main>

        </SidebarInset>

        {/* Modals */}
        <NewBookingModal
          isOpen={isNewBookingOpen}
          onClose={() => setIsNewBookingOpen(false)}
          onAddBooking={async (newJob) => {
            try {
              const data = await apiFetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newJob),
              });
              if (data.booking) {
                setBookings(prev => [data.booking, ...prev]);
                showToast(`Job for ${newJob.customerName} saved to Neon Lakebase Postgres!`);
                return;
              }
            } catch (err) {
              console.warn('Booking insert fallback', err);
            }

            const id = `bk-${Date.now().toString().slice(-4)}`;
            setBookings(prev => [{ ...newJob, id, createdAt: new Date().toISOString() }, ...prev]);
            showToast(`Job for ${newJob.customerName} added to dispatch schedule.`);
          }}
          services={services}
        />

      </div>
    </SidebarProvider>
    </ProtectedRoute>
      } />
    </Routes>
  );
}
