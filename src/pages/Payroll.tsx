import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import {
  Calculator,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  History,
  DollarSign,
  CalendarRange,
  Play,
  ClipboardCheck,
  Lock,
  Unlock,
  RefreshCw,
  Clock,
  Users,
  TrendingUp,
  ChevronRight,
  Eye,
  Download,
  X,
  Save,
  BarChart2,
  Banknote,
  Shield,
  Star,
  Calendar,
  Filter,
  Search,
  Sunset,
  Info
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useCurrency } from '../context/CurrencyContext';
import { toast } from 'react-toastify';
import {
  getAllEmployeeSalaries,
  getStructureById,
  computeSalaryBreakdown,
  type SalaryBreakdown,
} from '../data/salaryStructures';
import { useRunCandidates, totalsOf, persistPayrollRun, totalDeductionsOf, netOf, loadPeriodRunSummaries, loadRunEntries, approvePayrollRun, type RunEntry } from '../lib/payrollRun';
import { loadPrecheckCompletion } from '../lib/prePayroll';
import { useNavigate } from 'react-router-dom';

type PayrollPeriodStatus = 'Open' | 'Processing' | 'Closed' | 'Locked';
type RunPayrollStatus = 'Not Run' | 'Draft' | 'Processing' | 'Completed' | 'Approved' | 'Disbursed';

interface PayrollPeriod {
  id: string;
  name: string;
  code: string;
  financialYear: string;
  frequency: string;
  fromDate: string;
  toDate: string;
  paymentDate: string;
  status: PayrollPeriodStatus;
  isDefault: boolean;
  runStatus: RunPayrollStatus;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  processedOn?: string;
  processedBy?: string;
}

// ─── Half-Day Holiday Pay Rule ────────────────────────────────────────────────
// HD (Half-Day Holiday) days = employee works half day + half day is a paid holiday
// → Employee receives FULL PAY for HD days (no deduction)
// This is different from Half Day Leave (HD Leave) where only half pay is given.
// The payroll engine treats HD holiday days as fully paid working days.

interface HalfDayHolidayPayRule {
  description: string;
  paymentBasis: 'Full Pay';
  reason: string;
}

const HALF_DAY_HOLIDAY_PAY_RULE: HalfDayHolidayPayRule = {
  description: 'Half-Day Weekly Off Holiday (HD)',
  paymentBasis: 'Full Pay',
  reason: 'Employee works half the day; the other half is a paid holiday. Full day salary is payable.',
};

const PERIOD_STATUS_STYLES: Record<PayrollPeriodStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Open: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: Unlock },
  Processing: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: RefreshCw },
  Closed: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: CheckCircle2 },
  Locked: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: Lock },
};

