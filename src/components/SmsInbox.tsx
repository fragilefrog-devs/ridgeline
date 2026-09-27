import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  CheckCheck, 
  MapPin, 
  MessageSquare,
  ShieldCheck,
  UserCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  FlaskConical,
  X
} from 'lucide-react';
import { SmsThread, SmsMessage, JobBooking, AssistantSettings, TradeService, User as UserType } from '../types';
import { EmptyState } from './EmptyState';
import { AIIcon } from './AIIcon';

interface SmsInboxProps {
  threads: SmsThread[];
  activeThreadId?: string;
  onSelectThread: (threadId: string) => void;
  onSendMessage: (
    threadId: string, 
    text: string, 
    sender: 'customer' | 'assistant' | 'tradesperson',
    actionTag?: any,
    senderName?: string
  ) => void;
  onProcessCustomerSms: (
    threadId: string, 
    incomingText: string
  ) => Promise<{ replyText: string; actionTag?: any; shouldConfirmBooking?: boolean; extractedDetails?: any }>;
  bookings: JobBooking[];
  settings: AssistantSettings;
  services: TradeService[];
  onAutoConfirmFromSms: (thread: SmsThread, details: any) => void;
  onOpenSimulateSms?: () => void;
  tradespersonStatus?: 'on_call' | 'available' | 'driving';
  setTradespersonStatus?: (status: 'on_call' | 'available' | 'driving') => void;
  user?: UserType | null;
  onToggleTakeover?: (threadId: string, forceStatus?: boolean) => void;
}

