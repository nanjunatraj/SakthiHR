// Single source of truth for the Reports navigation — 13 groups. The sidebar, the
// Reports landing page, and the generic group-hub (`/reports/g/:groupKey`) all read
// from here. Single-item groups link straight to the report; multi-item groups open
// a hub of cards. No report pages/routes change — this is only a grouping layer.

import type { LucideIcon } from 'lucide-react';
import {
  UserSquare, Clock, CalendarDays, Wallet, Receipt, CircleDollarSign, Shield,
  FileText, BarChart2, ScrollText, BookOpen, TrendingUp, CalendarRange,
  Play, Banknote, FileSpreadsheet, IdCard,
} from 'lucide-react';

export interface ReportItem {
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export interface ReportGroup {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;       // tailwind bg-* for the icon chip
  iconColor: string;   // tailwind text-*
  tags: string[];
  items: ReportItem[];
}

export const REPORT_GROUPS: ReportGroup[] = [
  {
    key: 'employee', title: 'Employee Reports', icon: UserSquare, color: 'bg-blue-100', iconColor: 'text-blue-600',
    description: 'Employee master data, headcount, department-wise distribution, joining & exit reports.',
    tags: ['Headcount', 'Department-wise', 'Joining', 'Exit'],
    items: [
      { label: 'Employee Reports', description: 'Master data, headcount, department-wise distribution, joining & exit.', path: '/reports/employee', icon: UserSquare },
      { label: 'Employee Profile Report', description: 'Full personal, contact and employment profile of an individual employee.', path: '/reports/employee-profile', icon: IdCard },
    ],
  },
  {
    key: 'attendance', title: 'Attendance Reports', icon: Clock, color: 'bg-cyan-100', iconColor: 'text-cyan-600',
    description: 'Daily/period attendance register and attendance metrics across pay periods.',
    tags: ['Attendance Register', 'Present/Absent', 'Period Metrics'],
    items: [
      { label: 'Attendance Register', description: 'Per-day attendance grid for a payroll period.', path: '/reports/registers/attendance', icon: Clock },
      { label: 'Attendance Metrics (Period)', description: 'Attendance metrics across a from/to period range, grouped by org dimension.', path: '/reports/period', icon: BarChart2 },
    ],
  },
  {
    key: 'leave', title: 'Leave Reports', icon: CalendarDays, color: 'bg-teal-100', iconColor: 'text-teal-600',
    description: 'Leave register — taken, balance, and leave-type-wise utilisation.',
    tags: ['Leave Register', 'Balance', 'Type-wise'],
    items: [
      { label: 'Leave Register', description: 'Leave taken / balance per employee for a period.', path: '/reports/registers/leave', icon: CalendarDays },
    ],
  },
  {
    key: 'loan', title: 'Loan Reports', icon: Wallet, color: 'bg-indigo-100', iconColor: 'text-indigo-600',
    description: 'Loan & advance disbursements, outstanding balances, and EMI recovery.',
    tags: ['Disbursement', 'Outstanding', 'EMI'],
    items: [
      { label: 'Loans & Advances', description: 'Loan disbursements, outstanding balances and EMI schedules.', path: '/loans', icon: Wallet },
    ],
  },
  {
    key: 'payroll-overview', title: 'Payroll Overview', icon: Receipt, color: 'bg-emerald-100', iconColor: 'text-emerald-600',
    description: 'Payroll summary, detailed pay-run reports, payslip generation and salary payment.',
    tags: ['Summary', 'Pay Run', 'Payslips', 'Payment'],
    items: [
      { label: 'Payroll Summary', description: 'Monthly payroll summaries, gross vs net, cost analysis.', path: '/reports/payroll-summary', icon: Receipt },
      { label: 'Pay Run Reports', description: 'Detailed per-period pay-run, employee-wise data and disbursement status.', path: '/reports/pay-run', icon: Play },
      { label: 'Payslip Generation', description: 'Generate and export payslips with employee filters.', path: '/reports/payslip-generation', icon: FileText },
      { label: 'Salary Payment', description: 'Payment status, bank statements, re-runs and arrears.', path: '/payroll/salary-payment', icon: Banknote },
    ],
  },
  {
    key: 'deductions', title: 'Deductions Reports', icon: CircleDollarSign, color: 'bg-orange-100', iconColor: 'text-orange-600',
    description: 'Fines, damages, canteen, society, donations and other deduction registers.',
    tags: ['Fines', 'Damages', 'Canteen', 'Society'],
    items: [
      { label: 'Fines & Deductions Register', description: 'All non-statutory deductions per period with approval status.', path: '/reports/registers/fines-deductions', icon: CircleDollarSign },
    ],
  },
  {
    key: 'statutory', title: 'Statutory Reports', icon: Shield, color: 'bg-rose-100', iconColor: 'text-rose-600',
    description: 'PF, ESI, PT, TDS compliance reports plus Bonus and Gratuity registers.',
    tags: ['PF', 'ESI', 'PT', 'Bonus', 'Gratuity'],
    items: [
      { label: 'Statutory Reports', description: 'PF / ESI / PT / TDS statements, registers and returns for filings.', path: '/reports/statutory', icon: Shield },
      { label: 'Bonus Register', description: 'Payment of Bonus Act register (and ex-gratia).', path: '/reports/bonus', icon: Receipt },
      { label: 'Gratuity', description: 'Gratuity accrual provision and exit settlements.', path: '/reports/gratuity', icon: Wallet },
    ],
  },
  {
    key: 'it', title: 'IT Reports', icon: FileText, color: 'bg-violet-100', iconColor: 'text-violet-600',
    description: 'Income-tax reports — Form 16 and TDS / income-tax computation.',
    tags: ['Form 16', 'TDS', 'Income Tax'],
    items: [
      { label: 'Form 16', description: 'Generate and download Form 16 (Part A & B) per employee.', path: '/reports/form16', icon: FileText },
      { label: 'TDS / Income Tax', description: 'TDS statements and income-tax returns (Statutory → TDS).', path: '/reports/statutory', icon: Shield },
    ],
  },
  {
    key: 'period', title: 'Period Reports', icon: BarChart2, color: 'bg-sky-100', iconColor: 'text-sky-600',
    description: 'Any attendance / wage metric across a from-to period range, grouped by org dimension.',
    tags: ['From–To', 'LOP', 'PF Deducted', 'Grouped'],
    items: [
      { label: 'Period Reports', description: 'One metric across a period range grouped by location / dept / designation / category.', path: '/reports/period', icon: BarChart2 },
    ],
  },
  {
    key: 'statement', title: 'Statement', icon: ScrollText, color: 'bg-amber-100', iconColor: 'text-amber-600',
    description: 'Pay-period statements — bank, PF, ESI, PT, TDS and other pay statements.',
    tags: ['Bank', 'PF/ESI', 'PT', 'TDS'],
    items: [
      { label: 'Statements', description: 'Eleven pay-period statements with PDF / Excel / CSV export.', path: '/reports/statements', icon: ScrollText },
    ],
  },
  {
    key: 'registers', title: 'Registers', icon: BookOpen, color: 'bg-fuchsia-100', iconColor: 'text-fuchsia-600',
    description: 'Statutory registers — attendance, wage, leave, overtime and fines/deductions.',
    tags: ['Attendance', 'Wage', 'Leave', 'Overtime'],
    items: [
      { label: 'Registers', description: 'Attendance, Wage, Leave, Overtime and Fines/Deductions registers.', path: '/reports/registers', icon: BookOpen },
    ],
  },
  {
    key: 'ytd', title: 'YTD Reports', icon: TrendingUp, color: 'bg-lime-100', iconColor: 'text-lime-600',
    description: 'Year-to-date earnings, deductions, tax and PF/ESI contribution per employee.',
    tags: ['YTD Earnings', 'YTD Deductions', 'Tax', 'PF/ESI'],
    items: [
      { label: 'YTD Reports', description: 'Year-to-date earnings, deductions, tax and PF/ESI per employee.', path: '/reports/ytd', icon: TrendingUp },
    ],
  },
  {
    key: 'annual', title: 'Annual Reports', icon: CalendarRange, color: 'bg-slate-100', iconColor: 'text-slate-600',
    description: 'Consolidated yearly summaries — annual YTD and annual payroll cost.',
    tags: ['Annual YTD', 'Yearly Payroll', 'Consolidated'],
    items: [
      { label: 'Annual YTD Summary', description: 'Full financial-year earnings, deductions and tax per employee.', path: '/reports/ytd', icon: TrendingUp },
      { label: 'Annual Payroll Summary', description: 'Yearly payroll cost summary across periods.', path: '/reports/payroll-summary', icon: FileSpreadsheet },
    ],
  },
];

export const groupDestination = (g: ReportGroup): string =>
  g.items.length === 1 ? g.items[0].path : `/reports/g/${g.key}`;

export const getReportGroup = (key: string): ReportGroup | undefined =>
  REPORT_GROUPS.find(g => g.key === key);
