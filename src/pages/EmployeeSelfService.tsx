import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Eye, EyeOff, LogOut, FileText, Download,
  Mail, CheckCircle2, AlertCircle, X, ChevronRight,
  Calendar, DollarSign, TrendingDown, Wallet, Shield,
  Bell, Settings, Home, Clock, FileDown, MailCheck,
  Pencil, Save, RefreshCw, Info, Key, BadgeCheck,
  Building2, MapPin, Briefcase, Hash, Phone, Star,
  ChevronDown, ChevronUp, PiggyBank, CreditCard, Receipt,
  ArrowLeft, Loader2, CheckCheck, AlertTriangle,
  CalendarDays, Plus, Send, XCircle, TrendingUp,
  BarChart3, Layers, Heart, Baby, Umbrella, GraduationCap,
  ArrowRightLeft, Banknote, Filter, Search,
  HandCoins, Percent, TrendingDown as TrendDown,
  ThumbsUp, ThumbsDown, MessageSquare, UserCheck,
  Gavel, FileWarning, Megaphone, MessageCircle, MoreHorizontal,
  ClipboardCheck, AlertOctagon, Inbox, CheckSquare, MinusCircle, Users
} from 'lucide-react';
import { toast } from 'react-toastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
// Loosely-typed alias for tables not present in the generated Supabase types (e.g. deduction_entries).
const adb = supabase as unknown as SupabaseClient;
import { AttendanceLeaveCalendar, PollVoteWidget, EmiSkipPanel, Form16Panel, MyLettersPanel, MyReimbursementsPanel, MyResignationPanel } from '../components/SelfServiceWidgets';
import { useLoans, useActiveLoanTypes, applyLoan, type UiLoan, type UiLoanType } from '../lib/loans';
import EmployeeAvatar from '../components/EmployeeAvatar';
import ManagerDashboard from '../components/selfservice/ManagerDashboard';
import { isManager as checkIsManager, pendingCount as managerPendingCount } from '../lib/managerDashboard';
import { verifyLogin, changePassword, resetPasswordAndNotify, type SystemUserAccount } from '../lib/credentials';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeSession {
  id: string;
  /** Real Supabase employees.id (uuid), resolved at login from employeeCode. */
  dbEmployeeId?: string;
  employeeCode: string;
  /** User Master login_id — used for password change/reset. */
  loginId?: string;
  /** True when the account must change its password before using the portal. */
  mustChangePassword?: boolean;
  name: string;
  designation: string;
  department: string;
  workLocation: string;
  employeeType: string;
  employeeGrade: string;
  avatar: string;
  email: string;
  phone: string;
  doj: string;
  pan: string;
  uan: string;
  bankAccount: string;
  ifsc: string;
  bankName: string;
}

interface Payslip {
  id: string;
  periodId: string;
  periodName: string;
  periodCode: string;
  fromDate: string;
  toDate: string;
  paymentDate: string;
  financialYear: string;
  status: 'Draft' | 'Approved' | 'Disbursed';
  basic: number;
  hra: number;
  conveyance: number;
  medicalAllowance: number;
  specialAllowance: number;
  lta: number;
  overtimeAmount: number;
  gross: number;
  pfEmployee: number;
  esiEmployee: number;
  professionalTax: number;
  tds: number;
  loanEmi: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  lopDays: number;
  overtimeHours: number;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

// ─── Leave Types ──────────────────────────────────────────────────────────────

type LeaveTypeName = 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Compensatory Off' | 'Unpaid Leave';
type LeaveRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName: LeaveTypeName;
  leaveTypeCode: string;
  color: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
  accrualFrequency: string;
}

interface LeaveRequest {
  id: string;
  leaveTypeId: string;
  leaveTypeName: LeaveTypeName;
  leaveTypeCode: string;
  leaveTypeColor: string;
  fromDate: string;
  toDate: string;
  days: number;
  isHalfDay: boolean;
  reason: string;
  contactDuringLeave: string;
  handoverTo: string;
  status: LeaveRequestStatus;
  appliedOn: string;
  approvedBy?: string;
  approvedOn?: string;
  remarks?: string;
}

// ─── Loan Types ───────────────────────────────────────────────────────────────

type LoanTypeName = 'Personal Loan' | 'Emergency Advance' | 'Festival Advance' | 'Vehicle Loan' | 'Education Loan' | 'Medical Advance';
type LoanStatus = 'Pending' | 'Approved' | 'Active' | 'Closed' | 'Rejected';

interface LoanEMI {
  month: number;
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
  paid: boolean;
  paidDate?: string;
}

interface LoanApplication {
  id: string;
  loanType: string;
  principalAmount: number;
  interestRate: number;
  tenureMonths: number;
  emiAmount: number;
  disbursedDate: string;
  appliedDate: string;
  status: LoanStatus;
  purpose: string;
  paidEMIs: number;
  outstandingBalance: number;
  approvedBy?: string;
  approvedOn?: string;
  remarks?: string;
  schedule: LoanEMI[];
}

// ─── Approval Types ───────────────────────────────────────────────────────────

type ApprovalCategory = 'deductions' | 'disciplinary' | 'memos' | 'communication' | 'others';
type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Acknowledged';

interface ApprovalItem {
  id: string;
  category: ApprovalCategory;
  title: string;
  description: string;
  amount?: number;
  issuedBy: string;
  issuedByDesignation: string;
  issuedOn: string;
  dueBy?: string;
  status: ApprovalStatus;
  employeeResponse?: 'Approved' | 'Rejected';
  employeeResponseOn?: string;
  employeeRemarks?: string;
  hrRemarks?: string;
  referenceNo: string;
  payrollPeriod?: string;
  attachments?: string[];
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
}

type PortalTab = 'dashboard' | 'payslips' | 'leaves' | 'loans' | 'approvals' | 'manager' | 'profile' | 'settings';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  bgColor: string;
}

// ─── Leave Color Map ──────────────────────────────────────────────────────────

const LEAVE_COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string; bar: string; light: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', bar: 'bg-blue-500', light: 'bg-blue-50' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', bar: 'bg-rose-500', light: 'bg-rose-50' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500', light: 'bg-emerald-50' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500', bar: 'bg-violet-500', light: 'bg-violet-50' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', bar: 'bg-orange-500', light: 'bg-orange-50' },
};

function getLeaveColor(color: string) {
  return LEAVE_COLOR_MAP[color] ?? LEAVE_COLOR_MAP['blue'];
}

// ─── Loan Type Config ─────────────────────────────────────────────────────────

const LOAN_TYPE_CONFIG: Record<LoanTypeName, { maxAmount: number; maxTenure: number; interestRate: number; isInterestFree: boolean; eligibilityMonths: number; color: string; iconColor: string; accentBg: string; accentText: string; accentBorder: string; description: string }> = {
  'Personal Loan': { maxAmount: 200000, maxTenure: 24, interestRate: 10, isInterestFree: false, eligibilityMonths: 6, color: 'bg-blue-100', iconColor: 'text-blue-600', accentBg: 'bg-blue-50', accentText: 'text-blue-700', accentBorder: 'border-blue-200', description: 'General purpose personal loan for employees' },
  'Emergency Advance': { maxAmount: 50000, maxTenure: 6, interestRate: 0, isInterestFree: true, eligibilityMonths: 3, color: 'bg-red-100', iconColor: 'text-red-600', accentBg: 'bg-red-50', accentText: 'text-red-700', accentBorder: 'border-red-200', description: 'Interest-free emergency advance for urgent needs' },
  'Festival Advance': { maxAmount: 30000, maxTenure: 5, interestRate: 0, isInterestFree: true, eligibilityMonths: 12, color: 'bg-amber-100', iconColor: 'text-amber-600', accentBg: 'bg-amber-50', accentText: 'text-amber-700', accentBorder: 'border-amber-200', description: 'Festival advance disbursed before major festivals' },
  'Vehicle Loan': { maxAmount: 300000, maxTenure: 36, interestRate: 8, isInterestFree: false, eligibilityMonths: 12, color: 'bg-violet-100', iconColor: 'text-violet-600', accentBg: 'bg-violet-50', accentText: 'text-violet-700', accentBorder: 'border-violet-200', description: 'Vehicle purchase loan for two-wheelers and four-wheelers' },
  'Education Loan': { maxAmount: 100000, maxTenure: 24, interestRate: 6, isInterestFree: false, eligibilityMonths: 12, color: 'bg-emerald-100', iconColor: 'text-emerald-600', accentBg: 'bg-emerald-50', accentText: 'text-emerald-700', accentBorder: 'border-emerald-200', description: 'Education loan for self or dependent children' },
  'Medical Advance': { maxAmount: 75000, maxTenure: 12, interestRate: 0, isInterestFree: true, eligibilityMonths: 0, color: 'bg-rose-100', iconColor: 'text-rose-600', accentBg: 'bg-rose-50', accentText: 'text-rose-700', accentBorder: 'border-rose-200', description: 'Medical emergency advance for hospitalization expenses' },
};

const DEFAULT_LOAN_STYLE = { maxAmount: 0, maxTenure: 0, interestRate: 0, isInterestFree: false, eligibilityMonths: 0, color: 'bg-violet-100', iconColor: 'text-violet-600', accentBg: 'bg-violet-50', accentText: 'text-violet-700', accentBorder: 'border-violet-200', description: '' };

/** Map a DB loan (lib/loans) into the portal's display shape. */
function uiLoanToApplication(u: UiLoan): LoanApplication {
  return {
    id: u.id, loanType: u.loanTypeName, principalAmount: u.principalAmount, interestRate: u.interestRate,
    tenureMonths: u.tenureMonths, emiAmount: u.emiAmount, disbursedDate: u.disbursedDate, appliedDate: u.appliedDate,
    status: u.status, purpose: u.purpose, paidEMIs: u.paidEMIs, outstandingBalance: u.outstandingBalance,
    remarks: u.remarks, schedule: [],
  };
}
/** Visual style for a loan-type name; falls back to a neutral style for any
 *  DB-defined type that isn't one of the legacy named presets. */
const loanStyle = (name: string) => (LOAN_TYPE_CONFIG as Record<string, typeof DEFAULT_LOAN_STYLE>)[name] ?? DEFAULT_LOAN_STYLE;

const LOAN_STATUS_STYLES: Record<LoanStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  Approved: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: CheckCircle2 },
  Active: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: TrendingDown },
  Closed: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: CheckCircle2 },
  Rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
};

// ─── Approval Category Config ─────────────────────────────────────────────────

const APPROVAL_CATEGORY_CONFIG: Record<ApprovalCategory, {
  label: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  description: string;
}> = {
  deductions: {
    label: 'Deductions',
    icon: MinusCircle,
    color: 'bg-red-100',
    iconColor: 'text-red-600',
    accentBg: 'bg-red-50',
    accentText: 'text-red-700',
    accentBorder: 'border-red-200',
    description: 'Salary deductions requiring your acknowledgement',
  },
  disciplinary: {
    label: 'Disciplinary Action',
    icon: Gavel,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-700',
    accentBorder: 'border-amber-200',
    description: 'Disciplinary notices and actions issued by HR',
  },
  memos: {
    label: 'Memos',
    icon: FileWarning,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-700',
    accentBorder: 'border-violet-200',
    description: 'Official memos and notices requiring acknowledgement',
  },
  communication: {
    label: 'Communication',
    icon: Megaphone,
    color: 'bg-blue-100',
    iconColor: 'text-blue-600',
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-700',
    accentBorder: 'border-blue-200',
    description: 'HR communications and announcements',
  },
  others: {
    label: 'Others',
    icon: MoreHorizontal,
    color: 'bg-gray-100',
    iconColor: 'text-gray-600',
    accentBg: 'bg-gray-50',
    accentText: 'text-gray-700',
    accentBorder: 'border-gray-200',
    description: 'Other approvals and acknowledgements',
  },
};

const APPROVAL_STATUS_STYLES: Record<ApprovalStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  Approved: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: ThumbsUp },
  Rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: ThumbsDown },
  Acknowledged: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: CheckCheck },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Low: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  Medium: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  High: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  Critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

const DEMO_CREDENTIALS = [
  { username: 'EMP2524001', password: 'EMP2524001', employeeId: 'EMP001' },
  { username: 'EMP2524002', password: 'EMP2524002', employeeId: 'EMP002' },
  { username: 'EMP2524003', password: 'EMP2524003', employeeId: 'EMP003' },
];

const EMPLOYEE_PROFILES: Record<string, EmployeeSession> = {
  EMP001: {
    id: 'EMP001', employeeCode: 'EMP2524001', name: 'Sarah Jenkins',
    designation: 'Senior Software Engineer', department: 'Engineering',
    workLocation: 'Head Office – Mumbai', employeeType: 'Permanent',
    employeeGrade: 'Grade B2', avatar: 'SJ',
    email: 'sarah.jenkins@nexus.com', phone: '+91 98765 43210',
    doj: '2022-01-15', pan: 'ABCDE1234F', uan: '100123456789',
    bankAccount: 'XXXX XXXX 5678', ifsc: 'HDFC0001234', bankName: 'HDFC Bank',
  },
  EMP002: {
    id: 'EMP002', employeeCode: 'EMP2524002', name: 'Michael Chen',
    designation: 'Growth Lead', department: 'Marketing',
    workLocation: 'Head Office – Mumbai', employeeType: 'Permanent',
    employeeGrade: 'Grade B1', avatar: 'MC',
    email: 'michael.chen@nexus.com', phone: '+91 98765 43211',
    doj: '2022-03-01', pan: 'BCDEF2345G', uan: '100123456790',
    bankAccount: 'XXXX XXXX 1234', ifsc: 'ICIC0001234', bankName: 'ICICI Bank',
  },
  EMP003: {
    id: 'EMP003', employeeCode: 'EMP2524003', name: 'Elena Rodriguez',
    designation: 'Product Designer', department: 'Design',
    workLocation: 'Regional Office – Delhi', employeeType: 'Permanent',
    employeeGrade: 'Grade B1', avatar: 'ER',
    email: 'elena.rodriguez@nexus.com', phone: '+91 98765 43212',
    doj: '2021-06-10', pan: 'CDEFG3456H', uan: '100123456791',
    bankAccount: 'XXXX XXXX 9012', ifsc: 'SBIN0001234', bankName: 'SBI',
  },
};

const PAYSLIPS_DATA: Record<string, Payslip[]> = {
  EMP001: [
    {
      id: 'PS001-001', periodId: 'PP004', periodName: 'July 2025', periodCode: 'JUL-2025',
      fromDate: '2025-07-01', toDate: '2025-07-31', paymentDate: '2025-07-31',
      financialYear: '2025-26', status: 'Approved',
      basic: 40000, hra: 20000, conveyance: 1600, medicalAllowance: 1250,
      specialAllowance: 5000, lta: 0, overtimeAmount: 2250,
      gross: 70100, pfEmployee: 1800, esiEmployee: 0, professionalTax: 200,
      tds: 3500, loanEmi: 8791, otherDeductions: 0,
      totalDeductions: 14291, net: 55809,
      workingDays: 23, presentDays: 22, leaveDays: 1, lopDays: 0,
      overtimeHours: 4.5, acknowledged: false,
    },
    {
      id: 'PS001-002', periodId: 'PP003', periodName: 'June 2025', periodCode: 'JUN-2025',
      fromDate: '2025-06-01', toDate: '2025-06-30', paymentDate: '2025-06-30',
      financialYear: '2025-26', status: 'Disbursed',
      basic: 40000, hra: 20000, conveyance: 1600, medicalAllowance: 1250,
      specialAllowance: 5000, lta: 0, overtimeAmount: 0,
      gross: 67850, pfEmployee: 1800, esiEmployee: 0, professionalTax: 200,
      tds: 3500, loanEmi: 8791, otherDeductions: 0,
      totalDeductions: 14291, net: 53559,
      workingDays: 22, presentDays: 21, leaveDays: 1, lopDays: 0,
      overtimeHours: 0, acknowledged: true, acknowledgedAt: '2025-07-02 09:15',
    },
  ],
  EMP002: [
    {
      id: 'PS002-001', periodId: 'PP004', periodName: 'July 2025', periodCode: 'JUL-2025',
      fromDate: '2025-07-01', toDate: '2025-07-31', paymentDate: '2025-07-31',
      financialYear: '2025-26', status: 'Approved',
      basic: 30000, hra: 15000, conveyance: 1600, medicalAllowance: 1250,
      specialAllowance: 5000, lta: 0, overtimeAmount: 0,
      gross: 52850, pfEmployee: 1800, esiEmployee: 396, professionalTax: 200,
      tds: 2000, loanEmi: 0, otherDeductions: 1850,
      totalDeductions: 6246, net: 46604,
      workingDays: 23, presentDays: 20, leaveDays: 0, lopDays: 3,
      overtimeHours: 0, acknowledged: false,
    },
  ],
  EMP003: [
    {
      id: 'PS003-001', periodId: 'PP004', periodName: 'July 2025', periodCode: 'JUL-2025',
      fromDate: '2025-07-01', toDate: '2025-07-31', paymentDate: '2025-07-31',
      financialYear: '2025-26', status: 'Approved',
      basic: 28000, hra: 14000, conveyance: 1600, medicalAllowance: 1250,
      specialAllowance: 5000, lta: 0, overtimeAmount: 1000,
      gross: 50850, pfEmployee: 1800, esiEmployee: 373, professionalTax: 200,
      tds: 1800, loanEmi: 0, otherDeductions: 0,
      totalDeductions: 4173, net: 46677,
      workingDays: 23, presentDays: 21, leaveDays: 2, lopDays: 0,
      overtimeHours: 2, acknowledged: false,
    },
  ],
};

