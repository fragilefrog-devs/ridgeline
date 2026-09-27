import React, { useState } from 'react';
import { 
  Building2, 
  DollarSign, 
  CreditCard, 
  Plus, 
  Trash2, 
  Clock, 
  Phone, 
  AlertTriangle,
  LogOut
} from 'lucide-react';
import { Organization, AssistantSettings, TradeService, TradeType } from '../types';
import { formatCurrency } from '../lib/utils';
import { RidgeLineLogo } from './RidgeLineLogo';
import { AIIcon } from './AIIcon';

export type SettingsSubTab = 'general' | 'rates' | 'ai_dispatcher' | 'billing';

interface OrganizationSettingsProps {
  currentOrg: Organization;
  onUpdateOrg: (updatedOrg: Organization) => void;
  settings: AssistantSettings;
  onUpdateSettings: (newSettings: AssistantSettings) => void;
  services: TradeService[];
  onAddService: (newService: Omit<TradeService, 'id'>) => void;
  onDeleteService: (id: string) => void;
  activeSubTab?: SettingsSubTab;
  onChangeSubTab?: (tab: SettingsSubTab) => void;
  showToast: (msg: string) => void;
  onOpenOnboarding?: () => void;
  onLogout?: () => void;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({
  currentOrg,
  onUpdateOrg,
  settings,
  onUpdateSettings,
  services,
  onAddService,
  onDeleteService,
  activeSubTab = 'general',
  onChangeSubTab,
  showToast,
  onOpenOnboarding,
  onLogout,
}) => {
  const [currentTab, setCurrentTab] = useState<SettingsSubTab>(activeSubTab);
  
  // Organization form state
  const [orgForm, setOrgForm] = useState<Organization>({
    ...currentOrg,
    businessAddress: currentOrg.businessAddress || '104 Industrial Way, Suite B, Springfield',
    licenseNumber: currentOrg.licenseNumber || 'CA-PLUMB-982104',
    serviceRadiusMiles: currentOrg.serviceRadiusMiles || 25,
    email: currentOrg.email || 'dispatch@apexplumbingpro.com',
    // The forwarding number lives on the org row, but older orgs only have it on
    // assistant_settings — fall back so the field is never silently blanked.
    forwardCallsTo: currentOrg.forwardCallsTo || settings.forwardCallsTo || '',
  });

  // Assistant Settings form state
  const [aiForm, setAiForm] = useState<AssistantSettings>(settings);

  // Service form state
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTrade, setNewTrade] = useState<TradeType>(currentOrg.trade || 'plumbing');
  const [newPrice, setNewPrice] = useState<number>(250);
  const [newDuration, setNewDuration] = useState<number>(2);
  const [newDesc, setNewDesc] = useState('');

  const handleTabChange = (tab: SettingsSubTab) => {
    setCurrentTab(tab);
    onChangeSubTab?.(tab);
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateOrg(orgForm);
    // Also sync businessName and technicianName to AssistantSettings
    onUpdateSettings({
      ...settings,
      businessName: orgForm.name,
      tradespersonName: orgForm.technicianName,
      tradeType: orgForm.trade,
      twilioPhoneNumber: orgForm.twilioPhoneNumber,
      forwardCallsTo: orgForm.forwardCallsTo || '',
    });
    showToast(`Organization details for "${orgForm.name}" updated successfully.`);
  };

