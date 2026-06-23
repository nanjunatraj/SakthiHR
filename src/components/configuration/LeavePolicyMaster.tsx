import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';
import {
  BookOpen, Plus, Pencil, Trash2, X, ChevronLeft, Search,
  CheckCircle2, AlertCircle, Info, Copy, Star,
  ArrowRightLeft, TrendingUp, Banknote, Shield,
  ChevronDown, FileText, Settings2, Calendar,
  Layers, RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccrualFrequency = 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annually' | 'None';
type CarryForwardPolicy = 'None' | 'Full' | 'Limited' | 'Percentage';
type EncashmentPolicy = 'None' | 'On Separation' | 'Annual' | 'On Request';

interface PolicyLeaveEntitlement {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  leaveTypeColor: string;
  daysPerYear: number;
  maxConsecutiveDays: number;
  minDaysPerApplication: number;
  allowHalfDay: boolean;
  advanceNoticeDays: number;
  accrualFrequency: AccrualFrequency;
  accrualDaysPerCycle: number;
  accrueOnProbation: boolean;
  waitingPeriodDays: number;
  carryForwardPolicy: CarryForwardPolicy;
  maxCarryForwardDays: number;
  carryForwardPercentage: number;
  carryForwardExpiryMonths: number;
  encashmentPolicy: EncashmentPolicy;
  maxEncashmentDaysPerYear: number;
  encashmentMultiplier: number;
  encashmentTaxable: boolean;
}

interface LeavePolicy {
  id: string;
  name: string;
  code: string;
  description: string;
  effectiveFrom: string;
  effectiveTo: string;
  isDefault: boolean;
  isActive: boolean;
  entitlements: PolicyLeaveEntitlement[];
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCRUAL_FREQUENCIES: AccrualFrequency[] = ['Monthly', 'Quarterly', 'Half-Yearly', 'Annually', 'None'];
const CARRY_FORWARD_POLICIES: CarryForwardPolicy[] = ['None', 'Full', 'Limited', 'Percentage'];
const ENCASHMENT_POLICIES: EncashmentPolicy[] = ['None', 'On Separation', 'Annual', 'On Request'];

const lpmdb = supabase as unknown as SupabaseClient;
interface LeaveTypeOpt { id: string; name: string; code: string; color: string; category: string; }
// Available leave types load live from the leave_types master.
let AVAILABLE_LEAVE_TYPES: LeaveTypeOpt[] = [];
function useLeaveTypeOpts() {
  const [, force] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await lpmdb.from('leave_types').select('id, name, code, color, category').order('name');
      AVAILABLE_LEAVE_TYPES = ((data ?? []) as Record<string, any>[]).map(t => ({ id: t.id, name: t.name ?? '', code: t.code ?? '', color: t.color ?? 'blue', category: t.category ?? '' }));
      if (active) force(n => n + 1);
    })();
    return () => { active = false; };
  }, []);
}

const LEAVE_COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
};

function getColorStyle(color: string) {
  return LEAVE_COLOR_MAP[color] ?? LEAVE_COLOR_MAP['blue'];
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

function todayFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[now.getMonth()]}/${now.getFullYear()}`;
}

// Leave policies are session-only (no leave_policies table yet); start empty.
const SEED_POLICIES: LeavePolicy[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function emptyEntitlement(lt: LeaveTypeOpt): PolicyLeaveEntitlement {
  return {
    id: `E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    leaveTypeId: lt.id,
    leaveTypeName: lt.name,
    leaveTypeCode: lt.code,
    leaveTypeColor: lt.color,
    daysPerYear: 12,
    maxConsecutiveDays: 3,
    minDaysPerApplication: 0.5,
    allowHalfDay: true,
    advanceNoticeDays: 1,
    accrualFrequency: 'Monthly',
    accrualDaysPerCycle: 1,
    accrueOnProbation: true,
    waitingPeriodDays: 0,
    carryForwardPolicy: 'None',
    maxCarryForwardDays: 0,
    carryForwardPercentage: 0,
    carryForwardExpiryMonths: 0,
    encashmentPolicy: 'None',
    maxEncashmentDaysPerYear: 0,
    encashmentMultiplier: 1,
    encashmentTaxable: false,
  };
}

// ─── DB mappers ───────────────────────────────────────────────────────────────

