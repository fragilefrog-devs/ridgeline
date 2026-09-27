export type TradeType = 'plumbing' | 'electrical' | 'hvac' | 'locksmith' | 'general';

export type BookingStatus = 'scheduled' | 'en_route' | 'in_progress' | 'completed' | 'cancelled';

export interface JobBooking {
  id: string;
  organizationId?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  tradeType: TradeType;
  serviceTitle: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "09:00 AM - 11:00 AM"
  status: BookingStatus;
  estimateAmount: number;
  notes: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  createdFrom: 'sms' | 'missed_call' | 'manual';
  smsThreadId?: string;
  createdAt: string;
}

export interface SmsMessage {
  id: string;
  threadId: string;
  sender: 'customer' | 'assistant' | 'tradesperson';
  senderName?: string;
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  actionTag?: 'auto_booked' | 'rescheduled' | 'quote_given' | 'emergency_escalated' | 'slot_offered' | 'info_requested';
  parsedIntent?: {
    intent?: 'book' | 'reschedule' | 'cancel' | 'inquiry' | 'emergency' | 'confirm';
    urgency?: 'routine' | 'urgent' | 'emergency';
    serviceType?: string;
    requestedTime?: string;
    senderName?: string;
  };
}

export interface SmsThread {
  id: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  tradeType: TradeType;
  unreadCount: number;
  lastActivity: string;
  status: 'active' | 'booked' | 'rescheduled' | 'closed';
  bookingId?: string;
  isTakenOver?: boolean;
  takenOverBy?: string;
  messages: SmsMessage[];
}

export interface MissedCall {
  id: string;
  callerName: string;
  callerPhone: string;
  timestamp: string;
  durationSeconds: number;
  voicemailTranscript?: string;
  autoSmsSent: boolean;
  autoSmsTimestamp?: string;
  autoSmsReplyReceived: boolean;
  convertedToBooking: boolean;
  bookingId?: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  createdAt?: string;
}

export interface TradeService {
  id: string;
  title: string;
  trade: TradeType;
  durationHours: number;
  basePrice: number;
  description: string;
  isPopular?: boolean;
}

export interface AssistantSettings {
  tradespersonName: string;
  businessName: string;
  tradeType: TradeType;
  twilioPhoneNumber: string;
  forwardCallsTo: string;
  aiTone: 'friendly_direct' | 'ultra_professional' | 'concise_fast';
  autoConfirmRoutine: boolean;
  bufferMinutesBetweenJobs: number;
  workingHours: {
    start: string;
    end: string;
    workWeekends: boolean;
  };
  emergencyKeywords: string[];
  // LLM / AI Engine Settings (OpenAI-compatible vs Gemini)
  llmProvider?: 'openai_compatible' | 'gemini';
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
}

export interface Organization {
  id: string;
  name: string;
  trade: TradeType;
  technicianName: string;
  plan: string;
  twilioPhoneNumber: string;
  forwardCallsTo?: string;
  licenseNumber?: string;
  serviceRadiusMiles?: number;
  businessAddress?: string;
  email?: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'technician' | 'dispatcher';
  organizationId?: string;
  onboardingCompleted: boolean;
  createdAt?: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  history?: JobBooking[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token?: string;
}

