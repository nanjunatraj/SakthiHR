import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal, Building2, CalendarDays, Clock, ChevronRight, ChevronDown,
  Landmark, Users, MapPin, Calculator,
  CalendarRange, BookOpen, Shield, UserCheck, UserCog, FileText, Boxes
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import HolidayListMaster from '../components/configuration/HolidayListMaster';
import LeaveTypeMaster from '../components/configuration/LeaveTypeMaster';
import LeavePolicyMaster from '../components/configuration/LeavePolicyMaster';
import LeavePolicyAllocation from '../components/configuration/LeavePolicyAllocation';
import ShiftMaster from '../components/configuration/ShiftMaster';
import HRMasters from '../components/configuration/HRMasters';
import EstablishmentMaster from './EstablishmentMaster';
import WorkLocationMaster from './WorkLocationMaster';
import PayrollSetup from '../components/configuration/PayrollSetup';
import UserMaster from './UserMaster';
import TemplateMaster from '../components/configuration/TemplateMaster';
import AssetManagement from '../components/configuration/AssetManagement';

type ConfigModule =
  | 'home'
  | 'establishment'
  | 'work-location'
  | 'holiday'
  | 'leave-type'
  | 'leave-policy'
  | 'leave-policy-allocation'
  | 'shift'
  | 'hr-masters'
  | 'payroll-setup'
  | 'user-master'
  | 'template-master'
  | 'asset-management';

type ConfigGroup = 'establishment-setup' | 'hr-config' | 'leave-config' | 'payroll-config' | 'letters-config' | 'asset-config';

interface ConfigModuleItem {
  key: ConfigModule;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  tags: string[];
  group: ConfigGroup;
}

const CONFIG_MODULES: ConfigModuleItem[] = [
  // ── Establishment Setup ──
  {
    key: 'establishment',
    title: 'Establishment Master',
    description: 'Configure organisation identity, work locations, departments, and statutory compliance details.',
    icon: Landmark,
    color: 'bg-blue-100',
    iconColor: 'text-blue-600',
    tags: ['Organisation', 'Locations', 'Departments', 'Statutory'],
    group: 'establishment-setup',
  },
  {
    key: 'work-location',
    title: 'Work Location Master',
    description: 'Detailed work location management with statutory compliance, bank details, and letterhead configuration per location.',
    icon: MapPin,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    tags: ['Statutory', 'Bank Details', 'Letterhead', 'Compliance'],
    group: 'establishment-setup',
  },
  {
    key: 'user-master',
    title: 'User Master',
    description: 'Manage system users, assign roles, configure module-level access privileges, and control login credentials.',
    icon: UserCog,
    color: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    tags: ['Users', 'Roles', 'Privileges', 'Access Control'],
    group: 'establishment-setup',
  },
  // ── HR Configuration ──
  {
    key: 'hr-masters',
    title: 'HR Masters',
    description: 'Manage designations, employee types, groups, categories, classifications, sections, and salary grades.',
    icon: Users,
    color: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    tags: ['Designation', 'Employee Type', 'Classification', 'Grade'],
    group: 'hr-config',
  },
  {
    key: 'shift',
    title: 'Shift Master',
    description: 'Define work shifts with timing, break configuration, applicable days, and overtime rules.',
    icon: Clock,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    tags: ['Timing', 'Breaks', 'Overtime', 'Grace Period'],
    group: 'hr-config',
  },
  // ── Leave Configuration ──
  {
    key: 'holiday',
    title: 'Holiday List Master',
    description: 'Manage national, festival, and weekly holidays with auto-generation for the year.',
    icon: CalendarDays,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    tags: ['National', 'Festival', 'Weekly Off', 'Auto-Generate'],
    group: 'leave-config',
  },
  {
    key: 'leave-type',
    title: 'Leave Type Master',
    description: 'Define leave types with accrual rules, carry-forward limits, encashment settings, and eligibility.',
    icon: CalendarRange,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    tags: ['Accrual', 'Carry Forward', 'Encashment', 'Eligibility'],
    group: 'leave-config',
  },
  {
    key: 'leave-policy',
    title: 'Leave Policy Master',
    description: 'Define leave policies with entitlements, carry-forward rules, and accrual settings per leave type.',
    icon: Shield,
    color: 'bg-green-100',
    iconColor: 'text-green-600',
    tags: ['Entitlements', 'Accrual', 'Carry Forward', 'Encashment'],
    group: 'leave-config',
  },
  {
    key: 'leave-policy-allocation',
    title: 'Leave Policy Allocation',
    description: 'Allocate leave policies to employees filtered by Type, Group, Category, Section, Grade, Designation, and Department.',
    icon: UserCheck,
    color: 'bg-teal-100',
    iconColor: 'text-teal-600',
    tags: ['Employee Filter', 'Policy Assignment', 'Opening Balance', 'Bulk Allocation'],
    group: 'leave-config',
  },
  // ── Payroll Configuration ──
  {
    key: 'payroll-setup',
    title: 'Payroll Setup',
    description: 'Configure payroll periods, salary components, salary structures & assignment, pay heads, PF/ESI, TDS slabs, and loan types.',
    icon: Calculator,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    tags: ['Salary Components', 'Structures', 'PF / ESI', 'TDS Slabs'],
    group: 'payroll-config',
  },
  // ── Letters & Templates ──
  {
    key: 'template-master',
    title: 'Template Master',
    description: 'Create letter/form templates (offer, appointment, experience, relieving, memos, warnings…), generate on letterhead, and send to employees for eSign acknowledgement.',
    icon: FileText,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    tags: ['Offer/Relieving', 'Certificates', 'Memos & Warnings', 'eSign Acknowledge'],
    group: 'letters-config',
  },
  // ── Asset Management ──
  {
    key: 'asset-management',
    title: 'Asset Management',
    description: 'Store company assets category-wise with a Product ID (Laptops, Data Cards, Mobile Phones, Peripherals, Bikes, Cars, Access Cards) and allocate them to employees.',
    icon: Boxes,
    color: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    tags: ['Categories', 'Product ID', 'Allocation', 'Handover'],
    group: 'asset-config',
  },
];