function rowToEntitlement(r: Record<string, any>): PolicyLeaveEntitlement {
  return {
    id: r.id,
    leaveTypeId: r.leave_type_id ?? '',
    leaveTypeName: r.leave_type_name ?? '',
    leaveTypeCode: r.leave_type_code ?? '',
    leaveTypeColor: r.leave_type_color ?? 'blue',
    daysPerYear: Number(r.days_per_year ?? 0),
    maxConsecutiveDays: Number(r.max_consecutive_days ?? 0),
    minDaysPerApplication: Number(r.min_days_per_application ?? 0),
    allowHalfDay: Boolean(r.allow_half_day),
    advanceNoticeDays: Number(r.advance_notice_days ?? 0),
    accrualFrequency: (r.accrual_frequency as AccrualFrequency) ?? 'Monthly',
    accrualDaysPerCycle: Number(r.accrual_days_per_cycle ?? 0),
    accrueOnProbation: Boolean(r.accrue_on_probation),
    waitingPeriodDays: Number(r.waiting_period_days ?? 0),
    carryForwardPolicy: (r.carry_forward_policy as CarryForwardPolicy) ?? 'None',
    maxCarryForwardDays: Number(r.max_carry_forward_days ?? 0),
    carryForwardPercentage: Number(r.carry_forward_percentage ?? 0),
    carryForwardExpiryMonths: Number(r.carry_forward_expiry_months ?? 0),
    encashmentPolicy: (r.encashment_policy as EncashmentPolicy) ?? 'None',
    maxEncashmentDaysPerYear: Number(r.max_encashment_days_per_year ?? 0),
    encashmentMultiplier: Number(r.encashment_multiplier ?? 1),
    encashmentTaxable: Boolean(r.encashment_taxable),
  };
}

