import React from 'react';
import { Plus, Sparkles, User as UserIcon, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { AssistantSettings, User } from '../types';
import { SidebarTrigger } from './ui/sidebar';
import { SettingsSubTab } from './OrganizationSettings';

interface HeaderProps {
  activeTab: 'overview' | 'dispatch' | 'sms' | 'missed_calls' | 'customers' | 'services' | 'settings';
  setActiveTab: (tab: 'overview' | 'dispatch' | 'sms' | 'missed_calls' | 'customers' | 'services' | 'settings') => void;
  settingsSubTab?: SettingsSubTab;
  settings: AssistantSettings;
  unreadSmsCount: number;
  unconvertedCallsCount: number;
  onOpenNewBooking: () => void;
  neonConnected?: boolean;
  neonLatency?: number;
  user?: User | null;
  onLogout?: () => void;
  isDataLoading?: boolean;
  onRefreshData?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  settingsSubTab = 'general',
  settings,
  onOpenNewBooking,
  neonConnected = true,
  neonLatency = 780,
  user,
  onLogout,
  isDataLoading = false,
  onRefreshData,
}) => {
  // Breadcrumb title helper
  const getTabTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Overview Dashboard';
      case 'dispatch':
        return 'Dispatch Board & Schedule';
      case 'sms':
        return 'SMS Autonomous Inbox';
      case 'missed_calls':
        return 'Missed Call Recovery Pipeline';
      case 'customers':
        return 'Customer Profiles';
      case 'services':
        return 'Organization Settings · Service Rates';
      case 'settings':
        if (settingsSubTab === 'general') return 'Organization Settings · Profile';
        if (settingsSubTab === 'rates') return 'Organization Settings · Service Rates';
        if (settingsSubTab === 'ai_dispatcher') return 'Organization Settings · AI Dispatcher';
        if (settingsSubTab === 'billing') return 'Organization Settings · Plan & Billing';
        return 'Organization Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white/95 px-3 sm:px-6 backdrop-blur">
      
      {/* Zone 1: Sidebar Toggle Trigger + Context Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <SidebarTrigger />
        
        <div className="h-4 w-px bg-neutral-200 shrink-0" />

        <div className="flex items-center gap-1.5 sm:gap-2 text-xs min-w-0">
          <span className="font-semibold text-neutral-900 font-head truncate max-w-[100px] sm:max-w-none">
            {settings.businessName}
          </span>
          <span className="text-neutral-400 shrink-0">/</span>
          <span className="font-medium text-neutral-600 truncate max-w-[110px] sm:max-w-none">
            {getTabTitle()}
          </span>
        </div>
      </div>

      {/* Zone 2: Primary Action */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            disabled={isDataLoading}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition-colors shadow-2xs whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
            title="Refresh & sync data from API to view live charts and skeleton states"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-neutral-500 ${isDataLoading ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">{isDataLoading ? 'Syncing...' : 'Sync Data'}</span>
          </button>
        )}

        <button
          onClick={onOpenNewBooking}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Book Job</span>
          <span className="xs:hidden">Book</span>
        </button>

        {/* User Account Button (Only if logged in) */}
        {user && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 transition-colors text-xs"
              title={`Signed in as ${user.email}`}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white font-bold text-[10px]">
                {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
              <span className="hidden md:inline font-medium text-neutral-700 text-xs truncate max-w-[120px]">
                {user.fullName || user.email}
              </span>
            </div>
            
            <button
              onClick={onLogout}
              className="p-1.5 rounded-md border border-neutral-200 bg-white hover:bg-red-50 text-neutral-500 hover:text-red-600 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

    </header>
  );
};
