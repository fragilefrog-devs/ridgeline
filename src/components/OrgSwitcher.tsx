import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronsUpDown, 
  Check, 
  Plus, 
  Wrench, 
  Flame, 
  Zap, 
  Building2,
  Sparkles
} from 'lucide-react';
import { Organization, TradeType } from '../types';
import { RidgeLineLogo } from './RidgeLineLogo';

interface OrgSwitcherProps {
  organizations: Organization[];
  currentOrg: Organization;
  onSelectOrg: (org: Organization) => void;
  onAddOrg: (newOrg: Omit<Organization, 'id'>) => void;
  isCollapsed?: boolean;
}

export const OrgSwitcher: React.FC<OrgSwitcherProps> = ({
  organizations,
  currentOrg,
  onSelectOrg,
  onAddOrg,
  isCollapsed = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newTrade, setNewTrade] = useState<TradeType>('plumbing');
  const [newTechName, setNewTechName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getTradeIcon = (trade: TradeType) => {
    switch (trade) {
      case 'plumbing':
        return <Wrench className="h-3.5 w-3.5 text-blue-600" />;
      case 'hvac':
        return <Flame className="h-3.5 w-3.5 text-amber-600" />;
      case 'electrical':
        return <Zap className="h-3.5 w-3.5 text-yellow-500" />;
      default:
        return <Building2 className="h-3.5 w-3.5 text-neutral-600" />;
    }
  };

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    onAddOrg({
      name: newOrgName,
      trade: newTrade,
      technicianName: newTechName || 'Technician',
      plan: 'Solo Pro',
      twilioPhoneNumber: '+1 (555) ' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(1000 + Math.random() * 9000),
    });

    setNewOrgName('');
    setNewTechName('');
    setIsAdding(false);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Toggle Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        title={`Switch Organization (${currentOrg.name})`}
        className={`w-full flex items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-neutral-100 ${
          isOpen ? 'bg-neutral-100 ring-1 ring-neutral-200' : ''
        } ${isCollapsed ? 'justify-center p-1' : ''}`}
      >
        {/* Refined RidgeLine Logo */}
        <RidgeLineLogo size={32} />

        {/* Text Details (hidden in collapsed icon mode) */}
        {!isCollapsed && (
          <>
            <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
              <span className="truncate font-bold text-neutral-900 tracking-tight font-head">
                RidgeLine
              </span>
              <span className="truncate text-[10px] text-neutral-500 font-medium">
                {currentOrg.name}
              </span>
            </div>
            <ChevronsUpDown className={`h-3.5 w-3.5 text-neutral-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
          
          <div className="px-2 py-1.5 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Workspaces &amp; Trades
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              {organizations.length} available
            </span>
          </div>

          {/* Org list */}
          <div className="py-1 space-y-0.5 max-h-56 overflow-y-auto">
            {organizations.map((org) => {
              const isSelected = org.id === currentOrg.id;

              return (
                <button
                  key={org.id}
                  onClick={() => {
                    onSelectOrg(org);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                    isSelected 
                      ? 'bg-neutral-100 text-neutral-900 font-semibold' 
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 shrink-0 border border-neutral-200">
                      {getTradeIcon(org.trade)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs">{org.name}</p>
                      <p className="text-[10px] text-neutral-400 font-normal truncate">
                        {org.technicianName} · {org.plan}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-neutral-900 shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-neutral-100" />

          {/* Add organization action or mini-form */}
          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-neutral-300">
                <Plus className="h-3 w-3 text-neutral-500" />
              </div>
              <span>Add Organization</span>
            </button>
          ) : (
            <form onSubmit={handleCreateOrg} className="p-2 bg-neutral-50 rounded-lg space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Business Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Electric Pro"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Primary Trade</label>
                <select
                  value={newTrade}
                  onChange={(e) => setNewTrade(e.target.value as TradeType)}
                  className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="locksmith">Locksmith</option>
                  <option value="general">General Contractor</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Technician Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dave Miller"
                  value={newTechName}
                  onChange={(e) => setNewTechName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded px-2 py-1 text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 text-[11px] font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800"
                >
                  Create
                </button>
              </div>
            </form>
          )}

        </div>
      )}
    </div>
  );
};
