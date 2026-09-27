import React, { useState } from 'react';
import { 
  Building2, 
  DollarSign, 
  Phone, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Wrench, 
  Clock, 
  ShieldCheck, 
  MapPin, 
  Radio, 
  AlertTriangle,
  PlusCircle,
  Play,
  Check
} from 'lucide-react';
import { User, TradeType, AssistantSettings, TradeService, Organization } from '../types';
import { RidgeLineLogo } from './RidgeLineLogo';
import { AIIcon } from './AIIcon';
import { apiFetch } from '../lib/apiFetch';

interface OnboardingWizardProps {
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

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
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

      showToast(`Setup complete! Welcome to RidgeLine, ${technicianName}.`);
      onComplete(createdOrg, createdSettings, formattedServices);
    } catch (err: any) {
      showToast('Error saving onboarding data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Top Header / Progress Indicator */}
        <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RidgeLineLogo size={28} />
              <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                RidgeLine Setup Wizard
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-500 font-semibold">
              Step {step} of 4
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="mt-3 flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  s < step 
                    ? 'bg-emerald-600' 
                    : s === step 
                    ? 'bg-neutral-900' 
                    : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* STEP 1: TRADE & IDENTITY */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Your Trade &amp; Business Profile</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  RidgeLine introduces itself with your company name when responding to homeowners.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                    placeholder="e.g. Apex Plumbing & Mechanical"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Primary Trade Specialization
                  </label>
                  <select
                    value={tradeType}
                    onChange={e => handleTradeChange(e.target.value as TradeType)}
                    className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs focus:ring-2 focus:ring-neutral-900 focus:outline-none bg-white font-medium"
                  >
                    <option value="plumbing">Plumbing &amp; Water Systems</option>
                    <option value="electrical">Electrical &amp; Lighting</option>
                    <option value="hvac">HVAC &amp; Mechanical Heating/Cooling</option>
                    <option value="locksmith">Locksmith &amp; Access Security</option>
                    <option value="general">General Handyman &amp; Contracting</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Technician / Owner Name
                  </label>
                  <input
                    type="text"
                    value={technicianName}
                    onChange={e => setTechnicianName(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                    placeholder="e.g. Mark"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Trade License Number
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={e => setLicenseNumber(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                    placeholder="e.g. CA-PLUMB-982104"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Service Radius (Miles)
                  </label>
                  <input
                    type="number"
                    value={serviceRadiusMiles}
                    onChange={e => setServiceRadiusMiles(Number(e.target.value))}
                    className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                    min={5}
                    max={150}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: AI VOICE & DISPATCH RULES */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-base font-bold text-neutral-900">AI Personality &amp; Dispatch Rules</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Customize how RidgeLine communicates with homeowners over SMS while you are on tools.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-neutral-700">
                  Assistant Tone of Voice
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'friendly_direct', label: 'Friendly & Direct', desc: 'Warm, personable tone that sounds like a dedicated local dispatcher.' },
                    { id: 'ultra_professional', label: 'Ultra-Professional', desc: 'Formal, precise, licensed contractor language.' },
                    { id: 'concise_fast', label: 'Concise & Fast', desc: 'Ultra-short SMS replies focused strictly on slot confirmation.' },
                  ].map(t => (
                    <div
                      key={t.id}
                      onClick={() => setAiTone(t.id as any)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        aiTone === t.id
                          ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-neutral-900">{t.label}</span>
                        {aiTone === t.id && <Check className="h-3.5 w-3.5 text-neutral-900" />}
                      </div>
                      <p className="text-[11px] text-neutral-500">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-neutral-900 block">Auto-Confirm Routine Bookings</span>
                      <span className="text-[11px] text-neutral-500">Automatically add agreed slots to calendar</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoConfirmRoutine}
                      onChange={e => setAutoConfirmRoutine(e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                  <label className="block font-semibold text-neutral-900 mb-1">
                    Travel Buffer Between Jobs
                  </label>
                  <select
                    value={bufferMinutes}
                    onChange={e => setBufferMinutes(Number(e.target.value))}
                    className="w-full rounded border border-neutral-300 p-1.5 text-xs bg-white"
                  >
                    <option value={30}>30 Minutes buffer</option>
                    <option value={45}>45 Minutes buffer (Recommended)</option>
                    <option value={60}>60 Minutes buffer</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PRICE BOOK CATALOG */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Service Price Book</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    RidgeLine quotes these standard rates when customers ask "how much does it cost?"
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newSrv = { title: 'New Service', price: 100, duration: 1.0, desc: 'Add service description here' };
                      setServices([...services, newSrv]);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
                  >
                    <PlusCircle className="h-3 w-3" />
                    <span>Add Service</span>
                  </button>
                  <span className="text-[11px] font-mono text-neutral-500 uppercase">
                    {tradeType} rates
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {services.map((srv, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1">
                      <span className="font-semibold text-neutral-900 block">{srv.title}</span>
                      <span className="text-[11px] text-neutral-500 line-clamp-1">{srv.desc}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-neutral-200 font-mono">
                        <span className="text-neutral-500">$</span>
                        <input
                          type="number"
                          value={srv.price}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setServices(prev => prev.map((s, i) => i === idx ? { ...s, price: val } : s));
                          }}
                          className="w-14 text-right font-bold text-neutral-900 focus:outline-none"
                        />
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">{srv.duration}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: TELEPHONY & CALL FORWARDING */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Twilio Telephony &amp; Call Forwarding</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  RidgeLine manages your dedicated virtual business number and routes emergency calls.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Radio className="h-4 w-4 text-emerald-600" />
                    <span className="font-bold text-neutral-900">Dedicated RidgeLine Twilio Phone Number</span>
                  </div>
                  <input
                    type="text"
                    value={twilioNumber}
                    onChange={e => setTwilioNumber(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs font-mono font-semibold text-neutral-900 bg-white"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Share this number on your Google Business Profile, truck decal, and website.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Phone className="h-4 w-4 text-neutral-700" />
                    <span className="font-bold text-neutral-900">Personal Mobile (Emergency Call Forwarding)</span>
                  </div>
                  <input
                    type="text"
                    value={forwardNumber}
                    onChange={e => setForwardNumber(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs font-mono font-semibold text-neutral-900 bg-white"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    When active emergencies occur or clients request human voice talk, calls bridge directly here.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Buttons */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as any)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep((step + 1) as any)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer ml-auto"
            >
              <span>Next Step</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinishOnboarding}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer ml-auto disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isSubmitting ? 'Finalizing Setup...' : 'Complete Setup & Launch Dashboard'}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