  const handleSaveAi = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(aiForm);
    showToast('AI Dispatcher rules updated.');
  };

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddService({
      title: newTitle,
      trade: newTrade,
      basePrice: Number(newPrice),
      durationHours: Number(newDuration),
      description: newDesc || 'Standard trade service diagnostic and repair.',
      isPopular: false,
    });

    setNewTitle('');
    setNewDesc('');
    setNewPrice(250);
    setNewDuration(2);
    setShowAddServiceForm(false);
    showToast(`Service "${newTitle}" added to catalog.`);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Header */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <RidgeLineLogo size={42} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-neutral-900 font-head">
                  {currentOrg.name}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                  {currentOrg.trade}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {currentOrg.plan}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Manage organization profile, calling numbers, service rates catalog, and AI persona.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            {onOpenOnboarding && (
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <AIIcon className="h-3.5 w-3.5 text-indigo-600" />
                <span>Launch Setup Wizard</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-100 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            )}

            <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
              <span>RidgeLine number:</span>
              <span className="font-semibold text-neutral-900">{currentOrg.twilioPhoneNumber}</span>
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-neutral-100 mt-5 pt-3 text-xs scrollbar-none">
          <button
            onClick={() => handleTabChange('general')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              currentTab === 'general'
                ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>General &amp; Profile</span>
          </button>

          <button
            onClick={() => handleTabChange('rates')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              currentTab === 'rates'
                ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>Service Rates ({services.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('ai_dispatcher')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              currentTab === 'ai_dispatcher'
                ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <AIIcon className="h-3.5 w-3.5" />
            <span>AI Dispatcher &amp; Tone</span>
          </button>

          <button
            onClick={() => handleTabChange('billing')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              currentTab === 'billing'
                ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Plan &amp; Billing</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: GENERAL & PROFILE */}
      {currentTab === 'general' && (
        <form onSubmit={handleSaveOrg} className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
            <div className="border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 font-head">
                Organization Profile &amp; Territory
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                The AI dispatcher uses these business credentials on quote headers and customer SMS confirmations.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 mb-1">Company / DBA Name</label>
                <input
                  type="text"
                  required
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 mb-1">Primary Trade Industry</label>
                <select
                  value={orgForm.trade}
                  onChange={(e) => setOrgForm({ ...orgForm, trade: e.target.value as TradeType })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 focus:bg-white focus:outline-none"
                >
                  <option value="plumbing">Plumbing &amp; Mechanical</option>
                  <option value="electrical">Electrical &amp; EV Systems</option>
                  <option value="hvac">HVAC &amp; Heat Pumps</option>
                  <option value="locksmith">Locksmith &amp; Access Control</option>
                  <option value="general">General Contracting</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 mb-1">Lead Dispatch Technician / Owner</label>
                <input
                  type="text"
                  required
                  value={orgForm.technicianName}
                  onChange={(e) => setOrgForm({ ...orgForm, technicianName: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 mb-1">Contractor License / Certification #</label>
                <input
                  type="text"
                  value={orgForm.licenseNumber}
                  onChange={(e) => setOrgForm({ ...orgForm, licenseNumber: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 mb-1">Primary Shop / Yard Address</label>
                <input
                  type="text"
                  value={orgForm.businessAddress}
                  onChange={(e) => setOrgForm({ ...orgForm, businessAddress: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 mb-1">Service Radius (Miles from Shop)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={orgForm.serviceRadiusMiles}
                    onChange={(e) => setOrgForm({ ...orgForm, serviceRadiusMiles: Number(e.target.value) })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 focus:bg-white focus:outline-none font-mono"
                  />
                  <span className="text-neutral-500 shrink-0 font-medium">miles</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-100">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs"
              >
                Save Organization Profile
              </button>
            </div>
          </div>

          {/* Calling */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
            <div className="border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2 font-head">
                <Phone className="h-4 w-4 text-neutral-700" />
                Calling
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                The number customers call, and the phone it rings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label htmlFor="ridgeline-number" className="block font-medium text-neutral-700 mb-1">Your RidgeLine number</label>
                <input
                  id="ridgeline-number"
                  type="text"
                  readOnly
                  onChange={() => {}}
                  value={currentOrg.twilioPhoneNumber || ''}
                  placeholder="Not yet provisioned"
                  className="w-full bg-neutral-100 border border-neutral-200 rounded px-3 py-1.5 text-neutral-600 font-mono cursor-default"
                />
                <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
                  Provisioned for your business by RidgeLine. This is the number customers should call — put it on your trucks, cards, and listings.
                </p>
              </div>

              <div>
                <label htmlFor="forward-calls-to" className="block font-medium text-neutral-700 mb-1">Your phone number</label>
                <input
                  id="forward-calls-to"
                  type="tel"
                  value={orgForm.forwardCallsTo || ''}
                  onChange={(e) => setOrgForm({ ...orgForm, forwardCallsTo: e.target.value })}
                  placeholder="e.g. (555) 555-0100"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 text-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
                  Calls ring here when a customer calls your business line.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-100">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs"
              >
                Save Calling Details
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB 2: SERVICE RATES & CATALOG */}
      {currentTab === 'rates' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Service Rates &amp; Pricing Guardrails
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                RidgeLine AI parses customer requests and automatically quotes these rates and duration slots over SMS.
              </p>
            </div>

            <button
              onClick={() => setShowAddServiceForm(!showAddServiceForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showAddServiceForm ? 'Cancel' : 'Add Service'}</span>
            </button>
          </div>

          {/* Add Service Drawer */}
          {showAddServiceForm && (
            <form onSubmit={handleCreateService} className="bg-white p-4 rounded-xl border border-neutral-300 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-neutral-900">Add Service to AI Catalog</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">Service Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tankless Water Heater Flush"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">Trade Category</label>
                  <select
                    value={newTrade}
                    onChange={(e) => setNewTrade(e.target.value as TradeType)}
                    className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white focus:outline-none"
                  >
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="hvac">HVAC</option>
                    <option value="locksmith">Locksmith</option>
                    <option value="general">General Contractor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">Base Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-700 mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="8"
                    step="0.5"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-700 mb-1">Scope / Description</label>
                <input
                  type="text"
                  placeholder="What is included in this standard diagnostic or repair?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddServiceForm(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold rounded bg-neutral-900 text-white hover:bg-neutral-800"
                >
                  Save Service
                </button>
              </div>
            </form>
          )}

          {/* Service Rate Items */}
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-xs divide-y divide-neutral-100">
            {services.map((service) => (
              <div key={service.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-neutral-900">
                      {service.title}
                    </h4>
                    <span className="text-[10px] uppercase font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {service.trade}
                    </span>
                    {service.isPopular && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                        High Demand
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 max-w-xl">
                    {service.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <div className="text-right">
                    <div className="text-sm font-bold text-neutral-900 font-mono tabular-nums">
                      {formatCurrency(service.basePrice)}
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{service.durationHours} hrs</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteService(service.id)}
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove from catalog"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: AI DISPATCHER & TONE */}
      {currentTab === 'ai_dispatcher' && (
        <form onSubmit={handleSaveAi} className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-5">
            <div className="border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2 font-head">
                <AIIcon className="h-4 w-4 text-indigo-600" />
                AI Assistant Personality &amp; Autonomous Dispatch Rules
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Set how RidgeLine speaks to your clients, resolves reschedules, and filters emergency jobs.
              </p>
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
                    onClick={() => setAiForm({ ...aiForm, aiTone: tone.id as any })}
                    className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-colors ${
                      aiForm.aiTone === tone.id
                        ? 'border-neutral-900 bg-neutral-50/80 font-medium ring-1 ring-neutral-900'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-neutral-900">{tone.title}</span>
                      <input
                        type="radio"
                        name="aiTone"
                        checked={aiForm.aiTone === tone.id}
                        onChange={() => {}}
                        className="accent-neutral-900"
                      />
                    </div>
                    <span className="text-[11px] text-neutral-500 font-normal leading-relaxed">{tone.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Schedule & Timing Guardrails */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-neutral-100">
              <div>
                <label className="block font-medium text-neutral-700 mb-1">Daily Route Start</label>
                <input
                  type="time"
                  value={aiForm.workingHours.start}
                  onChange={(e) => setAiForm({
                    ...aiForm,
                    workingHours: { ...aiForm.workingHours, start: e.target.value }
                  })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 mb-1">Daily Route End</label>
                <input
                  type="time"
                  value={aiForm.workingHours.end}
                  onChange={(e) => setAiForm({
                    ...aiForm,
                    workingHours: { ...aiForm.workingHours, end: e.target.value }
                  })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 mb-1">Drive Buffer Between Jobs (Mins)</label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={aiForm.bufferMinutesBetweenJobs}
                  onChange={(e) => setAiForm({
                    ...aiForm,
                    bufferMinutesBetweenJobs: Number(e.target.value)
                  })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white font-mono"
                />
              </div>
            </div>

            {/* Emergency Keywords */}
            <div className="space-y-1.5 text-xs pt-2 border-t border-neutral-100">
              <label className="block font-medium text-neutral-700">Emergency Triage Keywords (Auto-Escalate)</label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                {aiForm.emergencyKeywords.map((kw, idx) => (
                  <span key={idx} className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {kw}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-neutral-500">
                When customers text these words, RidgeLine provides immediate safety shutoff guidance and offers priority same-day slots.
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-100">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs"
              >
                Save AI Assistant Rules
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB 4: PLAN & BILLING */}
      {currentTab === 'billing' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
            <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2 font-head">
                  <CreditCard className="h-4 w-4 text-neutral-700" />
                  Subscription &amp; Usage
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  RidgeLine Solo Pro subscription for {currentOrg.name}.
                </p>
              </div>

              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded">
                Active Plan: Solo Pro
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 space-y-1">
                <span className="text-[11px] text-neutral-500 font-medium">Monthly Investment</span>
                <p className="text-xl font-bold font-mono count-up tabular-nums text-neutral-900">$79.00 / mo</p>
                <p className="text-[11px] text-neutral-500">Next renewal: <span className="font-mono">Oct 15, 2026</span></p>
              </div>

              <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 space-y-1">
                <span className="text-[11px] text-neutral-500 font-medium">SMS Messages Processed</span>
                <p className="text-xl font-bold font-mono count-up tabular-nums text-neutral-900">482 Texts</p>
                <p className="text-[11px] text-emerald-600 font-medium">Unlimited included</p>
              </div>

              <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 space-y-1">
                <span className="text-[11px] text-neutral-500 font-medium">Missed Calls Converted</span>
                <p className="text-xl font-bold font-mono count-up tabular-nums text-neutral-900">22 of 25 (88%)</p>
                <p className="text-[11px] text-neutral-500">Estimated value saved: <span className="font-mono count-up tabular-nums">$14,850</span></p>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-neutral-700">
                <CreditCard className="h-4 w-4 text-neutral-500" />
                <span>Visa ending in <b>4921</b> (Expires 08/28)</span>
              </div>
              <button
                type="button"
                onClick={() => showToast('Payment method update portal requested.')}
                className="text-xs font-semibold text-neutral-900 hover:underline"
              >
                Update Card
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
