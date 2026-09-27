import React, { useState } from 'react';
import { 
  Building2, 
  DollarSign, 
  Phone, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Clock, 
  Radio, 
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import { User, TradeType, AssistantSettings, TradeService, Organization } from '../types';
import { RidgeLineLogo } from '../components/RidgeLineLogo';
import { AIIcon } from '../components/AIIcon';
import { apiFetch } from '../lib/apiFetch';

interface OnboardingPageProps {
  user: User;
  onComplete: (org: Organization, settings: AssistantSettings, services: TradeService[]) => void;
  showToast: (msg: string) => void;
}

const defaultServicesByTrade: Record<TradeType, Array<{ title: string; price: number; duration: number; desc: string }>> = {
  plumbing: [
    { title: 'Water Heater Replacement / Diagnostic', price: 420, duration: 2.5, desc: 'Diagnose pilot assembly, heating elements, or 50-gal tank replacement installation.' },
    { title: 'Main Line Drain Snaking / Hydrojet', price: 285, duration: 1.5, desc: 'Camera inspection + heavy duty 100ft snake rooter for sewer cleanout.' },
    { title: 'Emergency Burst Pipe & Valve Shutoff', price: 380, duration: 2.0, desc: 'Immediate dispatch for active interior leaks and broken fittings.' },
    { title: 'Garbage Disposal & Kitchen Faucet Swap', price: 220, duration: 1.5, desc: 'Replace disposal unit and supply lines under kitchen sink.' },
  ],
  electrical: [
    { title: 'Main Electrical Panel Upgrade (200A)', price: 1850, duration: 4.0, desc: 'Full breaker panel upgrade with grounding and city permit inspection.' },
    { title: 'EV Charger Level 2 Installation', price: 650, duration: 2.5, desc: 'Install 50A dedicated NEMA 14-50 or hardwired Tesla / Universal charger.' },
    { title: 'Emergency Tripping Breaker & Arc Fault Triage', price: 295, duration: 1.5, desc: 'Locate short circuit, replace damaged GFCI/AFCI breakers.' },
    { title: 'Recessed LED Can Lighting Installation (4-pack)', price: 450, duration: 3.0, desc: 'Cut-in slim LED wafers with Lutron dimmer switch wiring.' },
  ],
  hvac: [
    { title: 'Seasonal AC Diagnostic & Refrigerant Top-off', price: 295, duration: 1.5, desc: 'Subcooling/superheat pressure check, capacitor inspection, and coil cleaning.' },
    { title: 'Furnace Igniter & Flame Sensor Repair', price: 340, duration: 2.0, desc: 'Replace hot surface igniter, clean flame sensor, inspect heat exchanger.' },
    { title: 'Smart Thermostat (Ecobee/Nest) Install & C-Wire', price: 195, duration: 1.0, desc: 'Wire 24V common transformer and calibrate multi-stage heat pump.' },
    { title: 'Blower Motor / Run Capacitor Replacement', price: 480, duration: 2.5, desc: 'Diagnose seized blower wheel or failed dual-run capacitor.' },
  ],
  locksmith: [
    { title: 'Emergency Residential Lockout Service', price: 165, duration: 0.5, desc: 'Non-destructive entry for deadbolts and smart keypad locks.' },
    { title: 'Whole-Home Deadbolt Rekeying (Up to 5 locks)', price: 250, duration: 1.5, desc: 'Pin-cylinder rekeying with 4 matching master brass keys.' },
    { title: 'High-Security Commercial Keypad Deadbolt Install', price: 320, duration: 1.5, desc: 'Install ANSI Grade 1 touchscreen smart lock with audit trail.' },
  ],
  general: [
    { title: 'General Handyman & Diagnostics Call (2-Hour Block)', price: 220, duration: 2.0, desc: 'Punch list repairs, door adjustments, drywall patching, hardware.' },
    { title: 'Drywall Repair & Texture Blending', price: 310, duration: 2.5, desc: 'Patch pipe/electrical cuts with hot mud and orange peel texture match.' },
    { title: 'Interior Door Replacement & Trim Hanging', price: 275, duration: 2.0, desc: 'Hang pre-hung solid core door with strike plate calibration.' },
  ],
};

export const OnboardingPage: React.FC<OnboardingPageProps> = ({
  user,
  onComplete,
  showToast,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [businessName, setBusinessName] = useState(user.fullName ? `${user.fullName}'s Trade Services` : 'Apex Trades & Mechanical');
  const [tradeType, setTradeType] = useState<TradeType>('plumbing');
  const [technicianName, setTechnicianName] = useState(user.fullName || 'Mark Kowalski');
  const [licenseNumber, setLicenseNumber] = useState('CA-LIC-982104');
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(30);

  // AI & Dispatch Rules
  const [aiTone, setAiTone] = useState<'friendly_direct' | 'ultra_professional' | 'concise_fast'>('friendly_direct');
  const [autoConfirmRoutine, setAutoConfirmRoutine] = useState(true);
  const [bufferMinutes, setBufferMinutes] = useState(45);
  const [startHour, setStartHour] = useState('07:30');
  const [endHour, setEndHour] = useState('17:30');
  const [workWeekends, setWorkWeekends] = useState(false);

  // Telephony
  const [twilioNumber, setTwilioNumber] = useState('+1 (555) 782-4309');
  const [forwardNumber, setForwardNumber] = useState('+1 (555) 438-9210');

  // Services
  const [services, setServices] = useState<Array<{ title: string; price: number; duration: number; desc: string }>>(
    defaultServicesByTrade['plumbing']
  );

  // When trade changes, update suggested services
  const handleTradeChange = (newTrade: TradeType) => {
    setTradeType(newTrade);
    setServices(defaultServicesByTrade[newTrade] || defaultServicesByTrade['plumbing']);
  };

  const handleAddService = () => {
    setServices([...services, { title: 'New Service', price: 100, duration: 1.0, desc: 'Short description of your service.' }]);
  };

  const handleRemoveService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const data = await apiFetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          businessName,
          tradeType,
          technicianName,
          licenseNumber,
          serviceRadiusMiles,
          twilioPhoneNumber: twilioNumber,
          forwardCallsTo: forwardNumber,
          aiTone,
          autoConfirmRoutine,
          services: services.map(s => ({
            title: s.title,
            basePrice: s.price,
            durationHours: s.duration,
            description: s.desc,
            isPopular: true,
          })),
        }),
      });

      const createdOrg: Organization = {
        id: data.organizationId || `org-${Date.now()}`,
        name: businessName,
        trade: tradeType,
        technicianName,
        plan: 'Solo Pro',
        twilioPhoneNumber: twilioNumber,
        forwardCallsTo: forwardNumber,
        licenseNumber,
        serviceRadiusMiles,
      };

      const createdSettings: AssistantSettings = {
        businessName,
        tradeType,
        tradespersonName: technicianName,
        twilioPhoneNumber: twilioNumber,
        forwardCallsTo: forwardNumber,
        aiTone,
        autoConfirmRoutine,
        bufferMinutesBetweenJobs: bufferMinutes,
        workingHours: {
          start: startHour,
          end: endHour,
          workWeekends,
        },
        emergencyKeywords: ['flood', 'burst', 'leak', 'spark', 'smoke', 'sewage'],
      };

      const formattedServices: TradeService[] = services.map((s, idx) => ({
        id: `srv-init-${idx}`,
        title: s.title,
        trade: tradeType,
        durationHours: s.duration,
        basePrice: s.price,
        description: s.desc,
        isPopular: true,
      }));

      // App's handleOnboardingComplete owns the success toast and the redirect to the dashboard.
      onComplete(createdOrg, createdSettings, formattedServices);
    } catch (err: any) {
      showToast('Error saving onboarding data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-neutral-200 overflow-hidden flex flex-col h-[700px]">
        
        {/* Top Header / Progress Indicator */}
        <div className="border-b border-neutral-100 bg-white px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <RidgeLineLogo size={36} />
              <div className="h-6 w-px bg-neutral-200" />
              <span className="text-sm font-semibold text-neutral-900 font-head">
                Business Setup
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-medium">Step</span>
              <span className="h-7 w-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-semibold">
                {step}
              </span>
              <span className="text-xs text-neutral-400 font-medium">of 4</span>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s}
                className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                  s < step 
                    ? 'bg-neutral-900' 
                    : s === step 
                    ? 'bg-neutral-900 shadow-[0_0_8px_rgba(0,0,0,0.2)]' 
                    : 'bg-neutral-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-10">
          
          {/* STEP 1: TRADE & IDENTITY */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 flex items-center gap-3 font-head">
                  <Building2 className="h-6 w-6 text-neutral-400" />
                  Your Business Profile
                </h3>
                <p className="text-sm text-neutral-500 mt-2">
                  RidgeLine uses these details to represent you accurately when speaking with clients.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 py-2.5 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-colors"
                    placeholder="e.g. Apex Plumbing & Mechanical"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Trade Specialization
                  </label>
                  <select
                    value={tradeType}
                    onChange={e => handleTradeChange(e.target.value as TradeType)}
                    className="w-full rounded-lg border border-neutral-300 py-2.5 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-colors bg-white appearance-none"
                  >
                    <option value="plumbing">Plumbing &amp; Water Systems</option>
                    <option value="electrical">Electrical &amp; Lighting</option>
                    <option value="hvac">HVAC &amp; Mechanical</option>
                    <option value="locksmith">Locksmith &amp; Security</option>
                    <option value="general">Handyman &amp; General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Primary Technician
                  </label>
                  <input
                    type="text"
                    value={technicianName}
                    onChange={e => setTechnicianName(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 py-2.5 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-colors"
                    placeholder="e.g. Mark"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    License Number
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={e => setLicenseNumber(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 py-2.5 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-colors"
                    placeholder="e.g. CA-PLUMB-982104"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Service Radius (Miles)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={serviceRadiusMiles}
                      onChange={e => setServiceRadiusMiles(Number(e.target.value))}
                      className="w-full rounded-lg border border-neutral-300 py-2.5 px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-colors"
                      min={5}
                      max={150}
                    />
                    <span className="absolute right-3 top-2.5 text-neutral-400 text-sm">mi</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: AI VOICE & RULES */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 flex items-center gap-3 font-head">
                  <AIIcon className="h-6 w-6 text-indigo-600" />
                  AI Tone &amp; Rules
                </h3>
                <p className="text-sm text-neutral-500 mt-2">
                  Configure how RidgeLine interacts with your customers.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[
                  { id: 'friendly_direct', label: 'Friendly & Direct', desc: 'Personable tone, sounds like a local dispatcher.' },
                  { id: 'ultra_professional', label: 'Ultra-Professional', desc: 'Formal, precise language for high-end contracting.' },
                  { id: 'concise_fast', label: 'Concise & Fast', desc: 'Ultra-short replies focused strictly on slot confirmation.' },
                ].map(t => (
                  <div
                    key={t.id}
                    onClick={() => setAiTone(t.id as any)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors flex items-start justify-between gap-4 ${
                      aiTone === t.id
                        ? 'border-neutral-900 bg-white shadow-sm'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-neutral-900">{t.label}</span>
                      <p className="text-xs mt-1 text-neutral-500">{t.desc}</p>
                    </div>
                    {aiTone === t.id && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white flex items-center justify-between gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900">Auto-Confirm Bookings</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    RidgeLine will automatically add routine jobs to your calendar when a customer agrees to a slot.
                  </p>
                </div>
                <div 
                  onClick={() => setAutoConfirmRoutine(!autoConfirmRoutine)}
                  className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 ${autoConfirmRoutine ? 'bg-emerald-500' : 'bg-neutral-200'}`}
                >
                  <div className={`h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${autoConfirmRoutine ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PRICE BOOK */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-900 flex items-center gap-3 font-head">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                    Service Price Book
                  </h3>
                  <p className="text-sm text-neutral-500 mt-2">
                    Set your standard rates for common jobs.
                  </p>
                </div>
                <button 
                  onClick={handleAddService}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Service</span>
                </button>
              </div>

              <div className="space-y-4">
                {services.length === 0 ? (
                  <div className="p-10 text-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50">
                    <DollarSign className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
                    <p className="text-sm text-neutral-500">Your price book is empty.</p>
                    <button 
                      onClick={handleAddService}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add First Service</span>
                    </button>
                  </div>
                ) : (
                  services.map((srv, idx) => (
                  <div key={idx} className="group relative p-4 rounded-lg border border-neutral-200 bg-white transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={srv.title}
                          onChange={e => {
                            setServices(prev => prev.map((s, i) => i === idx ? { ...s, title: e.target.value } : s));
                          }}
                          className="w-full bg-transparent text-sm font-semibold text-neutral-900 focus:outline-none placeholder:text-neutral-300"
                          placeholder="Service Title"
                        />
                        <input
                          type="text"
                          value={srv.desc}
                          onChange={e => {
                            setServices(prev => prev.map((s, i) => i === idx ? { ...s, desc: e.target.value } : s));
                          }}
                          className="w-full bg-transparent text-xs text-neutral-500 focus:outline-none placeholder:text-neutral-300"
                          placeholder="Brief description..."
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-neutral-300">
                          <span className="text-neutral-400 text-sm">$</span>
                          <input
                            type="number"
                            value={srv.price}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setServices(prev => prev.map((s, i) => i === idx ? { ...s, price: val } : s));
                            }}
                            className="w-16 text-right text-sm text-neutral-900 focus:outline-none bg-transparent tabular-nums"
                          />
                        </div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-neutral-300">
                          <Clock className="h-4 w-4 text-neutral-400" />
                          <input
                            type="number"
                            step="0.5"
                            value={srv.duration}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setServices(prev => prev.map((s, i) => i === idx ? { ...s, duration: val } : s));
                            }}
                            className="w-12 text-center text-sm text-neutral-900 focus:outline-none bg-transparent tabular-nums"
                          />
                          <span className="text-neutral-400 text-xs">hr</span>
                        </div>
                        <button 
                          onClick={() => handleRemoveService(idx)}
                          className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )))}
              </div>
            </div>
          )}

          {/* STEP 4: TELEPHONY */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 flex items-center gap-3 font-head">
                  <Radio className="h-4 w-4 text-neutral-400" />
                  Telephony Setup
                </h3>
                <p className="text-sm text-neutral-500 mt-2">
                  Connect your business line to the RidgeLine dispatch engine.
                </p>
              </div>

              <div className="space-y-6">
                <div className="p-6 rounded-lg border border-neutral-200 bg-white">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Your RidgeLine Smart Number
                  </label>
                  <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 p-4 rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                      <Phone className="h-6 w-6" />
                    </div>
                    <input
                      type="text"
                      value={twilioNumber}
                      onChange={e => setTwilioNumber(e.target.value)}
                      className="flex-1 bg-transparent text-lg text-neutral-900 focus:outline-none tabular-nums"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Clients will text this number to book. Inbound calls are auto-transcribed for the AI.
                  </p>
                </div>

                <div className="p-6 rounded-lg border border-neutral-200 bg-white">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Emergency Call Forwarding
                  </label>
                  <div className="flex items-center gap-3 border border-neutral-300 p-3 rounded-lg bg-white focus-within:border-neutral-900 transition-colors">
                    <Radio className="h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={forwardNumber}
                      onChange={e => setForwardNumber(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-neutral-900 focus:outline-none tabular-nums"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Active emergency calls are bridged directly to your personal mobile.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Buttons */}
        <div className="border-t border-neutral-100 bg-white px-8 py-5 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as any)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep((step + 1) as any)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer group"
            >
              <span>Next Step</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button
              onClick={handleFinishOnboarding}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer disabled:opacity-70"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>{isSubmitting ? 'Launching...' : 'Finish & Launch'}</span>
            </button>
          )}
        </div>

      </div>
      
      <p className="mt-6 text-[10px] text-neutral-400 uppercase tracking-wider font-bold">
        RidgeLine Autonomous Dispatch Engine v2.0
      </p>
    </div>
  );
};
