import React, { useState } from 'react';
import { 
  Sliders, 
  Copy, 
  Check, 
  Sparkles, 
  Radio, 
  Clock, 
  ShieldAlert, 
  Phone, 
  RefreshCw
} from 'lucide-react';
import { AssistantSettings } from '../types';

interface SettingsViewProps {
  settings: AssistantSettings;
  onUpdateSettings: (newSettings: AssistantSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [formData, setFormData] = useState<AssistantSettings>(settings);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedVoiceWebhook, setCopiedVoiceWebhook] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const webhookUrl = `${window.location.origin}/api/sms/process`;
  const voiceWebhookUrl = `${window.location.origin}/api/missed-call/process`;

  const copyToClipboard = (text: string, isVoice = false) => {
    navigator.clipboard.writeText(text);
    if (isVoice) {
      setCopiedVoiceWebhook(true);
      setTimeout(() => setCopiedVoiceWebhook(false), 2000);
    } else {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      
      {/* Save Success Banner */}
      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-semibold flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          Settings updated successfully! AI dispatch assistant reconfigured.
        </div>
      )}

      {/* Section 1: Twilio & Supabase Integration Hub */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Radio className="h-4 w-4 text-red-600" />
              Twilio Telephony &amp; Supabase Integration
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Twilio handles SMS delivery and call forwarding; Supabase provides real-time state synchronization.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">Live Realtime Sync Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* Twilio SMS Webhook */}
          <div className="bg-neutral-50 p-3.5 rounded-md border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-800">Twilio SMS Webhook URL</span>
              <span className="text-[10px] text-neutral-500 font-mono">POST</span>
            </div>
            <p className="text-neutral-500 text-[11px]">
              Set this in your Twilio Console under "A Message Comes In":
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full text-xs font-mono bg-white border border-neutral-200 rounded px-2.5 py-1.5 text-neutral-700 select-all"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(webhookUrl, false)}
                className="px-2.5 py-1.5 bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors shrink-0"
              >
                {copiedWebhook ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Twilio Voice / Missed Call Webhook */}
          <div className="bg-neutral-50 p-3.5 rounded-md border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-800">Missed Call Fallback Voice Webhook</span>
              <span className="text-[10px] text-neutral-500 font-mono">POST</span>
            </div>
            <p className="text-neutral-500 text-[11px]">
              Triggers instant auto-SMS when a call rings unanswered for &gt; 15 seconds:
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={voiceWebhookUrl}
                className="w-full text-xs font-mono bg-white border border-neutral-200 rounded px-2.5 py-1.5 text-neutral-700 select-all"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(voiceWebhookUrl, true)}
                className="px-2.5 py-1.5 bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors shrink-0"
              >
                {copiedVoiceWebhook ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Section 2: Assistant Configuration Form */}
      <form onSubmit={handleSave} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs space-y-5">
        <div className="border-b border-neutral-100 pb-3">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            AI Persona &amp; Dispatch Rules
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configure how RidgeLine speaks to your clients and handles your calendar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-neutral-700 mb-1">Contractor / Technician Name</label>
            <input
              type="text"
              required
              value={formData.tradespersonName}
              onChange={(e) => setFormData({ ...formData, tradespersonName: e.target.value })}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Business Name</label>
            <input
              type="text"
              required
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Twilio Dedicated Virtual Number</label>
            <input
              type="text"
              value={formData.twilioPhoneNumber}
              onChange={(e) => setFormData({ ...formData, twilioPhoneNumber: e.target.value })}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 font-mono focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Forward Urgent Calls To (Personal Cell)</label>
            <input
              type="text"
              value={formData.forwardCallsTo}
              onChange={(e) => setFormData({ ...formData, forwardCallsTo: e.target.value })}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 font-mono focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Tone Selector */}
        <div className="space-y-1.5 text-xs">
          <label className="block font-medium text-neutral-700">AI Assistant Tone of Voice</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'friendly_direct',
                title: 'Friendly & Direct (Recommended)',
                desc: 'Warm, blue-collar, speaks like the business owner\'s trusted dispatcher.',
              },
              {
                id: 'ultra_professional',
                title: 'Ultra-Professional',
                desc: 'Formal corporate style, polite, structured confirmation messages.',
              },
              {
                id: 'concise_fast',
                title: 'Quick & Action-Focused',
                desc: 'Minimal words, immediate slot offerings, maximum efficiency.',
              },
            ].map((tone) => (
              <label
                key={tone.id}
                onClick={() => setFormData({ ...formData, aiTone: tone.id as any })}
                className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.aiTone === tone.id
                    ? 'border-neutral-900 bg-neutral-50/80 font-medium'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-neutral-900">{tone.title}</span>
                  <input
                    type="radio"
                    name="tone"
                    checked={formData.aiTone === tone.id}
                    onChange={() => {}}
                    className="accent-neutral-900"
                  />
                </div>
                <span className="text-[11px] text-neutral-500 font-normal leading-relaxed">{tone.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Working Hours & Buffer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-neutral-100">
          <div>
            <label className="block font-medium text-neutral-700 mb-1">Daily Schedule Start</label>
            <input
              type="time"
              value={formData.workingHours.start}
              onChange={(e) => setFormData({
                ...formData,
                workingHours: { ...formData.workingHours, start: e.target.value }
              })}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Daily Schedule End</label>
            <input
              type="time"
              value={formData.workingHours.end}
              onChange={(e) => setFormData({
                ...formData,
                workingHours: { ...formData.workingHours, end: e.target.value }
              })}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Buffer Between Jobs (Mins)</label>
            <input
              type="number"
              min="15"
              step="15"
              value={formData.bufferMinutesBetweenJobs}
              onChange={(e) => setFormData({
                ...formData,
                bufferMinutesBetweenJobs: Number(e.target.value)
              })}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-3 border-t border-neutral-100">
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs"
          >
            Save AI Assistant Configuration
          </button>
        </div>

      </form>

    </div>
  );
};