const LEAVE_BALANCES_DATA: Record<string, LeaveBalance[]> = {
  EMP001: [
    { leaveTypeId: 'LT001', leaveTypeName: 'Casual Leave', leaveTypeCode: 'CL', color: 'blue', totalDays: 12, usedDays: 4, pendingDays: 3, availableDays: 5, accrualFrequency: 'Monthly' },
    { leaveTypeId: 'LT002', leaveTypeName: 'Sick Leave', leaveTypeCode: 'SL', color: 'rose', totalDays: 12, usedDays: 2, pendingDays: 0, availableDays: 10, accrualFrequency: 'Monthly' },
    { leaveTypeId: 'LT003', leaveTypeName: 'Earned Leave', leaveTypeCode: 'EL', color: 'emerald', totalDays: 30, usedDays: 8, pendingDays: 5, availableDays: 17, accrualFrequency: 'Monthly' },
    { leaveTypeId: 'LT007', leaveTypeName: 'Compensatory Off', leaveTypeCode: 'CO', color: 'violet', totalDays: 4, usedDays: 2, pendingDays: 0, availableDays: 2, accrualFrequency: 'As Earned' },
    { leaveTypeId: 'LT008', leaveTypeName: 'Unpaid Leave', leaveTypeCode: 'UL', color: 'orange', totalDays: 0, usedDays: 0, pendingDays: 0, availableDays: 0, accrualFrequency: 'N/A' },
  ],
  EMP002: [
    { leaveTypeId: 'LT001', leaveTypeName: 'Casual Leave', leaveTypeCode: 'CL', color: 'blue', totalDays: 12, usedDays: 6, pendingDays: 0, availableDays: 6, accrualFrequency: 'Monthly' },
    { leaveTypeId: 'LT002', leaveTypeName: 'Sick Leave', leaveTypeCode: 'SL', color: 'rose', totalDays: 12, usedDays: 3, pendingDays: 0, availableDays: 9, accrualFrequency: 'Monthly' },
    { leaveTypeId: 'LT003', leaveTypeName: 'Earned Leave', leaveTypeCode: 'EL', color: 'emerald', totalDays: 30, usedDays: 5, pendingDays: 0, availableDays: 25, accrualFrequency: 'Monthly' },
    { leaveTypeId: 'LT007', leaveTypeName: 'Compensatory Off', leaveTypeCode: 'CO', color: 'violet', totalDays: 2, usedDays: 0, pendingDays: 0, availableDays: 2, accrualFrequency: 'As Earned' },
    { leaveTypeId: 'LT008', leaveTypeName: 'Unpaid Leave', leaveTypeCode: 'UL', color: 'orange', totalDays: 0, usedDays: 0, pendingDays: 0, availableDays: 0, accrualFrequency: 'N/A' },
  ],
  EMP003: [
    { leaveTypeId: 'LT001', leaveTypeName: 'Casual Leave', leaveTypeCode: 'CL', color: 'blue', totalDays: 12, usedDays: 3, pendingDays: 0, availableDays: 9, accrualFrequency: 'Monthly' },
    { leaveTypeId: 'LT002', leaveTypeName: 'Sick Leave', leaveTypeCode: 'SL', color: 'rose', totalDays: 12, usedDays: 1, pendingDays: 0, availableDays: 11, accrualFrequency: 'Monthly' },
    { leaveTypeId: 'LT003', leaveTypeName: 'Earned Leave', leaveTypeCode: 'EL', color: 'emerald', totalDays: 30, usedDays: 10, pendingDays: 2, availableDays: 18, accrualFrequency: 'Monthly' },
    { leaveTypeId: 'LT007', leaveTypeName: 'Compensatory Off', leaveTypeCode: 'CO', color: 'violet', totalDays: 3, usedDays: 1, pendingDays: 0, availableDays: 2, accrualFrequency: 'As Earned' },
    { leaveTypeId: 'LT008', leaveTypeName: 'Unpaid Leave', leaveTypeCode: 'UL', color: 'orange', totalDays: 0, usedDays: 0, pendingDays: 0, availableDays: 0, accrualFrequency: 'N/A' },
  ],
};

const LEAVE_REQUESTS_DATA: Record<string, LeaveRequest[]> = {
  EMP001: [
    {
      id: 'LR001-001', leaveTypeId: 'LT001', leaveTypeName: 'Casual Leave', leaveTypeCode: 'CL', leaveTypeColor: 'blue',
      fromDate: '2025-07-10', toDate: '2025-07-10', days: 1, isHalfDay: false,
      reason: 'Personal work', contactDuringLeave: '+91 98765 43210', handoverTo: 'Priya Nair',
      status: 'Pending', appliedOn: '2025-07-05',
    },
    {
      id: 'LR001-002', leaveTypeId: 'LT002', leaveTypeName: 'Sick Leave', leaveTypeCode: 'SL', leaveTypeColor: 'rose',
      fromDate: '2025-06-20', toDate: '2025-06-21', days: 2, isHalfDay: false,
      reason: 'Fever and cold, doctor advised rest', contactDuringLeave: '+91 98765 43210', handoverTo: 'David Kim',
      status: 'Approved', appliedOn: '2025-06-19', approvedBy: 'Lisa Thompson', approvedOn: '2025-06-19',
    },
  ],
  EMP002: [
    {
      id: 'LR002-001', leaveTypeId: 'LT001', leaveTypeName: 'Casual Leave', leaveTypeCode: 'CL', leaveTypeColor: 'blue',
      fromDate: '2025-07-15', toDate: '2025-07-15', days: 1, isHalfDay: false,
      reason: 'Personal work', contactDuringLeave: '+91 98765 43211', handoverTo: 'Anita Desai',
      status: 'Pending', appliedOn: '2025-07-10',
    },
  ],
  EMP003: [
    {
      id: 'LR003-001', leaveTypeId: 'LT003', leaveTypeName: 'Earned Leave', leaveTypeCode: 'EL', leaveTypeColor: 'emerald',
      fromDate: '2025-07-28', toDate: '2025-07-29', days: 2, isHalfDay: false,
      reason: 'Family function', contactDuringLeave: '+91 98765 43212', handoverTo: 'Rajiv Sharma',
      status: 'Pending', appliedOn: '2025-07-12',
    },
  ],
};

function calcEMI(principal: number, rate: number, tenure: number): number {
  if (rate === 0) return Math.round(principal / tenure);
  const r = rate / 12 / 100;
  return Math.round((principal * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1));
}

function generateSchedule(principal: number, rate: number, tenure: number, startDate: string): LoanEMI[] {
  const emi = calcEMI(principal, rate, tenure);
  const schedule: LoanEMI[] = [];
  let balance = principal;
  const start = new Date(startDate + 'T00:00:00');
  for (let i = 1; i <= tenure; i++) {
    const interest = Math.round(balance * (rate / 12 / 100));
    const principalPart = emi - interest;
    balance -= principalPart;
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);
    schedule.push({
      month: i,
      dueDate: dueDate.toISOString().split('T')[0],
      amount: emi,
      principal: principalPart,
      interest,
      paid: i <= 3,
      paidDate: i <= 3 ? dueDate.toISOString().split('T')[0] : undefined,
    });
  }
  return schedule;
}

const LOANS_DATA: Record<string, LoanApplication[]> = {
  EMP001: [
    {
      id: 'LN001-001',
      loanType: 'Personal Loan',
      principalAmount: 100000,
      interestRate: 10,
      tenureMonths: 12,
      emiAmount: calcEMI(100000, 10, 12),
      disbursedDate: '2025-04-01',
      appliedDate: '2025-03-20',
      status: 'Active',
      purpose: 'Home renovation and furniture purchase',
      paidEMIs: 3,
      outstandingBalance: 76000,
      approvedBy: 'Lisa Thompson',
      approvedOn: '2025-03-25',
      schedule: generateSchedule(100000, 10, 12, '2025-04-01'),
    },
  ],
  EMP002: [
    {
      id: 'LN002-001',
      loanType: 'Emergency Advance',
      principalAmount: 30000,
      interestRate: 0,
      tenureMonths: 6,
      emiAmount: 5000,
      disbursedDate: '',
      appliedDate: '2025-07-10',
      status: 'Pending',
      purpose: 'Medical emergency for family member',
      paidEMIs: 0,
      outstandingBalance: 30000,
      schedule: [],
    },
  ],
  EMP003: [],
};

// ─── Approvals Seed Data ──────────────────────────────────────────────────────

