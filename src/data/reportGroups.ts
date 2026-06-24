// Single source of truth for the Reports navigation — 13 groups. The sidebar, the
// Reports landing page, and the generic group-hub (`/reports/g/:groupKey`) all read
// from here. Single-item groups link straight to the report; multi-item groups open
// a hub of cards. No report pages/routes change — this is only a grouping layer.

import type { LucideIcon } from 'lucide-react';
import {
  UserSquare, Clock, CalendarDays, Wallet, Receipt, CircleDollarSign, Shield,
  FileText, BarChart2, ScrollText, BookOpen, TrendingUp, CalendarRange,
  Play, Banknote, FileSpreadsheet, IdCard,
  PieChart, Network, FileSignature, BadgeCheck, MapPin,
  Timer, LogIn, LogOut, ClipboardList, TrendingDown, CalendarClock, Activity,
  PiggyBank, CreditCard, Building2,
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
  /** Nested sub-hub reachable only from within another group (e.g. Time Management
   *  under Attendance). Hidden groups are resolvable by /reports/g/:key but excluded
   *  from the top-level Reports landing and the sidebar Reports menu. */
  hidden?: boolean;
}

export const REPORT_GROUPS: ReportGroup[] = [
  {
    key: 'employee', title: 'Employee Reports', icon: UserSquare, color: 'bg-blue-100', iconColor: 'text-blue-600',
    description: 'Headcount MIS, individual profiles & hierarchy, and on-demand employee letters & certificates.',
    tags: ['MIS', 'Profile', 'Hierarchy', 'Letters', 'Certificates'],
    items: [
      { label: 'MIS Reports', description: 'Headcount dashboard — distribution by department, designation, location, type & gender, with joiners vs exits.', path: '/reports/employee-mis', icon: PieChart },
      { label: 'Employee Profile', description: 'Full personal, contact and employment profile of an individual employee.', path: '/reports/employee-profile', icon: IdCard },
      { label: 'Employee Hierarchy', description: 'Reporting-manager org chart across the organisation.', path: '/employees/hierarchy', icon: Network },
      { label: 'Appointment Order', description: 'Generate a personalised appointment order / letter for an employee.', path: '/reports/employee-document/appointment', icon: FileSignature },
      { label: 'Experience Letter', description: 'Generate an experience certificate for an employee.', path: '/reports/employee-document/experience', icon: ScrollText },
      { label: 'Service Certificate', description: 'Generate a service certificate confirming current employment.', path: '/reports/employee-document/service', icon: BadgeCheck },
      { label: 'Income Proof', description: 'Generate a salary / income certificate for an employee.', path: '/reports/employee-document/income-proof', icon: Banknote },
      { label: 'Address Proof', description: 'Generate a residential address-proof letter for an employee.', path: '/reports/employee-document/address-proof', icon: MapPin },
    ],
  },
  {
    key: 'attendance', title: 'Attendance Reports', icon: Clock, color: 'bg-cyan-100', iconColor: 'text-cyan-600',
    description: 'Attendance register & statement, time-management (late / early / overtime) and period metrics.',
    tags: ['Register', 'Statement', 'Time Management', 'Period Metrics'],
    items: [
      { label: 'Attendance Register', description: 'Per-day attendance grid for a payroll period.', path: '/reports/registers/attendance', icon: Clock },
      { label: 'Attendance Statement', description: 'Per-employee attendance summary with filters to group the data by department, designation, location and more.', path: '/reports/attendance-statement', icon: ClipboardList },
      { label: 'Time Management Reports', description: 'Late entry, early out and overtime reports — punctuality and working-time analysis.', path: '/reports/g/time-management', icon: Timer },
      { label: 'Attendance Metrics (Period)', description: 'Attendance metrics across a from/to period range, grouped by org dimension.', path: '/reports/period', icon: BarChart2 },
    ],
  },
  {
    key: 'time-management', title: 'Time Management Reports', icon: Timer, color: 'bg-amber-100', iconColor: 'text-amber-600',
    hidden: true,
    description: 'Punctuality and working-time analysis — late entry, early out and overtime across a pay period.',
    tags: ['Late Entry', 'Early Out', 'Overtime'],
    items: [
      { label: 'Late Entry Report', description: 'Employees who checked in after their shift start (beyond grace), with late-by minutes.', path: '/reports/time-management/late', icon: LogIn },
      { label: 'Early Out Report', description: 'Employees who checked out before their shift end (beyond grace), with early-by minutes.', path: '/reports/time-management/early', icon: LogOut },
      { label: 'Overtime Report', description: 'Overtime hours logged against attendance, grouped by org dimension.', path: '/reports/time-management/overtime', icon: Timer },
    ],
  },
  {
    key: 'leave', title: 'Leave Reports', icon: CalendarDays, color: 'bg-teal-100', iconColor: 'text-teal-600',
    description: 'Leave register & statement, current employee leave status, and loss-of-pay report.',
    tags: ['Register', 'Statement', 'Leave Status', 'Loss of Pay'],
    items: [
      { label: 'Leave Register', description: 'Type-wise opening / used / closing leave balance per employee.', path: '/reports/registers/leave', icon: CalendarDays },
      { label: 'Leave Statement', description: 'Leave applications taken in a period, grouped by org dimension or leave type, with days totals.', path: '/reports/leave-statement', icon: ScrollText },
      { label: 'Employee Leave Status', description: 'Current entitlement, used, balance and pending applications per employee.', path: '/reports/leave-status', icon: BadgeCheck },
      { label: 'Loss of Pay Report', description: 'Unpaid days (unauthorised absence + LOP) per employee for a period, with indicative deduction.', path: '/reports/lop', icon: TrendingDown },
    ],
  },
  {
    key: 'loan', title: 'Loan & Advances Report', icon: Wallet, color: 'bg-indigo-100', iconColor: 'text-indigo-600',
    description: 'Loan & advance register and statement, application/approval letters, EMI schedule and loan status.',
    tags: ['Register', 'Statement', 'Letters', 'EMI', 'Status'],
    items: [
      { label: 'Loan & Advance Register', description: 'Master register of all loans & advances — principal, EMI, paid and outstanding per employee.', path: '/reports/loan-register', icon: Wallet },
      { label: 'Loan & Advance Statement', description: 'Disbursements and EMI recovery within a pay period, grouped by any dimension.', path: '/reports/loan-statement', icon: ScrollText },
      { label: 'Loan Application & Approval Letter', description: 'Generate the loan application or sanction/approval letter for any loan & advance.', path: '/reports/loan-letter', icon: FileSignature },
      { label: 'EMI Statement', description: 'Month-wise amortisation schedule for a loan — EMI, principal, interest and repayment status.', path: '/reports/emi-statement', icon: CalendarClock },
      { label: 'Loan Status Report', description: 'Repayment progress and approval state of every loan & advance.', path: '/reports/loan-status', icon: Activity },
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
    description: 'Fines & deductions register and statement, plus an employee-wise category breakdown.',
    tags: ['Register', 'Statement', 'Employee-wise'],
    items: [
      { label: 'Fines & Deductions Register', description: 'All non-statutory deductions per period with approval status (Form No. 2).', path: '/reports/registers/fines-deductions', icon: CircleDollarSign },
      { label: 'Fine & Deductions Statement', description: 'Deduction entries for a period grouped by category, status or org dimension with totals.', path: '/reports/deductions-statement', icon: ScrollText },
      { label: 'Employee-wise Fine & Deduction Report', description: 'Per-employee deduction summary broken down by category (Fines, Canteen, Society, …).', path: '/reports/deductions-employee', icon: UserSquare },
    ],
  },
  {
    key: 'statutory', title: 'Statutory Reports', icon: Shield, color: 'bg-rose-100', iconColor: 'text-rose-600',
    description: 'Statutory compliance — registers, statements, PF, ESI, Professional Tax, Bonus and Gratuity.',
    tags: ['Registers', 'Statements', 'PF', 'ESI', 'PT', 'Bonus', 'Gratuity'],
    items: [
      { label: 'Registers', description: 'Period-wise statutory registers (PF / ESI / PT) grouped by work-location statutory code.', path: '/reports/statutory?section=registers', icon: BookOpen },
      { label: 'Statements', description: 'PF / ESI / PT / TDS contribution statements for filings, with PDF / Excel / CSV export.', path: '/reports/statutory?section=statements', icon: ScrollText },
      { label: 'PF', description: 'EPFO monthly contribution — employee & employer PF, EPS, EDLI, UAN-wise for ECR filing.', path: '/reports/statutory?report=pf&section=statements', icon: PiggyBank },
      { label: 'ESI', description: 'ESIC monthly contribution — employee & employer ESI for employees with gross ≤ ₹21,000.', path: '/reports/statutory?report=esi&section=statements', icon: CreditCard },
      { label: 'Bonus', description: 'Payment of Bonus Act register (and ex-gratia).', path: '/reports/bonus', icon: Receipt },
      { label: 'Gratuity', description: 'Gratuity accrual provision and exit settlements.', path: '/reports/gratuity', icon: Wallet },
      { label: 'Professional Tax', description: 'State-wise professional tax deductions and remittance reports.', path: '/reports/statutory?report=pt&section=statements', icon: Building2 },
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
