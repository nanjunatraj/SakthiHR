import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, ChevronLeft, Search, Filter, X,
  RefreshCw, CheckCircle2, Users, Building2, MapPin,
  Briefcase, Tag, Layers, Award, Grid3X3, Play,
  Eye, Printer, Calendar, DollarSign, AlertCircle,
  Info, ChevronDown, ChevronUp, Hash, Phone, Mail,
  Shield, PiggyBank, CreditCard, Receipt, Wallet,
  TrendingDown, Star, Lock, Unlock, FileDown, Settings2,
  Send, Clock, CheckCheck, XCircle, Inbox, MailCheck,
  MailX, AlertTriangle, Bell, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useCurrency } from '../../context/CurrencyContext';
import { usePayslipEmployees, loadPayslipEmployees, useEstablishment } from '../../lib/reports';
import { loadPayslipLetterhead, letterheadPrintConfig } from '../../lib/letters';
import { sendEmployeeEmail, loadEmailDeliveries, subscribeEmailDeliveries } from '../../lib/email';
import { htmlToPdfBlob } from '../../lib/pdf';
import { toast } from 'react-toastify';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayslipEmployee {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  workLocation: string;
  employeeType: string;
  employeeGroup: string;
  employeeCategory: string;
  employeeGrade: string;
  avatar: string;
  email: string;
  pan: string;
  uan: string;
  bankAccount: string;
  ifsc: string;
  doj: string;
  basic: number;
  hra: number;
  conveyance: number;
  medicalAllowance: number;
  specialAllowance: number;
  lta: number;
  otherEarnings: number;
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
  overtimeAmount: number;
  /** Linked deduction-source amounts recovered this period, keyed by component head. */
  deductionBreakdown?: Record<string, number>;
}

interface PayslipFilters {
  workLocation: string[];
  department: string[];
  designation: string[];
  employeeType: string[];
  employeeGroup: string[];
  employeeCategory: string[];
  employeeGrade: string[];
  allEmployees: boolean;
}

type EmailDeliveryStatus = 'pending' | 'sending' | 'sent' | 'opened' | 'viewed' | 'confirmed' | 'simulated' | 'failed' | 'bounced' | 'no_email';

interface EmailDeliveryRecord {
  employeeId: string;
  employeeName: string;
  email: string;
  status: EmailDeliveryStatus;
  sentAt?: string;
  errorMessage?: string;
  messageId?: string;
  deliveryId?: string;
}

// Map a lib EmailStatus (DB) to the payslip panel's status vocabulary.
function mapEmailStatus(s: string): EmailDeliveryStatus {
  switch (s) {
    case 'Confirmed': return 'confirmed';
    case 'Viewed': return 'viewed';
    case 'Opened': return 'opened';
    case 'Sent': return 'sent';
    case 'Simulated': return 'simulated';
    case 'Failed': return 'failed';
    case 'Bounced': return 'bounced';
    case 'No Email': return 'no_email';
    default: return 'sending';
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const psdb = supabase as unknown as SupabaseClient;
interface PayrollPeriodOpt { id: string; name: string; code: string; fromDate: string; toDate: string; status: string; financialYear: string; }
// Payroll periods load live from the DB (module-scoped for the sub-components below).
let PAYROLL_PERIODS: PayrollPeriodOpt[] = [];
const EMPTY_PERIOD: PayrollPeriodOpt = { id: '', name: '—', code: '', fromDate: '', toDate: '', status: '', financialYear: '' };
function usePayslipPeriods() {
  const [, force] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await psdb.from('payroll_periods').select('id, name, code, from_date, to_date, status, financial_year').order('from_date', { ascending: false });
      PAYROLL_PERIODS = ((data ?? []) as Record<string, any>[]).map(p => ({ id: p.id, name: p.name ?? '', code: p.code ?? '', fromDate: p.from_date ?? '', toDate: p.to_date ?? '', status: p.status ?? 'Open', financialYear: p.financial_year ?? '' }));
      if (active) force(n => n + 1);
    })();
    return () => { active = false; };
  }, []);
}

const WORK_LOCATIONS = ['All', 'Head Office – Mumbai', 'Regional Office – Delhi', 'Branch Office – Bangalore'];
const DEPARTMENTS = ['All', 'Engineering', 'Marketing', 'Design', 'Sales', 'Human Resources', 'Finance', 'Operations'];
const DESIGNATIONS = ['All', 'Software Engineer', 'Senior Software Engineer', 'Tech Lead', 'HR Executive', 'HR Manager', 'Sales Executive', 'Finance Analyst', 'Product Designer', 'Growth Lead'];
const EMPLOYEE_TYPES = ['All', 'Permanent', 'Probationary', 'Contract', 'Intern', 'Part-Time', 'Consultant'];
const EMPLOYEE_GROUPS = ['All', 'Management Staff', 'Technical Staff', 'Support Staff', 'Sales Force', 'Field Workers'];
const EMPLOYEE_CATEGORIES = ['All', 'General', 'OBC', 'SC', 'ST', 'EWS', 'PwD', 'Ex-Serviceman'];
const EMPLOYEE_GRADES = ['All', 'Grade A1', 'Grade A2', 'Grade B1', 'Grade B2', 'Grade C1', 'Grade C2', 'Grade D', 'Grade E'];

// ─── Seed Employee Data ───────────────────────────────────────────────────────

