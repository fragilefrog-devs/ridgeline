import React, { useState } from 'react';
import { X, PhoneCall, PhoneMissed, Sparkles, AlertTriangle } from 'lucide-react';
import { TradeType } from '../types';

interface SimulateCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateMissedCall: (callerName: string, callerPhone: string, voicemail: string, urgency: 'routine' | 'urgent' | 'emergency') => Promise<void>;
}

export const SimulateCallModal: React.FC<SimulateCallModalProps> = ({
  isOpen,
  onClose,
  onSimulateMissedCall,
}) => {
  const [callerName, setCallerName] = useState('Kevin O\'Connor');
  const [callerPhone, setCallerPhone] = useState('+1 (555) 402-9988');
  const [voicemail, setVoicemail] = useState(
    'Hey Mark, Kevin here. My water heater is spraying water from the bottom valve and pooling in the utility room. Need someone ASAP.'
  );
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('emergency');
  const [isSimulating, setIsSimulating] = useState(false);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: { name: string; phone: string; text: string; urg: 'routine' | 'urgent' | 'emergency' }) => {
    setCallerName(preset.name);
    setCallerPhone(preset.phone);
    setVoicemail(preset.text);
    setUrgency(preset.urg);
  };

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);

    try {
      await onSimulateMissedCall(callerName, callerPhone, voicemail, urgency);
      setIsSimulating(false);
      onClose();
    } catch (err) {
      console.error(err);
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-neutral-200">
        
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <PhoneMissed className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 font-head">
                Simulate Twilio Missed Call
              </h3>
              <p className="text-[11px] text-neutral-500">
                Tests how RidgeLine auto-texts callers within 10s to prevent them calling competitors.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="mt-3.5 space-y-1.5 text-xs">
          <span className="font-semibold text-neutral-700">Select Test Scenario:</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSelectPreset({
                name: 'Kevin O\'Connor',
                phone: '+1 (555) 402-9988',
                text: 'Hey Mark, Kevin here. My 50-gallon water heater is spraying water from the bottom valve and flooding the room. Need urgent help!',
                urg: 'emergency'
              })}
              className="p-2 text-left rounded border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-[11px] transition-colors"
            >
              <span className="font-bold text-red-700 block">⚡ Flooding Heater</span>
              <span className="text-neutral-500">Urgent emergency</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset({
                name: 'Rachel Miller',
                phone: '+1 (555) 719-3321',
                text: 'Hi Mark, our AC compressor outside is making a loud buzzing noise and not blowing cold air. Can you come out this afternoon?',
                urg: 'urgent'
              })}
              className="p-2 text-left rounded border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-[11px] transition-colors"
            >
              <span className="font-bold text-neutral-800 block">❄️ AC Buzzing</span>
              <span className="text-neutral-500">HVAC diagnostic</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset({
                name: 'Greg House',
                phone: '+1 (555) 883-1100',
                text: 'Hello, looking for an estimate to install a new kitchen sink faucet and hook up our dishwasher.',
                urg: 'routine'
              })}
              className="p-2 text-left rounded border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-[11px] transition-colors"
            >
              <span className="font-bold text-neutral-800 block">🔧 Faucet Install</span>
              <span className="text-neutral-500">Routine service</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleTrigger} className="mt-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Caller Name</label>
              <input
                type="text"
                required
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Caller Phone Number</label>
              <input
                type="text"
                required
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 font-mono focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Voicemail Message Left by Caller</label>
            <textarea
              rows={3}
              required
              value={voicemail}
              onChange={(e) => setVoicemail(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-md border border-amber-200 flex items-start gap-2 text-amber-900 text-[11px]">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              RidgeLine's AI will parse this voicemail transcript, synthesize context, and dispatch an instant follow-up SMS to {callerPhone} to lock in the job before they call a competitor!
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSimulating}
              className="px-3.5 py-1.5 rounded text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 font-semibold rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              <PhoneCall className="h-3.5 w-3.5 text-amber-400" />
              <span>{isSimulating ? 'Simulating Ring & Auto-SMS...' : 'Trigger Missed Call'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