const APPROVALS_DATA: Record<string, ApprovalItem[]> = {
  EMP001: [
    {
      id: 'APR001-001',
      category: 'deductions',
      title: 'Canteen Charges — June 2025',
      description: 'Monthly canteen meal charges for June 2025. Total meals consumed: 22 days × ₹84/day.',
      amount: 1850,
      issuedBy: 'Lisa Thompson',
      issuedByDesignation: 'HR Manager',
      issuedOn: '2025-07-02',
      dueBy: '2025-07-10',
      status: 'Pending',
      referenceNo: 'CAN/JUN/2025/SJ',
      payrollPeriod: 'July 2025',
      priority: 'Medium',
    },
    {
      id: 'APR001-002',
      category: 'deductions',
      title: 'Laptop Screen Damage Recovery',
      description: 'Recovery for accidental damage to company laptop screen (Asset No: LAP-2024-042). Repair cost as per IT department assessment.',
      amount: 3500,
      issuedBy: 'Vikram Rao',
      issuedByDesignation: 'Finance Manager',
      issuedOn: '2025-07-05',
      dueBy: '2025-07-15',
      status: 'Rejected',
      employeeResponse: 'Rejected',
      employeeResponseOn: '2025-07-07 14:30',
      employeeRemarks: 'The damage was pre-existing and not caused by me. Requesting review with IT department.',
      referenceNo: 'DAM/JUL/2025/SJ',
      payrollPeriod: 'July 2025',
      priority: 'High',
    },
    {
      id: 'APR001-003',
      category: 'deductions',
      title: 'Society Contribution — July 2025',
      description: 'Monthly co-operative society contribution as per your enrollment in the Employee Welfare Society.',
      amount: 2000,
      issuedBy: 'Lisa Thompson',
      issuedByDesignation: 'HR Manager',
      issuedOn: '2025-07-01',
      status: 'Approved',
      employeeResponse: 'Approved',
      employeeResponseOn: '2025-07-02 09:15',
      referenceNo: 'SOC/JUL/2025/SJ',
      payrollPeriod: 'July 2025',
      priority: 'Low',
    },
    {
      id: 'APR001-004',
      category: 'disciplinary',
      title: 'Warning Letter — Late Attendance',
      description: 'This is a formal warning for repeated late arrivals. You have been late on 5 occasions in June 2025, which is a violation of company attendance policy. Please ensure punctuality going forward.',
      issuedBy: 'Priya Nair',
      issuedByDesignation: 'Engineering Manager',
      issuedOn: '2025-07-03',
      dueBy: '2025-07-10',
      status: 'Pending',
      referenceNo: 'DISC/WARN/2025/SJ/001',
      priority: 'High',
    },
    {
      id: 'APR001-005',
      category: 'memos',
      title: 'Work From Home Policy Update',
      description: 'Please acknowledge the updated Work From Home policy effective August 1, 2025. Key changes include: maximum 2 WFH days per week, mandatory core hours 10 AM – 4 PM, and prior manager approval required.',
      issuedBy: 'Lisa Thompson',
      issuedByDesignation: 'HR Manager',
      issuedOn: '2025-07-08',
      dueBy: '2025-07-20',
      status: 'Pending',
      referenceNo: 'MEMO/HR/2025/WFH/001',
      priority: 'Medium',
    },
    {
      id: 'APR001-006',
      category: 'memos',
      title: 'Annual Performance Review — Self Assessment',
      description: 'Please complete your self-assessment for the Annual Performance Review FY 2024-25. The self-assessment form has been shared via email. Deadline: July 25, 2025.',
      issuedBy: 'Lisa Thompson',
      issuedByDesignation: 'HR Manager',
      issuedOn: '2025-07-10',
      dueBy: '2025-07-25',
      status: 'Acknowledged',
      employeeResponseOn: '2025-07-11 10:00',
      referenceNo: 'MEMO/HR/2025/APR/SJ',
      priority: 'High',
    },
    {
      id: 'APR001-007',
      category: 'communication',
      title: 'Office Relocation Notice — August 2025',
      description: 'Please be informed that the Engineering team will be relocated to the new floor (14th Floor, Tower B) effective August 15, 2025. All team members are requested to pack their belongings by August 12, 2025.',
      issuedBy: 'Admin Team',
      issuedByDesignation: 'Administration',
      issuedOn: '2025-07-09',
      status: 'Acknowledged',
      employeeResponseOn: '2025-07-09 16:30',
      referenceNo: 'COMM/ADMIN/2025/RELOC',
      priority: 'Medium',
    },
    {
      id: 'APR001-008',
      category: 'communication',
      title: 'Mandatory Training — Cybersecurity Awareness',
      description: 'All employees are required to complete the Cybersecurity Awareness Training by July 31, 2025. The training is available on the Learning Management System. Completion is mandatory and will be tracked.',
      issuedBy: 'IT Security Team',
      issuedByDesignation: 'IT Department',
      issuedOn: '2025-07-05',
      dueBy: '2025-07-31',
      status: 'Pending',
      referenceNo: 'COMM/IT/2025/CYBER/001',
      priority: 'High',
    },
    {
      id: 'APR001-009',
      category: 'others',
      title: 'Uniform Deduction — Q2 2025',
      description: 'Quarterly uniform cost recovery for Q2 2025 (April–June). This covers the cost of 2 sets of company uniform issued to you.',
      amount: 1200,
      issuedBy: 'Admin Team',
      issuedByDesignation: 'Administration',
      issuedOn: '2025-07-01',
      status: 'Pending',
      referenceNo: 'UNI/Q2/2025/SJ',
      payrollPeriod: 'July 2025',
      priority: 'Low',
    },
  ],
  EMP002: [
    {
      id: 'APR002-001',
      category: 'deductions',
      title: 'Canteen Charges — June 2025',
      description: 'Monthly canteen meal charges for June 2025.',
      amount: 1650,
      issuedBy: 'Lisa Thompson',
      issuedByDesignation: 'HR Manager',
      issuedOn: '2025-07-02',
      dueBy: '2025-07-10',
      status: 'Pending',
      referenceNo: 'CAN/JUN/2025/MC',
      payrollPeriod: 'July 2025',
      priority: 'Medium',
    },
    {
      id: 'APR002-002',
      category: 'memos',
      title: 'Work From Home Policy Update',
      description: 'Please acknowledge the updated Work From Home policy effective August 1, 2025.',
      issuedBy: 'Lisa Thompson',
      issuedByDesignation: 'HR Manager',
      issuedOn: '2025-07-08',
      dueBy: '2025-07-20',
      status: 'Pending',
      referenceNo: 'MEMO/HR/2025/WFH/001',
      priority: 'Medium',
    },
    {
      id: 'APR002-003',
      category: 'communication',
      title: 'Mandatory Training — Cybersecurity Awareness',
      description: 'All employees are required to complete the Cybersecurity Awareness Training by July 31, 2025.',
      issuedBy: 'IT Security Team',
      issuedByDesignation: 'IT Department',
      issuedOn: '2025-07-05',
      dueBy: '2025-07-31',
      status: 'Acknowledged',
      employeeResponseOn: '2025-07-06 11:00',
      referenceNo: 'COMM/IT/2025/CYBER/001',
      priority: 'High',
    },
  ],
  EMP003: [
    {
      id: 'APR003-001',
      category: 'deductions',
      title: 'Donation — PM Relief Fund',
      description: 'Voluntary donation to PM Relief Fund as per your authorization form submitted on June 1, 2025.',
      amount: 5000,
      issuedBy: 'Lisa Thompson',
      issuedByDesignation: 'HR Manager',
      issuedOn: '2025-07-01',
      status: 'Approved',
      employeeResponse: 'Approved',
      employeeResponseOn: '2025-07-01 14:30',
      referenceNo: 'DON/JUN/2025/ER',
      payrollPeriod: 'July 2025',
      priority: 'Low',
    },
    {
      id: 'APR003-002',
      category: 'memos',
      title: 'Work From Home Policy Update',
      description: 'Please acknowledge the updated Work From Home policy effective August 1, 2025.',
      issuedBy: 'Lisa Thompson',
      issuedByDesignation: 'HR Manager',
      issuedOn: '2025-07-08',
      dueBy: '2025-07-20',
      status: 'Pending',
      referenceNo: 'MEMO/HR/2025/WFH/001',
      priority: 'Medium',
    },
    {
      id: 'APR003-003',
      category: 'communication',
      title: 'Office Relocation Notice — August 2025',
      description: 'Please be informed about the upcoming office relocation effective August 15, 2025.',
      issuedBy: 'Admin Team',
      issuedByDesignation: 'Administration',
      issuedOn: '2025-07-09',
      status: 'Pending',
      referenceNo: 'COMM/ADMIN/2025/RELOC',
      priority: 'Medium',
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function formatAmount(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

// "DD/Mon/YYYY HH:MM" from an ISO timestamp (used for acknowledgement timestamps).
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2, '0')}/${months[d.getMonth()]}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (num === 0) return 'Zero';
  function convertHundreds(n: number): string {
    let result = '';
    if (n >= 100) { result += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
    if (n >= 20) { result += tens[Math.floor(n / 10)] + ' '; n %= 10; }
    if (n > 0) result += ones[n] + ' ';
    return result;
  }
  let result = '';
  if (num >= 10000000) { result += convertHundreds(Math.floor(num / 10000000)) + 'Crore '; num %= 10000000; }
  if (num >= 100000) { result += convertHundreds(Math.floor(num / 100000)) + 'Lakh '; num %= 100000; }
  if (num >= 1000) { result += convertHundreds(Math.floor(num / 1000)) + 'Thousand '; num %= 1000; }
  result += convertHundreds(num);
  return result.trim() + ' Only';
}

function calcDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const d1 = new Date(from + 'T00:00:00');
  const d2 = new Date(to + 'T00:00:00');
  const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', color: 'text-gray-400', bgColor: 'bg-gray-200' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const normalized = Math.min(4, score);
  const levels: PasswordStrength[] = [
    { score: 0, label: 'Too Weak', color: 'text-red-600', bgColor: 'bg-red-500' },
    { score: 1, label: 'Weak', color: 'text-red-500', bgColor: 'bg-red-400' },
    { score: 2, label: 'Fair', color: 'text-amber-600', bgColor: 'bg-amber-400' },
    { score: 3, label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-500' },
    { score: 4, label: 'Strong', color: 'text-green-600', bgColor: 'bg-green-500' },
  ];
  return levels[normalized];
}

interface PasswordRule { label: string; met: boolean; }

function getPasswordRules(password: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'At least one uppercase letter (A–Z)', met: /[A-Z]/.test(password) },
    { label: 'At least one lowercase letter (a–z)', met: /[a-z]/.test(password) },
    { label: 'At least one number (0–9)', met: /[0-9]/.test(password) },
    { label: 'At least one special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

function generatePayslipHTML(employee: EmployeeSession, payslip: Payslip): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payslip — ${employee.name} — ${payslip.periodName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1f2937; background: #f3f4f6; }
    .page { width: 210mm; min-height: 297mm; background: white; margin: 0 auto; padding: 20mm 15mm; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
    .header { border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 16px; }
    .company-name { font-size: 18px; font-weight: bold; color: #1e3a5f; }
    .net-pay-section { background: linear-gradient(135deg, #1e3a5f, #2563eb); color: white; padding: 14px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    .generated-note { font-size: 9px; color: #9ca3af; text-align: center; margin-top: 8px; }
    @media print { body { background: white; } .page { box-shadow: none; margin: 0; width: 100%; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="background:#1e3a5f;color:white;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">
    <span style="font-size:13px;font-weight:600;">💰 Payslip — ${employee.name} — ${payslip.periodName}</span>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">🖨️ Print / Save PDF</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;">✕ Close</button>
    </div>
  </div>
  <div class="page">
    <div class="header">
      <div class="company-name">Nexus Technologies Pvt. Ltd.</div>
      <div style="font-size:13px;font-weight:bold;color:#374151;margin-top:4px;">SALARY SLIP — ${payslip.periodName}</div>
    </div>
    <div class="net-pay-section">
      <div>
        <div style="font-size:12px;font-weight:600;opacity:0.9;">Net Pay (Take Home)</div>
        <div style="font-size:10px;opacity:0.7;margin-top:2px;">${numberToWords(payslip.net)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:22px;font-weight:bold;">${formatAmount(payslip.net)}</div>
      </div>
    </div>
    <div class="generated-note">This is a computer-generated payslip. | Nexus Technologies Pvt. Ltd. | ${payslip.periodName}</div>
  </div>
</body>
</html>`;
}

// ─── DB-backed session builder ────────────────────────────────────────────────

/** Build an EmployeeSession from a User Master account by reading the real employee record. */
async function buildSessionFromAccount(account: SystemUserAccount): Promise<EmployeeSession> {
  const base: EmployeeSession = {
    id: account.employeeId || account.loginId,
    dbEmployeeId: account.employeeId || undefined,
    employeeCode: account.employeeCode || account.loginId,
    loginId: account.loginId,
    mustChangePassword: account.mustChangePassword,
    name: account.name || account.loginId,
    designation: '—', department: '—', workLocation: '—', employeeType: '—', employeeGrade: '—',
    avatar: (account.name || account.loginId).split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    email: account.email || '', phone: account.mobile || '',
    doj: '', pan: '—', uan: '—', bankAccount: '—', ifsc: '—', bankName: '—',
  };
  if (!account.employeeId) return base;
  const { data } = await supabase
    .from('employees')
    .select('first_name, middle_name, last_name, date_of_joining, mobile_number, email, designation:designations(name), department:departments(name), work_location:work_locations(name), employee_type:employee_types(name), grade:employee_grades(name), employee_statutory(pan_no, uan_no), employee_bank_accounts(account_number, ifsc_code, bank_name, is_primary)')
    .eq('id', account.employeeId)
    .maybeSingle();
  if (!data) return base;
  const r = data as Record<string, any>;
  const name = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ') || base.name;
  const stat = Array.isArray(r.employee_statutory) ? r.employee_statutory[0] : r.employee_statutory;
  const banks = Array.isArray(r.employee_bank_accounts) ? r.employee_bank_accounts : [];
  const bank = banks.find((b: any) => b.is_primary) ?? banks[0];
  const acctNo = bank?.account_number ? `XXXX XXXX ${String(bank.account_number).slice(-4)}` : '—';
  return {
    ...base,
    name,
    avatar: name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    designation: r.designation?.name ?? '—',
    department: r.department?.name ?? '—',
    workLocation: r.work_location?.name ?? '—',
    employeeType: r.employee_type?.name ?? '—',
    employeeGrade: r.grade?.name ?? '—',
    email: r.email || base.email,
    phone: r.mobile_number || base.phone,
    doj: r.date_of_joining ?? '',
    pan: stat?.pan_no ?? '—',
    uan: stat?.uan_no ?? '—',
    bankAccount: acctNo,
    ifsc: bank?.ifsc_code ?? '—',
    bankName: bank?.bank_name ?? '—',
  };
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

interface LoginScreenProps {
  onLogin: (session: EmployeeSession) => void;
}

const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) { setError('Please enter your Employee ID.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }
    setLoading(true);
    setError('');
    // 1) Authenticate against the real User Master (system_users).
    const account = await verifyLogin(username.trim(), password.trim());
    if (account) {
      const session = await buildSessionFromAccount(account);
      setLoading(false);
      onLogin(session);
      toast.success(`Welcome back, ${session.name.split(' ')[0]}!`);
      return;
    }
    // 2) Fall back to the legacy demo accounts.
    const cred = DEMO_CREDENTIALS.find(c => c.username === username.trim() && c.password === password.trim());
    if (cred && EMPLOYEE_PROFILES[cred.employeeId]) {
      const profile = EMPLOYEE_PROFILES[cred.employeeId];
      setLoading(false);
      onLogin(profile);
      toast.success(`Welcome back, ${profile.name.split(' ')[0]}!`);
      return;
    }
    setLoading(false);
    setError('Invalid Employee ID or password. Please try again.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-white text-2xl font-bold font-serif">S</span>
            </div>
            <h1 className="text-xl font-bold text-white">SakthiHR</h1>
            <p className="text-blue-100 text-sm mt-1">Employee Self-Service Portal</p>
          </div>

          <div className="px-8 py-8 space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Sign In to Your Account</h2>
              <p className="text-sm text-gray-500 mt-1">Use your Employee ID and password</p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700">
                <p className="font-semibold mb-0.5">Demo Credentials</p>
                <p>Employee ID: <strong>EMP2524001</strong> · Password: <strong>EMP2524001</strong></p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-sm transition-all"
                  placeholder="e.g. EMP2524001"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-9 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-sm transition-all"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
                <button onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <button onClick={() => setShowForgot(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">
                  Forgot your password?
                </button>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in...</>
              ) : (
                <><Lock size={16} /> Sign In</>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      </AnimatePresence>
    </div>
  );
};

// ─── Forgot Password Modal ────────────────────────────────────────────────────

const ForgotPasswordModal = ({ onClose }: { onClose: () => void }) => {
  const [empId, setEmpId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ sent: boolean } | null>(null);

  const handleSubmit = async () => {
    if (!empId.trim()) { setError('Please enter your Employee ID.'); return; }
    setLoading(true);
    setError('');
    const res = await resetPasswordAndNotify(empId.trim());
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setDone({ sent: !!res.notified });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl"><Key size={18} className="text-indigo-600" /></div>
            <div>
              <h2 className="text-base font-bold text-indigo-900">Forgot Password</h2>
              <p className="text-xs text-indigo-600">Reset your Self-Service portal password</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><X size={20} /></button>
        </div>

        {done ? (
          <div className="p-6 space-y-4 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Password Reset</p>
              <p className="text-sm text-gray-500 mt-1">
                {done.sent
                  ? 'A new password has been sent to your registered email address. Use it to sign in, then set a new password.'
                  : 'A new password has been generated, but no email address is on file. Please contact HR to receive it.'}
              </p>
            </div>
            <button onClick={onClose} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">Back to Sign In</button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <p className="text-sm text-gray-600">Enter your Employee ID. We'll generate a new password and send it to your registered email address.</p>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 text-sm font-mono transition-all" placeholder="e.g. SMS0001" value={empId} onChange={e => { setEmpId(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertCircle size={13} className="shrink-0" /> {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <><Key size={15} /> Reset & Send</>}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ─── Approval Detail Modal ────────────────────────────────────────────────────

interface ApprovalDetailModalProps {
  item: ApprovalItem;
  onClose: () => void;
  onApprove: (id: string, remarks: string) => void;
  onReject: (id: string, remarks: string) => void;
  onAcknowledge: (id: string) => void;
}

const ApprovalDetailModal = ({ item, onClose, onApprove, onReject, onAcknowledge }: ApprovalDetailModalProps) => {
  const [remarks, setRemarks] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const catConfig = APPROVAL_CATEGORY_CONFIG[item.category];
  const CatIcon = catConfig.icon;
  const statusStyle = APPROVAL_STATUS_STYLES[item.status];
  const StatusIcon = statusStyle.icon;
  const priorityStyle = PRIORITY_STYLES[item.priority];

  const needsApproval = item.category === 'deductions' || item.category === 'disciplinary';
  const needsAcknowledgement = item.category === 'memos' || item.category === 'communication' || item.category === 'others';

  const handleApprove = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onApprove(item.id, remarks);
    }, 800);
  };

  const handleReject = () => {
    if (!remarks.trim()) { toast.error('Please provide a reason for rejection.'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onReject(item.id, remarks);
    }, 800);
  };

  const handleAcknowledge = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onAcknowledge(item.id);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 ${catConfig.accentBg} shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <CatIcon size={18} className={catConfig.iconColor} />
            </div>
            <div>
              <h2 className={`text-base font-bold ${catConfig.accentText}`}>{catConfig.label}</h2>
              <p className={`text-xs ${catConfig.accentText} opacity-70`}>{item.referenceNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Title & Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-base text-gray-900">{item.title}</h3>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                  <StatusIcon size={10} />
                  {item.status}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}>
                  {item.priority} Priority
                </span>
              </div>
            </div>
            {item.amount && (
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-red-600">-{formatAmount(item.amount)}</p>
                <p className="text-[10px] text-gray-400">Deduction Amount</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-2">Description</p>
            <p className="text-sm text-gray-800 leading-relaxed">{item.description}</p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Issued By', value: `${item.issuedBy} (${item.issuedByDesignation})` },
              { label: 'Issued On', value: formatDate(item.issuedOn) },
              ...(item.dueBy ? [{ label: 'Response Due By', value: formatDate(item.dueBy) }] : []),
              ...(item.payrollPeriod ? [{ label: 'Payroll Period', value: item.payrollPeriod }] : []),
            ].map(row => (
              <div key={row.label} className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{row.label}</p>
                <p className="text-xs font-semibold text-gray-800 mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>

          {/* Employee Response (if already responded) */}
          {item.employeeResponse && (
            <div className={`p-4 rounded-xl border ${item.employeeResponse === 'Approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {item.employeeResponse === 'Approved' ? (
                  <><ThumbsUp size={15} className="text-green-600" /><p className="font-bold text-sm text-green-800">You Approved This</p></>
                ) : (
                  <><ThumbsDown size={15} className="text-red-600" /><p className="font-bold text-sm text-red-800">You Rejected This</p></>
                )}
              </div>
              <p className="text-xs text-gray-600">Responded on: {item.employeeResponseOn}</p>
              {item.employeeRemarks && (
                <div className="mt-2">
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">Your Remarks:</p>
                  <p className="text-xs text-gray-700 italic">"{item.employeeRemarks}"</p>
                </div>
              )}
            </div>
          )}

          {/* Acknowledged */}
          {item.status === 'Acknowledged' && item.employeeResponseOn && !item.employeeResponse && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <CheckCheck size={16} className="text-blue-600 shrink-0" />
              <div>
                <p className="font-bold text-sm text-blue-800">Acknowledged</p>
                <p className="text-xs text-blue-600 mt-0.5">You acknowledged this on {item.employeeResponseOn}</p>
              </div>
            </div>
          )}

          {/* HR Remarks */}
          {item.hrRemarks && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">HR Remarks</p>
              <p className="text-xs text-amber-800">{item.hrRemarks}</p>
            </div>
          )}

          {/* Action Area — Pending Items */}
          {item.status === 'Pending' && (
            <div className="space-y-4">
              {needsApproval && (
                <>
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-700">
                      <p className="font-semibold mb-0.5">Your Response Required</p>
                      <p>Please review the details carefully and approve or reject this {item.category === 'deductions' ? 'deduction' : 'action'}. Your response will be recorded and notified to HR.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Remarks (Optional for Approval, Required for Rejection)</label>
                    <textarea
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all resize-none"
                      rows={3}
                      placeholder="Add your remarks or reason for rejection..."
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                    />
                  </div>

                  {!showRejectForm ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors shadow-sm disabled:opacity-60 flex-1 justify-center"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                        Approve
                      </button>
                      <button
                        onClick={() => setShowRejectForm(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-sm hover:bg-red-100 transition-colors flex-1 justify-center"
                      >
                        <ThumbsDown size={14} /> Reject
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleReject}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60 flex-1 justify-center"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <ThumbsDown size={14} />}
                        Confirm Rejection
                      </button>
                      <button onClick={() => setShowRejectForm(false)} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}

              {needsAcknowledgement && (
                <>
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-700">
                      <p className="font-semibold mb-0.5">Acknowledgement Required</p>
                      <p>Please read the above {item.category} carefully and acknowledge receipt. This confirms you have been informed.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAcknowledge}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-md disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                    {loading ? 'Acknowledging...' : 'Acknowledge Receipt'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Payslip Detail Modal ─────────────────────────────────────────────────────

interface PayslipDetailModalProps {
  payslip: Payslip;
  employee: EmployeeSession;
  onClose: () => void;
  onDownload: () => void;
  onAcknowledge: () => void;
}

const PayslipDetailModal = ({ payslip, employee, onClose, onDownload, onAcknowledge }: PayslipDetailModalProps) => {
  const [acknowledging, setAcknowledging] = useState(false);

  const handleAcknowledge = () => {
    setAcknowledging(true);
    setTimeout(() => {
      setAcknowledging(false);
      onAcknowledge();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <FileText size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-indigo-900">Payslip — {payslip.periodName}</h2>
              <p className="text-xs text-indigo-600">{formatDate(payslip.fromDate)} – {formatDate(payslip.toDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDownload} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
              <FileDown size={14} /> Download PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Working Days', value: payslip.workingDays, color: 'bg-gray-50 border-gray-200', textColor: 'text-gray-700' },
              { label: 'Present Days', value: payslip.presentDays, color: 'bg-green-50 border-green-200', textColor: 'text-green-700' },
              { label: 'Leave Days', value: payslip.leaveDays, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
              { label: 'LOP Days', value: payslip.lopDays, color: 'bg-red-50 border-red-200', textColor: 'text-red-700' },
              { label: 'Overtime', value: `${payslip.overtimeHours}h`, color: 'bg-violet-50 border-violet-200', textColor: 'text-violet-700' },
            ].map(card => (
              <div key={card.label} className={`p-3 rounded-xl border ${card.color} text-center`}>
                <p className={`text-lg font-bold ${card.textColor}`}>{card.value}</p>
                <p className={`text-[10px] font-medium ${card.textColor} uppercase tracking-wide`}>{card.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-green-50 border-b border-green-200">
                <p className="text-xs font-bold text-green-800 uppercase tracking-wide">Earnings</p>
              </div>
              <div className="p-3 space-y-1.5">
                {[
                  { label: 'Basic Salary', value: payslip.basic },
                  { label: 'HRA', value: payslip.hra },
                  { label: 'Conveyance', value: payslip.conveyance },
                  { label: 'Medical Allowance', value: payslip.medicalAllowance },
                  { label: 'Special Allowance', value: payslip.specialAllowance },
                  ...(payslip.lta > 0 ? [{ label: 'LTA', value: payslip.lta }] : []),
                  ...(payslip.overtimeAmount > 0 ? [{ label: `Overtime (${payslip.overtimeHours}h)`, value: payslip.overtimeAmount }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-semibold text-green-700">{formatAmount(row.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-gray-100">
                  <span>Gross Earnings</span>
                  <span className="text-green-700">{formatAmount(payslip.gross)}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-200">
                <p className="text-xs font-bold text-red-800 uppercase tracking-wide">Deductions</p>
              </div>
              <div className="p-3 space-y-1.5">
                {[
                  { label: 'PF (Employee 12%)', value: payslip.pfEmployee },
                  ...(payslip.esiEmployee > 0 ? [{ label: 'ESI (0.75%)', value: payslip.esiEmployee }] : []),
                  { label: 'Professional Tax', value: payslip.professionalTax },
                  ...(payslip.tds > 0 ? [{ label: 'TDS', value: payslip.tds }] : []),
                  ...(payslip.loanEmi > 0 ? [{ label: 'Loan EMI', value: payslip.loanEmi }] : []),
                  ...(payslip.otherDeductions > 0 ? [{ label: 'Other Deductions', value: payslip.otherDeductions }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-semibold text-red-600">-{formatAmount(row.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-gray-100">
                  <span>Total Deductions</span>
                  <span className="text-red-600">-{formatAmount(payslip.totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-5 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl text-white">
            <div>
              <p className="text-sm font-semibold opacity-90">Net Pay (Take Home)</p>
              <p className="text-[10px] opacity-70 mt-0.5">{numberToWords(payslip.net)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatAmount(payslip.net)}</p>
              <p className="text-[10px] opacity-70 mt-0.5">Gross {formatAmount(payslip.gross)} − Deductions {formatAmount(payslip.totalDeductions)}</p>
            </div>
          </div>

          {!payslip.acknowledged && payslip.status !== 'Draft' && (
            <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm text-amber-800">Acknowledgement Required</p>
                <p className="text-xs text-amber-700 mt-0.5">Please review and acknowledge receipt of your payslip for {payslip.periodName}.</p>
              </div>
              <button onClick={handleAcknowledge} disabled={acknowledging} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-60 shrink-0">
                {acknowledging ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                {acknowledging ? 'Acknowledging...' : 'Acknowledge'}
              </button>
            </div>
          )}

          {payslip.acknowledged && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              <div>
                <p className="font-bold text-sm text-green-800">Payslip Acknowledged</p>
                <p className="text-xs text-green-700 mt-0.5">Acknowledged on <strong>{payslip.acknowledgedAt}</strong>.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Email Update Modal ───────────────────────────────────────────────────────

interface EmailUpdateModalProps {
  currentEmail: string;
  onUpdate: (newEmail: string) => void;
  onClose: () => void;
}

const EmailUpdateModal = ({ currentEmail, onUpdate, onClose }: EmailUpdateModalProps) => {
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleUpdate = () => {
    if (!newEmail.trim()) { setError('Please enter a new email address.'); return; }
    if (!isValidEmail(newEmail)) { setError('Please enter a valid email address.'); return; }
    if (newEmail === currentEmail) { setError('New email must be different from the current email.'); return; }
    if (newEmail !== confirmEmail) { setError('Email addresses do not match.'); return; }
    if (!password.trim()) { setError('Please enter your password to confirm the change.'); return; }
    setLoading(true);
    setError('');
    setTimeout(() => {
      setLoading(false);
      onUpdate(newEmail);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl"><Mail size={18} className="text-blue-600" /></div>
            <div>
              <h2 className="text-base font-bold text-blue-900">Update Email Address</h2>
              <p className="text-xs text-blue-600">Change your registered email address</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <Mail size={15} className="text-gray-500 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Current Email</p>
              <p className="text-sm font-semibold text-gray-800">{currentEmail}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">New Email Address <span className="text-red-500">*</span></label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-300 text-sm transition-all" placeholder="Enter new email address" value={newEmail} onChange={e => { setNewEmail(e.target.value); setError(''); }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Confirm New Email <span className="text-red-500">*</span></label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-300 text-sm transition-all" placeholder="Confirm new email address" value={confirmEmail} onChange={e => { setConfirmEmail(e.target.value); setError(''); }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Current Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type={showPassword ? 'text' : 'password'} className="w-full pl-9 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-300 text-sm transition-all" placeholder="Enter your current password to confirm" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} />
              <button onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertCircle size={13} className="shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          <button onClick={handleUpdate} disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-60">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Updating...</> : <><Save size={14} /> Update Email</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Password Change Modal ────────────────────────────────────────────────────

interface PasswordChangeModalProps {
  employeeCode: string;
  loginId?: string;
  forced?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PasswordChangeModal = ({ employeeCode, loginId, forced = false, onClose, onSuccess }: PasswordChangeModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'success'>('form');

  const strength = getPasswordStrength(newPassword);
  const rules = getPasswordRules(newPassword);
  const allRulesMet = rules.every(r => r.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async () => {
    if (!currentPassword.trim()) { setError('Please enter your current password.'); return; }
    if (!newPassword.trim()) { setError('Please enter a new password.'); return; }
    if (!allRulesMet) { setError('Password needs: ' + rules.filter(r => !r.met).map(r => r.label.replace(/^At least /i, '')).join(', ') + '.'); return; }
    if (!confirmPassword.trim()) { setError('Please confirm your new password.'); return; }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    if (currentPassword === newPassword) { setError('New password must be different from your current password.'); return; }
    setLoading(true);
    setError('');
    // Persist against the real User Master account when we have a login_id; else fall back to the demo check.
    if (loginId) {
      const res = await changePassword(loginId, currentPassword.trim(), newPassword.trim());
      setLoading(false);
      if (res.error) { setError(res.error); return; }
      setStep('success');
      return;
    }
    setTimeout(() => {
      setLoading(false);
      if (currentPassword !== employeeCode) {
        setError('Current password is incorrect. Please try again.');
        return;
      }
      setStep('success');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl"><Key size={18} className="text-amber-600" /></div>
            <div>
              <h2 className="text-base font-bold text-amber-900">{forced ? 'Set a New Password' : 'Change Password'}</h2>
              <p className="text-xs text-amber-600">{forced ? 'Required before you can continue' : 'Update your account password securely'}</p>
            </div>
          </div>
          {!forced && <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><X size={20} /></button>}
        </div>
        {forced && step === 'form' && (
          <div className="px-6 pt-4">
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700">This is your first login. Please set a new password to secure your account before continuing.</p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Current Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showCurrent ? 'text' : 'password'} className="w-full pl-9 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-300 text-sm transition-all" placeholder="Enter your current password" value={currentPassword} onChange={e => { setCurrentPassword(e.target.value); setError(''); }} />
                    <button onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{forced ? 'Enter the password you just signed in with.' : `Tip: your initial password is your Employee ID (${employeeCode})`}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">New Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showNew ? 'text' : 'password'} className="w-full pl-9 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-300 text-sm transition-all" placeholder="Enter a strong new password" value={newPassword} onChange={e => { setNewPassword(e.target.value); setError(''); }} />
                    <button onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  {newPassword.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex gap-1">
                          {[1, 2, 3, 4].map(level => (
                            <div key={level} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${strength.score >= level ? strength.bgColor : 'bg-gray-200'}`} />
                          ))}
                        </div>
                        <span className={`text-[10px] font-bold ${strength.color} w-14 text-right`}>{strength.label}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {rules.map(rule => (
                          <div key={rule.label} className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-all ${rule.met ? 'bg-green-500' : 'bg-gray-200'}`}>
                              {rule.met ? <CheckCircle2 size={9} className="text-white" /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                            </div>
                            <span className={`text-[10px] transition-colors ${rule.met ? 'text-green-700 font-medium' : 'text-gray-500'}`}>{rule.label}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Confirm New Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showConfirm ? 'text' : 'password'} className={`w-full pl-9 pr-10 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 text-sm transition-all ${passwordsMismatch ? 'border-red-300 focus:ring-red-200' : passwordsMatch ? 'border-green-300 focus:ring-green-200' : 'border-gray-200 focus:ring-amber-300'}`} placeholder="Re-enter your new password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError(''); }} />
                    <button onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {passwordsMismatch && <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={10} /> Passwords do not match</p>}
                  {passwordsMatch && <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={10} /> Passwords match</p>}
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <AlertCircle size={13} className="shrink-0" />
                    {error}
                  </motion.div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                {!forced && <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>}
                <button onClick={handleSubmit} disabled={loading || !currentPassword || !newPassword || !confirmPassword} className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Changing...</> : <><Key size={14} /> Change Password</>}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="p-8 text-center space-y-5">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }} className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </motion.div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Password Changed Successfully!</h3>
                <p className="text-sm text-gray-500 mt-2">Your password has been updated. Please use your new password the next time you sign in.</p>
              </div>
              <button onClick={() => { onSuccess(); onClose(); }} className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors shadow-md">
                <CheckCheck size={16} /> Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// ─── Apply Leave Modal ────────────────────────────────────────────────────────

interface ApplyLeaveModalProps {
  balances: LeaveBalance[];
  onSubmit: (request: Omit<LeaveRequest, 'id' | 'appliedOn' | 'status'>) => void;
  onClose: () => void;
  initialFromDate?: string;
}

const ApplyLeaveModal = ({ balances, onSubmit, onClose, initialFromDate }: ApplyLeaveModalProps) => {
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState(balances[0]?.leaveTypeId ?? '');
  const [fromDate, setFromDate] = useState(initialFromDate ?? '');
  const [toDate, setToDate] = useState(initialFromDate ?? '');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [contactDuringLeave, setContactDuringLeave] = useState('');
  const [handoverTo, setHandoverTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedBalance = balances.find(b => b.leaveTypeId === selectedLeaveTypeId);
  const days = isHalfDay ? 0.5 : calcDays(fromDate, toDate);
  const colorStyle = selectedBalance ? getLeaveColor(selectedBalance.color) : getLeaveColor('blue');

  const handleSubmit = () => {
    if (!selectedLeaveTypeId) { setError('Please select a leave type.'); return; }
    if (!fromDate) { setError('Please select a from date.'); return; }
    if (!toDate) { setError('Please select a to date.'); return; }
    if (new Date(fromDate) > new Date(toDate)) { setError('From date must be before to date.'); return; }
    if (!reason.trim()) { setError('Please provide a reason for leave.'); return; }
    if (selectedBalance && selectedBalance.leaveTypeCode !== 'UL' && days > selectedBalance.availableDays) {
      setError(`Insufficient leave balance. Available: ${selectedBalance.availableDays} days.`);
      return;
    }

    setLoading(true);
    setError('');
    setTimeout(() => {
      setLoading(false);
      onSubmit({
        leaveTypeId: selectedLeaveTypeId,
        leaveTypeName: selectedBalance!.leaveTypeName,
        leaveTypeCode: selectedBalance!.leaveTypeCode,
        leaveTypeColor: selectedBalance!.color,
        fromDate,
        toDate,
        days,
        isHalfDay,
        reason,
        contactDuringLeave,
        handoverTo,
      });
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-emerald-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-xl"><Plus size={18} className="text-teal-600" /></div>
            <div>
              <h2 className="text-base font-bold text-teal-900">Apply for Leave</h2>
              <p className="text-xs text-teal-600">Submit a new leave request</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold mb-2 text-gray-600 uppercase tracking-wide">Leave Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 gap-2">
              {balances.map(bal => {
                const cs = getLeaveColor(bal.color);
                const isSelected = selectedLeaveTypeId === bal.leaveTypeId;
                return (
                  <button key={bal.leaveTypeId} onClick={() => { setSelectedLeaveTypeId(bal.leaveTypeId); setError(''); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${isSelected ? `${cs.light} ${cs.border} shadow-sm` : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cs.bg} ${cs.text} ${cs.border}`}>{bal.leaveTypeCode}</span>
                    <span className="font-semibold text-sm flex-1">{bal.leaveTypeName}</span>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${cs.text}`}>{bal.availableDays}d</p>
                      <p className="text-[10px] text-gray-400">available</p>
                    </div>
                    {isSelected && <CheckCircle2 size={16} className={cs.text} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div onClick={() => { setIsHalfDay(v => !v); if (!isHalfDay) setToDate(fromDate); }} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${isHalfDay ? `${colorStyle.light} ${colorStyle.border}` : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
            <div>
              <p className="text-sm font-semibold text-gray-800">Half Day Leave</p>
              <p className="text-[10px] text-gray-500">Apply for half day (0.5 days)</p>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors relative ${isHalfDay ? 'bg-teal-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isHalfDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">From Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="date" className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-300 text-sm transition-all" value={fromDate} min={new Date().toISOString().split('T')[0]} onChange={e => { setFromDate(e.target.value); if (isHalfDay) setToDate(e.target.value); setError(''); }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">To Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="date" className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-300 text-sm transition-all" value={toDate} min={fromDate || new Date().toISOString().split('T')[0]} disabled={isHalfDay} onChange={e => { setToDate(e.target.value); setError(''); }} />
              </div>
            </div>
          </div>

          {fromDate && toDate && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colorStyle.light} ${colorStyle.border}`}>
              <CalendarDays size={15} className={colorStyle.text} />
              <p className={`text-sm font-semibold ${colorStyle.text}`}>
                Duration: <strong>{days} day{days !== 1 ? 's' : ''}</strong>
                {isHalfDay && ' (Half Day)'}
              </p>
            </motion.div>
          )}

          <div>
            <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Reason <span className="text-red-500">*</span></label>
            <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-300 text-sm transition-all resize-none" rows={3} placeholder="Briefly describe the reason for your leave..." value={reason} onChange={e => { setReason(e.target.value); setError(''); }} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Contact During Leave</label>
              <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-300 text-sm transition-all" placeholder="+91 98765 43210" value={contactDuringLeave} onChange={e => setContactDuringLeave(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Handover To</label>
              <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-300 text-sm transition-all" placeholder="Employee name" value={handoverTo} onChange={e => setHandoverTo(e.target.value)} />
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertCircle size={13} className="shrink-0" />
              {error}
            </motion.div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 shrink-0">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-md disabled:opacity-60">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : <><Send size={14} /> Submit Request</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Loan Application Modal ───────────────────────────────────────────────────

interface LoanApplicationModalProps {
  loanTypes: UiLoanType[];
  onApply: (p: { loanType: UiLoanType; principal: number; tenureMonths: number; purpose: string }) => Promise<{ error: string | null }>;
  onClose: () => void;
}

const WORKFLOW_HINT: Record<string, string> = {
  SingleHR: 'Reviewed and approved by HR / Admin.',
  TwoStage: 'Approved by your reporting manager, then HR.',
  AutoWithinLimits: 'Auto-approved instantly when within the type limits.',
};

const LoanApplicationModal = ({ loanTypes, onApply, onClose }: LoanApplicationModalProps) => {
  const [selectedId, setSelectedId] = useState<string>(loanTypes[0]?.id ?? '');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [tenureMonths, setTenureMonths] = useState(String(loanTypes[0]?.maxTenureMonths ? Math.min(12, loanTypes[0].maxTenureMonths) : 12));
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selected = loanTypes.find(t => t.id === selectedId);
  const rate = selected ? (selected.isInterestFree ? 0 : selected.interestRate) : 0;
  const principal = parseFloat(principalAmount) || 0;
  const tenure = parseInt(tenureMonths) || 1;
  const previewEMI = selected && principal > 0 ? calcEMI(principal, rate, tenure) : 0;

  const handleSubmit = async () => {
    if (!selected) { setError('Select a loan type.'); return; }
    if (!principalAmount || principal <= 0) { setError('Please enter a valid loan amount.'); return; }
    if (principal > selected.maxAmount) { setError(`Maximum amount for ${selected.name} is ${formatAmount(selected.maxAmount)}.`); return; }
    if (tenure > selected.maxTenureMonths) { setError(`Maximum tenure for ${selected.name} is ${selected.maxTenureMonths} months.`); return; }
    if (!purpose.trim()) { setError('Please provide the purpose of the loan.'); return; }
    setLoading(true);
    setError('');
    const { error: e } = await onApply({ loanType: selected, principal, tenureMonths: tenure, purpose });
    setLoading(false);
    if (e) { setError(e); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl"><HandCoins size={20} className="text-amber-600" /></div>
            <div>
              <h2 className="text-base font-bold text-amber-900">Apply for Loan / Advance</h2>
              <p className="text-xs text-amber-600">Submit a new loan or advance request</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {loanTypes.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700"><p className="font-semibold mb-0.5">No loan types available</p><p>Loan / advance types have not been configured yet. Please contact HR.</p></div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold mb-2 text-gray-600 uppercase tracking-wide">Loan / Advance Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {loanTypes.map(t => {
                    const cfg = loanStyle(t.name);
                    const isSelected = selectedId === t.id;
                    return (
                      <button key={t.id} onClick={() => { setSelectedId(t.id); setError(''); setPrincipalAmount(''); setTenureMonths(String(Math.min(12, t.maxTenureMonths))); }} className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${isSelected ? `${cfg.accentBg} ${cfg.accentBorder} shadow-sm` : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <div className={`p-1.5 rounded-lg ${cfg.color} shrink-0 mt-0.5`}><HandCoins size={14} className={cfg.iconColor} /></div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-xs ${isSelected ? cfg.accentText : 'text-gray-800'}`}>{t.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Max: {formatAmount(t.maxAmount)} · {t.isInterestFree ? '0%' : `${t.interestRate}%`}</p>
                          {t.isInterestFree && <span className="text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full mt-1 inline-block">Interest-Free</span>}
                        </div>
                        {isSelected && <CheckCircle2 size={14} className={cfg.accentText} />}
                      </button>
                    );
                  })}
                </div>
                {selected && <p className="text-[10px] text-gray-400 mt-2">{WORKFLOW_HINT[selected.approvalWorkflow]}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Loan Amount (₹) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="number" className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-300 text-sm transition-all" placeholder={selected ? `Max: ${formatAmount(selected.maxAmount)}` : ''} min={1000} max={selected?.maxAmount} step={1000} value={principalAmount} onChange={e => { setPrincipalAmount(e.target.value); setError(''); }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Repayment Tenure (Months) <span className="text-red-500">*</span></label>
                  <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-300 text-sm transition-all appearance-none" value={tenureMonths} onChange={e => setTenureMonths(e.target.value)}>
                    {Array.from({ length: Math.max(1, selected?.maxTenureMonths ?? 12) }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{m} month{m !== 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {previewEMI > 0 && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center"><p className="text-[10px] text-indigo-600 font-medium uppercase tracking-wide">Monthly EMI</p><p className="text-lg font-bold text-indigo-700 mt-0.5">{formatAmount(Math.round(previewEMI))}</p></div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-center"><p className="text-[10px] text-green-600 font-medium uppercase tracking-wide">Total Payable</p><p className="text-lg font-bold text-green-700 mt-0.5">{formatAmount(Math.round(previewEMI * tenure))}</p></div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center"><p className="text-[10px] text-rose-600 font-medium uppercase tracking-wide">Total Interest</p><p className="text-lg font-bold text-rose-700 mt-0.5">{formatAmount(Math.round(previewEMI * tenure - principal))}</p></div>
                </motion.div>
              )}

              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-600 uppercase tracking-wide">Purpose / Reason <span className="text-red-500">*</span></label>
                <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-300 text-sm transition-all resize-none" rows={3} placeholder="Describe the purpose of this loan or advance..." value={purpose} onChange={e => { setPurpose(e.target.value); setError(''); }} />
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"><AlertCircle size={13} className="shrink-0" />{error}</motion.div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 shrink-0">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || loanTypes.length === 0} className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : <><HandCoins size={14} /> Submit Application</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Loan Detail Modal ────────────────────────────────────────────────────────

interface LoanDetailModalProps {
  loan: LoanApplication;
  onClose: () => void;
}

const LoanDetailModal = ({ loan, onClose }: LoanDetailModalProps) => {
  const config = loanStyle(loan.loanType);
  const statusStyle = LOAN_STATUS_STYLES[loan.status];
  const StatusIcon = statusStyle.icon;
  const progress = loan.tenureMonths > 0 ? (loan.paidEMIs / loan.tenureMonths) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${config.color} rounded-xl`}>
              <HandCoins size={20} className={config.iconColor} />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-900">{loan.loanType}</h2>
              <p className="text-xs text-amber-600">{loan.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
              <StatusIcon size={11} />
              {loan.status}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><X size={20} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`p-4 rounded-xl border ${config.accentBg} ${config.accentBorder} text-center`}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Principal</p>
              <p className={`text-lg font-bold ${config.accentText} mt-0.5`}>{formatAmount(loan.principalAmount)}</p>
            </div>
            <div className="p-4 rounded-xl border bg-indigo-50 border-indigo-200 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Monthly EMI</p>
              <p className="text-lg font-bold text-indigo-700 mt-0.5">{formatAmount(loan.emiAmount)}</p>
            </div>
            <div className="p-4 rounded-xl border bg-amber-50 border-amber-200 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Outstanding</p>
              <p className="text-lg font-bold text-amber-700 mt-0.5">{formatAmount(loan.outstandingBalance)}</p>
            </div>
            <div className="p-4 rounded-xl border bg-green-50 border-green-200 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">EMIs Paid</p>
              <p className="text-lg font-bold text-green-700 mt-0.5">{loan.paidEMIs}/{loan.tenureMonths}</p>
            </div>
          </div>

          {loan.status === 'Active' && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700">Repayment Progress</span>
                <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full bg-green-500 rounded-full" />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-400">
                <span>{loan.paidEMIs} EMIs paid</span>
                <span>{loan.tenureMonths - loan.paidEMIs} remaining</span>
              </div>
            </div>
          )}

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Purpose</p>
            <p className="text-sm text-gray-800">{loan.purpose}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50 shrink-0">
          <button onClick={onClose} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Close</button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Portal Dashboard ─────────────────────────────────────────────────────────

interface PortalDashboardProps {
  session: EmployeeSession;
  payslips: Payslip[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  loans: LoanApplication[];
  approvals: ApprovalItem[];
  onLogout: () => void;
  onUpdateEmail: (newEmail: string) => void;
  onAcknowledge: (payslipId: string) => void;
  onSubmitLeave: (request: Omit<LeaveRequest, 'id' | 'appliedOn' | 'status'>) => void;
  onCancelLeave: (requestId: string) => void;
  onApprovalAction: (id: string, action: 'approve' | 'reject' | 'acknowledge', remarks?: string) => void;
}

const PortalDashboard = ({
  session, payslips, leaveBalances, leaveRequests, loans, approvals,
  onLogout, onUpdateEmail, onAcknowledge, onSubmitLeave, onCancelLeave, onApprovalAction
}: PortalDashboardProps) => {
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [leaveFromDate, setLeaveFromDate] = useState('');
  const [showLoanApplicationModal, setShowLoanApplicationModal] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [currentEmail, setCurrentEmail] = useState(session.email);
  const [fyFilter, setFyFilter] = useState('All');
  const [expandedPayslip, setExpandedPayslip] = useState<string | null>(null);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<LeaveRequestStatus | 'All'>('All');
  const [leaveView, setLeaveView] = useState<'balance' | 'requests'>('balance');
  const [loanStatusFilter, setLoanStatusFilter] = useState<LoanStatus | 'All'>('All');
  const { loanTypes: dbLoanTypes } = useActiveLoanTypes();
  // Manager Dashboard — shown when the logged-in employee has direct reports.
  const [isMgr, setIsMgr] = useState(false);
  const [mgrPending, setMgrPending] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      const mgr = await checkIsManager(session.dbEmployeeId);
      if (!active) return;
      setIsMgr(mgr);
      if (mgr && session.dbEmployeeId) setMgrPending(await managerPendingCount(session.dbEmployeeId));
    })();
    return () => { active = false; };
  }, [session.dbEmployeeId]);

  // Approvals state
  const [approvalCategoryFilter, setApprovalCategoryFilter] = useState<ApprovalCategory | 'all'>('all');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<ApprovalStatus | 'all'>('Pending');
  const [approvalSearch, setApprovalSearch] = useState('');

  const latestPayslip = payslips[0];
  const pendingAcknowledgements = payslips.filter(p => !p.acknowledged && p.status !== 'Draft').length;
  const ytdGross = payslips.filter(p => p.status !== 'Draft').reduce((s, p) => s + p.gross, 0);
  const ytdNet = payslips.filter(p => p.status !== 'Draft').reduce((s, p) => s + p.net, 0);

  const filteredPayslips = useMemo(() => {
    return payslips.filter(p => fyFilter === 'All' || p.financialYear === fyFilter);
  }, [payslips, fyFilter]);

  const filteredLeaveRequests = useMemo(() => {
    return leaveRequests.filter(r => leaveStatusFilter === 'All' || r.status === leaveStatusFilter);
  }, [leaveRequests, leaveStatusFilter]);

  const filteredLoans = useMemo(() => {
    return loans.filter(l => loanStatusFilter === 'All' || l.status === loanStatusFilter);
  }, [loans, loanStatusFilter]);

  const filteredApprovals = useMemo(() => {
    return approvals.filter(a => {
      const matchCategory = approvalCategoryFilter === 'all' || a.category === approvalCategoryFilter;
      const matchStatus = approvalStatusFilter === 'all' || a.status === approvalStatusFilter;
      const matchSearch = !approvalSearch || a.title.toLowerCase().includes(approvalSearch.toLowerCase()) || a.description.toLowerCase().includes(approvalSearch.toLowerCase()) || a.referenceNo.toLowerCase().includes(approvalSearch.toLowerCase());
      return matchCategory && matchStatus && matchSearch;
    });
  }, [approvals, approvalCategoryFilter, approvalStatusFilter, approvalSearch]);

  const pendingLeaveCount = leaveRequests.filter(r => r.status === 'Pending').length;
  const totalAvailableLeave = leaveBalances.reduce((s, b) => s + b.availableDays, 0);
  const activeLoans = loans.filter(l => l.status === 'Active');
  const pendingLoans = loans.filter(l => l.status === 'Pending');
  const totalOutstanding = activeLoans.reduce((s, l) => s + l.outstandingBalance, 0);
  const hasActiveLoan = loans.some(l => l.status === 'Active' || l.status === 'Pending');

  // Approvals counts
  const pendingApprovalsCount = approvals.filter(a => a.status === 'Pending').length;
  const approvalsByCategory = useMemo(() => {
    const counts: Record<ApprovalCategory, number> = { deductions: 0, disciplinary: 0, memos: 0, communication: 0, others: 0 };
    approvals.forEach(a => { counts[a.category]++; });
    return counts;
  }, [approvals]);

  const pendingByCategory = useMemo(() => {
    const counts: Record<ApprovalCategory, number> = { deductions: 0, disciplinary: 0, memos: 0, communication: 0, others: 0 };
    approvals.filter(a => a.status === 'Pending').forEach(a => { counts[a.category]++; });
    return counts;
  }, [approvals]);

  const handleDownload = (payslip: Payslip) => {
    const html = generatePayslipHTML(session, payslip);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=900,height=700,scrollbars=yes');
    if (!win) { toast.error('Popup blocked. Please allow popups for this site.'); URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success(`Payslip for ${payslip.periodName} opened. Use Print → Save as PDF to download.`);
  };

  const handleEmailUpdate = (newEmail: string) => {
    setCurrentEmail(newEmail);
    onUpdateEmail(newEmail);
    setShowEmailModal(false);
    toast.success('Email address updated successfully!');
  };

  const handleAcknowledge = (payslipId: string) => {
    onAcknowledge(payslipId);
    if (selectedPayslip?.id === payslipId) {
      setSelectedPayslip(prev => prev ? { ...prev, acknowledged: true, acknowledgedAt: new Date().toLocaleString('en-IN') } : null);
    }
    toast.success('Payslip acknowledged successfully!');
  };

  const handlePasswordChangeSuccess = () => {
    toast.success('Password changed successfully!');
  };

  const handleSubmitLeave = (request: Omit<LeaveRequest, 'id' | 'appliedOn' | 'status'>) => {
    onSubmitLeave(request);
    setShowApplyLeaveModal(false);
    setLeaveView('requests');
    toast.success(`Leave request submitted successfully for ${request.days} day(s).`);
  };

  const handleApplyLoan = async (p: { loanType: UiLoanType; principal: number; tenureMonths: number; purpose: string }): Promise<{ error: string | null }> => {
    if (!session.dbEmployeeId) return { error: 'Your employee record is still loading — please retry in a moment.' };
    const rate = p.loanType.isInterestFree ? 0 : p.loanType.interestRate;
    const res = await applyLoan({ employeeId: session.dbEmployeeId, loanType: p.loanType, principal: p.principal, interestRate: rate, tenureMonths: p.tenureMonths, purpose: p.purpose });
    if (!res.error) {
      toast.success(p.loanType.approvalWorkflow === 'AutoWithinLimits' ? 'Loan auto-approved & disbursed!' : `Loan application for ${formatAmount(p.principal)} submitted for approval.`);
    }
    return res;
  };

  const handleApprovalApprove = (id: string, remarks: string) => {
    onApprovalAction(id, 'approve', remarks);
    setSelectedApproval(null);
    toast.success('You have approved this deduction/action.');
  };

  const handleApprovalReject = (id: string, remarks: string) => {
    onApprovalAction(id, 'reject', remarks);
    setSelectedApproval(null);
    toast.info('You have rejected this deduction/action. HR has been notified.');
  };

  const handleApprovalAcknowledge = (id: string) => {
    onApprovalAction(id, 'acknowledge');
    setSelectedApproval(null);
    toast.success('Acknowledged successfully!');
  };

  const STATUS_STYLES_LEAVE: Record<LeaveRequestStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
    Pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
    Approved: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle2 },
    Rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
    Cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: X },
  };

  const navItems: { key: PortalTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: Home },
    { key: 'payslips', label: 'My Payslips', icon: FileText, badge: pendingAcknowledgements > 0 ? pendingAcknowledgements : undefined },
    { key: 'leaves', label: 'Leave', icon: CalendarDays, badge: pendingLeaveCount > 0 ? pendingLeaveCount : undefined },
    { key: 'loans', label: 'Loans', icon: HandCoins, badge: pendingLoans.length > 0 ? pendingLoans.length : undefined },
    { key: 'approvals', label: 'Approvals', icon: ClipboardCheck, badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined },
    ...(isMgr ? [{ key: 'manager' as PortalTab, label: 'My Team', icon: Users, badge: mgrPending > 0 ? mgrPending : undefined }] : []),
    { key: 'profile', label: 'My Profile', icon: User },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold font-serif">S</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">SakthiHR</span>
              <span className="text-gray-400 text-xs ml-2">Employee Self-Service</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  <Icon size={16} />
                  {item.label}
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
              <EmployeeAvatar employeeCode={session.employeeCode} initials={session.avatar} name={session.name} size={28} rounded="lg" />
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-800 leading-tight">{session.name.split(' ')[0]}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{session.employeeCode}</p>
              </div>
            </div>
            <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut size={15} /> <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-1 overflow-x-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Icon size={14} />
              {item.label}
              {item.badge && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">

          {/* ── Dashboard Tab ── */}
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Welcome back,</p>
                    <h1 className="text-2xl font-bold mt-0.5">{session.name}</h1>
                    <p className="text-blue-100 text-sm mt-1">{session.designation} · {session.department}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full">{session.employeeCode}</span>
                      <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full">{session.employeeType}</span>
                      <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full">{session.employeeGrade}</span>
                    </div>
                  </div>
                  <EmployeeAvatar employeeCode={session.employeeCode} initials={session.avatar} name={session.name} size={64} rounded="xl" className="!bg-white/20 !text-white shadow-sm" />
                </div>
              </div>

              {/* Alerts */}
              {pendingAcknowledgements > 0 && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="p-2 bg-amber-100 rounded-lg shrink-0"><Bell size={18} className="text-amber-600" /></div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-amber-800">{pendingAcknowledgements} Payslip{pendingAcknowledgements !== 1 ? 's' : ''} Pending Acknowledgement</p>
                    <p className="text-xs text-amber-700 mt-0.5">Please review and acknowledge your recent payslips.</p>
                  </div>
                  <button onClick={() => setActiveTab('payslips')} className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors shadow-sm shrink-0">
                    View <ChevronRight size={14} />
                  </button>
                </motion.div>
              )}

              {pendingApprovalsCount > 0 && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="p-2 bg-red-100 rounded-lg shrink-0"><ClipboardCheck size={18} className="text-red-600" /></div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-red-800">{pendingApprovalsCount} Approval{pendingApprovalsCount !== 1 ? 's' : ''} Pending Your Response</p>
                    <p className="text-xs text-red-700 mt-0.5">Deductions, memos, and communications require your acknowledgement.</p>
                  </div>
                  <button onClick={() => setActiveTab('approvals')} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm shrink-0">
                    Review <ChevronRight size={14} />
                  </button>
                </motion.div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'YTD Gross Pay', value: formatAmount(ytdGross), sub: 'FY 2025-26', color: 'bg-green-50 border-green-200', textColor: 'text-green-700', icon: DollarSign, iconBg: 'bg-green-100' },
                  { label: 'YTD Net Pay', value: formatAmount(ytdNet), sub: 'Take home', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700', icon: Wallet, iconBg: 'bg-blue-100' },
                  { label: 'Leave Balance', value: `${totalAvailableLeave}d`, sub: 'Available days', color: 'bg-teal-50 border-teal-200', textColor: 'text-teal-700', icon: CalendarDays, iconBg: 'bg-teal-100' },
                  { label: 'Pending Approvals', value: pendingApprovalsCount, sub: 'Require response', color: 'bg-red-50 border-red-200', textColor: 'text-red-700', icon: ClipboardCheck, iconBg: 'bg-red-100' },
                ].map((card, i) => {
                  const CardIcon = card.icon;
                  return (
                    <motion.div key={i} whileHover={{ y: -3 }} className={`p-5 rounded-xl border ${card.color} flex items-center gap-4`}>
                      <div className={`p-2.5 ${card.iconBg} rounded-xl shrink-0`}><CardIcon size={20} className={card.textColor} /></div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
                        <p className={`font-bold text-lg mt-0.5 ${card.textColor}`}>{card.value}</p>
                        <p className="text-[10px] text-gray-400">{card.sub}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Apply for Leave', icon: Plus, color: 'bg-teal-50 border-teal-200 hover:bg-teal-100', textColor: 'text-teal-700', action: () => { setActiveTab('leaves'); setShowApplyLeaveModal(true); } },
                  { label: 'Apply for Loan', icon: HandCoins, color: 'bg-amber-50 border-amber-200 hover:bg-amber-100', textColor: 'text-amber-700', action: () => { setActiveTab('loans'); setShowLoanApplicationModal(true); } },
                  { label: 'View Approvals', icon: ClipboardCheck, color: 'bg-red-50 border-red-200 hover:bg-red-100', textColor: 'text-red-700', action: () => setActiveTab('approvals') },
                  { label: 'View Payslips', icon: FileText, color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', textColor: 'text-indigo-700', action: () => setActiveTab('payslips') },
                ].map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <motion.button key={i} whileHover={{ y: -2 }} onClick={item.action} className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${item.color}`}>
                      <ItemIcon size={18} className={item.textColor} />
                      <span className={`text-sm font-semibold ${item.textColor}`}>{item.label}</span>
                      <ChevronRight size={14} className={`ml-auto ${item.textColor} opacity-60`} />
                    </motion.button>
                  );
                })}
              </div>

              {/* Latest Payslip */}
              {latestPayslip && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-indigo-600" />
                      <h3 className="font-bold text-sm">Latest Payslip — {latestPayslip.periodName}</h3>
                    </div>
                    <button onClick={() => setSelectedPayslip(latestPayslip)} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline">
                      View Details <ChevronRight size={13} />
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-4 bg-green-50 border border-green-200 rounded-xl">
                        <p className="text-xl font-bold text-green-700">{formatAmount(latestPayslip.gross)}</p>
                        <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide mt-1">Gross Pay</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-xl font-bold text-red-600">-{formatAmount(latestPayslip.totalDeductions)}</p>
                        <p className="text-[10px] font-medium text-red-500 uppercase tracking-wide mt-1">Deductions</p>
                      </div>
                      <div className="text-center p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <p className="text-xl font-bold text-indigo-700">{formatAmount(latestPayslip.net)}</p>
                        <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-wide mt-1">Net Pay</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSelectedPayslip(latestPayslip)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                        <Eye size={14} /> View Payslip
                      </button>
                      <button onClick={() => handleDownload(latestPayslip)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                        <FileDown size={14} /> Download PDF
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Live attendance calendar + leave application (Supabase-backed) */}
              <AttendanceLeaveCalendar
                employeeId={session.dbEmployeeId}
                onApplyForDate={date => { setLeaveFromDate(date); setShowApplyLeaveModal(true); }}
              />

              {/* HR letters — view / print / download + Aadhaar eSign acknowledge */}
              <MyLettersPanel employeeId={session.dbEmployeeId} employeeName={session.name} employeeCode={session.employeeCode} />

              {/* Reimbursements — raise expense claims + track status */}
              <MyReimbursementsPanel employeeId={session.dbEmployeeId} />

              {/* Resignation / Exit — submit resignation, track approvals, approve team's */}
              <MyResignationPanel employeeId={session.dbEmployeeId} employeeName={session.name} employeeCode={session.employeeCode} />

              {/* Active polls (Supabase-backed) */}
              <PollVoteWidget employeeId={session.dbEmployeeId} />
            </motion.div>
          )}

          {/* ── Payslips Tab ── */}
          {activeTab === 'payslips' && (
            <motion.div key="payslips" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">My Payslips</h2>
                  <p className="text-sm text-gray-500 mt-0.5">View, download, and acknowledge your salary slips</p>
                </div>
                <select className="px-4 py-2 border border-gray-200 rounded-lg bg-white outline-none text-sm appearance-none" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
                  <option value="All">All Financial Years</option>
                  <option value="2025-26">FY 2025-26</option>
                  <option value="2024-25">FY 2024-25</option>
                </select>
              </div>

              {/* Form 16 — annual TDS certificate (DB-backed, view & download) */}
              <Form16Panel employeeId={session.dbEmployeeId} />

              {pendingAcknowledgements > 0 && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <Bell size={16} className="text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800 font-medium"><strong>{pendingAcknowledgements}</strong> payslip{pendingAcknowledgements !== 1 ? 's' : ''} pending your acknowledgement</p>
                </div>
              )}

              <div className="space-y-3">
                {filteredPayslips.map((payslip, i) => {
                  const isExpanded = expandedPayslip === payslip.id;
                  return (
                    <motion.div key={payslip.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${!payslip.acknowledged && payslip.status !== 'Draft' ? 'border-amber-200' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-4 px-5 py-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${payslip.status === 'Disbursed' ? 'bg-green-100' : payslip.status === 'Approved' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                          <FileText size={18} className={payslip.status === 'Disbursed' ? 'text-green-600' : payslip.status === 'Approved' ? 'text-blue-600' : 'text-amber-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm text-gray-900">{payslip.periodName}</p>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${payslip.status === 'Disbursed' ? 'bg-green-100 text-green-700 border-green-200' : payslip.status === 'Approved' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                              {payslip.status === 'Disbursed' ? <CheckCircle2 size={9} /> : <Clock size={9} />}
                              {payslip.status}
                            </span>
                            {payslip.acknowledged ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-200">
                                <CheckCheck size={9} /> Acknowledged
                              </span>
                            ) : payslip.status !== 'Draft' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                                <Bell size={9} /> Pending Acknowledgement
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{formatDate(payslip.fromDate)} – {formatDate(payslip.toDate)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-base text-indigo-700">{formatAmount(payslip.net)}</p>
                          <p className="text-[10px] text-gray-400">Net Pay</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setSelectedPayslip(payslip)} className="p-2 rounded-lg hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 transition-colors" title="View Payslip"><Eye size={16} /></button>
                          <button onClick={() => handleDownload(payslip)} className="p-2 rounded-lg hover:bg-green-50 text-gray-500 hover:text-green-600 transition-colors" title="Download PDF"><FileDown size={16} /></button>
                          <button onClick={() => setExpandedPayslip(isExpanded ? null : payslip.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-gray-100">
                            <div className="px-5 py-4 bg-gray-50 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-2">Earnings</p>
                                  <div className="space-y-1">
                                    {[
                                      { label: 'Basic', value: payslip.basic },
                                      { label: 'HRA', value: payslip.hra },
                                      { label: 'Conveyance', value: payslip.conveyance },
                                      { label: 'Medical', value: payslip.medicalAllowance },
                                      { label: 'Special', value: payslip.specialAllowance },
                                    ].map(row => (
                                      <div key={row.label} className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">{row.label}</span>
                                        <span className="font-medium text-green-700">{formatAmount(row.value)}</span>
                                      </div>
                                    ))}
                                    <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-gray-200">
                                      <span>Gross</span>
                                      <span className="text-green-700">{formatAmount(payslip.gross)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-2">Deductions</p>
                                  <div className="space-y-1">
                                    {[
                                      { label: 'PF (12%)', value: payslip.pfEmployee },
                                      ...(payslip.esiEmployee > 0 ? [{ label: 'ESI (0.75%)', value: payslip.esiEmployee }] : []),
                                      { label: 'Prof. Tax', value: payslip.professionalTax },
                                      ...(payslip.tds > 0 ? [{ label: 'TDS', value: payslip.tds }] : []),
                                      ...(payslip.loanEmi > 0 ? [{ label: 'Loan EMI', value: payslip.loanEmi }] : []),
                                    ].map(row => (
                                      <div key={row.label} className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">{row.label}</span>
                                        <span className="font-medium text-red-600">-{formatAmount(row.value)}</span>
                                      </div>
                                    ))}
                                    <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-gray-200">
                                      <span>Total Deductions</span>
                                      <span className="text-red-600">-{formatAmount(payslip.totalDeductions)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedPayslip(payslip)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                                  <Eye size={13} /> View Full Payslip
                                </button>
                                {!payslip.acknowledged && payslip.status !== 'Draft' && (
                                  <button onClick={() => handleAcknowledge(payslip.id)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm ml-auto">
                                    <CheckCheck size={13} /> Acknowledge Receipt
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {filteredPayslips.length === 0 && (
                  <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                    <FileText size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="font-semibold text-gray-500">No payslips found</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Leaves Tab ── */}
          {activeTab === 'leaves' && (
            <motion.div key="leaves" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Leave Management</h2>
                  <p className="text-sm text-gray-500 mt-0.5">View your leave balance, apply for leave, and track requests</p>
                </div>
                <button onClick={() => setShowApplyLeaveModal(true)} className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors shadow-md">
                  <Plus size={15} /> Apply for Leave
                </button>
              </div>

              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                {[
                  { key: 'balance' as const, label: 'Leave Balance', icon: BarChart3 },
                  { key: 'requests' as const, label: `My Requests (${leaveRequests.length})`, icon: CalendarDays },
                ].map(tab => {
                  const TabIcon = tab.icon;
                  const isActive = leaveView === tab.key;
                  return (
                    <button key={tab.key} onClick={() => setLeaveView(tab.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                      <TabIcon size={15} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {leaveView === 'balance' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {leaveBalances.map((bal, i) => {
                      const cs = getLeaveColor(bal.color);
                      const totalAllocated = bal.totalDays;
                      const usedPct = totalAllocated > 0 ? Math.min((bal.usedDays / totalAllocated) * 100, 100) : 0;
                      const availPct = totalAllocated > 0 ? Math.min((bal.availableDays / totalAllocated) * 100, 100) : 0;
                      const isLow = availPct < 25 && totalAllocated > 0;

                      return (
                        <motion.div key={bal.leaveTypeId} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }} className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden transition-all ${isLow ? 'border-amber-200' : cs.border}`}>
                          <div className={`h-1.5 w-full ${cs.bar}`} />
                          <div className="p-5">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl ${cs.bg} flex items-center justify-center`}>
                                  <span className={`text-xs font-bold ${cs.text}`}>{bal.leaveTypeCode}</span>
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-gray-900">{bal.leaveTypeName}</p>
                                  <p className="text-[10px] text-gray-400">{bal.accrualFrequency} accrual</p>
                                </div>
                              </div>
                              {isLow && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Low</span>}
                            </div>

                            <div className="flex items-end justify-between mb-3">
                              <div>
                                <p className={`text-3xl font-bold ${cs.text}`}>{bal.availableDays}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">days available</p>
                              </div>
                              <div className="text-right space-y-1">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <span className="text-[10px] text-gray-400">Used:</span>
                                  <span className="text-xs font-bold text-rose-600">{bal.usedDays}d</span>
                                </div>
                                <div className="flex items-center gap-1.5 justify-end">
                                  <span className="text-[10px] text-gray-400">Total:</span>
                                  <span className="text-xs font-bold text-gray-600">{bal.totalDays}d</span>
                                </div>
                              </div>
                            </div>

                            {totalAllocated > 0 && (
                              <div className="space-y-1">
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full flex rounded-full overflow-hidden">
                                    {usedPct > 0 && <div className="h-full bg-rose-400 transition-all duration-500" style={{ width: `${usedPct}%` }} />}
                                    {availPct > 0 && <div className={`h-full ${cs.bar} transition-all duration-500`} style={{ width: `${availPct}%` }} />}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {leaveView === 'requests' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Filter:</span>
                      {(['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'] as const).map(status => (
                        <button key={status} onClick={() => setLeaveStatusFilter(status)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${leaveStatusFilter === status ? 'bg-teal-600 text-white border-teal-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                          {status}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto text-xs text-gray-400">{filteredLeaveRequests.length} requests</div>
                  </div>

                  {filteredLeaveRequests.length > 0 ? (
                    <div className="space-y-3">
                      {filteredLeaveRequests.map((req, i) => {
                        const cs = getLeaveColor(req.leaveTypeColor);
                        const statusStyle = STATUS_STYLES_LEAVE[req.status];
                        const StatusIcon = statusStyle.icon;
                        return (
                          <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                            <div className="flex items-center gap-4 px-5 py-4">
                              <div className={`w-10 h-10 rounded-xl ${cs.bg} flex items-center justify-center shrink-0`}>
                                <span className={`text-xs font-bold ${cs.text}`}>{req.leaveTypeCode}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-sm text-gray-900">{req.leaveTypeName}</p>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                    <StatusIcon size={9} />
                                    {req.status}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {formatDate(req.fromDate)} {req.fromDate !== req.toDate ? `→ ${formatDate(req.toDate)}` : ''} · {req.days}d · Applied {formatDate(req.appliedOn)}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5 italic truncate">{req.reason}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className={`text-center px-3 py-1.5 rounded-lg ${cs.light} ${cs.border} border`}>
                                  <p className={`text-base font-bold ${cs.text}`}>{req.days}</p>
                                  <p className={`text-[9px] font-medium ${cs.text}`}>days</p>
                                </div>
                                {req.status === 'Pending' && (
                                  <button onClick={() => { onCancelLeave(req.id); toast.info('Leave request cancelled.'); }} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors" title="Cancel Request">
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                      <CalendarDays size={32} className="text-gray-300 mx-auto mb-3" />
                      <p className="font-semibold text-gray-500">No leave requests found</p>
                      <button onClick={() => setShowApplyLeaveModal(true)} className="mt-4 flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm mx-auto">
                        <Plus size={15} /> Apply for Leave
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── Loans Tab ── */}
          {activeTab === 'loans' && (
            <motion.div key="loans" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Loans & Advances</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Apply for loans, track repayment, and view EMI schedules</p>
                </div>
                <button onClick={() => setShowLoanApplicationModal(true)} disabled={hasActiveLoan} className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                  <Plus size={15} /> Apply for Loan
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Loans', value: loans.length, sub: 'All time', color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-700', iconBg: 'bg-amber-100', icon: HandCoins },
                  { label: 'Active Loans', value: activeLoans.length, sub: 'Currently running', color: 'bg-green-50 border-green-200', textColor: 'text-green-700', iconBg: 'bg-green-100', icon: CheckCircle2 },
                  { label: 'Outstanding Balance', value: totalOutstanding > 0 ? formatAmount(totalOutstanding) : 'Nil', sub: 'Total remaining', color: 'bg-rose-50 border-rose-200', textColor: 'text-rose-700', iconBg: 'bg-rose-100', icon: TrendingDown },
                  { label: 'Pending Approval', value: pendingLoans.length, sub: 'Awaiting review', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700', iconBg: 'bg-blue-100', icon: Clock },
                ].map((card, i) => {
                  const CardIcon = card.icon;
                  return (
                    <motion.div key={i} whileHover={{ y: -3 }} className={`p-5 rounded-xl border ${card.color} flex items-center gap-4`}>
                      <div className={`p-2.5 ${card.iconBg} rounded-xl shrink-0`}><CardIcon size={20} className={card.textColor} /></div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
                        <p className={`font-bold text-lg mt-0.5 ${card.textColor}`}>{card.value}</p>
                        <p className="text-[10px] text-gray-400">{card.sub}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* EMI-skip requests (Supabase-backed, manager + HR approval) */}
              <EmiSkipPanel employeeId={session.dbEmployeeId} />

              {loans.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Filter:</span>
                      {(['All', 'Pending', 'Approved', 'Active', 'Closed', 'Rejected'] as const).map(status => (
                        <button key={status} onClick={() => setLoanStatusFilter(status)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${loanStatusFilter === status ? 'bg-amber-600 text-white border-amber-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300'}`}>
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredLoans.map((loan, i) => {
                    const config = loanStyle(loan.loanType);
                    const statusStyle = LOAN_STATUS_STYLES[loan.status];
                    const StatusIcon = statusStyle.icon;
                    const progress = loan.tenureMonths > 0 ? (loan.paidEMIs / loan.tenureMonths) * 100 : 0;

                    return (
                      <motion.div key={loan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                        <div className={`h-1.5 w-full ${loan.status === 'Active' ? 'bg-green-400' : loan.status === 'Pending' ? 'bg-amber-400' : loan.status === 'Closed' ? 'bg-gray-300' : loan.status === 'Rejected' ? 'bg-red-400' : 'bg-blue-400'}`} />
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-11 h-11 rounded-xl ${config.color} flex items-center justify-center shrink-0`}>
                                <HandCoins size={20} className={config.iconColor} />
                              </div>
                              <div>
                                <p className="font-bold text-sm text-gray-900">{loan.loanType}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{loan.id} · Applied {formatDate(loan.appliedDate)}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                              <StatusIcon size={10} />
                              {loan.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Principal</p>
                              <p className="text-sm font-bold text-gray-800 mt-0.5">{formatAmount(loan.principalAmount)}</p>
                            </div>
                            <div className="bg-indigo-50 rounded-lg p-3 text-center">
                              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Monthly EMI</p>
                              <p className="text-sm font-bold text-indigo-700 mt-0.5">{formatAmount(loan.emiAmount)}</p>
                            </div>
                            <div className="bg-amber-50 rounded-lg p-3 text-center">
                              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Outstanding</p>
                              <p className="text-sm font-bold text-amber-700 mt-0.5">{formatAmount(loan.outstandingBalance)}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 text-center">
                              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">EMIs Paid</p>
                              <p className="text-sm font-bold text-green-700 mt-0.5">{loan.paidEMIs}/{loan.tenureMonths}</p>
                            </div>
                          </div>

                          {loan.status === 'Active' && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-semibold text-gray-600">Repayment Progress</span>
                                <span className="text-xs font-bold text-green-600">{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500 flex-1 truncate italic">{loan.purpose}</p>
                            <button onClick={() => setSelectedLoan(loan)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors shrink-0">
                              <Eye size={13} /> View Details
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <HandCoins size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold text-gray-500">No loans found</p>
                  <button onClick={() => setShowLoanApplicationModal(true)} className="mt-4 flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors shadow-sm mx-auto">
                    <HandCoins size={15} /> Apply Now
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Approvals Tab ── */}
          {activeTab === 'approvals' && (
            <motion.div key="approvals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Approvals & Acknowledgements</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Review and respond to deductions, disciplinary actions, memos, and communications</p>
                </div>
              </div>

              {/* Pending Alert */}
              {pendingApprovalsCount > 0 && (
                <div className="flex items-start gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="p-2 bg-red-100 rounded-lg shrink-0"><AlertOctagon size={18} className="text-red-600" /></div>
                  <div>
                    <p className="font-bold text-sm text-red-800">{pendingApprovalsCount} Item{pendingApprovalsCount !== 1 ? 's' : ''} Require Your Response</p>
                    <p className="text-xs text-red-700 mt-0.5">Please review and respond to all pending items. Deductions will be applied to your payroll after your approval or as per HR decision.</p>
                  </div>
                </div>
              )}

              {/* Category Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(Object.entries(APPROVAL_CATEGORY_CONFIG) as [ApprovalCategory, typeof APPROVAL_CATEGORY_CONFIG[ApprovalCategory]][]).map(([key, cfg]) => {
                  const CatIcon = cfg.icon;
                  const total = approvalsByCategory[key];
                  const pending = pendingByCategory[key];
                  const isActive = approvalCategoryFilter === key;
                  return (
                    <motion.button
                      key={key}
                      whileHover={{ y: -2 }}
                      onClick={() => setApprovalCategoryFilter(isActive ? 'all' : key)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${isActive ? `${cfg.accentBg} ${cfg.accentBorder} shadow-sm` : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <div className={`p-2 ${cfg.color} rounded-lg w-fit mb-2`}>
                        <CatIcon size={16} className={cfg.iconColor} />
                      </div>
                      <p className={`font-bold text-xs ${isActive ? cfg.accentText : 'text-gray-800'}`}>{cfg.label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">{total} total</span>
                        {pending > 0 && (
                          <span className="text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">
                            {pending} pending
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by title, description, or reference..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all"
                    value={approvalSearch}
                    onChange={e => setApprovalSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status:</span>
                  {(['all', 'Pending', 'Approved', 'Rejected', 'Acknowledged'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setApprovalStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        approvalStatusFilter === status
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      {status === 'all' ? 'All' : status}
                      {status !== 'all' && (
                        <span className="ml-1 opacity-70">({approvals.filter(a => a.status === status).length})</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="ml-auto text-xs text-gray-400">{filteredApprovals.length} items</div>
              </div>

              {/* Approval Items */}
              {filteredApprovals.length > 0 ? (
                <div className="space-y-3">
                  {filteredApprovals.map((item, i) => {
                    const catConfig = APPROVAL_CATEGORY_CONFIG[item.category];
                    const CatIcon = catConfig.icon;
                    const statusStyle = APPROVAL_STATUS_STYLES[item.status];
                    const StatusIcon = statusStyle.icon;
                    const priorityStyle = PRIORITY_STYLES[item.priority];

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${item.status === 'Pending' ? 'border-amber-200' : 'border-gray-200'}`}
                      >
                        <div className={`h-1 w-full ${
                          item.priority === 'Critical' ? 'bg-red-500' :
                          item.priority === 'High' ? 'bg-amber-500' :
                          item.priority === 'Medium' ? 'bg-blue-400' :
                          'bg-gray-300'
                        }`} />
                        <div className="p-5">
                          <div className="flex items-start gap-4">
                            {/* Category Icon */}
                            <div className={`w-10 h-10 rounded-xl ${catConfig.color} flex items-center justify-center shrink-0 mt-0.5`}>
                              <CatIcon size={18} className={catConfig.iconColor} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catConfig.accentBg} ${catConfig.accentText} ${catConfig.accentBorder}`}>
                                      {catConfig.label}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                      <StatusIcon size={9} />
                                      {item.status}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}>
                                      {item.priority}
                                    </span>
                                  </div>
                                  <h3 className="font-bold text-sm text-gray-900">{item.title}</h3>
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 flex-wrap">
                                    <span>By: <strong className="text-gray-600">{item.issuedBy}</strong></span>
                                    <span>On: <strong className="text-gray-600">{formatDate(item.issuedOn)}</strong></span>
                                    {item.dueBy && (
                                      <span className={`font-semibold ${new Date(item.dueBy) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                                        Due: {formatDate(item.dueBy)}
                                      </span>
                                    )}
                                    <span className="font-mono text-gray-400">{item.referenceNo}</span>
                                  </div>
                                </div>

                                {/* Amount (for deductions) */}
                                {item.amount && (
                                  <div className="text-right shrink-0">
                                    <p className="text-lg font-bold text-red-600">-{formatAmount(item.amount)}</p>
                                    <p className="text-[10px] text-gray-400">Deduction</p>
                                    {item.payrollPeriod && (
                                      <p className="text-[10px] text-gray-400">{item.payrollPeriod}</p>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Employee Response Summary */}
                              {item.employeeResponse && (
                                <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg ${item.employeeResponse === 'Approved' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                  {item.employeeResponse === 'Approved' ? (
                                    <><ThumbsUp size={12} className="text-green-600 shrink-0" /><p className="text-xs text-green-700 font-medium">You approved this on {item.employeeResponseOn}</p></>
                                  ) : (
                                    <><ThumbsDown size={12} className="text-red-600 shrink-0" /><p className="text-xs text-red-700 font-medium">You rejected this on {item.employeeResponseOn}</p></>
                                  )}
                                </div>
                              )}

                              {item.status === 'Acknowledged' && item.employeeResponseOn && !item.employeeResponse && (
                                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                  <CheckCheck size={12} className="text-blue-600 shrink-0" />
                                  <p className="text-xs text-blue-700 font-medium">Acknowledged on {item.employeeResponseOn}</p>
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                                <button
                                  onClick={() => setSelectedApproval(item)}
                                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${catConfig.accentBg} ${catConfig.accentText} border ${catConfig.accentBorder} hover:opacity-80`}
                                >
                                  <Eye size={13} /> View Details
                                </button>

                                {item.status === 'Pending' && (
                                  <>
                                    {(item.category === 'deductions' || item.category === 'disciplinary') && (
                                      <>
                                        <button
                                          onClick={() => { onApprovalAction(item.id, 'approve', ''); toast.success('Approved successfully!'); }}
                                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm"
                                        >
                                          <ThumbsUp size={13} /> Approve
                                        </button>
                                        <button
                                          onClick={() => setSelectedApproval(item)}
                                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                                        >
                                          <ThumbsDown size={13} /> Reject
                                        </button>
                                      </>
                                    )}
                                    {(item.category === 'memos' || item.category === 'communication' || item.category === 'others') && (
                                      <button
                                        onClick={() => { onApprovalAction(item.id, 'acknowledge'); toast.success('Acknowledged successfully!'); }}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                                      >
                                        <CheckCheck size={13} /> Acknowledge
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckSquare size={28} className="text-green-600" />
                  </div>
                  <p className="font-semibold text-gray-500">
                    {approvalSearch || approvalCategoryFilter !== 'all' || approvalStatusFilter !== 'all'
                      ? 'No items match your filters'
                      : 'All caught up! No pending approvals.'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {approvalSearch || approvalCategoryFilter !== 'all' || approvalStatusFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria'
                      : 'You have responded to all pending items.'}
                  </p>
                  {(approvalSearch || approvalCategoryFilter !== 'all' || approvalStatusFilter !== 'all') && (
                    <button
                      onClick={() => { setApprovalSearch(''); setApprovalCategoryFilter('all'); setApprovalStatusFilter('all'); }}
                      className="mt-4 flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm mx-auto"
                    >
                      <RefreshCw size={14} /> Clear Filters
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Manager / My Team Tab ── */}
          {activeTab === 'manager' && isMgr && session.dbEmployeeId && (
            <motion.div key="manager" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <ManagerDashboard managerId={session.dbEmployeeId} managerName={session.name} onCountChange={setMgrPending} />
            </motion.div>
          )}

          {/* ── Profile Tab ── */}
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
                <p className="text-sm text-gray-500 mt-0.5">Your employment and personal details</p>
              </div>

              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-5">
                  <EmployeeAvatar employeeCode={session.employeeCode} initials={session.avatar} name={session.name} size={80} rounded="xl" className="!bg-white/20 !text-white shadow-lg" />
                  <div>
                    <h3 className="text-xl font-bold">{session.name}</h3>
                    <p className="text-blue-100 mt-0.5">{session.designation}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full">{session.employeeCode}</span>
                      <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full">{session.employeeType}</span>
                      <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full">{session.employeeGrade}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                  <Briefcase size={16} className="text-indigo-600" />
                  <h3 className="font-bold text-sm">Employment Details</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Employee Code', value: session.employeeCode, icon: Hash },
                    { label: 'Department', value: session.department, icon: Building2 },
                    { label: 'Designation', value: session.designation, icon: Briefcase },
                    { label: 'Work Location', value: session.workLocation, icon: MapPin },
                    { label: 'Employee Type', value: session.employeeType, icon: User },
                    { label: 'Employee Grade', value: session.employeeGrade, icon: Star },
                    { label: 'Date of Joining', value: formatDate(session.doj), icon: Calendar },
                  ].map(row => {
                    const RowIcon = row.icon;
                    return (
                      <div key={row.label} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="p-1.5 bg-indigo-100 rounded-lg shrink-0"><RowIcon size={14} className="text-indigo-600" /></div>
                        <div>
                          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{row.label}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{row.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail size={16} className="text-blue-600" />
                      <h3 className="font-bold text-sm">Contact Information</h3>
                    </div>
                    <button onClick={() => setShowEmailModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline">
                      <Pencil size={12} /> Update Email
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <Mail size={15} className="text-blue-600 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Email Address</p>
                        <p className="text-sm font-semibold text-gray-800">{currentEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <Phone size={15} className="text-gray-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Phone Number</p>
                        <p className="text-sm font-semibold text-gray-800">{session.phone}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                    <Shield size={16} className="text-emerald-600" />
                    <h3 className="font-bold text-sm">Statutory Details</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    {[
                      { label: 'PAN Number', value: session.pan, icon: Receipt },
                      { label: 'UAN Number', value: session.uan, icon: PiggyBank },
                      { label: 'Bank Account', value: `${session.bankAccount} (${session.bankName})`, icon: CreditCard },
                      { label: 'IFSC Code', value: session.ifsc, icon: Hash },
                    ].map(row => {
                      const RowIcon = row.icon;
                      return (
                        <div key={row.label} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                          <RowIcon size={14} className="text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{row.label}</p>
                            <p className="text-sm font-semibold text-gray-800 font-mono">{row.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Settings Tab ── */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Account Settings</h2>
                <p className="text-sm text-gray-500 mt-0.5">Manage your account preferences and security</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                  <Mail size={16} className="text-blue-600" />
                  <h3 className="font-bold text-sm">Email Address</h3>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{currentEmail}</p>
                      <p className="text-xs text-gray-500 mt-0.5">This email is used for payslip notifications and HR communications</p>
                    </div>
                    <button onClick={() => setShowEmailModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                      <Pencil size={14} /> Update Email
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                  <Key size={16} className="text-amber-600" />
                  <h3 className="font-bold text-sm">Password & Security</h3>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Change Password</p>
                      <p className="text-xs text-gray-500 mt-0.5">Update your password with a strong, unique combination of characters</p>
                    </div>
                    <button onClick={() => setShowPasswordModal(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors shadow-sm">
                      <Key size={14} /> Change Password
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Sign Out</p>
                    <p className="text-xs text-gray-500 mt-0.5">Sign out of the Employee Self-Service Portal</p>
                  </div>
                  <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Payslip Detail Modal */}
      <AnimatePresence>
        {selectedPayslip && (
          <PayslipDetailModal
            payslip={selectedPayslip}
            employee={{ ...session, email: currentEmail }}
            onClose={() => setSelectedPayslip(null)}
            onDownload={() => handleDownload(selectedPayslip)}
            onAcknowledge={() => handleAcknowledge(selectedPayslip.id)}
          />
        )}
      </AnimatePresence>

      {/* Email Update Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <EmailUpdateModal
            currentEmail={currentEmail}
            onUpdate={handleEmailUpdate}
            onClose={() => setShowEmailModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Password Change Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <PasswordChangeModal
            employeeCode={session.employeeCode}
            loginId={session.loginId}
            onClose={() => setShowPasswordModal(false)}
            onSuccess={handlePasswordChangeSuccess}
          />
        )}
      </AnimatePresence>

      {/* Apply Leave Modal */}
      <AnimatePresence>
        {showApplyLeaveModal && (
          <ApplyLeaveModal
            balances={leaveBalances}
            onSubmit={handleSubmitLeave}
            initialFromDate={leaveFromDate}
            onClose={() => { setShowApplyLeaveModal(false); setLeaveFromDate(''); }}
          />
        )}
      </AnimatePresence>

      {/* Loan Application Modal */}
      <AnimatePresence>
        {showLoanApplicationModal && (
          <LoanApplicationModal
            loanTypes={dbLoanTypes}
            onApply={handleApplyLoan}
            onClose={() => setShowLoanApplicationModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Approval Detail Modal */}
      <AnimatePresence>
        {selectedApproval && (
          <ApprovalDetailModal
            item={selectedApproval}
            onClose={() => setSelectedApproval(null)}
            onApprove={handleApprovalApprove}
            onReject={handleApprovalReject}
            onAcknowledge={handleApprovalAcknowledge}
          />
        )}
      </AnimatePresence>

      {/* Loan Detail Modal */}
      <AnimatePresence>
        {selectedLoan && (
          <LoanDetailModal
            loan={selectedLoan}
            onClose={() => setSelectedLoan(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeSelfService() {
  const [session, setSession] = useState<EmployeeSession | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);

  // Loans are read live from the DB, scoped to the logged-in employee.
  const { loans: dbLoans } = useLoans({ employeeId: session?.dbEmployeeId, scoped: true });
  const loans = useMemo(() => dbLoans.map(uiLoanToApplication), [dbLoans]);

  // For real (DB-linked) employees, load actual leave types + balances so the leave-type
  // selector and balances are populated from the database (the mock maps only cover demo logins).
  useEffect(() => {
    const empId = session?.dbEmployeeId;
    if (!empId) return;
    let active = true;
    void (async () => {
      const fyYear = (() => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; })();
      const [{ data: types }, { data: bals }] = await Promise.all([
        supabase.from('leave_types').select('id, name, code, color, accrual_frequency').eq('is_active', true).order('name'),
        supabase.from('leave_balances').select('leave_type_id, opening_balance, accrued, used, pending, closing_balance, year').eq('employee_id', empId),
      ]);
      // Prefer the current financial year's balance row for each leave type.
      const balByType = new Map<string, Record<string, any>>();
      ((bals ?? []) as Record<string, any>[]).forEach(b => {
        const existing = balByType.get(b.leave_type_id);
        if (!existing || b.year === fyYear) balByType.set(b.leave_type_id, b);
      });
      const result: LeaveBalance[] = ((types ?? []) as Record<string, any>[]).map(t => {
        const b = balByType.get(t.id);
        const opening = Number(b?.opening_balance ?? 0);
        const accrued = Number(b?.accrued ?? 0);
        return {
          leaveTypeId: t.id,
          leaveTypeName: (t.name ?? '') as LeaveTypeName,
          leaveTypeCode: t.code ?? '',
          color: t.color ?? 'blue',
          totalDays: opening + accrued,
          usedDays: Number(b?.used ?? 0),
          pendingDays: Number(b?.pending ?? 0),
          availableDays: Number(b?.closing_balance ?? 0),
          accrualFrequency: t.accrual_frequency ?? 'Monthly',
        };
      });
      if (active) setLeaveBalances(result);
    })();
    return () => { active = false; };
  }, [session?.dbEmployeeId]);

  // For real (DB-linked) employees, load actual payslips from payroll_entries so the
  // portal shows the current payroll period's pay data (not the demo PAYSLIPS_DATA).
  useEffect(() => {
    const empId = session?.dbEmployeeId;
    if (!empId) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('payroll_entries')
        .select('id, basic_salary, hra, special_allowance, conveyance_allowance, medical_allowance, lta, other_earnings, gross_salary, pf_employee, esi_employee, professional_tax, tds, loan_emi, advance_recovery, other_deductions, total_deductions, net_salary, working_days, present_days, leave_days, absent_days, overtime_hours, status, employee_acknowledged, employee_acknowledged_at, payroll_period:payroll_periods(id, name, code, financial_year, from_date, to_date, payment_date)')
        .eq('employee_id', empId);
      const n = (v: unknown) => Number(v ?? 0) || 0;
      const rows = ((data ?? []) as Record<string, any>[])
        .filter(e => e.payroll_period)
        .map((e): Payslip => {
          const p = e.payroll_period;
          const s = (e.status ?? '').toLowerCase();
          const status: Payslip['status'] = /disburs|paid/.test(s) ? 'Disbursed' : /approv/.test(s) ? 'Approved' : 'Draft';
          return {
            id: e.id,
            periodId: p.id, periodName: p.name ?? '', periodCode: p.code ?? '',
            fromDate: p.from_date ?? '', toDate: p.to_date ?? '', paymentDate: p.payment_date ?? '',
            financialYear: p.financial_year ?? '', status,
            basic: n(e.basic_salary), hra: n(e.hra), conveyance: n(e.conveyance_allowance),
            medicalAllowance: n(e.medical_allowance), specialAllowance: n(e.special_allowance),
            lta: n(e.lta), overtimeAmount: n(e.other_earnings), gross: n(e.gross_salary),
            pfEmployee: n(e.pf_employee), esiEmployee: n(e.esi_employee),
            professionalTax: n(e.professional_tax), tds: n(e.tds), loanEmi: n(e.loan_emi),
            otherDeductions: n(e.other_deductions) + n(e.advance_recovery),
            totalDeductions: n(e.total_deductions), net: n(e.net_salary),
            workingDays: n(e.working_days), presentDays: n(e.present_days),
            leaveDays: n(e.leave_days), lopDays: n(e.absent_days), overtimeHours: n(e.overtime_hours),
            acknowledged: !!e.employee_acknowledged,
            acknowledgedAt: e.employee_acknowledged_at ? fmtDateTime(e.employee_acknowledged_at) : undefined,
          };
        })
        .sort((a, b) => (b.fromDate || '').localeCompare(a.fromDate || ''));
      if (active) setPayslips(rows);
    })();
    return () => { active = false; };
  }, [session?.dbEmployeeId]);

  // For real (DB-linked) employees, load actual leave requests from the leave_requests table.
  const loadLeaveRequests = useCallback(async () => {
    const empId = session?.dbEmployeeId;
    if (!empId) return;
    const { data } = await supabase
      .from('leave_requests')
      .select('id, leave_type_id, from_date, to_date, days, is_half_day, reason, contact_during_leave, handover_to, status, applied_on, approved_on, remarks, leave_type:leave_types(name, code, color)')
      .eq('employee_id', empId);
    const rows = ((data ?? []) as Record<string, any>[])
      .map((r): LeaveRequest => ({
        id: r.id,
        leaveTypeId: r.leave_type_id ?? '',
        leaveTypeName: (r.leave_type?.name ?? '') as LeaveTypeName,
        leaveTypeCode: r.leave_type?.code ?? '',
        leaveTypeColor: r.leave_type?.color ?? 'blue',
        fromDate: r.from_date ?? '', toDate: r.to_date ?? '',
        days: Number(r.days ?? 0) || 0, isHalfDay: !!r.is_half_day,
        reason: r.reason ?? '', contactDuringLeave: r.contact_during_leave ?? '', handoverTo: r.handover_to ?? '',
        status: (r.status ?? 'Pending') as LeaveRequestStatus,
        appliedOn: r.applied_on ?? '', approvedOn: r.approved_on ?? undefined, remarks: r.remarks ?? undefined,
      }))
      .sort((a, b) => (b.appliedOn || '').localeCompare(a.appliedOn || ''));
    setLeaveRequests(rows);
  }, [session?.dbEmployeeId]);
  useEffect(() => { void loadLeaveRequests(); }, [loadLeaveRequests]);

  // For real (DB-linked) employees, load deduction entries awaiting their approval.
  const loadApprovals = useCallback(async () => {
    const empId = session?.dbEmployeeId;
    if (!empId) return;
    const dedLabel: Record<string, string> = {
      'damages-loss': 'Damage & Loss', fines: 'Fines', canteen: 'Canteen', society: 'Society',
      donations: 'Donations / Campaign', 'other-deductions': 'Other Deductions', 'loan-advances': 'Loan & Advances',
    };
    const { data } = await adb
      .from('deduction_entries')
      .select('id, category, description, amount, reference_no, status, employee_approval_status, employee_approval_at, employee_rejection_reason, created_at, payroll_period:payroll_periods(name)')
      .eq('employee_id', empId)
      .eq('employee_approval_required', true);
    const rows = ((data ?? []) as Record<string, any>[]).map((d): ApprovalItem => {
      const es = (d.employee_approval_status ?? 'Pending').toLowerCase();
      const status: ApprovalStatus = /approv/.test(es) ? 'Approved' : /reject/.test(es) ? 'Rejected' : 'Pending';
      return {
        id: d.id, category: 'deductions',
        title: dedLabel[d.category] ?? (d.category ?? 'Deduction'),
        description: d.description ?? 'Salary deduction requiring your approval.',
        amount: Number(d.amount ?? 0) || 0,
        issuedBy: 'Payroll / HR', issuedByDesignation: 'HR Department',
        issuedOn: (d.created_at ?? '').slice(0, 10),
        status,
        employeeResponse: status === 'Approved' ? 'Approved' : status === 'Rejected' ? 'Rejected' : undefined,
        employeeResponseOn: d.employee_approval_at ? fmtDateTime(d.employee_approval_at) : undefined,
        employeeRemarks: d.employee_rejection_reason ?? undefined,
        referenceNo: d.reference_no ?? d.id.slice(0, 8).toUpperCase(),
        payrollPeriod: d.payroll_period?.name ?? undefined,
        priority: 'Medium',
      };
    });
    setApprovals(rows);
  }, [session?.dbEmployeeId]);
  useEffect(() => { void loadApprovals(); }, [loadApprovals]);

  const handleLogin = (employeeSession: EmployeeSession) => {
    setSession(employeeSession);
    setPayslips(PAYSLIPS_DATA[employeeSession.id] ?? []);
    setLeaveBalances(LEAVE_BALANCES_DATA[employeeSession.id] ?? []);
    setLeaveRequests(LEAVE_REQUESTS_DATA[employeeSession.id] ?? []);
    setApprovals(APPROVALS_DATA[employeeSession.id] ?? []);

    // Resolve the real Supabase employee record (uuid) from the employee code so
    // the live widgets (attendance calendar, polls, EMI-skip) can read/write real data.
    void supabase
      .from('employees')
      .select('id')
      .eq('employee_id', employeeSession.employeeCode)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setSession(prev => (prev ? { ...prev, dbEmployeeId: data.id } : prev));
      });
  };

  const handleLogout = () => {
    setSession(null);
    setPayslips([]);
    setLeaveBalances([]);
    setLeaveRequests([]);
    setApprovals([]);
    toast.info('You have been signed out successfully.');
  };

  const handleUpdateEmail = (newEmail: string) => {
    if (session) {
      setSession(prev => prev ? { ...prev, email: newEmail } : null);
    }
  };

  const handleAcknowledge = (payslipId: string) => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const acknowledgedAt = `${day}/${months[now.getMonth()]}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // Persist for real employees; the local update gives instant feedback either way.
    if (session?.dbEmployeeId) {
      void supabase.from('payroll_entries')
        .update({ employee_acknowledged: true, employee_acknowledged_at: now.toISOString() } as never)
        .eq('id', payslipId)
        .then(({ error }) => { if (error) toast.error(`Could not save acknowledgement: ${error.message}`); });
    }
    setPayslips(prev =>
      prev.map(p => p.id === payslipId ? { ...p, acknowledged: true, acknowledgedAt } : p)
    );
  };

  const handleSubmitLeave = (requestData: Omit<LeaveRequest, 'id' | 'appliedOn' | 'status'>) => {
    const now = new Date();
    const newRequest: LeaveRequest = {
      ...requestData,
      id: `LR-${Date.now()}`,
      appliedOn: now.toISOString().split('T')[0],
      status: 'Pending',
    };
    // Real employees persist to leave_requests; demo logins keep local-only behaviour.
    if (session?.dbEmployeeId) {
      void (async () => {
        const { error } = await supabase.from('leave_requests').insert({
          employee_id: session.dbEmployeeId,
          leave_type_id: requestData.leaveTypeId || null,
          from_date: requestData.fromDate,
          to_date: requestData.toDate,
          days: requestData.days,
          is_half_day: requestData.isHalfDay,
          reason: requestData.reason,
          contact_during_leave: requestData.contactDuringLeave || null,
          handover_to: requestData.handoverTo || null,
          status: 'Pending',
          applied_on: now.toISOString().slice(0, 10),
        } as never);
        if (error) { toast.error(`Could not submit leave: ${error.message}`); return; }
        toast.success('Leave request submitted.');
        await loadLeaveRequests();
      })();
      return;
    }
    setLeaveRequests(prev => [newRequest, ...prev]);
    setLeaveBalances(prev =>
      prev.map(b =>
        b.leaveTypeId === requestData.leaveTypeId
          ? { ...b, pendingDays: b.pendingDays + requestData.days }
          : b
      )
    );
  };

  const handleCancelLeave = (requestId: string) => {
    const request = leaveRequests.find(r => r.id === requestId);
    if (!request) return;
    if (session?.dbEmployeeId) {
      void (async () => {
        const { error } = await supabase.from('leave_requests')
          .update({ status: 'Cancelled', updated_at: new Date().toISOString() } as never)
          .eq('id', requestId);
        if (error) { toast.error(`Could not cancel leave: ${error.message}`); return; }
        toast.info('Leave request cancelled.');
        await loadLeaveRequests();
      })();
      return;
    }
    setLeaveRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: 'Cancelled' } : r)
    );
    if (request.status === 'Pending') {
      setLeaveBalances(prev =>
        prev.map(b =>
          b.leaveTypeId === request.leaveTypeId
            ? { ...b, pendingDays: Math.max(0, b.pendingDays - request.days) }
            : b
        )
      );
    }
  };


  const handleApprovalAction = (id: string, action: 'approve' | 'reject' | 'acknowledge', remarks?: string) => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const responseTime = `${day}/${months[now.getMonth()]}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Real deduction approvals persist to deduction_entries (acknowledge is for memo-type
    // items which only exist as demo data, so those stay local).
    if (session?.dbEmployeeId && (action === 'approve' || action === 'reject')) {
      void (async () => {
        const patch = action === 'approve'
          ? { employee_approval_status: 'Approved', status: 'Approved by Employee', employee_approval_at: now.toISOString() }
          : { employee_approval_status: 'Rejected', status: 'Rejected by Employee', employee_approval_at: now.toISOString(), employee_rejection_reason: remarks ?? null };
        const { error } = await adb.from('deduction_entries')
          .update({ ...patch, updated_at: now.toISOString() })
          .eq('id', id);
        if (error) { toast.error(`Could not update: ${error.message}`); return; }
        await loadApprovals();
      })();
      return;
    }

    setApprovals(prev =>
      prev.map(a => {
        if (a.id !== id) return a;
        if (action === 'approve') {
          return {
            ...a,
            status: 'Approved' as ApprovalStatus,
            employeeResponse: 'Approved' as const,
            employeeResponseOn: responseTime,
            employeeRemarks: remarks,
          };
        }
        if (action === 'reject') {
          return {
            ...a,
            status: 'Rejected' as ApprovalStatus,
            employeeResponse: 'Rejected' as const,
            employeeResponseOn: responseTime,
            employeeRemarks: remarks,
          };
        }
        if (action === 'acknowledge') {
          return {
            ...a,
            status: 'Acknowledged' as ApprovalStatus,
            employeeResponseOn: responseTime,
          };
        }
        return a;
      })
    );
  };

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // First login (or after an HR/forgot-password reset): force a password change before the portal opens.
  if (session.mustChangePassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <PasswordChangeModal
          forced
          employeeCode={session.employeeCode}
          loginId={session.loginId}
          onClose={() => {}}
          onSuccess={() => setSession(prev => prev ? { ...prev, mustChangePassword: false } : prev)}
        />
      </div>
    );
  }

  return (
    <PortalDashboard
      session={session}
      payslips={payslips}
      leaveBalances={leaveBalances}
      leaveRequests={leaveRequests}
      loans={loans}
      approvals={approvals}
      onLogout={handleLogout}
      onUpdateEmail={handleUpdateEmail}
      onAcknowledge={handleAcknowledge}
      onSubmitLeave={handleSubmitLeave}
      onCancelLeave={handleCancelLeave}
      onApprovalAction={handleApprovalAction}
    />
  );
}