export const SmsInbox: React.FC<SmsInboxProps> = ({
  threads,
  activeThreadId,
  onSelectThread,
  onSendMessage,
  onProcessCustomerSms,
  bookings,
  settings,
  services,
  onAutoConfirmFromSms,
  tradespersonStatus = 'on_call',
  setTradespersonStatus,
  user,
  onToggleTakeover,
}) => {
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showSimulateDrawer, setShowSimulateDrawer] = useState(false);
  const [simCustomerText, setSimCustomerText] = useState('');
  
  // Local fallback map for taken over threads if not in thread object
  const [localTakenOverMap, setLocalTakenOverMap] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedThread = threads.find(t => t.id === activeThreadId) || threads[0];
  const linkedBooking = bookings.find(b => b.id === selectedThread?.bookingId || b.smsThreadId === selectedThread?.id);

  const currentUserName = user?.fullName || settings.tradespersonName || 'Technician';
  const isAvailable = tradespersonStatus === 'available';

  // Thread is considered taken over if flagged in thread or in local map
  const isThreadTakenOver = selectedThread 
    ? (selectedThread.isTakenOver ?? localTakenOverMap[selectedThread.id] ?? false)
    : false;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedThread?.messages, isAiThinking, isThreadTakenOver]);

  // Handle toggling takeover for the active thread
  const handleToggleTakeover = (force?: boolean) => {
    if (!selectedThread) return;
    const targetStatus = force !== undefined ? force : !isThreadTakenOver;

    // If attempting to take over while on_call, automatically switch status to available
    if (targetStatus && !isAvailable && setTradespersonStatus) {
      setTradespersonStatus('available');
    }

    setLocalTakenOverMap(prev => ({
      ...prev,
      [selectedThread.id]: targetStatus,
    }));

    if (onToggleTakeover) {
      onToggleTakeover(selectedThread.id, targetStatus);
    }
  };

  // Handle user sending an outgoing message directly to the customer as their username
  const handleSendOperatorMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedThread) return;

    const text = inputText.trim();
    setInputText('');

    // Ensure thread is marked as taken over when operator messages directly
    if (!isThreadTakenOver) {
      handleToggleTakeover(true);
    }

    onSendMessage(
      selectedThread.id,
      text,
      'tradesperson',
      undefined,
      currentUserName
    );
  };

  // Handle simulating incoming customer SMS
  const handleSendSimulatedCustomerSms = async (customPrompt?: string) => {
    const textToSend = customPrompt || simCustomerText;
    if (!textToSend.trim() || !selectedThread) return;

    if (!customPrompt) {
      setSimCustomerText('');
      setShowSimulateDrawer(false);
    }

    // 1. Post customer message to thread
    onSendMessage(selectedThread.id, textToSend, 'customer');

    // 2. If the user has taken over this thread, RidgeLine AI will NOT auto-reply!
    // The operator will answer directly in real-time.
    if (isThreadTakenOver) {
      return;
    }

    // 3. If thread is NOT taken over (AI Autonomous mode), trigger Gemini AI auto-reply
    setIsAiThinking(true);
    try {
      const result = await onProcessCustomerSms(selectedThread.id, textToSend);

      // Post AI response with RidgeLine AI Dispatcher branding
      onSendMessage(
        selectedThread.id,
        result.replyText,
        'assistant',
        result.actionTag,
        'RidgeLine AI Dispatcher'
      );

      if (result.shouldConfirmBooking) {
        onAutoConfirmFromSms(selectedThread, result.extractedDetails);
      }
    } catch (err) {
      console.error('Failed to process customer SMS:', err);
    } finally {
      setIsAiThinking(false);
    }
  };

  const filteredThreads = threads.filter(t => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return t.customerName.toLowerCase().includes(q) || t.customerPhone.includes(q);
  });

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No Active SMS Conversations"
        description="RidgeLine monitors your Twilio business number 24/7. When a homeowner sends an SMS inquiry or a missed call triggers auto-reply, live booking conversations will appear here."
        primaryAction={undefined}
        tip="Homeowners can text questions, ask for quotes, or request reschedules. RidgeLine parses natural language and confirms appointments directly to your dispatch calendar."
        badge="SMS Dispatch Engine Active"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-140px)] min-h-[620px]">
      
      {/* Left Column: Thread List (4 cols) */}
      <div className="md:col-span-4 flex flex-col bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-neutral-200 bg-neutral-50/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-neutral-900">SMS Conversations</h3>
              <span className="text-[11px] font-mono bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded">
                {threads.length}
              </span>
            </div>

            {/* Quick status badge */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span
                className={`h-2 w-2 rounded-full ${
                  isAvailable ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span className="text-[10px] text-neutral-600 font-medium hidden sm:inline">
                {isAvailable ? 'Available' : 'On Service Call'}
              </span>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search conversations by name or phone..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full text-xs bg-white border border-neutral-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
          {filteredThreads.map((thread) => {
            const isSelected = thread.id === selectedThread?.id;
            const lastMsg = thread.messages[thread.messages.length - 1];
            const threadIsTaken = thread.isTakenOver ?? localTakenOverMap[thread.id] ?? false;

            return (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1.5 ${
                  isSelected 
                    ? 'bg-neutral-100/90 border-l-3 border-neutral-900' 
                    : 'hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-neutral-900 truncate">
                      {thread.customerName}
                    </span>
                    {threadIsTaken && (
                      <span className="text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-semibold shrink-0" title="Human operator takeover active">
                        Live Takeover
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                    {lastMsg ? lastMsg.timestamp : thread.lastActivity}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono">
                  <span>{thread.customerPhone}</span>
                  {thread.status === 'booked' && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-sans font-medium">
                      Booked
                    </span>
                  )}
                  {thread.status === 'rescheduled' && (
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-sans font-medium">
                      Rescheduled
                    </span>
                  )}
                </div>

                {lastMsg && (
                  <p className="text-xs text-neutral-600 line-clamp-1 italic">
                    {lastMsg.sender === 'assistant' 
                      ? 'RidgeLine AI: ' 
                      : lastMsg.sender === 'tradesperson' 
                      ? `${lastMsg.senderName || currentUserName}: ` 
                      : ''}
                    {lastMsg.text}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Active Conversation (8 cols) */}
      <div className="md:col-span-8 flex flex-col bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-xs">
        
        {/* Conversation Header */}
        {selectedThread ? (
          <div className="p-3.5 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900 font-head">
                  {selectedThread.customerName}
                </h3>
                <span className="text-xs text-neutral-500 font-mono">
                  {selectedThread.customerPhone}
                </span>
                {selectedThread.address && (
                  <span className="hidden lg:inline-flex items-center gap-1 text-xs text-neutral-500">
                    <MapPin className="h-3 w-3 text-neutral-400" />
                    {selectedThread.address}
                  </span>
                )}
              </div>

              {linkedBooking && (
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                  <span className="font-medium text-neutral-900">Linked Job:</span>
                  <span>{linkedBooking.serviceTitle}</span>
                  <span>·</span>
                  <span className="font-mono">{linkedBooking.timeSlot}</span>
                  <span className="text-emerald-700 font-medium font-mono count-up">(${linkedBooking.estimateAmount})</span>
                </div>
              )}
            </div>

            {/* Takeover Control Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {isThreadTakenOver ? (
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-200">
                    <UserCheck className="h-3.5 w-3.5 text-blue-700" />
                    <span>Live Takeover: {currentUserName}</span>
                  </div>
                  <button
                    onClick={() => handleToggleTakeover(false)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 transition-colors shadow-2xs cursor-pointer"
                    title="Hand conversation back to RidgeLine AI Dispatcher"
                  >
                    <Bot className="h-3.5 w-3.5 text-neutral-600" />
                    <span>Hand back to AI</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleTakeover(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
                    title={isAvailable ? "Take over this conversation directly" : "Switch to Available & Take Over"}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>{isAvailable ? "Take Over Conversation" : "Switch to Available & Take Over"}</span>
                  </button>
                </div>
              )}

              {/* Simulation drawer trigger */}
              <button
                onClick={() => setShowSimulateDrawer(!showSimulateDrawer)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border cursor-pointer ${
                  showSimulateDrawer
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                }`}
                title="Test customer messages in this thread"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Simulate Inbound</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-neutral-200">
            <h3 className="text-sm font-medium text-neutral-500">Select a conversation</h3>
          </div>
        )}

        {/* Takeover Status Notification Banners */}
        {selectedThread && isThreadTakenOver && (
          <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center justify-between gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
              <p className="truncate">
                <strong>Live Takeover Active:</strong> You (<strong>{currentUserName}</strong>) are speaking directly with {selectedThread.customerName}. AI auto-replies are paused.
              </p>
            </div>
            <button
              onClick={() => handleToggleTakeover(false)}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 underline shrink-0 cursor-pointer"
            >
              Resume AI Dispatcher
            </button>
          </div>
        )}

        {selectedThread && !isThreadTakenOver && isAvailable && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="truncate">
                You are marked as <strong>Available</strong>. RidgeLine AI Dispatcher is currently managing replies, or you can take over directly.
              </p>
            </div>
            <button
              onClick={() => handleToggleTakeover(true)}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline shrink-0 cursor-pointer"
            >
              Take Over Conversation &rarr;
            </button>
          </div>
        )}

        {selectedThread && !isThreadTakenOver && !isAvailable && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <p className="truncate">
                Technician is <strong>On Service Call</strong>. RidgeLine AI Dispatcher is actively handling customer conversations &amp; scheduling.
              </p>
            </div>
            <button
              onClick={() => {
                if (setTradespersonStatus) setTradespersonStatus('available');
                handleToggleTakeover(true);
              }}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 underline shrink-0 cursor-pointer"
            >
              Switch to Available &amp; Take Over &rarr;
            </button>
          </div>
        )}

        {/* Optional Simulator Panel (Collapsible) */}
        {showSimulateDrawer && selectedThread && (
          <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-200/80 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                <FlaskConical className="h-3.5 w-3.5 text-amber-700" />
                <span>Simulate Inbound SMS from {selectedThread.customerName}</span>
              </div>
              <button 
                onClick={() => setShowSimulateDrawer(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-amber-800 mb-2">
              {isThreadTakenOver 
                ? "Because you have taken over, the incoming message will arrive without AI auto-reply, allowing you to respond manually."
                : "RidgeLine AI Dispatcher is active and will automatically parse intent, check calendar availability, and formulate an instant reply."}
            </p>

            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => handleSendSimulatedCustomerSms("Hi, can we reschedule tomorrow's appointment to 2:00 PM?")}
                className="text-[11px] bg-white text-neutral-800 border border-amber-300 rounded px-2 py-1 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                "Can we reschedule to 2:00 PM?"
              </button>
              <button
                type="button"
                onClick={() => handleSendSimulatedCustomerSms("How much do you charge for a water heater inspection?")}
                className="text-[11px] bg-white text-neutral-800 border border-amber-300 rounded px-2 py-1 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                "How much for water heater inspection?"
              </button>
              <button
                type="button"
                onClick={() => handleSendSimulatedCustomerSms("Yes, tomorrow morning works great! Please confirm.")}
                className="text-[11px] bg-white text-neutral-800 border border-amber-300 rounded px-2 py-1 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                "Yes, tomorrow morning works!"
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={simCustomerText}
                onChange={(e) => setSimCustomerText(e.target.value)}
                placeholder="Or type custom customer message..."
                className="flex-1 text-xs bg-white border border-amber-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendSimulatedCustomerSms();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleSendSimulatedCustomerSms()}
                disabled={!simCustomerText.trim() || isAiThinking}
                className="px-3 py-1.5 bg-amber-700 text-white rounded text-xs font-semibold hover:bg-amber-800 disabled:opacity-50 cursor-pointer"
              >
                Simulate Inbound
              </button>
            </div>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-neutral-50/20">
          {selectedThread?.messages.map((msg) => {
            const isCustomer = msg.sender === 'customer';
            const isAi = msg.sender === 'assistant';
            const isTradesperson = msg.sender === 'tradesperson';

            // Determine accurate sender name based on conversation history
            const displayedSenderName = isCustomer
              ? `${selectedThread.customerName} (Client SMS)`
              : isAi
              ? 'RidgeLine AI Dispatcher'
              : `${msg.senderName || currentUserName} (Live Operator)`;

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
              >
                {/* Sender badge */}
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 mb-1 px-1">
                  {isCustomer && (
                    <span className="font-medium text-neutral-700 flex items-center gap-1">
                      <User className="h-2.5 w-2.5 text-neutral-500" />
                      {displayedSenderName}
                    </span>
                  )}
                  {isAi && (
                    <span className="flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.2 rounded border border-indigo-100">
                      <AIIcon className="h-2.5 w-2.5 text-indigo-600" />
                      RidgeLine AI Dispatcher
                    </span>
                  )}
                  {isTradesperson && (
                    <span className="flex items-center gap-1 font-semibold text-blue-800 bg-blue-50/80 px-1.5 py-0.2 rounded border border-blue-200">
                      <ShieldCheck className="h-3 w-3 text-blue-600" />
                      {displayedSenderName}
                    </span>
                  )}
                  <span>·</span>
                  <span className="font-mono">{msg.timestamp}</span>
                </div>

                {/* Message Bubble */}
                <div 
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-2xs ${
                    isCustomer 
                      ? 'bg-white text-neutral-900 border border-neutral-200 rounded-tl-xs' 
                      : isAi
                      ? 'bg-neutral-900 text-white rounded-tr-xs'
                      : 'bg-blue-600 text-white rounded-tr-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Action Tag if performed by AI */}
                {msg.actionTag && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-neutral-600 font-medium px-1">
                    <CheckCheck className="h-3 w-3 text-emerald-600" />
                    <span>
                      {msg.actionTag === 'auto_booked' && 'Confirmed on Technician Dispatch Board'}
                      {msg.actionTag === 'rescheduled' && 'Rescheduled in Calendar'}
                      {msg.actionTag === 'quote_given' && 'Estimated Pricing Quoted'}
                      {msg.actionTag === 'emergency_escalated' && 'Emergency Priority Flagged'}
                      {msg.actionTag === 'slot_offered' && 'Slot Availability Offered'}
                      {msg.actionTag === 'info_requested' && 'Address / Details Requested'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* AI Thinking Animation */}
          {isAiThinking && (
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 text-[10px] text-neutral-500 mb-1">
                <AIIcon className="h-2.5 w-2.5 text-indigo-600 animate-spin" />
                <span>RidgeLine is parsing intent &amp; calendar schedule...</span>
              </div>
              <div className="bg-neutral-900 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Live Operator Input Form */}
        <div className="border-t border-neutral-200 bg-neutral-50/80 p-3">
          <form 
            onSubmit={handleSendOperatorMessage}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isThreadTakenOver
                    ? `Reply directly to ${selectedThread?.customerName} as ${currentUserName}...`
                    : isAvailable
                    ? `Type to take over and reply directly as ${currentUserName}...`
                    : `Reply as ${currentUserName} (takes over from AI Dispatcher)...`
                }
                className="w-full text-xs bg-white border border-neutral-300 rounded-md px-3 py-2.5 pr-10 focus:outline-none focus:ring-1 focus:ring-neutral-900 shadow-2xs"
                disabled={isAiThinking}
              />
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || isAiThinking}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-md text-white transition-colors shadow-xs cursor-pointer ${
                isThreadTakenOver
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-neutral-900 hover:bg-neutral-800'
              } disabled:opacity-50`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send as {currentUserName.split(' ')[0]}</span>
            </button>
          </form>

          <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-500">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 font-medium">
                {isThreadTakenOver ? (
                  <span className="text-blue-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Sending as {currentUserName}
                  </span>
                ) : (
                  <span className="text-neutral-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-indigo-500" /> RidgeLine AI Dispatcher Active
                  </span>
                )}
              </span>
              <span>·</span>
              <span>SMS routed through Twilio: <span className="font-mono">{settings.twilioPhoneNumber}</span></span>
            </div>

            {!isThreadTakenOver && (
              <button
                type="button"
                onClick={() => handleToggleTakeover(true)}
                className="text-neutral-700 hover:text-neutral-900 underline font-medium cursor-pointer"
              >
                Take Over Conversation
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