function entitlementToRow(e: PolicyLeaveEntitlement, policyId: string, sortOrder: number): Record<string, unknown> {
  return {
    policy_id: policyId,
    leave_type_id: isUuid(e.leaveTypeId) ? e.leaveTypeId : null,
    leave_type_name: e.leaveTypeName || null,
    leave_type_code: e.leaveTypeCode || null,
    leave_type_color: e.leaveTypeColor || null,
    days_per_year: e.daysPerYear || 0,
    max_consecutive_days: e.maxConsecutiveDays || 0,
    min_days_per_application: e.minDaysPerApplication || 0,
    allow_half_day: e.allowHalfDay,
    advance_notice_days: e.advanceNoticeDays || 0,
    accrual_frequency: e.accrualFrequency,
    accrual_days_per_cycle: e.accrualDaysPerCycle || 0,
    accrue_on_probation: e.accrueOnProbation,
    waiting_period_days: e.waitingPeriodDays || 0,
    carry_forward_policy: e.carryForwardPolicy,
    max_carry_forward_days: e.maxCarryForwardDays || 0,
    carry_forward_percentage: e.carryForwardPercentage || 0,
    carry_forward_expiry_months: e.carryForwardExpiryMonths || 0,
    encashment_policy: e.encashmentPolicy,
    max_encashment_days_per_year: e.maxEncashmentDaysPerYear || 0,
    encashment_multiplier: e.encashmentMultiplier || 1,
    encashment_taxable: e.encashmentTaxable,
    sort_order: sortOrder,
  };
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function policyHeaderToRow(f: { name: string; code: string; description: string; effectiveFrom: string; effectiveTo: string; isDefault: boolean; isActive: boolean }): Record<string, unknown> {
  return {
    name: f.name.trim(), code: f.code.trim(), description: f.description?.trim() || null,
    effective_from: f.effectiveFrom || null, effective_to: f.effectiveTo || null,
    is_default: f.isDefault, is_active: f.isActive, updated_at: new Date().toISOString(),
  };
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none";

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

const Field = ({ label, required, children, hint }: FieldProps) => (
  <div>
    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  accentColor?: string;
  accentBg?: string;
}

const SectionHeader = ({ icon: Icon, title, subtitle, accentColor = 'text-primary', accentBg = 'bg-primary/10' }: SectionHeaderProps) => (
  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
    <div className={`p-2 ${accentBg} rounded-lg shrink-0`}>
      <Icon size={16} className={accentColor} />
    </div>
    <div>
      <h3 className="font-bold text-sm">{title}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

const Toggle = ({ value, onChange, label, description }: ToggleProps) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div onClick={() => onChange(!value)} className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-primary' : 'bg-border'}`}>
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </div>
    <div>
      <span className="text-sm font-medium">{label}</span>
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
    </div>
  </label>
);

// ─── Entitlement Row ──────────────────────────────────────────────────────────

interface EntitlementRowProps {
  entitlement: PolicyLeaveEntitlement;
  index: number;
  onUpdate: (updates: Partial<PolicyLeaveEntitlement>) => void;
  onRemove: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

const EntitlementRow = ({ entitlement, index, onUpdate, onRemove, expanded, onToggleExpand }: EntitlementRowProps) => {
  const colorStyle = getColorStyle(entitlement.leaveTypeColor);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
        <div className={`w-8 h-8 rounded-lg ${colorStyle.bg} flex items-center justify-center shrink-0`}>
          <span className={`text-[10px] font-bold ${colorStyle.text}`}>{entitlement.leaveTypeCode}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{entitlement.leaveTypeName}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>
              {entitlement.daysPerYear}d/yr
            </span>
            {entitlement.accrualFrequency !== 'None' && (
              <span className="text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
                {entitlement.accrualDaysPerCycle}d/{entitlement.accrualFrequency.toLowerCase()}
              </span>
            )}
            {entitlement.carryForwardPolicy !== 'None' && (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                CF: {entitlement.carryForwardPolicy === 'Limited' ? `${entitlement.maxCarryForwardDays}d` : entitlement.carryForwardPolicy === 'Percentage' ? `${entitlement.carryForwardPercentage}%` : 'Full'}
              </span>
            )}
            {entitlement.encashmentPolicy !== 'None' && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                Encashable
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors"
          >
            <Settings2 size={12} />
            {expanded ? 'Collapse' : 'Configure'}
            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-border space-y-5 bg-accent/10">
              <div>
                <SectionHeader icon={Calendar} title="Entitlement Settings" subtitle="Days allowed, consecutive limits, and application rules" accentColor="text-blue-600" accentBg="bg-blue-50" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Days Per Year" required>
                    <input type="number" className={inputCls} min={0} max={365} step={0.5} value={entitlement.daysPerYear} onChange={e => onUpdate({ daysPerYear: parseFloat(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Max Consecutive Days">
                    <input type="number" className={inputCls} min={1} max={365} value={entitlement.maxConsecutiveDays} onChange={e => onUpdate({ maxConsecutiveDays: parseInt(e.target.value) || 1 })} />
                  </Field>
                  <Field label="Min Days / Application">
                    <input type="number" className={inputCls} min={0.5} max={30} step={0.5} value={entitlement.minDaysPerApplication} onChange={e => onUpdate({ minDaysPerApplication: parseFloat(e.target.value) || 0.5 })} />
                  </Field>
                  <Field label="Advance Notice (Days)">
                    <input type="number" className={inputCls} min={0} max={90} value={entitlement.advanceNoticeDays} onChange={e => onUpdate({ advanceNoticeDays: parseInt(e.target.value) || 0 })} />
                  </Field>
                </div>
                <div className="mt-3">
                  <Toggle value={entitlement.allowHalfDay} onChange={v => onUpdate({ allowHalfDay: v })} label="Allow Half Day" description="Employee can apply for half-day leave" />
                </div>
              </div>

              <div>
                <SectionHeader icon={TrendingUp} title="Accrual Settings" subtitle="How leave days are credited over time" accentColor="text-violet-600" accentBg="bg-violet-50" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Accrual Frequency">
                    <select className={selectCls} value={entitlement.accrualFrequency} onChange={e => onUpdate({ accrualFrequency: e.target.value as AccrualFrequency })}>
                      {ACCRUAL_FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </Field>
                  {entitlement.accrualFrequency !== 'None' && (
                    <>
                      <Field label="Days Per Cycle">
                        <input type="number" className={inputCls} min={0.5} max={30} step={0.5} value={entitlement.accrualDaysPerCycle} onChange={e => onUpdate({ accrualDaysPerCycle: parseFloat(e.target.value) || 0 })} />
                      </Field>
                      <Field label="Waiting Period (Days)" hint="Days before accrual starts">
                        <input type="number" className={inputCls} min={0} max={365} value={entitlement.waitingPeriodDays} onChange={e => onUpdate({ waitingPeriodDays: parseInt(e.target.value) || 0 })} />
                      </Field>
                    </>
                  )}
                </div>
                {entitlement.accrualFrequency !== 'None' && (
                  <div className="mt-3">
                    <Toggle value={entitlement.accrueOnProbation} onChange={v => onUpdate({ accrueOnProbation: v })} label="Accrue During Probation" description="Leave days are credited even during probation period" />
                  </div>
                )}
              </div>

              <div>
                <SectionHeader icon={ArrowRightLeft} title="Carry Forward Rules" subtitle="How unused balance is handled at year end" accentColor="text-emerald-600" accentBg="bg-emerald-50" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Carry Forward Policy">
                    <select className={selectCls} value={entitlement.carryForwardPolicy} onChange={e => onUpdate({ carryForwardPolicy: e.target.value as CarryForwardPolicy })}>
                      {CARRY_FORWARD_POLICIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  {entitlement.carryForwardPolicy === 'Limited' && (
                    <Field label="Max Days to Carry Forward">
                      <input type="number" className={inputCls} min={0} max={365} value={entitlement.maxCarryForwardDays} onChange={e => onUpdate({ maxCarryForwardDays: parseInt(e.target.value) || 0 })} />
                    </Field>
                  )}
                  {entitlement.carryForwardPolicy === 'Percentage' && (
                    <Field label="Percentage to Carry Forward (%)">
                      <input type="number" className={inputCls} min={0} max={100} step={5} value={entitlement.carryForwardPercentage} onChange={e => onUpdate({ carryForwardPercentage: parseInt(e.target.value) || 0 })} />
                    </Field>
                  )}
                  {entitlement.carryForwardPolicy !== 'None' && (
                    <Field label="Expiry (Months)" hint="0 = no expiry">
                      <input type="number" className={inputCls} min={0} max={24} value={entitlement.carryForwardExpiryMonths} onChange={e => onUpdate({ carryForwardExpiryMonths: parseInt(e.target.value) || 0 })} />
                    </Field>
                  )}
                </div>
              </div>

              <div>
                <SectionHeader icon={Banknote} title="Encashment Settings" subtitle="Rules for converting leave balance to cash" accentColor="text-amber-600" accentBg="bg-amber-50" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Encashment Policy">
                    <select className={selectCls} value={entitlement.encashmentPolicy} onChange={e => onUpdate({ encashmentPolicy: e.target.value as EncashmentPolicy })}>
                      {ENCASHMENT_POLICIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  {entitlement.encashmentPolicy !== 'None' && (
                    <>
                      <Field label="Max Encashment Days/Year">
                        <input type="number" className={inputCls} min={0} max={365} value={entitlement.maxEncashmentDaysPerYear} onChange={e => onUpdate({ maxEncashmentDaysPerYear: parseInt(e.target.value) || 0 })} />
                      </Field>
                      <Field label="Encashment Multiplier" hint="e.g. 1 = 1× daily salary">
                        <input type="number" className={inputCls} min={0.5} max={5} step={0.25} value={entitlement.encashmentMultiplier} onChange={e => onUpdate({ encashmentMultiplier: parseFloat(e.target.value) || 1 })} />
                      </Field>
                      <div className="flex items-end">
                        <Toggle value={entitlement.encashmentTaxable} onChange={v => onUpdate({ encashmentTaxable: v })} label="Taxable" description="Encashment amount is subject to income tax" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Policy Form Modal ────────────────────────────────────────────────────────

type PolicyFormTab = 'basic' | 'entitlements';

interface PolicyFormData {
  name: string;
  code: string;
  description: string;
  effectiveFrom: string;
  effectiveTo: string;
  isDefault: boolean;
  isActive: boolean;
  entitlements: PolicyLeaveEntitlement[];
}

interface PolicyFormModalProps {
  title: string;
  form: PolicyFormData;
  onChange: (key: keyof PolicyFormData, value: any) => void;
  onEntitlementUpdate: (id: string, updates: Partial<PolicyLeaveEntitlement>) => void;
  onEntitlementRemove: (id: string) => void;
  onEntitlementAdd: (lt: LeaveTypeOpt) => void;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
}

const PolicyFormModal = ({
  title, form, onChange, onEntitlementUpdate, onEntitlementRemove, onEntitlementAdd, onSave, onClose, saveLabel
}: PolicyFormModalProps) => {
  const [activeTab, setActiveTab] = useState<PolicyFormTab>('basic');
  const [expandedEntitlements, setExpandedEntitlements] = useState<string[]>([]);
  const [showAddLeaveType, setShowAddLeaveType] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedEntitlements(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const assignedLeaveTypeIds = new Set(form.entitlements.map(e => e.leaveTypeId));
  const availableToAdd = AVAILABLE_LEAVE_TYPES.filter(lt => !assignedLeaveTypeIds.has(lt.id));

  const tabs: { key: PolicyFormTab; label: string; icon: React.ElementType }[] = [
    { key: 'basic', label: 'Policy Details', icon: FileText },
    { key: 'entitlements', label: `Leave Entitlements (${form.entitlements.length})`, icon: Calendar },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-0.5 px-6 pt-3 border-b border-border bg-accent/10 overflow-x-auto">
          {tabs.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all rounded-t-lg border-b-2 whitespace-nowrap ${
                  isActive ? 'text-primary border-primary bg-primary/5' : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <TabIcon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12 }}
            >
              {activeTab === 'basic' && (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <Info size={16} className="text-green-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-green-700">
                      Define the leave policy with its entitlements. To assign this policy to specific employees, use the <strong>Leave Policy Allocation</strong> module where you can filter by Employee Type, Group, Category, Section, Grade, Designation, and Department.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Field label="Policy Name" required>
                        <input type="text" className={inputCls} placeholder="e.g. Standard Leave Policy" value={form.name} onChange={e => onChange('name', e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Policy Code" required hint="Short unique identifier">
                      <input type="text" className={`${inputCls} font-mono uppercase`} placeholder="e.g. SLP" maxLength={8} value={form.code} onChange={e => onChange('code', e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Status">
                      <select className={selectCls} value={form.isActive ? 'Active' : 'Inactive'} onChange={e => onChange('isActive', e.target.value === 'Active')}>
                        <option>Active</option>
                        <option>Inactive</option>
                      </select>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Description">
                        <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Brief description of this leave policy" value={form.description} onChange={e => onChange('description', e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Effective From" required>
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="date" className={`${inputCls} pl-9`} value={form.effectiveFrom} onChange={e => onChange('effectiveFrom', e.target.value)} />
                      </div>
                    </Field>
                    <Field label="Effective To" hint="Leave blank for open-ended policy">
                      <div className="relative">
                        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="date" className={`${inputCls} pl-9`} value={form.effectiveTo} onChange={e => onChange('effectiveTo', e.target.value)} />
                      </div>
                    </Field>
                    <div className="md:col-span-2">
                      <Toggle value={form.isDefault} onChange={v => onChange('isDefault', v)} label="Set as Default Policy" description="This policy will be suggested as default when creating new allocations" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'entitlements' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      Add leave types to this policy and configure specific entitlements, accrual rules, carry-forward limits, and encashment settings for each. Click <strong>Configure</strong> on any row to expand its settings.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-muted-foreground">{form.entitlements.length} leave type{form.entitlements.length !== 1 ? 's' : ''} assigned</span>
                    <div className="relative">
                      <button
                        onClick={() => setShowAddLeaveType(v => !v)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-xs font-semibold shadow-sm"
                      >
                        <Plus size={13} /> Add Leave Type
                        <ChevronDown size={12} className={`transition-transform ${showAddLeaveType ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showAddLeaveType && availableToAdd.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden min-w-[220px]"
                          >
                            {availableToAdd.map(lt => {
                              const colorStyle = getColorStyle(lt.color);
                              return (
                                <button
                                  key={lt.id}
                                  onClick={() => { onEntitlementAdd(lt); setShowAddLeaveType(false); }}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                                >
                                  <div className={`w-7 h-7 rounded-lg ${colorStyle.bg} flex items-center justify-center shrink-0`}>
                                    <span className={`text-[9px] font-bold ${colorStyle.text}`}>{lt.code}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{lt.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{lt.category}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                        {showAddLeaveType && availableToAdd.length === 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 p-4 min-w-[200px]"
                          >
                            <p className="text-xs text-muted-foreground text-center">All available leave types have been added.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {form.entitlements.length === 0 ? (
                    <div className="text-center py-12 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                      <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Calendar size={22} className="text-green-600" />
                      </div>
                      <p className="font-semibold text-muted-foreground text-sm">No leave types assigned yet</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">Add leave types to define entitlements for this policy</p>
                      <button
                        onClick={() => setShowAddLeaveType(true)}
                        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto"
                      >
                        <Plus size={15} /> Add Leave Type
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.entitlements.map((ent, i) => (
                        <EntitlementRow
                          key={ent.id}
                          entitlement={ent}
                          index={i}
                          onUpdate={updates => onEntitlementUpdate(ent.id, updates)}
                          onRemove={() => onEntitlementRemove(ent.id)}
                          expanded={expandedEntitlements.includes(ent.id)}
                          onToggleExpand={() => toggleExpand(ent.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          <div className="flex items-center gap-2">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-2 h-2 rounded-full transition-all ${activeTab === tab.key ? 'bg-primary w-4' : 'bg-border hover:bg-muted-foreground'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={onSave} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
              {saveLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Policy Card ──────────────────────────────────────────────────────────────

interface PolicyCardProps {
  policy: LeavePolicy;
  onEdit: (p: LeavePolicy) => void;
  onDelete: (id: string) => void;
  onDuplicate: (p: LeavePolicy) => void;
  onToggleStatus: (id: string) => void;
  onSetDefault: (id: string) => void;
}

const PolicyCard = ({ policy, onEdit, onDelete, onDuplicate, onToggleStatus, onSetDefault }: PolicyCardProps) => {
  const [showEntitlements, setShowEntitlements] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -3 }}
      className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className={`h-1.5 w-full ${policy.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <BookOpen size={20} className="text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm">{policy.name}</h3>
                {policy.isDefault && (
                  <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Star size={8} /> Default
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{policy.code}</span>
            </div>
          </div>
          <button
            onClick={() => onToggleStatus(policy.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              policy.isActive ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${policy.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            {policy.isActive ? 'Active' : 'Inactive'}
          </button>
        </div>

        {policy.description && (
          <p className="text-[11px] text-muted-foreground italic mb-3 line-clamp-2">{policy.description}</p>
        )}

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
          <Calendar size={11} />
          <span>{formatDate(policy.effectiveFrom)}</span>
          {policy.effectiveTo && <><span>→</span><span>{formatDate(policy.effectiveTo)}</span></>}
        </div>

        <div className="mb-4">
          <button
            onClick={() => setShowEntitlements(v => !v)}
            className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
          >
            <Layers size={11} />
            {policy.entitlements.length} Leave Type{policy.entitlements.length !== 1 ? 's' : ''} Assigned
            <ChevronDown size={11} className={`transition-transform ${showEntitlements ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showEntitlements && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2"
              >
                <div className="space-y-1.5">
                  {policy.entitlements.map(ent => {
                    const colorStyle = getColorStyle(ent.leaveTypeColor);
                    return (
                      <div key={ent.id} className="flex items-center justify-between px-3 py-2 bg-accent/30 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colorStyle.bg} ${colorStyle.text}`}>{ent.leaveTypeCode}</span>
                          <span className="text-xs font-medium">{ent.leaveTypeName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-primary">{ent.daysPerYear}d/yr</span>
                          {ent.carryForwardPolicy !== 'None' && (
                            <span className="text-[9px] text-emerald-600 font-medium">CF</span>
                          )}
                          {ent.encashmentPolicy !== 'None' && (
                            <span className="text-[9px] text-amber-600 font-medium">ENC</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1 pt-3 border-t border-border">
          <button onClick={() => onEdit(policy)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors">
            <Pencil size={12} /> Edit
          </button>
          <button onClick={() => onDuplicate(policy)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors">
            <Copy size={12} /> Duplicate
          </button>
          {!policy.isDefault && (
            <button onClick={() => onSetDefault(policy.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors">
              <Star size={12} /> Set Default
            </button>
          )}
          <button onClick={() => onDelete(policy.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface LeavePolicyMasterProps {
  onBack: () => void;
}

function emptyPolicyForm(): PolicyFormData {
  return {
    name: '',
    code: '',
    description: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    isDefault: false,
    isActive: true,
    entitlements: [],
  };
}

export default function LeavePolicyMaster({ onBack }: LeavePolicyMasterProps) {
  useLeaveTypeOpts();
  const [policies, setPolicies] = useState<LeavePolicy[]>(SEED_POLICIES);

  // Leave policies + their entitlements load live from the DB.
  const loadPolicies = useCallback(async () => {
    const [{ data: polRows }, { data: entRows }] = await Promise.all([
      lpmdb.from('leave_policies').select('*').order('created_at'),
      lpmdb.from('leave_policy_entitlements').select('*').order('sort_order'),
    ]);
    const ents = (entRows ?? []) as Record<string, any>[];
    setPolicies(((polRows ?? []) as Record<string, any>[]).map(p => ({
      id: p.id, name: p.name ?? '', code: p.code ?? '', description: p.description ?? '',
      effectiveFrom: p.effective_from ?? '', effectiveTo: p.effective_to ?? '',
      isDefault: Boolean(p.is_default), isActive: Boolean(p.is_active),
      entitlements: ents.filter(e => e.policy_id === p.id).map(rowToEntitlement),
      createdAt: p.created_at ? formatDate(String(p.created_at).slice(0, 10)) : '',
    })));
  }, []);
  useEffect(() => { void loadPolicies(); }, [loadPolicies]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [modal, setModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);
  const [form, setForm] = useState<PolicyFormData>(emptyPolicyForm());

  const filtered = useMemo(() =>
    policies
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
      .filter(p => statusFilter === 'All' || (statusFilter === 'Active' ? p.isActive : !p.isActive)),
    [policies, search, statusFilter]
  );

  const activeCount = policies.filter(p => p.isActive).length;
  const defaultPolicy = policies.find(p => p.isDefault);
  const totalEntitlements = policies.reduce((s, p) => s + p.entitlements.length, 0);

  const openAdd = () => {
    setEditingPolicy(null);
    setForm(emptyPolicyForm());
    setModal(true);
  };

  const openEdit = (policy: LeavePolicy) => {
    setEditingPolicy(policy);
    setForm({
      name: policy.name,
      code: policy.code,
      description: policy.description,
      effectiveFrom: policy.effectiveFrom,
      effectiveTo: policy.effectiveTo,
      isDefault: policy.isDefault,
      isActive: policy.isActive,
      entitlements: policy.entitlements.map(e => ({ ...e })),
    });
    setModal(true);
  };

  const handleDuplicate = (policy: LeavePolicy) => {
    setEditingPolicy(null);
    setForm({
      name: `${policy.name} (Copy)`,
      code: `${policy.code}2`,
      description: policy.description,
      effectiveFrom: policy.effectiveFrom,
      effectiveTo: policy.effectiveTo,
      isDefault: false,
      isActive: false,
      entitlements: policy.entitlements.map(e => ({
        ...e,
        id: `E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    });
    setModal(true);
    toast.info('Policy duplicated — review and save.');
  };

  const savePolicy = async () => {
    if (!form.name.trim()) { toast.error('Policy name is required.'); return; }
    if (!form.code.trim()) { toast.error('Policy code is required.'); return; }
    if (!form.effectiveFrom) { toast.error('Effective From date is required.'); return; }

    const codeExists = policies.some(p => p.code === form.code && (editingPolicy ? p.id !== editingPolicy.id : true));
    if (codeExists) { toast.error('Policy code already exists. Please use a unique code.'); return; }

    const header = policyHeaderToRow(form);
    let policyId = editingPolicy?.id ?? '';

    if (editingPolicy) {
      const { error } = await lpmdb.from('leave_policies').update(header as never).eq('id', editingPolicy.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await lpmdb.from('leave_policies').insert(header as never).select('id').single();
      if (error) { toast.error(error.message); return; }
      policyId = (data as { id: string }).id;
    }

    // Replace the policy's entitlements.
    const delErr = (await lpmdb.from('leave_policy_entitlements').delete().eq('policy_id', policyId)).error;
    if (delErr) { toast.error(delErr.message); return; }
    if (form.entitlements.length > 0) {
      const rows = form.entitlements.map((e, i) => entitlementToRow(e, policyId, i));
      const insErr = (await lpmdb.from('leave_policy_entitlements').insert(rows as never)).error;
      if (insErr) { toast.error(insErr.message); return; }
    }

    // Only one default policy at a time.
    if (form.isDefault) {
      await lpmdb.from('leave_policies').update({ is_default: false } as never).neq('id', policyId);
    }

    toast.success(`Leave policy ${editingPolicy ? 'updated' : 'created'} successfully.`);
    setModal(false);
    void loadPolicies();
  };

  const deletePolicy = async (id: string) => {
    const policy = policies.find(p => p.id === id);
    if (policy?.isDefault) { toast.error('Cannot delete the default policy. Set another policy as default first.'); return; }
    const { error } = await lpmdb.from('leave_policies').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.info('Leave policy deleted.');
    void loadPolicies();
  };

  const toggleStatus = async (id: string) => {
    const policy = policies.find(p => p.id === id);
    if (!policy) return;
    const { error } = await lpmdb.from('leave_policies').update({ is_active: !policy.isActive } as never).eq('id', id);
    if (error) { toast.error(error.message); return; }
    void loadPolicies();
  };

  const setDefault = async (id: string) => {
    await lpmdb.from('leave_policies').update({ is_default: false } as never).neq('id', id);
    const { error } = await lpmdb.from('leave_policies').update({ is_default: true } as never).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Default policy updated.');
    void loadPolicies();
  };

  const handleFormChange = (key: keyof PolicyFormData, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const handleEntitlementUpdate = (id: string, updates: Partial<PolicyLeaveEntitlement>) => {
    setForm(f => ({
      ...f,
      entitlements: f.entitlements.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  };

  const handleEntitlementRemove = (id: string) => {
    setForm(f => ({ ...f, entitlements: f.entitlements.filter(e => e.id !== id) }));
    toast.info('Leave type removed from policy.');
  };

  const handleEntitlementAdd = (lt: LeaveTypeOpt) => {
    const newEnt = emptyEntitlement(lt);
    setForm(f => ({ ...f, entitlements: [...f.entitlements, newEnt] }));
    toast.success(`${lt.name} added to policy.`);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-green-100 rounded-lg">
                <BookOpen size={22} className="text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-serif">Leave Policy Master</h1>
                <p className="text-xs text-muted-foreground">Define leave policies with entitlements, carry-forward rules, and accrual settings. Use Leave Policy Allocation to assign policies to employees.</p>
              </div>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"
            >
              <Plus size={16} /> Create Policy
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-green-100 rounded-xl"><BookOpen size={20} className="text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Policies</p>
                <p className="font-bold text-lg mt-0.5">{policies.length}</p>
                <p className="text-[10px] text-muted-foreground">{activeCount} active</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-indigo-100 rounded-xl"><Star size={20} className="text-indigo-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Default Policy</p>
                <p className="font-bold text-sm mt-0.5 truncate max-w-[120px]">{defaultPolicy?.name ?? 'Not set'}</p>
                <p className="text-[10px] text-muted-foreground">{defaultPolicy?.code ?? '—'}</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-blue-100 rounded-xl"><Calendar size={20} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Entitlements</p>
                <p className="font-bold text-lg mt-0.5">{totalEntitlements}</p>
                <p className="text-[10px] text-muted-foreground">Across all policies</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-amber-100 rounded-xl"><AlertCircle size={20} className="text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Allocation</p>
                <p className="font-bold text-sm mt-0.5">Via Allocation</p>
                <p className="text-[10px] text-muted-foreground">Module</p>
              </div>
            </motion.div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <Info size={17} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Leave Policy Master — Policy Definition Only</p>
              <p className="text-xs text-blue-700 mt-0.5">
                This module is for defining leave policies with their entitlements, accrual rules, carry-forward limits, and encashment settings. To assign policies to specific employees, use the <strong>Leave Policy Allocation</strong> module which supports filtering by Employee Type, Group, Category, Section, Grade, Designation, and Department.
              </p>
            </div>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search policies by name or code..."
                className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
            >
              <option value="All">All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 size={13} className="text-green-500" />
              <span>{filtered.length} of {policies.length} policies</span>
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map(policy => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  onEdit={openEdit}
                  onDelete={deletePolicy}
                  onDuplicate={handleDuplicate}
                  onToggleStatus={toggleStatus}
                  onSetDefault={setDefault}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen size={28} className="text-green-600" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {search || statusFilter !== 'All' ? 'No policies match your filters' : 'No leave policies defined yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                {search || statusFilter !== 'All' ? 'Try adjusting your search or filter criteria' : 'Create your first leave policy to get started'}
              </p>
              {!search && statusFilter === 'All' && (
                <button
                  onClick={openAdd}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto"
                >
                  <Plus size={15} /> Create Leave Policy
                </button>
              )}
            </div>
          )}

          {policies.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
                <Layers size={16} className="text-primary" />
                <h3 className="font-bold text-sm">Policy Overview</h3>
                <span className="ml-auto text-xs text-muted-foreground">{policies.length} policies defined</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Policy</th>
                      <th className="px-4 py-3 font-semibold">Leave Types</th>
                      <th className="px-4 py-3 font-semibold">Effective Period</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {policies.map((policy, i) => (
                      <motion.tr
                        key={policy.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-accent/30 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                              <BookOpen size={14} className="text-green-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm">{policy.name}</p>
                                {policy.isDefault && (
                                  <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                    <Star size={8} /> Default
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{policy.code}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {policy.entitlements.slice(0, 3).map(ent => {
                              const colorStyle = getColorStyle(ent.leaveTypeColor);
                              return (
                                <span key={ent.id} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colorStyle.bg} ${colorStyle.text}`}>
                                  {ent.leaveTypeCode}
                                </span>
                              );
                            })}
                            {policy.entitlements.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{policy.entitlements.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium">{formatDate(policy.effectiveFrom)}</p>
                          {policy.effectiveTo && <p className="text-[10px] text-muted-foreground">→ {formatDate(policy.effectiveTo)}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{policy.createdAt}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleStatus(policy.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                              policy.isActive ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${policy.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {policy.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(policy)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDuplicate(policy)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                              <Copy size={13} />
                            </button>
                            <button onClick={() => deletePolicy(policy.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {modal && (
          <PolicyFormModal
            title={editingPolicy ? `Edit Policy — ${editingPolicy.name}` : 'Create Leave Policy'}
            form={form}
            onChange={handleFormChange}
            onEntitlementUpdate={handleEntitlementUpdate}
            onEntitlementRemove={handleEntitlementRemove}
            onEntitlementAdd={handleEntitlementAdd}
            onSave={savePolicy}
            onClose={() => setModal(false)}
            saveLabel={editingPolicy ? 'Save Changes' : 'Create Policy'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}