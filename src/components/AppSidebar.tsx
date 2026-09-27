import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  PhoneMissed,
  Users,
  DollarSign,
  Sliders,
  PlusCircle,
  Building2,
  LogOut,
  Compass,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from './ui/sidebar';
import { AssistantSettings, Organization, User } from '../types';
import { OrgSwitcher } from './OrgSwitcher';
import { SettingsSubTab } from './OrganizationSettings';
import { AIIcon } from './AIIcon';

interface AppSidebarProps {
  activeTab: 'overview' | 'dispatch' | 'sms' | 'missed_calls' | 'customers' | 'services' | 'settings';
  setActiveTab: (tab: 'overview' | 'dispatch' | 'sms' | 'missed_calls' | 'customers' | 'services' | 'settings') => void;
  settingsSubTab?: SettingsSubTab;
  setSettingsSubTab?: (tab: SettingsSubTab) => void;
  settings: AssistantSettings;
  organizations: Organization[];
  currentOrg: Organization;
  onSelectOrg: (org: Organization) => void;
  onAddOrg: (newOrg: Omit<Organization, 'id'>) => void;
  unreadSmsCount: number;
  unconvertedCallsCount: number;
  totalBookingsCount: number;
  onOpenNewBooking: () => void;
  tradespersonStatus: 'on_call' | 'available' | 'driving';
  setTradespersonStatus: (status: 'on_call' | 'available' | 'driving') => void;
  user: User | null;
  onLogout: () => void;
  onOpenOnboarding: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  setActiveTab,
  settingsSubTab = 'general',
  setSettingsSubTab,
  settings,
  organizations,
  currentOrg,
  onSelectOrg,
  onAddOrg,
  unreadSmsCount,
  unconvertedCallsCount,
  totalBookingsCount,
  onOpenNewBooking,
  tradespersonStatus,
  setTradespersonStatus,
  user,
  onLogout,
  onOpenOnboarding,
}) => {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon">
      {/* Header: Refined Logo & Interactive Organization Switcher */}
      <SidebarHeader className="border-b border-neutral-100 p-2">
        <OrgSwitcher
          organizations={organizations}
          currentOrg={currentOrg}
          onSelectOrg={onSelectOrg}
          onAddOrg={onAddOrg}
          isCollapsed={isCollapsed}
        />
      </SidebarHeader>

      {/* Content: Nav Links */}
      <SidebarContent>
        {/* Main Operations Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Dispatch Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Overview */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'overview'}
                  onClick={() => setActiveTab('overview')}
                  tooltip="Overview Dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Dispatch Board */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'dispatch'}
                  onClick={() => setActiveTab('dispatch')}
                  tooltip="Dispatch Schedule"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Dispatch Board</span>
                  {totalBookingsCount > 0 && (
                    <SidebarMenuBadge className="bg-neutral-100 text-neutral-700">
                      {totalBookingsCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* SMS Inbox */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'sms'}
                  onClick={() => setActiveTab('sms')}
                  tooltip="SMS Conversations"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>SMS Inbox</span>
                  {unreadSmsCount > 0 && (
                    <SidebarMenuBadge className="bg-neutral-900 text-white">
                      {unreadSmsCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Missed Calls */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'missed_calls'}
                  onClick={() => setActiveTab('missed_calls')}
                  tooltip="Missed Call Pipeline"
                >
                  <PhoneMissed className="h-4 w-4" />
                  <span>Missed Calls</span>
                  {unconvertedCallsCount > 0 && (
                    <SidebarMenuBadge className="bg-amber-600 text-white">
                      {unconvertedCallsCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Customers */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'customers'}
                  onClick={() => setActiveTab('customers')}
                  tooltip="Customer Profiles & History"
                >
                  <Users className="h-4 w-4" />
                  <span>Customers</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Business Management Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Settings &amp; Rates</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Organization Settings */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'settings' && settingsSubTab === 'general'}
                  onClick={() => {
                    setActiveTab('settings');
                    setSettingsSubTab?.('general');
                  }}
                  tooltip="Organization Profile & Territory"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Organization</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Service Rates */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'services' || (activeTab === 'settings' && settingsSubTab === 'rates')}
                  onClick={() => {
                    setActiveTab('settings');
                    setSettingsSubTab?.('rates');
                  }}
                  tooltip="Service Catalog & Rates"
                >
                  <DollarSign className="h-4 w-4" />
                  <span>Service Rates</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* AI Dispatcher */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'settings' && settingsSubTab === 'ai_dispatcher'}
                  onClick={() => {
                    setActiveTab('settings');
                    setSettingsSubTab?.('ai_dispatcher');
                  }}
                  tooltip="AI Dispatcher & Tone"
                >
                  <AIIcon className="h-4 w-4" />
                  <span>AI Dispatcher</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Simulator Triggers */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onOpenNewBooking}
                  className="text-neutral-900 hover:bg-neutral-100 font-semibold"
                  tooltip="Book New Job"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>+ Book Manual Job</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: User Account & Technician Status */}
      <SidebarFooter>
        <div className="flex flex-col gap-1.5">
          {/* Technician Status & Availability Switch */}
          <div className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-200 group-data-[collapsible=icon]:p-1.5 transition-all">
            {/* Expanded view with Switch Toggle */}
            <div className="flex flex-col gap-2 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      tradespersonStatus === 'available'
                        ? 'bg-emerald-500 ring-2 ring-emerald-200'
                        : 'bg-amber-500 ring-2 ring-amber-200 animate-pulse'
                    }`}
                  />
                  <div className="overflow-hidden min-w-0">
                    <p className="text-xs font-semibold text-neutral-900 truncate">
                      {user?.fullName || settings.tradespersonName}
                    </p>
                    <p className="text-[10px] font-medium text-neutral-500 truncate">
                      {tradespersonStatus === 'available' ? 'Available (SMS Takeover)' : 'On Service Call (AI Active)'}
                    </p>
                  </div>
                </div>

                {/* Interactive Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={tradespersonStatus === 'available'}
                  onClick={() =>
                    setTradespersonStatus(
                      tradespersonStatus === 'available' ? 'on_call' : 'available'
                    )
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-neutral-900 ${
                    tradespersonStatus === 'available' ? 'bg-emerald-600' : 'bg-neutral-300'
                  }`}
                  title={
                    tradespersonStatus === 'available'
                      ? 'Currently Available. Click to switch to On service call.'
                      : 'Currently On service call. Click to switch to Available.'
                  }
                >
                  <span className="sr-only">Toggle technician availability status</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      tradespersonStatus === 'available' ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Status Segment Switch Buttons */}
              <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-neutral-200/60 font-medium">
                <button
                  type="button"
                  onClick={() => setTradespersonStatus('on_call')}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    tradespersonStatus === 'on_call'
                      ? 'bg-amber-100 text-amber-900 font-bold'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  On service call
                </button>
                <button
                  type="button"
                  onClick={() => setTradespersonStatus('available')}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    tradespersonStatus === 'available'
                      ? 'bg-emerald-100 text-emerald-900 font-bold'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  Available
                </button>
              </div>
            </div>

            {/* Collapsed Icon-only View */}
            <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <button
                type="button"
                onClick={() =>
                  setTradespersonStatus(
                    tradespersonStatus === 'available' ? 'on_call' : 'available'
                  )
                }
                className="p-1 rounded-md hover:bg-neutral-200 transition-colors cursor-pointer"
                title={`Status: ${tradespersonStatus === 'available' ? 'Available' : 'On Service Call'}. Click to toggle.`}
              >
                <span
                  className={`block h-3 w-3 rounded-full ${
                    tradespersonStatus === 'available'
                      ? 'bg-emerald-500 ring-2 ring-emerald-200'
                      : 'bg-amber-500 ring-2 ring-amber-200 animate-pulse'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* User Account Card (Only if logged in) */}
          {user && (
            <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-neutral-200 shadow-2xs group-data-[collapsible=icon]:p-1.5">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white font-bold text-xs shrink-0">
                  {user.fullName ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                </div>
                <div className="overflow-hidden group-data-[collapsible=icon]:hidden text-left">
                  <p className="text-xs font-semibold text-neutral-900 truncate">
                    {user.fullName}
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
                <button
                  onClick={onOpenOnboarding}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                  title="Launch Onboarding Wizard"
                >
                  <Compass className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onLogout}
                  className="p-1 rounded text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