// Payslips derive from processed payroll entries; empty until payroll is run.
const SEED_EMPLOYEES: PayslipEmployee[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
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

// ─── Payslip HTML Generator ───────────────────────────────────────────────────

const DEFAULT_LH_MARGINS = { top: 20, bottom: 20, left: 15, right: 15 };

// Payslip CSS (shared by single and combined documents). Letterhead margins are
// interpolated only for the .page--lh layout.
function payslipStyles(lhMargins: { top: number; bottom: number; left: number; right: number }): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; background: #e6e6e6; }
    .page { width: 210mm; min-height: 297mm; background: white; margin: 0 auto; padding: 20mm 15mm; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
    /* On letterhead: the header/footer banner images bleed full edge-to-edge (no page
       padding); only the body content is inset by the Letterhead-format margins. */
    .page--lh { padding: 0; display: flex; flex-direction: column; }
    .page--lh .pg-body { flex: 1 0 auto; padding: ${lhMargins.top}mm ${lhMargins.right}mm ${lhMargins.bottom}mm ${lhMargins.left}mm; }
    .page--lh .lh-header, .page--lh .lh-footer { margin: 0; }
    /* Monochrome (black & white) payslip body — only the letterhead keeps its colours. */
    .header { border-bottom: 2.5px solid #000; padding-bottom: 12px; margin-bottom: 18px; }
    .company-name { font-size: 23px; font-weight: bold; color: #000; letter-spacing: .01em; }
    .payslip-title { font-size: 15px; font-weight: bold; color: #000; margin-top: 6px; letter-spacing: .08em; }
    .period-badge { display: inline-block; background: #fff; border: 1.5px solid #000; color: #000; padding: 4px 12px; font-size: 11px; font-weight: bold; margin-top: 6px; }
    .emp-section { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; padding: 14px 16px; background: #fff; border: 1.5px solid #000; }
    .emp-row { display: flex; gap: 8px; margin-bottom: 7px; }
    .emp-label { color: #333; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; min-width: 130px; }
    .emp-value { color: #000; font-weight: 700; font-size: 10px; }
    .attendance-section { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 18px; }
    .att-card { background: #fff; border: 1.5px solid #000; padding: 10px 6px; text-align: center; }
    .att-value { font-size: 15px; font-weight: bold; color: #000; line-height: 1.1; }
    .att-label { font-size: 9.5px; color: #000; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
    .earnings-deductions { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
    .section-title { font-size: 11px; font-weight: bold; color: #000; background: #e8e8e8; padding: 7px 12px; border: 1.5px solid #000; border-bottom: none; letter-spacing: .04em; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #e8e8e8; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #000; padding: 7px 10px; text-align: left; border: 1px solid #000; letter-spacing: .03em; }
    td { padding: 7px 10px; border: 1px solid #000; font-size: 10px; color: #000; }
    td.amount { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    tr.total-row td { background: #d9d9d9; font-weight: bold; font-size: 10.5px; }
    .net-pay-section { background: #fff; color: #000; border: 2.5px solid #000; padding: 16px 20px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
    .net-pay-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .net-pay-amount { font-size: 19px; font-weight: bold; }
    .net-pay-words { font-size: 11px; margin-top: 4px; font-style: italic; }
    .footer-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 18px; padding-top: 14px; border-top: 1.5px solid #000; }
    .footer-item { text-align: center; }
    .footer-label { font-size: 9.5px; color: #333; font-weight: 700; text-transform: uppercase; }
    .footer-value { font-size: 12px; font-weight: 700; color: #000; margin-top: 3px; }
    .signature-line { border-top: 1px solid #000; margin-top: 26px; padding-top: 5px; font-size: 10px; color: #000; text-align: center; }
    .generated-note { font-size: 9.5px; color: #333; text-align: center; margin-top: 10px; }
    /* Keep the whole payslip — letterhead header AND footer — on a single printed page. */
    @media print {
      body { background: white; }
      @page { size: A4; margin: 0; }
      .page { box-shadow: none; margin: 0; width: 210mm; break-after: page; }
      .page:last-child { break-after: auto; }
      .page--lh { min-height: 0; height: 297mm; overflow: hidden; }
      .no-print { display: none !important; }
    }`;
}

// Shrink-to-fit script — generalised to handle ANY number of .page blocks (combined doc).
const PAYSLIP_FIT_SCRIPT = `<script>(function(){
    function fitOne(page){
      var body=page.querySelector('.pg-body'); if(!body) return; body.style.zoom='';
      var probe=document.createElement('div');
      probe.style.cssText='position:absolute;top:-9999px;left:-9999px;height:297mm;';
      document.body.appendChild(probe); var onePage=probe.offsetHeight; probe.remove();
      var z=1, guard=0;
      while(page.scrollHeight>onePage+1 && z>0.55 && guard<60){ z=Math.round((z-0.02)*100)/100; body.style.zoom=String(z); guard++; }
    }
    function fit(){ var pages=document.querySelectorAll('.page'); for(var i=0;i<pages.length;i++) fitOne(pages[i]); }
    if(document.readyState==='complete') fit(); else window.addEventListener('load', fit);
  })();</script>`;

// The payslip page markup (one A4 page) — used standalone and combined.
function payslipPageHTML(
  employee: PayslipEmployee,
  period: PayrollPeriodOpt,
  companyName: string,
  currencySymbol: string,
  companyAddress = '',
  letterheadHeader = '',
  letterheadFooter = '',
): string {
  const formatAmt = (n: number) => `${currencySymbol}${n.toLocaleString('en-IN')}`;
  // Holidays = period days that aren't worked/leave/LOP (weekly offs + declared holidays).
  // Working Days is the full period: Present + Leave + LOP + Holidays.
  const holidayDays = Math.max(0, (employee.workingDays || 0) - (employee.presentDays || 0) - (employee.leaveDays || 0) - (employee.lopDays || 0));
  // Earnings / Deductions rows — only those with a non-zero value are shown.
  const earningRows: Array<[string, number]> = [
    ['Basic Salary', employee.basic],
    ['House Rent Allowance (HRA)', employee.hra],
    ['Conveyance Allowance', employee.conveyance],
    ['Medical Allowance', employee.medicalAllowance],
    ['Special Allowance', employee.specialAllowance],
    ['Leave Travel Allowance (LTA)', employee.lta],
    ...(employee.overtimeAmount > 0 ? [[`Overtime (${employee.overtimeHours}h)`, employee.overtimeAmount] as [string, number]] : []),
  ];
  const deductionRows: Array<[string, number]> = [
    ['Provident Fund (Employee 12%)', employee.pfEmployee],
    ['ESI (Employee 0.75%)', employee.esiEmployee],
    ['Professional Tax', employee.professionalTax],
    ['TDS (Income Tax)', employee.tds],
    ['Loan EMI Recovery', employee.loanEmi],
    // Linked deduction-source heads (Fines, Canteen, Society, Damages, Donations, …).
    ...Object.entries(employee.deductionBreakdown ?? {}).map(([head, amt]) => [head, amt] as [string, number]),
    ['Other Deductions', employee.otherDeductions],
  ];
  const rowHtml = (rows: Array<[string, number]>) => rows
    .filter(([, v]) => Number(v) > 0)
    .map(([label, v]) => `<tr><td>${label}</td><td class="amount">${formatAmt(v)}</td></tr>`).join('');
  return `<div class="page${letterheadHeader ? ' page--lh' : ''}">
    ${letterheadHeader || ''}
    <div class="pg-body">
    <div class="header">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          ${letterheadHeader ? '' : `<div class="company-name">${companyName}</div>
          ${companyAddress ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;">${companyAddress}</div>` : ''}`}
          <div class="payslip-title">SALARY SLIP</div>
          <div class="period-badge">Pay Period: ${period.name} (${formatDate(period.fromDate)} – ${formatDate(period.toDate)})</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;color:#333;">Employee Code</div>
          <div style="font-size:12px;font-weight:bold;color:#000;">${employee.employeeCode}</div>
          <div style="font-size:9px;color:#333;margin-top:4px;">Generated: ${formatDate(new Date().toISOString().split('T')[0])}</div>
        </div>
      </div>
    </div>
    <div class="emp-section">
      <div>
        <div class="emp-row"><span class="emp-label">Employee Name</span><span class="emp-value">${employee.name}</span></div>
        <div class="emp-row"><span class="emp-label">Designation</span><span class="emp-value">${employee.designation}</span></div>
        <div class="emp-row"><span class="emp-label">Department</span><span class="emp-value">${employee.department}</span></div>
        <div class="emp-row"><span class="emp-label">Work Location</span><span class="emp-value">${employee.workLocation}</span></div>
        <div class="emp-row"><span class="emp-label">Date of Joining</span><span class="emp-value">${formatDate(employee.doj)}</span></div>
      </div>
      <div>
        <div class="emp-row"><span class="emp-label">Employee Type</span><span class="emp-value">${employee.employeeType}</span></div>
        <div class="emp-row"><span class="emp-label">Grade</span><span class="emp-value">${employee.employeeGrade}</span></div>
        <div class="emp-row"><span class="emp-label">PAN Number</span><span class="emp-value">${employee.pan}</span></div>
        <div class="emp-row"><span class="emp-label">UAN Number</span><span class="emp-value">${employee.uan}</span></div>
        <div class="emp-row"><span class="emp-label">Bank Account</span><span class="emp-value">${employee.bankAccount} (${employee.ifsc})</span></div>
      </div>
    </div>
    <div class="attendance-section">
      <div class="att-card"><div class="att-value">${employee.workingDays}</div><div class="att-label">Working Days</div></div>
      <div class="att-card"><div class="att-value">${employee.presentDays}</div><div class="att-label">Present Days</div></div>
      <div class="att-card"><div class="att-value">${employee.leaveDays}</div><div class="att-label">Leave Days</div></div>
      <div class="att-card"><div class="att-value">${employee.lopDays}</div><div class="att-label">LOP Days</div></div>
      <div class="att-card"><div class="att-value">${holidayDays}</div><div class="att-label">Holidays</div></div>
      <div class="att-card"><div class="att-value">${employee.overtimeHours}h</div><div class="att-label">Overtime</div></div>
    </div>
    <div class="earnings-deductions">
      <div>
        <div class="section-title">Earnings</div>
        <table>
          <thead><tr><th>Component</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${rowHtml(earningRows)}
            <tr class="total-row"><td><strong>Gross Earnings</strong></td><td class="amount"><strong>${formatAmt(employee.gross)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <div class="section-title">Deductions</div>
        <table>
          <thead><tr><th>Component</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${rowHtml(deductionRows)}
            <tr class="total-row"><td><strong>Total Deductions</strong></td><td class="amount"><strong>${formatAmt(employee.totalDeductions)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="net-pay-section">
      <div>
        <div class="net-pay-label">Net Pay (Take Home)</div>
        <div class="net-pay-words">${numberToWords(employee.net)}</div>
      </div>
      <div style="text-align:right;">
        <div class="net-pay-amount">${formatAmt(employee.net)}</div>
        <div style="font-size:11px;margin-top:4px;">Gross: ${formatAmt(employee.gross)} − Deductions: ${formatAmt(employee.totalDeductions)}</div>
      </div>
    </div>
    <div class="footer-section">
      <div class="footer-item"><div class="footer-label">PF Contribution (Employer)</div><div class="footer-value">${formatAmt(employee.pfEmployee)}</div></div>
      <div class="footer-item"><div class="footer-label">YTD Gross (Apr–Jul)</div><div class="footer-value">${formatAmt(employee.gross * 4)}</div></div>
      <div class="footer-item"><div class="footer-label">YTD TDS Deducted</div><div class="footer-value">${formatAmt(employee.tds * 4)}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
      <div class="signature-line">Employee Signature</div>
      <div class="signature-line">HR Manager</div>
      <div class="signature-line">Authorised Signatory</div>
    </div>
    <div class="generated-note">This is a computer-generated payslip and does not require a physical signature. | ${companyName} | ${period.name}</div>
    </div>
    ${letterheadFooter || ''}
  </div>`;
}

// Full single-payslip document (optional in-page toolbar) — unchanged external API.
function generatePayslipHTML(
  employee: PayslipEmployee,
  period: PayrollPeriodOpt,
  companyName: string,
  currencySymbol: string,
  companyAddress = '',
  withToolbar = true,
  letterheadHeader = '',
  letterheadFooter = '',
  // Letterhead page margins (mm) — header/footer/body are inset by these on letterhead.
  lhMargins: { top: number; bottom: number; left: number; right: number } = DEFAULT_LH_MARGINS,
): string {
  const toolbar = withToolbar ? `<div class="no-print" style="background:#1e3a5f;color:white;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">
    <span style="font-size:13px;font-weight:600;">💰 Payslip — ${employee.name} — ${period.name}</span>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">🖨️ Print / Save PDF</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;">✕ Close</button>
    </div>
  </div>
  <div style="padding:16px 0;background:#f3f4f6;" class="no-print">
    <p style="text-align:center;font-size:11px;color:#6b7280;">Use browser Print (Ctrl+P) → Save as PDF to export.</p>
  </div>` : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payslip — ${employee.name} — ${period.name}</title>
  <style>${payslipStyles(lhMargins)}</style>
</head>
<body>
  ${toolbar}
  ${payslipPageHTML(employee, period, companyName, currencySymbol, companyAddress, letterheadHeader, letterheadFooter)}
  ${PAYSLIP_FIT_SCRIPT}
</body>
</html>`;
}

// Combined document — one A4 page per (employee × period). Printed/saved as a single PDF.
// Used to generate payslips across a RANGE of periods for many employees at once.
function buildCombinedPayslipsHTML(
  items: Array<{ employee: PayslipEmployee; period: PayrollPeriodOpt }>,
  companyName: string,
  currencySymbol: string,
  companyAddress = '',
): string {
  const pages = items.map(it => payslipPageHTML(it.employee, it.period, companyName, currencySymbol, companyAddress)).join('\n');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payslips — ${items.length} document${items.length !== 1 ? 's' : ''}</title>
  <style>${payslipStyles(DEFAULT_LH_MARGINS)}</style>
</head>
<body>
${pages}
${PAYSLIP_FIT_SCRIPT}
</body>
</html>`;
}

// ─── Email Delivery Status Badge ──────────────────────────────────────────────

const EMAIL_STATUS_STYLES: Record<EmailDeliveryStatus, { bg: string; text: string; border: string; icon: React.ElementType; label: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: Clock, label: 'Pending' },
  sending: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: Loader2, label: 'Sending...' },
  sent: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: MailCheck, label: 'Sent' },
  opened: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200', icon: MailCheck, label: 'Opened' },
  viewed: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', icon: Eye, label: 'Attachment Viewed' },
  confirmed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2, label: 'Receipt Confirmed' },
  simulated: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', icon: MailCheck, label: 'Simulated' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: MailX, label: 'Failed' },
  bounced: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle, label: 'Bounced' },
  no_email: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', icon: AlertTriangle, label: 'No Email' },
};

// ─── Email Confirmation Dialog ────────────────────────────────────────────────

interface EmailConfirmDialogProps {
  employees: PayslipEmployee[];
  period: PayrollPeriodOpt;
  isBulk: boolean;
  companyName: string;
  onConfirm: (subject: string, message: string) => void;
  onClose: () => void;
}

const EmailConfirmDialog = ({ employees, period, isBulk, companyName, onConfirm, onClose }: EmailConfirmDialogProps) => {
  const co = companyName || 'the Establishment';
  const [subject, setSubject] = useState(`Payslip for ${period.name} — ${co}`);
  const [message, setMessage] = useState(
    `Dear Employee,\n\nPlease find attached your salary slip for the pay period ${period.name}.\n\nIf you have any queries regarding your payslip, please contact the HR/Payroll department.\n\nRegards,\nHR & Payroll Team\n${co}`
  );
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Send size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-blue-900">
                {isBulk ? `Send Payslips via Email` : `Email Payslip`}
              </h2>
              <p className="text-xs text-blue-600">
                {isBulk
                  ? `${employees.length} employee${employees.length !== 1 ? 's' : ''} · ${period.name}`
                  : `${employees[0]?.name} · ${employees[0]?.email} · ${period.name}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Recipients Summary */}
          <div className={`p-4 rounded-xl border ${isBulk ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 bg-white rounded-lg shadow-sm`}>
                {isBulk ? <Users size={16} className="text-indigo-600" /> : <Mail size={16} className="text-blue-600" />}
              </div>
              <div>
                <p className={`font-bold text-sm ${isBulk ? 'text-indigo-800' : 'text-blue-800'}`}>
                  {isBulk ? `Bulk Email — ${employees.length} Recipients` : 'Individual Email'}
                </p>
                <p className={`text-xs ${isBulk ? 'text-indigo-600' : 'text-blue-600'}`}>
                  Payslip for {period.name} will be sent as PDF attachment
                </p>
              </div>
            </div>
            {isBulk ? (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {employees.slice(0, 12).map(emp => (
                  <div key={emp.id} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-indigo-200 rounded-lg">
                    <div className="w-4 h-4 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[8px]">{emp.avatar}</div>
                    <span className="text-[10px] font-medium text-indigo-800">{emp.name}</span>
                  </div>
                ))}
                {employees.length > 12 && (
                  <div className="flex items-center px-2 py-1 bg-white border border-indigo-200 rounded-lg">
                    <span className="text-[10px] text-indigo-600">+{employees.length - 12} more</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-blue-200">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{employees[0]?.avatar}</div>
                <div>
                  <p className="text-sm font-semibold">{employees[0]?.name}</p>
                  <p className="text-xs text-muted-foreground">{employees[0]?.email}</p>
                </div>
              </div>
            )}
          </div>

          {/* Email Subject */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
              Email Subject <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              className="w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject line"
            />
          </div>

          {/* Email Message */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
              Email Message
            </label>
            <textarea
              className="w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all resize-none"
              rows={6}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Email body message"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              The payslip PDF will be automatically attached to this email. Employee name will be personalized in the greeting.
            </p>
          </div>

          {/* Email Preview Toggle */}
          <button
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
          >
            <Eye size={13} />
            {showPreview ? 'Hide' : 'Show'} Email Preview
            <ChevronDown size={12} className={`transition-transform ${showPreview ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-gray-50 border-b border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Email Preview</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide w-16 shrink-0">From:</span>
                      <span className="text-xs">{co} — Payroll</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide w-16 shrink-0">To:</span>
                      <span className="text-xs text-muted-foreground">
                        {isBulk ? `${employees.length} recipients (employee registered email addresses)` : employees[0]?.email}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide w-16 shrink-0">Subject:</span>
                      <span className="text-xs font-semibold">{subject}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide w-16 shrink-0">Attach:</span>
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 border border-red-200 rounded-lg">
                        <FileText size={11} className="text-red-600" />
                        <span className="text-[10px] font-semibold text-red-700">
                          Payslip_{isBulk ? '[EmployeeName]' : employees[0]?.name.replace(' ', '_')}_{period.code}.pdf
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{message}</pre>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Warning for bulk */}
          {isBulk && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-semibold mb-0.5">Bulk Email Confirmation</p>
                <p>You are about to send payslips to <strong>{employees.length} employees</strong>. Each employee will receive their individual payslip as a PDF attachment. This action cannot be undone.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(subject, message)}
            disabled={!subject.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={15} />
            {isBulk ? `Send to ${employees.length} Employees` : 'Send Payslip'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Email Delivery Status Panel ──────────────────────────────────────────────

interface EmailDeliveryPanelProps {
  records: EmailDeliveryRecord[];
  period: PayrollPeriodOpt;
  onClose: () => void;
  onRetry: (employeeId: string) => void;
}

const EmailDeliveryPanel = ({ records, period, onClose, onRetry }: EmailDeliveryPanelProps) => {
  const sentCount = records.filter(r => r.status === 'sent').length;
  const failedCount = records.filter(r => r.status === 'failed' || r.status === 'bounced').length;
  const sendingCount = records.filter(r => r.status === 'sending').length;
  const pendingCount = records.filter(r => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <Inbox size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-green-900">Email Delivery Status</h2>
              <p className="text-xs text-green-600">{period.name} Payslips · {records.length} emails</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3 p-5 border-b border-border">
          {[
            { label: 'Sent', value: sentCount, color: 'bg-green-100', textColor: 'text-green-700', icon: MailCheck },
            { label: 'Sending', value: sendingCount, color: 'bg-blue-100', textColor: 'text-blue-700', icon: Loader2 },
            { label: 'Failed', value: failedCount, color: 'bg-red-100', textColor: 'text-red-700', icon: MailX },
            { label: 'Pending', value: pendingCount, color: 'bg-gray-100', textColor: 'text-gray-600', icon: Clock },
          ].map((card, i) => {
            const CardIcon = card.icon;
            return (
              <div key={i} className={`p-3 rounded-xl border ${card.color} text-center`}>
                <div className="flex items-center justify-center mb-1">
                  <CardIcon size={16} className={`${card.textColor} ${card.label === 'Sending' ? 'animate-spin' : ''}`} />
                </div>
                <p className={`text-xl font-bold ${card.textColor}`}>{card.value}</p>
                <p className={`text-[10px] font-medium ${card.textColor} uppercase tracking-wide`}>{card.label}</p>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        {(sendingCount > 0 || pendingCount > 0) && (
          <div className="px-5 py-3 border-b border-border bg-accent/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Sending progress</span>
              <span className="text-xs font-bold text-primary">{sentCount}/{records.length}</span>
            </div>
            <div className="w-full h-2 bg-accent rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(sentCount / records.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}

        {/* Records List */}
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Employee</th>
                <th className="px-4 py-2.5 font-semibold">Email Address</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Sent At</th>
                <th className="px-4 py-2.5 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((record, i) => {
                const statusStyle = EMAIL_STATUS_STYLES[record.status];
                const StatusIcon = statusStyle.icon;
                return (
                  <motion.tr
                    key={record.employeeId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-accent/20 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[9px] shrink-0">
                          {record.employeeName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-semibold">{record.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{record.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                        <StatusIcon size={10} className={record.status === 'sending' ? 'animate-spin' : ''} />
                        {statusStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {record.sentAt ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {(record.status === 'failed' || record.status === 'bounced') && (
                        <button
                          onClick={() => onRetry(record.employeeId)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                        >
                          <RefreshCw size={10} /> Retry
                        </button>
                      )}
                      {record.status === 'sent' && (
                        <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                          <CheckCheck size={10} /> Delivered
                        </span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          <div className="text-xs text-muted-foreground">
            {sentCount === records.length ? (
              <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                <CheckCircle2 size={14} /> All payslips sent successfully
              </span>
            ) : failedCount > 0 ? (
              <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
                <AlertTriangle size={14} /> {failedCount} email{failedCount !== 1 ? 's' : ''} failed — use Retry to resend
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                <Loader2 size={14} className="animate-spin" /> Sending in progress...
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-sm"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Multi-Select Chips ───────────────────────────────────────────────────────

interface MultiSelectChipsProps {
  label: string;
  icon: React.ElementType;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  accentBg?: string;
  accentText?: string;
  accentBorder?: string;
}

const MultiSelectChips = ({
  label, icon: Icon, options, selected, onChange,
  accentBg = 'bg-primary/10', accentText = 'text-primary', accentBorder = 'border-primary/30'
}: MultiSelectChipsProps) => {
  const filteredOptions = options.filter(o => o !== 'All');
  const toggle = (opt: string) => {
    const updated = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(updated);
  };
  return (
    <div>
      <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Icon size={12} /> {label}
        {selected.length > 0 && (
          <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${accentBg} ${accentText} border ${accentBorder}`}>
            {selected.length} selected
          </span>
        )}
      </label>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onChange([])}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            selected.length === 0
              ? `${accentBg} ${accentText} ${accentBorder} ring-1 ring-offset-1 ring-current`
              : 'bg-accent text-muted-foreground border-border hover:border-primary/30'
          }`}
        >
          All
        </button>
        {filteredOptions.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isSelected
                  ? `${accentBg} ${accentText} ${accentBorder} ring-1 ring-offset-1 ring-current`
                  : 'bg-accent text-muted-foreground border-border hover:border-primary/30'
              }`}
            >
              {isSelected && <CheckCircle2 size={10} className="inline mr-1" />}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Payslip Preview Modal ────────────────────────────────────────────────────

interface PayslipPreviewModalProps {
  employee: PayslipEmployee;
  period: PayrollPeriodOpt;
  onClose: () => void;
  onPrintView: () => void;
  onExport: () => void;
  onEmail: () => void;
  currencySymbol: string;
  formatAmount: (n: number) => string;
}

// Popup-proof Print View — renders the payslip in an iframe (no window.open) with a
// Print / Save-PDF action that prints just the payslip content. Offers a "Print on
// Letterhead" toggle when the employee's Work Location has a payslip-enabled letterhead.
const PayslipPrintModal = ({ employee, period, companyName, currencySymbol, companyAddress, onClose }: {
  employee: PayslipEmployee; period: PayrollPeriodOpt; companyName: string; currencySymbol: string; companyAddress: string; onClose: () => void;
}) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [letterhead, setLetterhead] = useState<Record<string, any> | null>(null);
  const [lhLoading, setLhLoading] = useState(true);
  const [useLetterhead, setUseLetterhead] = useState(false);

  useEffect(() => {
    let active = true;
    setLhLoading(true);
    loadPayslipLetterhead(employee.id).then(lh => {
      if (!active) return;
      setLetterhead(lh);
      setUseLetterhead(!!lh); // default ON when a payslip letterhead exists for the work location
      setLhLoading(false);
    });
    return () => { active = false; };
  }, [employee.id]);

  const cfg = (useLetterhead && letterhead) ? letterheadPrintConfig(letterhead) : null;
  const html = generatePayslipHTML(
    employee, period, companyName, currencySymbol, companyAddress, false,
    cfg?.header ?? '', cfg?.footer ?? '',
    cfg ? { top: cfg.marginTop, bottom: cfg.marginBottom, left: cfg.marginLeft, right: cfg.marginRight } : undefined,
  );
  const doPrint = () => { const w = frameRef.current?.contentWindow; if (!w) return; w.focus(); w.print(); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-3xl h-[92vh] rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-indigo-50 to-blue-50 shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Printer size={18} className="text-indigo-600 shrink-0" />
            <h2 className="text-sm font-bold text-indigo-900 truncate">Payslip — {employee.name} · {period.name}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* On-Letterhead toggle — sourced from the employee's Work Location letterhead */}
            <label
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${letterhead ? 'cursor-pointer border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700' : 'border-border bg-muted text-muted-foreground cursor-not-allowed'}`}
              title={lhLoading ? 'Checking letterhead…' : (letterhead ? 'Print on the Work Location letterhead' : 'No payslip letterhead configured for this employee’s Work Location')}
            >
              <input type="checkbox" disabled={!letterhead} checked={useLetterhead} onChange={e => setUseLetterhead(e.target.checked)} className="accent-indigo-600" />
              <FileText size={13} /> On Letterhead
            </label>
            <button onClick={doPrint} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
              <Printer size={14} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
          </div>
        </div>
        <iframe title="payslip-print-view" ref={frameRef} srcDoc={html} className="flex-1 w-full bg-white" />
      </div>
    </div>
  );
};

const PayslipPreviewModal = ({ employee, period, onClose, onPrintView, onExport, onEmail, currencySymbol, formatAmount }: PayslipPreviewModalProps) => {
  const est = useEstablishment();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-50 to-blue-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <FileText size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-indigo-900">Payslip Preview</h2>
              <p className="text-xs text-indigo-600">{employee.name} · {period.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrintView}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm"
            >
              <Printer size={14} /> Print View
            </button>
            <button
              onClick={onEmail}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Send size={14} /> Email
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <FileDown size={14} /> Export PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Payslip Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Company + Period */}
          <div className="flex items-start justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div>
              <p className="font-bold text-base text-indigo-900">{est.name || '—'}</p>
              {est.address && <p className="text-[10px] text-indigo-700/80 mt-0.5">{est.address}</p>}
              <p className="text-xs text-indigo-700 mt-0.5">SALARY SLIP</p>
              <span className="text-[10px] font-bold bg-white border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                {period.name} · {formatDate(period.fromDate)} – {formatDate(period.toDate)}
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-indigo-600 font-medium uppercase tracking-wide">Employee Code</p>
              <p className="text-lg font-bold text-indigo-900 font-mono">{employee.employeeCode}</p>
              <p className="text-[10px] text-indigo-600 mt-1 flex items-center gap-1 justify-end">
                <Mail size={10} /> {employee.email}
              </p>
            </div>
          </div>

          {/* Employee Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-accent/30 rounded-xl border border-border">
            <div className="space-y-2">
              {[
                { label: 'Name', value: employee.name },
                { label: 'Designation', value: employee.designation },
                { label: 'Department', value: employee.department },
                { label: 'Work Location', value: employee.workLocation },
                { label: 'Date of Joining', value: formatDate(employee.doj) },
              ].map(row => (
                <div key={row.label} className="flex items-start gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide w-28 shrink-0">{row.label}</span>
                  <span className="text-xs font-semibold">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { label: 'Employee Type', value: employee.employeeType },
                { label: 'Grade', value: employee.employeeGrade },
                { label: 'PAN', value: employee.pan },
                { label: 'UAN', value: employee.uan },
                { label: 'Bank Account', value: `${employee.bankAccount} (${employee.ifsc})` },
              ].map(row => (
                <div key={row.label} className="flex items-start gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide w-28 shrink-0">{row.label}</span>
                  <span className="text-xs font-semibold">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attendance */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Working Days', value: employee.workingDays, color: 'bg-gray-50 border-gray-200', textColor: 'text-gray-700' },
              { label: 'Present Days', value: employee.presentDays, color: 'bg-green-50 border-green-200', textColor: 'text-green-700' },
              { label: 'Leave Days', value: employee.leaveDays, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
              { label: 'LOP Days', value: employee.lopDays, color: 'bg-red-50 border-red-200', textColor: 'text-red-700' },
              { label: 'Overtime', value: `${employee.overtimeHours}h`, color: 'bg-violet-50 border-violet-200', textColor: 'text-violet-700' },
            ].map(card => (
              <div key={card.label} className={`p-3 rounded-xl border ${card.color} text-center`}>
                <p className={`text-lg font-bold ${card.textColor}`}>{card.value}</p>
                <p className={`text-[10px] font-medium ${card.textColor} uppercase tracking-wide`}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* Earnings & Deductions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-green-50 border-b border-green-200">
                <p className="text-xs font-bold text-green-800 uppercase tracking-wide">Earnings</p>
              </div>
              <div className="p-3 space-y-1.5">
                {[
                  { label: 'Basic Salary', value: employee.basic },
                  { label: 'HRA', value: employee.hra },
                  { label: 'Conveyance', value: employee.conveyance },
                  { label: 'Medical Allowance', value: employee.medicalAllowance },
                  { label: 'Special Allowance', value: employee.specialAllowance },
                  ...(employee.lta > 0 ? [{ label: 'LTA', value: employee.lta }] : []),
                  ...(employee.overtimeAmount > 0 ? [{ label: `Overtime (${employee.overtimeHours}h)`, value: employee.overtimeAmount }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold text-green-700">{formatAmount(row.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-border">
                  <span>Gross Earnings</span>
                  <span className="text-green-700">{formatAmount(employee.gross)}</span>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-200">
                <p className="text-xs font-bold text-red-800 uppercase tracking-wide">Deductions</p>
              </div>
              <div className="p-3 space-y-1.5">
                {[
                  { label: 'PF (Employee 12%)', value: employee.pfEmployee },
                  ...(employee.esiEmployee > 0 ? [{ label: 'ESI (0.75%)', value: employee.esiEmployee }] : []),
                  { label: 'Professional Tax', value: employee.professionalTax },
                  ...(employee.tds > 0 ? [{ label: 'TDS', value: employee.tds }] : []),
                  ...(employee.loanEmi > 0 ? [{ label: 'Loan EMI', value: employee.loanEmi }] : []),
                  ...(employee.otherDeductions > 0 ? [{ label: 'Other Deductions', value: employee.otherDeductions }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold text-red-600">-{formatAmount(row.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-border">
                  <span>Total Deductions</span>
                  <span className="text-red-600">-{formatAmount(employee.totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="flex items-center justify-between p-5 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl text-white">
            <div>
              <p className="text-sm font-semibold opacity-90">Net Pay (Take Home)</p>
              <p className="text-[10px] opacity-70 mt-0.5">{numberToWords(employee.net)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatAmount(employee.net)}</p>
              <p className="text-[10px] opacity-70 mt-0.5">Gross {formatAmount(employee.gross)} − Deductions {formatAmount(employee.totalDeductions)}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PayslipGeneration() {
  const navigate = useNavigate();
  usePayslipPeriods();
  const { formatAmount, currencySymbol } = useCurrency();

  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  // Two distinct generation modes: a single "particular period", or a "two-period group"
  // that spans From → To. They use separate selectors so the choice is explicit.
  const [genMode, setGenMode] = useState<'single' | 'range'>('single');
  // Range start (group mode). Empty ⇒ just the anchor/To period.
  const [fromPeriodId, setFromPeriodId] = useState('');
  const [generatingRange, setGeneratingRange] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [previewEmployee, setPreviewEmployee] = useState<PayslipEmployee | null>(null);
  const [printEmployee, setPrintEmployee] = useState<PayslipEmployee | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);

  // Email state
  const [emailConfirmTarget, setEmailConfirmTarget] = useState<{ employees: PayslipEmployee[]; isBulk: boolean } | null>(null);
  const [emailDeliveryRecords, setEmailDeliveryRecords] = useState<EmailDeliveryRecord[]>([]);
  const [showDeliveryPanel, setShowDeliveryPanel] = useState(false);
  const [emailingEmployee, setEmailingEmployee] = useState<string | null>(null);

  const [filters, setFilters] = useState<PayslipFilters>({
    workLocation: [],
    department: [],
    designation: [],
    employeeType: [],
    employeeGroup: [],
    employeeCategory: [],
    employeeGrade: [],
    allEmployees: false,
  });

  const selectedPeriod = PAYROLL_PERIODS.find(p => p.id === selectedPeriodId) ?? PAYROLL_PERIODS[0] ?? EMPTY_PERIOD;
  const isLockedPeriod = selectedPeriod.status === 'Locked';
  // Payslip rows come from the anchor period's latest payroll run (payroll_entries) — DB-driven.
  const { employees: dbEmployees } = usePayslipEmployees(selectedPeriod.id || null);
  const est = useEstablishment();

  // Periods covered by the current selection. Single period unless a range start is set;
  // then every period between the two endpoints (inclusive) ordered oldest → newest.
  const periodsInRange = useMemo<PayrollPeriodOpt[]>(() => {
    const anchor = selectedPeriod.id;
    if (genMode === 'single' || !fromPeriodId || fromPeriodId === anchor) return anchor ? [selectedPeriod] : [];
    const ai = PAYROLL_PERIODS.findIndex(p => p.id === anchor);
    const fi = PAYROLL_PERIODS.findIndex(p => p.id === fromPeriodId);
    if (ai < 0 || fi < 0) return anchor ? [selectedPeriod] : [];
    const [lo, hi] = [Math.min(ai, fi), Math.max(ai, fi)];
    // PAYROLL_PERIODS is sorted newest→oldest; reverse the slice for oldest→newest output.
    return PAYROLL_PERIODS.slice(lo, hi + 1).slice().reverse();
  }, [genMode, fromPeriodId, selectedPeriod, selectedPeriodId]);

  const hasActiveFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v);

  const resetFilters = () => {
    setFilters({
      workLocation: [], department: [], designation: [],
      employeeType: [], employeeGroup: [], employeeCategory: [],
      employeeGrade: [], allEmployees: false,
    });
    setSearch('');
  };

  const filteredEmployees = useMemo(() => {
    return dbEmployees.filter(emp => {
      const matchSearch = emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
        emp.department.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filters.allEmployees) return true;
      const checks = [
        filters.workLocation.length === 0 || filters.workLocation.includes(emp.workLocation),
        filters.department.length === 0 || filters.department.includes(emp.department),
        filters.designation.length === 0 || filters.designation.includes(emp.designation),
        filters.employeeType.length === 0 || filters.employeeType.includes(emp.employeeType),
        filters.employeeGroup.length === 0 || filters.employeeGroup.includes(emp.employeeGroup),
        filters.employeeCategory.length === 0 || filters.employeeCategory.includes(emp.employeeCategory),
        filters.employeeGrade.length === 0 || filters.employeeGrade.includes(emp.employeeGrade),
      ];
      return checks.every(Boolean);
    });
  }, [dbEmployees, filters, search]);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map(e => e.id));
    }
  };

  const handleExportSingle = (employee: PayslipEmployee) => {
    const html = generatePayslipHTML(employee, selectedPeriod, est.name || 'Establishment', currencySymbol, est.address);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=900,height=700,scrollbars=yes');
    if (!win) { toast.error('Popup blocked. Please allow popups for this site.'); URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success(`Payslip opened for ${employee.name}. Use Print → Save as PDF to export.`);
  };

  const handleGenerateSelected = () => {
    if (selectedEmployees.length === 0) { toast.error('Please select at least one employee.'); return; }
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      const firstEmp = dbEmployees.find(e => e.id === selectedEmployees[0]);
      if (firstEmp) handleExportSingle(firstEmp);
      toast.success(`Payslips generated for ${selectedEmployees.length} employee(s). Opening first payslip...`);
    }, 1200);
  };

  const handleBulkDownload = () => {
    const toGenerate = selectedEmployees.length > 0
      ? filteredEmployees.filter(e => selectedEmployees.includes(e.id))
      : filteredEmployees;
    if (toGenerate.length === 0) { toast.error('No employees to generate payslips for.'); return; }
    setGeneratingBulk(true);
    setTimeout(() => {
      setGeneratingBulk(false);
      if (toGenerate.length > 0) handleExportSingle(toGenerate[0]);
      toast.success(`${toGenerate.length} payslip(s) generated. Opening first payslip as preview...`);
    }, 2000);
  };

  // Generate payslips for the selected employees across EVERY processed period in the
  // range, as one combined document (one A4 page per employee × period) opened for
  // print / Save-as-PDF. Falls back to the single anchor period when no range is set.
  const handleGenerateRange = async () => {
    if (periodsInRange.length === 0) { toast.error('Select a pay period first.'); return; }
    // Target employees: explicit selection wins; else the filtered set if the anchor has
    // rows; else (anchor period has no run) every employee found in each period.
    const explicitIds = selectedEmployees.length > 0
      ? selectedEmployees
      : (filteredEmployees.length > 0 ? filteredEmployees.map(e => e.id) : null);
    const idSet = explicitIds ? new Set(explicitIds) : null;
    setGeneratingRange(true);
    try {
      const items: Array<{ employee: PayslipEmployee; period: PayrollPeriodOpt }> = [];
      const periodsWithRun = new Set<string>();
      for (const period of periodsInRange) {
        // Anchor period rows are already loaded; fetch the others on demand.
        const emps: PayslipEmployee[] = period.id === selectedPeriod.id
          ? dbEmployees
          : await loadPayslipEmployees(period.id);
        if (emps.length > 0) periodsWithRun.add(period.id);
        (idSet ? emps.filter(e => idSet.has(e.id)) : emps).forEach(employee => items.push({ employee, period }));
      }
      if (items.length === 0) {
        toast.error('No processed payroll found for the selected employees in this period range.');
        return;
      }
      const html = buildCombinedPayslipsHTML(items, est.name || 'Establishment', currencySymbol, est.address || '');
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const win = window.open(url, '_blank');
      if (!win) { toast.error('Popup blocked — allow popups to open the generated payslips.'); URL.revokeObjectURL(url); return; }
      setTimeout(() => URL.revokeObjectURL(url), 20000);
      const empCount = new Set(items.map(i => i.employee.id)).size;
      const skipped = periodsInRange.length - periodsWithRun.size;
      toast.success(`${items.length} payslip${items.length !== 1 ? 's' : ''} generated — ${empCount} employee${empCount !== 1 ? 's' : ''} × ${periodsWithRun.size} period${periodsWithRun.size !== 1 ? 's' : ''}.${skipped > 0 ? ` ${skipped} period(s) had no processed run and were skipped.` : ''} Use Print → Save as PDF.`);
    } finally {
      setGeneratingRange(false);
    }
  };

  // ── Email Handlers ──────────────────────────────────────────────────────────

  const handleEmailSingle = (employee: PayslipEmployee) => {
    setEmailConfirmTarget({ employees: [employee], isBulk: false });
    setPreviewEmployee(null);
  };

  const handleEmailSelected = () => {
    const toEmail = selectedEmployees.length > 0
      ? filteredEmployees.filter(e => selectedEmployees.includes(e.id))
      : filteredEmployees;
    if (toEmail.length === 0) { toast.error('No employees selected for email.'); return; }
    setEmailConfirmTarget({ employees: toEmail, isBulk: toEmail.length > 1 });
  };

  const handleEmailBulkAll = () => {
    if (filteredEmployees.length === 0) { toast.error('No employees match the current filters.'); return; }
    setEmailConfirmTarget({ employees: filteredEmployees, isBulk: true });
  };

  // Build the printable payslip HTML for an employee, on their work-location letterhead when configured.
  const buildPayslipDoc = async (emp: PayslipEmployee): Promise<string> => {
    let header = '', footer = '';
    let margins: { top: number; bottom: number; left: number; right: number } | undefined;
    try {
      const cfg = letterheadPrintConfig(await loadPayslipLetterhead(emp.id));
      if (cfg) { header = cfg.header; footer = cfg.footer; margins = { top: cfg.marginTop, bottom: cfg.marginBottom, left: cfg.marginLeft, right: cfg.marginRight }; }
    } catch { /* no letterhead — plain payslip */ }
    return generatePayslipHTML(emp, selectedPeriod, est.name || 'Establishment', currencySymbol, est.address || '', false, header, footer, margins);
  };

  const sendPayslipEmails = async (employees: PayslipEmployee[], subject: string, message: string) => {
    setEmailDeliveryRecords(employees.map(emp => ({ employeeId: emp.id, employeeName: emp.name, email: emp.email, status: 'sending' as EmailDeliveryStatus })));
    setShowDeliveryPanel(true);
    setEmailConfirmTarget(null);
    for (const emp of employees) {
      const html = await buildPayslipDoc(emp);
      const pdf = await htmlToPdfBlob(html).catch(() => null);
      const subj = subject.replace(/\{name\}/g, emp.name).replace(/\{period\}/g, selectedPeriod.name);
      const body = `<p>${message.replace(/\{name\}/g, emp.name).replace(/\{period\}/g, selectedPeriod.name).replace(/\n/g, '<br/>')}</p>`;
      const res = await sendEmployeeEmail({
        employeeId: emp.id, toEmail: emp.email, category: 'payslip',
        documentTitle: `Payslip ${selectedPeriod.name} — ${emp.employeeCode}`, subject: subj, message: body,
        documentHtml: pdf ? null : html, documentPdf: pdf,
      });
      setEmailDeliveryRecords(prev => prev.map(r => r.employeeId === emp.id ? {
        ...r, status: mapEmailStatus(res.status), deliveryId: res.id ?? undefined,
        sentAt: (res.status === 'Sent' || res.status === 'Simulated') ? formatDateTime(new Date()) : undefined,
        errorMessage: res.error ?? undefined,
      } : r));
    }
    toast.success('Email dispatch complete. Opens & receipts update live in the panel / Email Communications.');
  };

  const handleConfirmEmail = (subject: string, message: string) => {
    if (!emailConfirmTarget) return;
    void sendPayslipEmails(emailConfirmTarget.employees, subject, message);
  };

  const handleRetryEmail = (employeeId: string) => {
    const emp = dbEmployees.find(e => e.id === employeeId);
    if (!emp) return;
    setEmailDeliveryRecords(prev => prev.map(r => r.employeeId === employeeId ? { ...r, status: 'sending' } : r));
    void (async () => {
      const html = await buildPayslipDoc(emp);
      const pdf = await htmlToPdfBlob(html).catch(() => null);
      const res = await sendEmployeeEmail({
        employeeId: emp.id, toEmail: emp.email, category: 'payslip',
        documentTitle: `Payslip ${selectedPeriod.name} — ${emp.employeeCode}`, subject: `Payslip ${selectedPeriod.name}`,
        message: '<p>Please find your payslip attached.</p>', documentHtml: pdf ? null : html, documentPdf: pdf,
      });
      setEmailDeliveryRecords(prev => prev.map(r => r.employeeId === employeeId ? {
        ...r, status: mapEmailStatus(res.status), deliveryId: res.id ?? r.deliveryId,
        sentAt: formatDateTime(new Date()), errorMessage: res.error ?? undefined,
      } : r));
      if (res.error) toast.error(`Resend failed: ${res.error}`); else toast.success(`Payslip re-sent to ${emp.name}.`);
    })();
  };

  // Live-update the delivery panel as employees open the mail / attachment / confirm receipt.
  useEffect(() => {
    if (!showDeliveryPanel) return;
    const unsub = subscribeEmailDeliveries(async () => {
      const rows = await loadEmailDeliveries({ category: 'payslip', limit: 500 });
      const byId = new Map(rows.map(r => [r.id, r.status]));
      setEmailDeliveryRecords(prev => prev.map(r => (r.deliveryId && byId.has(r.deliveryId)) ? { ...r, status: mapEmailStatus(byId.get(r.deliveryId)!) } : r));
    });
    return unsub;
  }, [showDeliveryPanel]);

  // Get email status for an employee
  const getEmailStatus = (employeeId: string): EmailDeliveryStatus | null => {
    const record = emailDeliveryRecords.find(r => r.employeeId === employeeId);
    return record?.status ?? null;
  };

  const totalGross = filteredEmployees.reduce((s, e) => s + e.gross, 0);
  const totalNet = filteredEmployees.reduce((s, e) => s + e.net, 0);
  const totalDeductions = filteredEmployees.reduce((s, e) => s + e.totalDeductions, 0);

  const filterChips = [
    ...filters.workLocation.map(v => ({ label: `Location: ${v}`, key: 'workLocation', value: v })),
    ...filters.department.map(v => ({ label: `Dept: ${v}`, key: 'department', value: v })),
    ...filters.designation.map(v => ({ label: `Designation: ${v}`, key: 'designation', value: v })),
    ...filters.employeeType.map(v => ({ label: `Type: ${v}`, key: 'employeeType', value: v })),
    ...filters.employeeGroup.map(v => ({ label: `Group: ${v}`, key: 'employeeGroup', value: v })),
    ...filters.employeeCategory.map(v => ({ label: `Category: ${v}`, key: 'employeeCategory', value: v })),
    ...filters.employeeGrade.map(v => ({ label: `Grade: ${v}`, key: 'employeeGrade', value: v })),
  ];

  const removeFilterChip = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: (prev[key as keyof PayslipFilters] as string[]).filter(v => v !== value),
    }));
  };

  // Email delivery summary for the status bar
  const emailSentCount = emailDeliveryRecords.filter(r => r.status === 'sent').length;
  const emailFailedCount = emailDeliveryRecords.filter(r => r.status === 'failed' || r.status === 'bounced').length;
  const emailTotalCount = emailDeliveryRecords.length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileText size={22} className="text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Payslip Generation</h1>
                <p className="text-xs text-muted-foreground">Generate, export, and email payslips with employee-wise filters.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent text-muted-foreground'}`}
              >
                <Filter size={15} /> Filters {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
              </button>
              {/* Email delivery status indicator */}
              {emailTotalCount > 0 && (
                <button
                  onClick={() => setShowDeliveryPanel(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  <Inbox size={15} />
                  Email Status
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${emailFailedCount > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {emailSentCount}/{emailTotalCount}
                  </span>
                </button>
              )}
              {selectedEmployees.length > 0 && (
                <button
                  onClick={handleGenerateSelected}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-60"
                >
                  {generating ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                  Generate ({selectedEmployees.length})
                </button>
              )}
              <button
                onClick={handleBulkDownload}
                disabled={generatingBulk}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-md disabled:opacity-60"
              >
                {generatingBulk ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                {generatingBulk ? 'Generating...' : `Bulk Download (${filteredEmployees.length})`}
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Payroll Period Selector */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <Calendar size={16} className="text-primary" />
              <h2 className="font-bold text-sm">Select Pay Period(s)</h2>
              <span className="text-[10px] text-muted-foreground ml-auto">Pick the period to review; set a range start below to generate across multiple periods</span>
            </div>
            {/* Generation mode — a particular single period, or a two-period group */}
            <div className="inline-flex items-center gap-1 p-1 mb-4 bg-accent/50 rounded-xl">
              <button
                onClick={() => setGenMode('single')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${genMode === 'single' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Calendar size={14} /> Particular Period
              </button>
              <button
                onClick={() => setGenMode('range')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${genMode === 'range' ? 'bg-white text-indigo-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Layers size={14} /> Two-Period Group
              </button>
            </div>

            {genMode === 'single' ? (
              <>
                <div className="flex flex-wrap gap-3">
                  {PAYROLL_PERIODS.map(period => (
                    <button
                      key={period.id}
                      onClick={() => setSelectedPeriodId(period.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        selectedPeriodId === period.id
                          ? 'bg-primary text-primary-foreground border-primary shadow-md'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {period.status === 'Locked' ? <Lock size={13} /> : period.status === 'Closed' ? <CheckCircle2 size={13} /> : <Unlock size={13} />}
                      {period.name}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        selectedPeriodId === period.id ? 'bg-white/20 text-white' :
                        period.status === 'Locked' ? 'bg-red-100 text-red-700' :
                        period.status === 'Closed' ? 'bg-gray-100 text-gray-600' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {period.status}
                      </span>
                    </button>
                  ))}
                </div>
                {selectedPeriod && (
                  <div className="mt-3 flex items-center gap-4 px-4 py-3 bg-accent/30 rounded-xl border border-border text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(selectedPeriod.fromDate)} → {formatDate(selectedPeriod.toDate)}</span>
                    <span className="flex items-center gap-1.5"><Hash size={12} /> {selectedPeriod.code}</span>
                    <span className="flex items-center gap-1.5"><Shield size={12} /> FY {selectedPeriod.financialYear}</span>
                    {isLockedPeriod && (
                      <span className="flex items-center gap-1.5 text-red-600 font-semibold ml-auto"><Lock size={12} /> Period is locked — payslips are final</span>
                    )}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-x-3 gap-y-2 px-4 py-3 bg-primary/5 rounded-xl border border-primary/15 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide"><FileText size={13} /> Generate for {selectedPeriod.name}</span>
                  <span className="text-[11px] text-muted-foreground">· {selectedEmployees.length > 0 ? `${selectedEmployees.length} selected` : `${filteredEmployees.length} employees`}</span>
                  <button
                    onClick={() => void handleGenerateRange()}
                    disabled={generatingRange}
                    className="ml-auto flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold shadow-md disabled:opacity-60"
                  >
                    {generatingRange ? <RefreshCw size={14} className="animate-spin" /> : <FileDown size={14} />}
                    {generatingRange ? 'Generating…' : 'Generate Payslips'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Calendar size={12} /> From Period</label>
                    <select
                      value={fromPeriodId || selectedPeriod.id}
                      onChange={e => setFromPeriodId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {PAYROLL_PERIODS.map(p => <option key={p.id} value={p.id}>{p.name} · FY {p.financialYear}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Calendar size={12} /> To Period</label>
                    <select
                      value={selectedPeriodId || selectedPeriod.id}
                      onChange={e => setSelectedPeriodId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {PAYROLL_PERIODS.map(p => <option key={p.id} value={p.id}>{p.name} · FY {p.financialYear}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-x-3 gap-y-2 px-4 py-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 uppercase tracking-wide"><Layers size={13} /> Group Payslips</span>
                  <span className="text-xs text-muted-foreground">
                    {periodsInRange.length > 0 ? `${periodsInRange[0].name} → ${periodsInRange[periodsInRange.length - 1].name}` : '—'}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{periodsInRange.length} period{periodsInRange.length !== 1 ? 's' : ''}</span>
                  <span className="text-[11px] text-muted-foreground">· {selectedEmployees.length > 0 ? `${selectedEmployees.length} selected` : (filteredEmployees.length > 0 ? `${filteredEmployees.length} employees` : 'all employees')}</span>
                  <button
                    onClick={() => void handleGenerateRange()}
                    disabled={generatingRange}
                    className="ml-auto flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-md disabled:opacity-60"
                  >
                    {generatingRange ? <RefreshCw size={14} className="animate-spin" /> : <FileDown size={14} />}
                    {generatingRange ? 'Generating…' : `Generate Group (${periodsInRange.length})`}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Filter size={15} className="text-primary" /> Employee Selection Filters
                  </h3>
                  <div className="flex items-center gap-3">
                    {hasActiveFilters && (
                      <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <RefreshCw size={12} /> Reset All
                      </button>
                    )}
                    <button onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* All Employees Toggle */}
                <div
                  onClick={() => setFilters(prev => ({ ...prev, allEmployees: !prev.allEmployees }))}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    filters.allEmployees ? 'bg-indigo-50 border-indigo-300' : 'bg-accent/30 border-border hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${filters.allEmployees ? 'bg-indigo-100' : 'bg-accent'}`}>
                      <Users size={18} className={filters.allEmployees ? 'text-indigo-600' : 'text-muted-foreground'} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">All Employees</p>
                      <p className="text-[10px] text-muted-foreground">Generate payslips for all employees regardless of other filters</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${filters.allEmployees ? 'bg-indigo-500' : 'bg-border'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${filters.allEmployees ? 'translate-x-7' : 'translate-x-1'}`} />
                  </div>
                </div>

                {!filters.allEmployees && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <MultiSelectChips label="Work Location" icon={MapPin} options={WORK_LOCATIONS} selected={filters.workLocation} onChange={v => setFilters(prev => ({ ...prev, workLocation: v }))} accentBg="bg-teal-100" accentText="text-teal-700" accentBorder="border-teal-300" />
                    <MultiSelectChips label="Department" icon={Building2} options={DEPARTMENTS} selected={filters.department} onChange={v => setFilters(prev => ({ ...prev, department: v }))} accentBg="bg-violet-100" accentText="text-violet-700" accentBorder="border-violet-300" />
                    <MultiSelectChips label="Designation" icon={Briefcase} options={DESIGNATIONS} selected={filters.designation} onChange={v => setFilters(prev => ({ ...prev, designation: v }))} accentBg="bg-indigo-100" accentText="text-indigo-700" accentBorder="border-indigo-300" />
                    <MultiSelectChips label="Employee Type" icon={Tag} options={EMPLOYEE_TYPES} selected={filters.employeeType} onChange={v => setFilters(prev => ({ ...prev, employeeType: v }))} accentBg="bg-blue-100" accentText="text-blue-700" accentBorder="border-blue-300" />
                    <MultiSelectChips label="Employee Group" icon={Users} options={EMPLOYEE_GROUPS} selected={filters.employeeGroup} onChange={v => setFilters(prev => ({ ...prev, employeeGroup: v }))} accentBg="bg-emerald-100" accentText="text-emerald-700" accentBorder="border-emerald-300" />
                    <MultiSelectChips label="Employee Category" icon={Layers} options={EMPLOYEE_CATEGORIES} selected={filters.employeeCategory} onChange={v => setFilters(prev => ({ ...prev, employeeCategory: v }))} accentBg="bg-amber-100" accentText="text-amber-700" accentBorder="border-amber-300" />
                    <div className="md:col-span-2">
                      <MultiSelectChips label="Employee Grade" icon={Award} options={EMPLOYEE_GRADES} selected={filters.employeeGrade} onChange={v => setFilters(prev => ({ ...prev, employeeGrade: v }))} accentBg="bg-cyan-100" accentText="text-cyan-700" accentBorder="border-cyan-300" />
                    </div>
                  </div>
                )}

                {/* Active Filter Chips */}
                {filterChips.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide self-center">Active:</span>
                    {filterChips.map((chip, i) => (
                      <button
                        key={i}
                        onClick={() => removeFilterChip(chip.key, chip.value)}
                        className="flex items-center gap-1 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
                      >
                        {chip.label} <X size={10} />
                      </button>
                    ))}
                  </div>
                )}

                {/* Match Count */}
                <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <Users size={15} className="text-indigo-600 shrink-0" />
                  <p className="text-sm text-indigo-700">
                    <strong className="text-indigo-900">{filteredEmployees.length}</strong> employee{filteredEmployees.length !== 1 ? 's' : ''} match the current filter criteria
                  </p>
                  {filteredEmployees.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                      {filteredEmployees.length} matched
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Employees Matched', value: filteredEmployees.length, sub: 'Based on filters', color: 'bg-indigo-100', iconColor: 'text-indigo-600', icon: Users },
              { label: 'Total Gross Pay', value: formatAmount(totalGross), sub: selectedPeriod.name, color: 'bg-green-100', iconColor: 'text-green-600', icon: DollarSign },
              { label: 'Total Deductions', value: formatAmount(totalDeductions), sub: selectedPeriod.name, color: 'bg-red-100', iconColor: 'text-red-600', icon: TrendingDown },
              { label: 'Total Net Pay', value: formatAmount(totalNet), sub: selectedPeriod.name, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Wallet },
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

          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <Info size={17} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">Payslip Generation & Email Delivery</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                Use filters to narrow down employees. <strong>Export PDF</strong> opens a printable payslip. <strong>Email</strong> sends the payslip directly to the employee's registered email address. Use <strong>Bulk Email</strong> to send to all filtered employees at once. Track delivery status via the <strong>Email Status</strong> button.
              </p>
            </div>
          </div>

          {/* Search + Table Controls */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search by name, code, or department..."
                className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <span className="text-xs text-muted-foreground">{selectedEmployees.length} selected · {filteredEmployees.length} total</span>
              {selectedEmployees.length > 0 && (
                <button onClick={() => setSelectedEmployees([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <X size={12} /> Clear selection
                </button>
              )}
            </div>
          </div>

          {/* Employee Table */}
          {filteredEmployees.length > 0 ? (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-10">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                          onChange={toggleAll}
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold">Employee</th>
                      <th className="px-4 py-3 font-semibold">Work Location</th>
                      <th className="px-4 py-3 font-semibold">Type / Grade</th>
                      <th className="px-4 py-3 font-semibold text-green-700">Gross Pay</th>
                      <th className="px-4 py-3 font-semibold text-red-700">Deductions</th>
                      <th className="px-4 py-3 font-semibold text-blue-700">Net Pay</th>
                      <th className="px-4 py-3 font-semibold text-center">Attendance</th>
                      <th className="px-4 py-3 font-semibold text-center">Email</th>
                      <th className="px-4 py-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEmployees.map((emp, i) => {
                      const isSelected = selectedEmployees.includes(emp.id);
                      const emailStatus = getEmailStatus(emp.id);
                      const emailStatusStyle = emailStatus ? EMAIL_STATUS_STYLES[emailStatus] : null;
                      const EmailStatusIcon = emailStatusStyle?.icon;
                      return (
                        <motion.tr
                          key={emp.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className={`transition-colors group ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-accent/30'}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="rounded border-border"
                              checked={isSelected}
                              onChange={() => toggleEmployee(emp.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{emp.avatar}</div>
                              <div>
                                <p className="text-sm font-semibold">{emp.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{emp.employeeCode}</span>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{emp.designation}</span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Mail size={9} className="text-muted-foreground shrink-0" />
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{emp.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={11} className="text-muted-foreground shrink-0" />
                              <div>
                                <p className="text-xs font-medium truncate max-w-[130px]">{emp.workLocation}</p>
                                <p className="text-[10px] text-muted-foreground">{emp.department}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full block w-fit">{emp.employeeType}</span>
                              <span className="text-[10px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full block w-fit">{emp.employeeGrade}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-sm text-green-700">{formatAmount(emp.gross)}</td>
                          <td className="px-4 py-3 text-sm text-red-600">-{formatAmount(emp.totalDeductions)}</td>
                          <td className="px-4 py-3 font-bold text-sm text-blue-700">{formatAmount(emp.net)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="text-xs text-muted-foreground">
                              <span className="text-green-600 font-semibold">{emp.presentDays}P</span>
                              {emp.leaveDays > 0 && <span className="text-blue-600 font-semibold ml-1">{emp.leaveDays}L</span>}
                              {emp.lopDays > 0 && <span className="text-red-600 font-semibold ml-1">{emp.lopDays}LOP</span>}
                              <span className="text-muted-foreground ml-1">/{emp.workingDays}</span>
                            </div>
                          </td>
                          {/* Email Status Column */}
                          <td className="px-4 py-3 text-center">
                            {emailStatus && emailStatusStyle && EmailStatusIcon ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${emailStatusStyle.bg} ${emailStatusStyle.text} ${emailStatusStyle.border}`}>
                                <EmailStatusIcon size={9} className={emailStatus === 'sending' ? 'animate-spin' : ''} />
                                {emailStatusStyle.label}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={() => setPreviewEmployee(emp)}
                                className="p-1.5 rounded-lg hover:bg-indigo-50 text-muted-foreground hover:text-indigo-600 transition-colors"
                                title="Preview Payslip"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => setPrintEmployee(emp)}
                                className="p-1.5 rounded-lg hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors"
                                title="Print View"
                              >
                                <Printer size={14} />
                              </button>
                              <button
                                onClick={() => handleExportSingle(emp)}
                                className="p-1.5 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors"
                                title="Export PDF"
                              >
                                <FileDown size={14} />
                              </button>
                              <button
                                onClick={() => handleEmailSingle(emp)}
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors"
                                title="Email Payslip"
                              >
                                <Send size={14} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-accent/30 border-t-2 border-border">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Total ({filteredEmployees.length} employees)
                      </td>
                      <td className="px-4 py-3 font-bold text-sm text-green-700">{formatAmount(totalGross)}</td>
                      <td className="px-4 py-3 font-bold text-sm text-red-600">-{formatAmount(totalDeductions)}</td>
                      <td className="px-4 py-3 font-bold text-sm text-blue-700">{formatAmount(totalNet)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-indigo-600" />
              </div>
              <p className="font-semibold text-muted-foreground">No employees match the selected filters</p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">Try adjusting your filter criteria or reset all filters</p>
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto"
              >
                <RefreshCw size={15} /> Reset Filters
              </button>
            </div>
          )}

          {/* Bulk Action Bar */}
          {filteredEmployees.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border shadow-sm flex-wrap gap-3">
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedEmployees.length > 0 ? selectedEmployees.length : filteredEmployees.length}</span> payslip{(selectedEmployees.length > 0 ? selectedEmployees.length : filteredEmployees.length) !== 1 ? 's' : ''} will be processed
                {selectedEmployees.length > 0 && <span className="text-muted-foreground"> (selected)</span>}
                {selectedEmployees.length === 0 && <span className="text-muted-foreground"> (all filtered)</span>}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Email Actions */}
                <button
                  onClick={selectedEmployees.length > 0 ? handleEmailSelected : handleEmailBulkAll}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                >
                  <Send size={14} />
                  {selectedEmployees.length > 0
                    ? `Email Selected (${selectedEmployees.length})`
                    : `Bulk Email All (${filteredEmployees.length})`}
                </button>
                {selectedEmployees.length > 0 && (
                  <button
                    onClick={handleGenerateSelected}
                    disabled={generating}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-60"
                  >
                    {generating ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                    Generate Selected ({selectedEmployees.length})
                  </button>
                )}
                <button
                  onClick={handleBulkDownload}
                  disabled={generatingBulk}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-md disabled:opacity-60"
                >
                  {generatingBulk ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                  {generatingBulk ? 'Generating...' : `Bulk Download All (${filteredEmployees.length})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Payslip Preview Modal */}
      <AnimatePresence>
        {previewEmployee && (
          <PayslipPreviewModal
            employee={previewEmployee}
            period={selectedPeriod}
            onClose={() => setPreviewEmployee(null)}
            onPrintView={() => { setPrintEmployee(previewEmployee); setPreviewEmployee(null); }}
            onExport={() => { handleExportSingle(previewEmployee); setPreviewEmployee(null); }}
            onEmail={() => handleEmailSingle(previewEmployee)}
            currencySymbol={currencySymbol}
            formatAmount={formatAmount}
          />
        )}
        {printEmployee && (
          <PayslipPrintModal
            employee={printEmployee}
            period={selectedPeriod}
            companyName={est.name || 'Establishment'}
            currencySymbol={currencySymbol}
            companyAddress={est.address || ''}
            onClose={() => setPrintEmployee(null)}
          />
        )}
      </AnimatePresence>

      {/* Email Confirmation Dialog */}
      <AnimatePresence>
        {emailConfirmTarget && (
          <EmailConfirmDialog
            employees={emailConfirmTarget.employees}
            period={selectedPeriod}
            isBulk={emailConfirmTarget.isBulk}
            companyName={est.name}
            onConfirm={handleConfirmEmail}
            onClose={() => setEmailConfirmTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Email Delivery Status Panel */}
      <AnimatePresence>
        {showDeliveryPanel && emailDeliveryRecords.length > 0 && (
          <EmailDeliveryPanel
            records={emailDeliveryRecords}
            period={selectedPeriod}
            onClose={() => setShowDeliveryPanel(false)}
            onRetry={handleRetryEmail}
          />
        )}
      </AnimatePresence>
    </div>
  );
}