const RUN_STATUS_STYLES: Record<RunPayrollStatus, { bg: string; text: string; border: string }> = {
  'Not Run': { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  'Draft': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  'Processing': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  'Completed': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Approved': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Disbursed': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
};

// Payroll periods are loaded live from the `payroll_periods` table.
const db = supabase as unknown as SupabaseClient;
function rowToPeriod(r: Record<string, any>): PayrollPeriod {
  return {
    id: r.id,
    name: r.name ?? '',
    code: r.code ?? '',
    financialYear: r.financial_year ?? '',
    frequency: r.frequency ?? 'Monthly',
    fromDate: r.from_date ?? '',
    toDate: r.to_date ?? '',
    paymentDate: r.payment_date ?? '',
    status: (r.status as PayrollPeriodStatus) ?? 'Open',
    isDefault: Boolean(r.is_default),
    runStatus: 'Not Run',
    totalEmployees: 0,
    totalGross: 0,
    totalDeductions: 0,
    totalNet: 0,
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

// ─── Payroll Calculation Engine ───────────────────────────────────────────────
// Computes gross pay considering HD (Half-Day Holiday) days as FULL PAY days.
// HD days are NOT deducted from salary — they count as present days for pay purposes.

interface AttendanceSummary {
  workingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  holidayDays: number;       // Full holidays (H) — paid, not worked
  halfDayHolidayDays: number; // Half-Day holidays (HD) — paid, worked half day → FULL PAY
  lopDays: number;
  weekendDays: number;
}

interface PayrollCalculationResult {
  grossSalary: number;
  lopDeduction: number;
  netGrossAfterLOP: number;
  paidDays: number;
  totalDays: number;
  hdDaysFullPay: number;
  calculationNote: string;
}

function calculatePayrollForEmployee(
  monthlyCTC: number,
  attendance: AttendanceSummary
): PayrollCalculationResult {
  const totalDays = attendance.workingDays + attendance.weekendDays + attendance.holidayDays + attendance.halfDayHolidayDays;
  const workingDays = attendance.workingDays;

  // Paid days = Present + Leave (approved) + Full Holidays + Half-Day Holidays (FULL PAY)
  // HD days are treated as fully paid because:
  //   - Employee works half the day (earning half)
  //   - The other half is a paid holiday (earning the other half)
  //   - Net result: FULL DAY PAY
  const paidDays = attendance.presentDays + attendance.leaveDays + attendance.holidayDays + attendance.halfDayHolidayDays;

  // LOP deduction only for absent days (not for HD holidays)
  const lopDays = attendance.lopDays + attendance.absentDays;
  const perDaySalary = monthlyCTC / workingDays;
  const lopDeduction = lopDays * perDaySalary;
  const grossSalary = monthlyCTC;
  const netGrossAfterLOP = Math.max(0, grossSalary - lopDeduction);

  const calculationNote = attendance.halfDayHolidayDays > 0
    ? `${attendance.halfDayHolidayDays} Half-Day Holiday (HD) day${attendance.halfDayHolidayDays !== 1 ? 's' : ''} treated as Full Pay — employee works half day + half day is a paid holiday.`
    : 'Standard payroll calculation applied.';

  return {
    grossSalary,
    lopDeduction,
    netGrossAfterLOP,
    paidDays,
    totalDays,
    hdDaysFullPay: attendance.halfDayHolidayDays,
    calculationNote,
  };
}

// ─── Run Payroll Modal ────────────────────────────────────────────────────────

interface EmployeePayrollResult {
  employeeId: string;
  employeeName: string;
  structureCode: string;
  ctcMonthly: number;
  breakdown: SalaryBreakdown;
}

interface PayrollRunTotals {
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}

interface RunPayrollModalProps {
  period: PayrollPeriod;
  onClose: () => void;
  onConfirm: (periodId: string, totals: PayrollRunTotals) => void;
  formatAmount: (n: number) => string;
}

const RunPayrollModal = ({ period, onClose, onConfirm, formatAmount }: RunPayrollModalProps) => {
  const [step, setStep] = useState<'confirm' | 'running' | 'done'>('confirm');

  // Sample attendance data for July 2025 — includes HD days
  const sampleAttendance: AttendanceSummary = {
    workingDays: 23,
    presentDays: 20,
    absentDays: 0,
    leaveDays: 1,
    holidayDays: 2,
    halfDayHolidayDays: 2, // 2 Half-Day Weekly Off holidays in July 2025
    lopDays: 0,
    weekendDays: 8,
  };

  // Sample calculation for a ₹100,000/month employee
  const sampleCalc = calculatePayrollForEmployee(100000, sampleAttendance);

  // ─── Build payroll from each employee's DB salary assignment ─────────────────
  // Reads employee_salary_assignments → salary_structures, computes the breakdown,
  // and layers in the Loan/Advance EMI deduction (active loans minus approved
  // EMI-skips for this period). Running PERSISTS payroll_runs + payroll_entries.
  const { candidates, loading: loadingCandidates } = useRunCandidates(period.id);

  const totals = useMemo<PayrollRunTotals>(() => totalsOf(candidates), [candidates]);
  const totalLoanEmi = useMemo(() => candidates.reduce((s, c) => s + c.loanEmi, 0), [candidates]);
  const totalTds = useMemo(() => candidates.reduce((s, c) => s + c.tds, 0), [candidates]);
  const hasConfiguredEmployees = candidates.length > 0;

  const handleRun = async () => {
    setStep('running');
    const { error } = await persistPayrollRun(period.id, candidates);
    if (error) { toast.error(error); setStep('confirm'); return; }
    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Calculator size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">Run Payroll</h2>
              <p className="text-xs text-muted-foreground">{period.name} · {formatDate(period.fromDate)} → {formatDate(period.toDate)}</p>
            </div>
          </div>
          {step !== 'running' && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-6">
          {step === 'confirm' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700">
                  <p className="font-semibold mb-1">Pre-Payroll Checklist</p>
                  <ul className="space-y-0.5 list-disc list-inside">
                    <li>Attendance for the period has been entered and approved</li>
                    <li>Leave records are up to date</li>
                    <li>Salary structures are assigned to all employees</li>
                    <li>Loan EMI deductions are configured</li>
                  </ul>
                </div>
              </div>

              {/* HD Holiday Pay Rule Banner */}
              <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                <Sunset size={16} className="text-teal-600 shrink-0 mt-0.5" />
                <div className="text-xs text-teal-700">
                  <p className="font-semibold mb-1">Half-Day Holiday (HD) Pay Rule — Full Pay Applied</p>
                  <p>
                    Employees with <strong>Half-Day Weekly Off holidays (HD)</strong> in this period will receive <strong>full day pay</strong> for those days.
                    This is because they work half the day and the other half is a paid holiday — resulting in full salary for the day.
                    HD days are <strong>not treated as LOP or half-day leave</strong>.
                  </p>
                  {sampleAttendance.halfDayHolidayDays > 0 && (
                    <div className="mt-2 px-3 py-2 bg-white/70 border border-teal-200 rounded-lg">
                      <p className="font-semibold text-teal-800">Sample Calculation (₹1,00,000/month employee):</p>
                      <p className="mt-1">
                        HD Days: <strong>{sampleAttendance.halfDayHolidayDays}</strong> ·
                        Paid Days: <strong>{sampleCalc.paidDays}</strong> of {sampleAttendance.workingDays} working days ·
                        LOP Deduction: <strong>{formatAmount(sampleCalc.lopDeduction)}</strong> ·
                        Net Gross: <strong>{formatAmount(sampleCalc.netGrossAfterLOP)}</strong>
                      </p>
                      <p className="mt-1 italic opacity-80">{sampleCalc.calculationNote}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Pay Period', value: period.name },
                  { label: 'Payment Date', value: formatDate(period.paymentDate) },
                  { label: 'Employees', value: `${period.totalEmployees} employees` },
                  { label: 'Financial Year', value: `FY ${period.financialYear}` },
                ].map(item => (
                  <div key={item.label} className="p-3 bg-accent/30 rounded-xl border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{item.label}</p>
                    <p className="text-sm font-bold">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Per-employee salary preview computed from each employee's structure */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/40 border-b border-border">
                  <Users size={14} className="text-primary" />
                  <p className="text-xs font-bold">Salary Components by Employee</p>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {totals.totalEmployees} employee{totals.totalEmployees !== 1 ? 's' : ''} with configured salary structures
                  </span>
                </div>
                {hasConfiguredEmployees ? (
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-accent/20 text-muted-foreground uppercase tracking-wide text-[10px] sticky top-0">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Employee</th>
                          <th className="px-4 py-2 font-semibold">Structure</th>
                          <th className="px-4 py-2 font-semibold text-right">Gross</th>
                          <th className="px-4 py-2 font-semibold text-right">TDS</th>
                          <th className="px-4 py-2 font-semibold text-right">Loan EMI</th>
                          <th className="px-4 py-2 font-semibold text-right">Deductions</th>
                          <th className="px-4 py-2 font-semibold text-right">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {candidates.map(c => {
                          const ded = totalDeductionsOf(c);
                          const net = netOf(c);
                          return (
                          <tr key={c.employeeId} className="hover:bg-accent/20">
                            <td className="px-4 py-2">
                              <p className="font-semibold">{c.employeeName}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{c.employeeCode} · {c.regime} regime</p>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-[10px] font-mono bg-accent px-1.5 py-0.5 rounded">{c.structureCode}</span>
                            </td>
                            <td className="px-4 py-2 text-right font-semibold">{formatAmount(c.breakdown.grossMonthly + c.breakdown.totalReimbursements)}</td>
                            <td className="px-4 py-2 text-right text-rose-600">{c.tds > 0 ? `−${formatAmount(c.tds)}` : '—'}</td>
                            <td className="px-4 py-2 text-right text-amber-600">{c.loanEmi > 0 ? `−${formatAmount(c.loanEmi)}` : '—'}</td>
                            <td className="px-4 py-2 text-right text-red-600">−{formatAmount(ded)}</td>
                            <td className="px-4 py-2 text-right font-bold text-green-600">{formatAmount(net)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-accent/30 font-bold sticky bottom-0">
                        <tr>
                          <td className="px-4 py-2" colSpan={2}>Total ({totals.totalEmployees})</td>
                          <td className="px-4 py-2 text-right">{formatAmount(totals.totalGross)}</td>
                          <td className="px-4 py-2 text-right text-rose-600">−{formatAmount(totalTds)}</td>
                          <td className="px-4 py-2 text-right text-amber-600">−{formatAmount(totalLoanEmi)}</td>
                          <td className="px-4 py-2 text-right text-red-600">−{formatAmount(totals.totalDeductions)}</td>
                          <td className="px-4 py-2 text-right text-green-700">{formatAmount(totals.totalNet)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                    No employees have a salary structure configured yet. Assign salary structures in
                    <strong> Employee Master → Salary Structure</strong> tab, then run payroll.
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Running payroll calculates salaries from each employee's <strong>configured salary structure values</strong> for <strong>{period.name}</strong>.
                  HD (Half-Day Holiday) days are counted as <strong>full pay days</strong>. The result is saved as a Draft and can be reviewed before approval.
                </p>
              </div>
            </motion.div>
          )}

          {step === 'running' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                <RefreshCw size={28} className="text-primary animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Processing Payroll...</h3>
                <p className="text-sm text-muted-foreground mt-1">Calculating salaries for {period.totalEmployees} employees</p>
                <p className="text-xs text-teal-600 mt-1 flex items-center justify-center gap-1">
                  <Sunset size={12} /> HD days → Full Pay applied
                </p>
              </div>
              <div className="w-full bg-accent rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.6, ease: 'easeInOut' }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
              <p className="text-xs text-muted-foreground">Please wait while payroll is being processed...</p>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-800">Payroll Processed!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Payroll for <strong>{period.name}</strong> has been calculated and saved as Draft.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Employees', value: totals.totalEmployees },
                  { label: 'Gross Pay', value: formatAmount(totals.totalGross) },
                  { label: 'Net Pay', value: formatAmount(totals.totalNet) },
                ].map(item => (
                  <div key={item.label} className="p-3 bg-green-50 border border-green-200 rounded-xl text-center">
                    <p className="text-lg font-bold text-green-700">{item.value}</p>
                    <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide">{item.label}</p>
                  </div>
                ))}
              </div>
              {/* HD Pay confirmation */}
              <div className="flex items-center gap-2 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl">
                <Sunset size={15} className="text-teal-600 shrink-0" />
                <p className="text-xs text-teal-700 text-left">
                  <strong>HD Holiday Pay Applied:</strong> All Half-Day Weekly Off holidays were treated as full pay days.
                  No salary deduction was made for HD days — employees received full pay for those days.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Review the payroll details and approve to proceed with disbursement.</p>
            </motion.div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          {step === 'confirm' && (
            <>
              <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button
                onClick={handleRun}
                disabled={!hasConfiguredEmployees}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play size={15} /> Run Payroll for {period.name}
              </button>
            </>
          )}
          {step === 'running' && (
            <div className="w-full text-center text-xs text-muted-foreground">Processing in progress...</div>
          )}
          {step === 'done' && (
            <>
              <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Close</button>
              <button
                onClick={() => { onConfirm(period.id, totals); onClose(); }}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-md"
              >
                <Eye size={15} /> View Payroll Details
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Payroll Details Modal (employee-wise saved calculations) ──────────────────

interface PayrollDetailsModalProps {
  period: PayrollPeriod;
  onClose: () => void;
  onApproved: () => void;
  formatAmount: (n: number) => string;
}

const PayrollDetailsModal = ({ period, onClose, onApproved, formatAmount }: PayrollDetailsModalProps) => {
  const [entries, setEntries] = useState<RunEntry[]>([]);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [runDate, setRunDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await loadRunEntries(period.id);
    setEntries(res.entries); setRunStatus(res.runStatus); setRunDate(res.runDate);
    setLoading(false);
  }, [period.id]);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => entries.reduce((t, e) => ({
    gross: t.gross + e.gross, ded: t.ded + e.totalDeductions, net: t.net + e.net,
    pf: t.pf + e.pfEmployee, esi: t.esi + e.esiEmployee, pt: t.pt + e.pt, tds: t.tds + e.tds, loan: t.loan + e.loanEmi,
  }), { gross: 0, ded: 0, net: 0, pf: 0, esi: 0, pt: 0, tds: 0, loan: 0 }), [entries]);

  const handleApprove = async () => {
    setApproving(true);
    const { error } = await approvePayrollRun(period.id);
    setApproving(false);
    if (error) { toast.error(error); return; }
    toast.success(`Payroll for ${period.name} approved.`);
    setRunStatus('Approved');
    onApproved();
  };

  const isDraft = (runStatus ?? '').toLowerCase() === 'draft';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card w-full max-w-5xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl"><Users size={20} className="text-primary" /></div>
            <div>
              <h2 className="text-base font-bold">Payroll Details — {period.name}</h2>
              <p className="text-xs text-muted-foreground">
                Employee-wise calculations{runStatus ? ` · ${runStatus}` : ''}{runDate ? ` · run ${new Date(runDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm"><RefreshCw size={16} className="animate-spin" /> Loading…</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No payroll has been run for this period yet.</div>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-accent/40 text-muted-foreground uppercase tracking-wide text-[10px] sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Employee</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Gross</th>
                    <th className="px-3 py-2.5 font-semibold text-right">PF</th>
                    <th className="px-3 py-2.5 font-semibold text-right">ESI</th>
                    <th className="px-3 py-2.5 font-semibold text-right">PT</th>
                    <th className="px-3 py-2.5 font-semibold text-right">TDS</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Loan EMI</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Total Ded.</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map(e => (
                    <tr key={e.employeeId} className="hover:bg-accent/20">
                      <td className="px-3 py-2"><p className="font-semibold">{e.name}</p><p className="text-[10px] font-mono text-muted-foreground">{e.code}</p></td>
                      <td className="px-3 py-2 text-right font-semibold">{formatAmount(e.gross)}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{e.pfEmployee ? `−${formatAmount(e.pfEmployee)}` : '—'}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{e.esiEmployee ? `−${formatAmount(e.esiEmployee)}` : '—'}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{e.pt ? `−${formatAmount(e.pt)}` : '—'}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{e.tds ? `−${formatAmount(e.tds)}` : '—'}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{e.loanEmi ? `−${formatAmount(e.loanEmi)}` : '—'}</td>
                      <td className="px-3 py-2 text-right text-red-600">−{formatAmount(e.totalDeductions)}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-600">{formatAmount(e.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-accent/30 font-bold sticky bottom-0">
                  <tr>
                    <td className="px-3 py-2">Total ({entries.length})</td>
                    <td className="px-3 py-2 text-right">{formatAmount(totals.gross)}</td>
                    <td className="px-3 py-2 text-right text-rose-600">−{formatAmount(totals.pf)}</td>
                    <td className="px-3 py-2 text-right text-rose-600">−{formatAmount(totals.esi)}</td>
                    <td className="px-3 py-2 text-right text-rose-600">−{formatAmount(totals.pt)}</td>
                    <td className="px-3 py-2 text-right text-rose-600">−{formatAmount(totals.tds)}</td>
                    <td className="px-3 py-2 text-right text-amber-600">−{formatAmount(totals.loan)}</td>
                    <td className="px-3 py-2 text-right text-red-600">−{formatAmount(totals.ded)}</td>
                    <td className="px-3 py-2 text-right text-green-700">{formatAmount(totals.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Close</button>
          {isDraft && entries.length > 0 && (
            <button onClick={handleApprove} disabled={approving} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-md disabled:opacity-50">
              <CheckCircle2 size={15} /> {approving ? 'Approving…' : 'Approve Payroll'}
            </button>
          )}
          {!isDraft && runStatus && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg"><CheckCircle2 size={13} /> {runStatus}</span>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default function Payroll() {
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  // Pre-payroll stage completion per period (gates Run Payroll).
  const [prechecks, setPrechecks] = useState<Map<string, { closed: number; total: number; allClosed: boolean }>>(new Map());
  // Load periods AND merge each period's latest persisted run (status + totals) so the
  // list reflects real payroll state after a refresh — not just an optimistic update.
  const loadPeriods = useCallback(async () => {
    const [{ data }, runs, pre] = await Promise.all([
      db.from('payroll_periods').select('*').order('from_date', { ascending: true }),
      loadPeriodRunSummaries(),
      loadPrecheckCompletion(),
    ]);
    setPrechecks(pre);
    setPeriods((data ?? []).map((r: Record<string, any>) => {
      const p = rowToPeriod(r);
      const run = runs.get(p.id);
      if (run) {
        p.runStatus = (run.status as RunPayrollStatus) ?? 'Draft';
        p.totalEmployees = run.totalEmployees;
        p.totalGross = run.totalGross;
        p.totalDeductions = run.totalDeductions;
        p.totalNet = run.totalNet;
        if (run.runDate) p.processedOn = new Date(run.runDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return p;
    }));
  }, []);
  useEffect(() => { void loadPeriods(); }, [loadPeriods]);
  const [runModal, setRunModal] = useState<PayrollPeriod | null>(null);
  const [detailsPeriod, setDetailsPeriod] = useState<PayrollPeriod | null>(null);
  const [fyFilter, setFyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<PayrollPeriodStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [showHDInfo, setShowHDInfo] = useState(true);

  const uniqueFYs = [...new Set(periods.map(p => p.financialYear))];

  const filtered = useMemo(() =>
    periods
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
      .filter(p => fyFilter === 'All' || p.financialYear === fyFilter)
      .filter(p => statusFilter === 'All' || p.status === statusFilter),
    [periods, search, fyFilter, statusFilter]
  );

  const handleRunPayroll = (periodId: string, totals: PayrollRunTotals) => {
    void loadPeriods().then(() => {
      // Open the employee-wise details for the period that was just run.
      setPeriods(prev => { const p = prev.find(x => x.id === periodId); if (p) setDetailsPeriod(p); return prev; });
    });
    toast.success(`Payroll processed for ${totals.totalEmployees} employee${totals.totalEmployees !== 1 ? 's' : ''} from their salary structures. HD days treated as full pay.`);
  };

  const precheckDone = (periodId: string) => prechecks.get(periodId)?.allClosed ?? false;
  const canRunPayroll = (period: PayrollPeriod) =>
    period.status === 'Open' && (period.runStatus === 'Not Run' || period.runStatus === 'Draft') && precheckDone(period.id);

  const totalGross = periods.filter(p => p.runStatus === 'Disbursed' || p.runStatus === 'Approved').reduce((s, p) => s + p.totalGross, 0);
  const openPeriods = periods.filter(p => p.status === 'Open').length;
  const processedPeriods = periods.filter(p => p.runStatus !== 'Not Run').length;
  const defaultPeriod = periods.find(p => p.isDefault);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calculator size={22} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-serif">Payroll Processing</h1>
                <p className="text-xs text-muted-foreground">Run payroll for each period, review calculations, and disburse salaries.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
                <History size={15} /> History
              </button>
              {defaultPeriod && canRunPayroll(defaultPeriod) && (
                <button
                  onClick={() => setRunModal(defaultPeriod)}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"
                >
                  <Play size={15} /> Run {defaultPeriod.name}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* HD Holiday Pay Rule Info Banner */}
          {showHDInfo && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-4 p-4 bg-teal-50 border border-teal-200 rounded-xl"
            >
              <div className="p-2 bg-teal-100 rounded-lg shrink-0">
                <Sunset size={18} className="text-teal-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-teal-800">Half-Day Holiday (HD) Pay Rule — Full Pay</p>
                <p className="text-xs text-teal-700 mt-0.5">
                  Employees with <strong>Half-Day Weekly Off holidays (HD)</strong> receive <strong>full day pay</strong> for those days.
                  The employee works half the day and the other half is a paid holiday — resulting in full salary.
                  HD days are <strong>not deducted</strong> from salary and are treated the same as full holidays (H) for pay purposes.
                </p>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-teal-600 font-semibold flex-wrap">
                  <span className="flex items-center gap-1"><Sunset size={10} /> HD = Half-Day Holiday → Full Pay</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={10} /> H = Full Holiday → Full Pay</span>
                  <span className="flex items-center gap-1"><AlertCircle size={10} /> LOP = Loss of Pay → Deducted</span>
                </div>
              </div>
              <button onClick={() => setShowHDInfo(false)} className="p-1 rounded hover:bg-teal-200 text-teal-600 transition-colors shrink-0">
                <X size={14} />
              </button>
            </motion.div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Periods', value: periods.length, sub: `${openPeriods} open`, color: 'bg-indigo-100', iconColor: 'text-indigo-600', icon: CalendarRange },
              { label: 'Processed', value: processedPeriods, sub: 'This FY', color: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: CheckCircle2 },
              { label: 'Total Disbursed', value: formatAmount(totalGross), sub: 'Gross pay', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: DollarSign },
              { label: 'Employees', value: 154, sub: 'On payroll', color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Users },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                <div className={`p-2.5 ${card.color} rounded-xl`}><card.icon size={20} className={card.iconColor} /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="font-bold text-lg mt-0.5">{card.value}</p>
                  <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Default Period Banner */}
          {defaultPeriod && (
            <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-primary/5 to-indigo-50 border border-primary/20 rounded-xl">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <CalendarRange size={22} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-base">{defaultPeriod.name}</p>
                  <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Star size={8} /> Current Period
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(defaultPeriod.fromDate)} → {formatDate(defaultPeriod.toDate)} · Payment: {formatDate(defaultPeriod.paymentDate)} · FY {defaultPeriod.financialYear}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-sm font-bold">{defaultPeriod.totalEmployees}</p>
                  <p className="text-[10px] text-muted-foreground">Employees</p>
                </div>
                {canRunPayroll(defaultPeriod) && (
                  <button
                    onClick={() => setRunModal(defaultPeriod)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity shadow-md text-sm font-semibold"
                  >
                    <Play size={15} /> Run Payroll
                  </button>
                )}
                {defaultPeriod.runStatus !== 'Not Run' && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${RUN_STATUS_STYLES[defaultPeriod.runStatus].bg} ${RUN_STATUS_STYLES[defaultPeriod.runStatus].text} ${RUN_STATUS_STYLES[defaultPeriod.runStatus].border}`}>
                    {defaultPeriod.runStatus}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <input
                type="text"
                placeholder="Search periods..."
                className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
              value={fyFilter}
              onChange={e => setFyFilter(e.target.value)}
            >
              <option value="All">All Financial Years</option>
              {uniqueFYs.map(fy => <option key={fy}>FY {fy}</option>)}
            </select>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
            >
              <option value="All">All Status</option>
              <option>Open</option>
              <option>Processing</option>
              <option>Closed</option>
              <option>Locked</option>
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} periods</div>
          </div>

          {/* Payroll Period List */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
              <CalendarRange size={16} className="text-primary" />
              <h2 className="font-bold text-sm">Payroll Periods</h2>
              <span className="ml-auto text-xs text-muted-foreground">{filtered.length} periods</span>
            </div>

            {/* Table Header */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Period</th>
                    <th className="px-5 py-3 font-semibold">From Date</th>
                    <th className="px-5 py-3 font-semibold">To Date</th>
                    <th className="px-5 py-3 font-semibold">Payment Date</th>
                    <th className="px-5 py-3 font-semibold">Period Status</th>
                    <th className="px-5 py-3 font-semibold">Payroll Status</th>
                    <th className="px-5 py-3 font-semibold text-right">Gross Pay</th>
                    <th className="px-5 py-3 font-semibold text-right">Net Pay</th>
                    <th className="px-5 py-3 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((period, i) => {
                    const periodStyle = PERIOD_STATUS_STYLES[period.status];
                    const PeriodIcon = periodStyle.icon;
                    const runStyle = RUN_STATUS_STYLES[period.runStatus];
                    const canRun = canRunPayroll(period);

                    return (
                      <motion.tr
                        key={period.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="hover:bg-accent/30 transition-colors group"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-sm">{period.name}</p>
                                {period.isDefault && (
                                  <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Star size={8} /> Default
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{period.code}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Calendar size={12} className="text-indigo-500 shrink-0" />
                            {formatDate(period.fromDate)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Calendar size={12} className="text-rose-500 shrink-0" />
                            {formatDate(period.toDate)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Banknote size={12} className="text-green-500 shrink-0" />
                            {formatDate(period.paymentDate)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${periodStyle.bg} ${periodStyle.text} ${periodStyle.border}`}>
                            <PeriodIcon size={10} />
                            {period.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${runStyle.bg} ${runStyle.text} ${runStyle.border}`}>
                            {period.runStatus === 'Disbursed' && <CheckCircle2 size={10} />}
                            {period.runStatus === 'Approved' && <Shield size={10} />}
                            {period.runStatus === 'Completed' && <CheckCircle2 size={10} />}
                            {period.runStatus === 'Processing' && <RefreshCw size={10} />}
                            {period.runStatus === 'Draft' && <FileText size={10} />}
                            {period.runStatus === 'Not Run' && <Clock size={10} />}
                            {period.runStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {period.totalGross > 0 ? (
                            <span className="font-bold text-sm">{formatAmount(period.totalGross)}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {period.totalNet > 0 ? (
                            <span className="font-bold text-sm text-green-600">{formatAmount(period.totalNet)}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {(() => {
                            const pc = prechecks.get(period.id);
                            const needsPrechecks = period.status === 'Open' && (period.runStatus === 'Not Run' || period.runStatus === 'Draft') && !(pc?.allClosed);
                            return (
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                {needsPrechecks && (
                                  <button
                                    onClick={() => navigate('/payroll/pre-payroll')}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors text-xs font-semibold whitespace-nowrap"
                                    title="Complete the Pre-Payroll checks to enable Run Payroll"
                                  >
                                    <ClipboardCheck size={12} /> Pre-checks {pc ? `${pc.closed}/${pc.total}` : '0/6'}
                                  </button>
                                )}
                                {canRun && (
                                  <button
                                    onClick={() => setRunModal(period)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-xs font-semibold shadow-sm whitespace-nowrap"
                                  >
                                    <Play size={12} /> {period.runStatus === 'Draft' ? 'Re-run' : 'Run Payroll'}
                                  </button>
                                )}
                                {period.runStatus !== 'Not Run' && (
                                  <button
                                    onClick={() => setDetailsPeriod(period)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg hover:bg-accent transition-colors text-xs font-medium text-muted-foreground whitespace-nowrap"
                                  >
                                    <Eye size={12} /> View
                                  </button>
                                )}
                                {!canRun && !needsPrechecks && period.runStatus === 'Not Run' && (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </motion.tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-muted-foreground text-sm">
                        No payroll periods match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions + HD Pay Rule Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" /> Quick Actions
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Manage Loans & Advances', icon: DollarSign },
                  { label: 'Tax Declarations (TDS)', icon: AlertCircle },
                  { label: 'Bulk Payslip Generation', icon: FileText },
                  { label: 'Payroll Reports', icon: BarChart2 },
                ].map((item, i) => (
                  <button key={i} className="w-full flex items-center justify-between p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors group text-sm">
                    <div className="flex items-center gap-3">
                      <item.icon size={16} className="text-primary" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            {/* HD Pay Rule Card */}
            <div className="bg-teal-50 border border-teal-200 p-5 rounded-xl shadow-sm">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2 text-teal-800">
                <Sunset size={16} className="text-teal-600" /> HD Holiday Pay Rule
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-white/70 border border-teal-200 rounded-xl">
                  <p className="text-xs font-bold text-teal-800 mb-1">Half-Day Holiday (HD) = Full Pay</p>
                  <p className="text-[11px] text-teal-700">
                    When an employee has a Half-Day Weekly Off holiday, they work half the day and the other half is a paid holiday.
                    The payroll engine grants <strong>full day salary</strong> for HD days — no deduction is applied.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Full Holiday (H)', desc: 'Full Pay — not worked', color: 'bg-violet-100 text-violet-700 border-violet-200' },
                    { label: 'Half-Day Holiday (HD)', desc: 'Full Pay — worked half + paid half', color: 'bg-teal-100 text-teal-700 border-teal-200' },
                    { label: 'Half-Day Leave', desc: 'Half Pay — leave deducted', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                    { label: 'LOP / Absent', desc: 'Deducted from salary', color: 'bg-red-100 text-red-700 border-red-200' },
                  ].map(item => (
                    <div key={item.label} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[10px] font-semibold ${item.color}`}>
                      <span>{item.label}</span>
                      <span className="opacity-70">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-primary text-primary-foreground p-5 rounded-xl shadow-lg">
              <h3 className="text-base font-bold mb-2">Payroll Status</h3>
              <p className="text-primary-foreground/80 text-sm mb-4">
                {defaultPeriod?.runStatus === 'Not Run'
                  ? `${defaultPeriod.name} payroll is ready to run. Click Run Payroll to begin.`
                  : `Current period payroll is in ${defaultPeriod?.runStatus} status.`}
              </p>
              <div className="w-full bg-white/20 h-2 rounded-full mb-4">
                <div
                  className="bg-white h-full rounded-full transition-all"
                  style={{
                    width: `${defaultPeriod?.runStatus === 'Not Run' ? 0 :
                      defaultPeriod?.runStatus === 'Draft' ? 25 :
                      defaultPeriod?.runStatus === 'Processing' ? 50 :
                      defaultPeriod?.runStatus === 'Completed' ? 75 :
                      defaultPeriod?.runStatus === 'Approved' ? 90 : 100}%`
                  }}
                />
              </div>
              {defaultPeriod && canRunPayroll(defaultPeriod) ? (
                <button
                  onClick={() => setRunModal(defaultPeriod)}
                  className="w-full py-2.5 bg-white text-primary font-bold rounded-lg hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={15} /> Run {defaultPeriod.name} Payroll
                </button>
              ) : (
                <button className="w-full py-2.5 bg-white text-primary font-bold rounded-lg hover:bg-white/90 transition-colors">
                  View Payroll Details
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Run Payroll Modal */}
      <AnimatePresence>
        {runModal && (
          <RunPayrollModal
            period={runModal}
            onClose={() => setRunModal(null)}
            onConfirm={handleRunPayroll}
            formatAmount={formatAmount}
          />
        )}
      </AnimatePresence>

      {/* Payroll Details Modal — employee-wise saved calculations */}
      <AnimatePresence>
        {detailsPeriod && (
          <PayrollDetailsModal
            period={detailsPeriod}
            onClose={() => setDetailsPeriod(null)}
            onApproved={() => void loadPeriods()}
            formatAmount={formatAmount}
          />
        )}
      </AnimatePresence>
    </div>
  );
}