// Ordered list of the Configuration sub-menus.
const GROUP_ORDER: ConfigGroup[] = ['establishment-setup', 'hr-config', 'leave-config', 'payroll-config', 'letters-config', 'asset-config'];

const GROUP_META: Record<ConfigGroup, {
  label: string; description: string; icon: React.ElementType; color: string; bg: string; border: string;
}> = {
  'establishment-setup': {
    label: 'Establishment Setup',
    description: 'Organisation identity, work locations, and system user management.',
    icon: Building2,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  'hr-config': {
    label: 'HR Configuration',
    description: 'Employee masters, designations, grades, classifications, and shift policies.',
    icon: Users,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  'leave-config': {
    label: 'Leave Configuration',
    description: 'Holiday lists, leave types, leave policies, and policy allocation to employees.',
    icon: BookOpen,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  'payroll-config': {
    label: 'Payroll Configuration',
    description: 'All payroll setup — periods, salary components & structures, pay heads, PF/ESI, TDS, and loan types.',
    icon: Calculator,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  'letters-config': {
    label: 'Letters & Templates',
    description: 'Letter/form templates, generation on letterhead, and employee eSign acknowledgement.',
    icon: FileText,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  'asset-config': {
    label: 'Asset Management',
    description: 'Company assets category-wise with Product IDs, allocation to employees, and handover tracking.',
    icon: Boxes,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
  },
};

export default function Configuration() {
  const [activeModule, setActiveModule] = useState<ConfigModule>('home');
  // All sub-menus expanded by default; clicking a header collapses/expands it.
  const [collapsed, setCollapsed] = useState<Record<ConfigGroup, boolean>>({
    'establishment-setup': false, 'hr-config': false, 'leave-config': false, 'payroll-config': false, 'letters-config': false, 'asset-config': false,
  });

  if (activeModule === 'establishment') return <EstablishmentMaster />;
  if (activeModule === 'work-location') return <WorkLocationMaster onBack={() => setActiveModule('home')} />;
  if (activeModule === 'holiday') return <HolidayListMaster onBack={() => setActiveModule('home')} />;
  if (activeModule === 'leave-type') return <LeaveTypeMaster onBack={() => setActiveModule('home')} />;
  if (activeModule === 'leave-policy') return <LeavePolicyMaster onBack={() => setActiveModule('home')} />;
  if (activeModule === 'leave-policy-allocation') return <LeavePolicyAllocation onBack={() => setActiveModule('home')} />;
  if (activeModule === 'shift') return <ShiftMaster onBack={() => setActiveModule('home')} />;
  if (activeModule === 'hr-masters') return <HRMasters onBack={() => setActiveModule('home')} />;
  if (activeModule === 'payroll-setup') return <PayrollSetup onBack={() => setActiveModule('home')} />;
  if (activeModule === 'user-master') return <UserMaster embedded onBack={() => setActiveModule('home')} />;
  if (activeModule === 'template-master') return <TemplateMaster onBack={() => setActiveModule('home')} />;
  if (activeModule === 'asset-management') return <AssetManagement onBack={() => setActiveModule('home')} />;

  const renderModuleCard = (mod: ConfigModuleItem, i: number) => {
    const Icon = mod.icon;
    return (
      <motion.button
        key={mod.key}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        whileHover={{ y: -4 }}
        onClick={() => setActiveModule(mod.key)}
        className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all p-6 text-left group"
      >
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 ${mod.color} rounded-xl`}><Icon size={24} className={mod.iconColor} /></div>
          <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
        </div>
        <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors">{mod.title}</h3>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{mod.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {mod.tags.map(tag => (
            <span key={tag} className="text-[10px] font-semibold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      </motion.button>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><SlidersHorizontal size={22} className="text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold">Configuration</h1>
              <p className="text-xs text-muted-foreground">Set up masters, policies, user management, and system-wide configurations — grouped by area.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {GROUP_ORDER.map(groupKey => {
            const meta = GROUP_META[groupKey];
            const Icon = meta.icon;
            const modules = CONFIG_MODULES.filter(m => m.group === groupKey);
            const isCollapsed = collapsed[groupKey];
            return (
              <div key={groupKey}>
                {/* Sub-menu header (click to expand/collapse) */}
                <button
                  onClick={() => setCollapsed(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                  className={`w-full flex items-center gap-3 p-4 ${meta.bg} border ${meta.border} rounded-xl ${isCollapsed ? '' : 'mb-5'} transition-all hover:shadow-sm`}
                >
                  <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
                    <Icon size={20} className={meta.color} />
                  </div>
                  <div className="text-left">
                    <h2 className={`font-bold text-base ${meta.color}`}>{meta.label}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <span className={`text-[10px] font-bold bg-white border px-2.5 py-1 rounded-full ${meta.color} ${meta.border}`}>
                      {modules.length} module{modules.length !== 1 ? 's' : ''}
                    </span>
                    <ChevronDown size={18} className={`${meta.color} transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-1">
                        {modules.map((mod, i) => renderModuleCard(mod, i))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
