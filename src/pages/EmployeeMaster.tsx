import DateInput from '../components/DateInput';
import { todayFormatted } from '../utils/date';
import React, { useState, useRef, useMemo, useCallback, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase/client';
import DocumentSignControl from '../components/DocumentSignControl';
import SecureDocUploadZone from '../components/SecureDocUploadZone';
import EmployeeAvatar, { primeEmployeePhoto } from '../components/EmployeeAvatar';
import { uploadEmployeePhoto, updateEmployeePhotoUrl, resolvePhotoUrl } from '../lib/storage';
import { buildEmployeeId, defaultEmpIdPattern, type EmpIdPattern } from '../lib/employeeId';
import { useDbStructures, getEmployeeAssignment, upsertEmployeeAssignment } from '../lib/salaryAssignments';
import { usePayrollSettingsForBreakdown, resolveEffectiveStatutory, computeStatutory, employeePf, wageBaseFromComponents, loadPtSlabs, ptForGross, type PtSlab } from '../lib/statutory';
import { solveForTarget, balanceBasicViaCustom } from '../lib/salarySolver';
import { useEstablishment } from '../lib/reports';
import { useEmployeeAssets, returnAsset } from '../lib/assets';
import { resetPasswordAndNotify } from '../lib/credentials';
import { sendNotificationEmail } from '../lib/email';
import type { SignatureData } from '../components/AadhaarOTPSigning';
import {
  User, Plus, Trash2, X, Save, ChevronLeft, Upload, Eye,
  Paperclip, CheckCircle2, AlertCircle, Info, Phone, Mail,
  MapPin, Hash, Calendar, Building2, Briefcase, GraduationCap,
  Users, Heart, Banknote, FileText, Camera, IdCard, Home,
  Boxes, Undo2,
  Shield, CreditCard, Receipt, BadgeCheck, Star, Baby,
  Navigation, Globe, DollarSign, Percent, Award, BookOpen, UserCheck,
  Trash, Download, RefreshCw, Copy, ChevronDown, ChevronRight,
  Fingerprint, Flag, Stethoscope, Building, Tag, Layers,
  Search, Network, ExternalLink, ChevronUp, Languages, Volume2,
  BookOpenCheck, PenLine, CalendarClock, UserPlus, Key, EyeOff,
  Lock, Sparkles, CalendarDays, TrendingUp, TrendingDown,
  ArrowRightLeft, BarChart3, Clock, Wallet, RefreshCcw,
  Pencil, Send
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import EmployeeDocumentFormats from '../components/employee/EmployeeDocumentFormats';
import { toast } from 'react-toastify';
import { useNavigate, useParams } from 'react-router-dom';
import {
  SALARY_STRUCTURES,
  getStructureById,
  computeSalaryBreakdown,
  resolveComponentValue,
  defaultComponentValues,
  isConfigurable,
  emptyEmployeeSalaryStructure,
  saveEmployeeSalary,
  getEmployeeSalary,
  VALUE_TYPE_META,
  COMPONENT_TYPE_META,
  roundTo,
  type EmployeeSalaryStructure,
  type SalaryStructure,
  type RoundCode,
} from '../data/salaryStructures';
import type { RevisionBasis } from '../lib/salarySolver';

// ─── Types ────────────────────────────────────────────────────────────────────

type EmployeeTab =
  | 'personal'
  | 'employment'
  | 'statutory'
  | 'education'
  | 'family'
  | 'bank'
  | 'documents'
  | 'salary-structure'
  | 'leave-balances'
  | 'assets';

type ProficiencyLevel = 'None' | 'Basic' | 'Intermediate' | 'Advanced' | 'Native';

interface LanguageProficiency {
  id: string;
  language: string;
  speak: ProficiencyLevel;
  read: ProficiencyLevel;
  write: ProficiencyLevel;
}

interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dataUrl: string;
  signature?: SignatureData;
}

// Identity of the person whose Aadhaar signs documents in this form (the employee
// being created/edited). Provided at the form root and consumed by DocUploadZone.
const SignerContext = createContext<{ name: string; id: string }>({ name: '', id: '' });

interface Address {
  line1: string;
  line2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
}

interface PersonalDetails {
  firstName: string;
  middleName: string;
  lastName: string;
  fatherName: string;
  motherName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  mobile: string;
  email: string;
  identificationMarks: string;
  gender: string;
  maritalStatus: string;
  anniversaryDate: string;
  bloodGroup: string;
  religion: string;
  caste: string;
  motherTongue: string;
  photo: string;
  specimenSignature: string;
  thumbImpression: string;
  presentAddress: Address;
  permanentAddress: Address;
  sameAsPresent: boolean;
}

interface PriorWorkExperience {
  id: string;
  companyName: string;
  designation: string;
  department: string;
  fromDate: string;
  toDate: string;
  yearsOfExperience: number;
  monthsOfExperience: number;
  reasonForLeaving: string;
  lastSalary: string;
  referenceName: string;
  referenceDesignation: string;
  referencePhone: string;
  referenceEmail: string;
  documents: UploadedDoc[];
}

interface EmploymentDetails {
  employeeId: string;
  currentEmployeeId: string;
  serviceBookNo: string;
  attendanceSystemId: string;
  dateOfJoining: string;
  dateOfConfirmation: string;
  probationPeriodMonths: number;
  designation: string;
  department: string;
  section: string;
  grade: string;
  employeeType: string;
  employeeCategory: string;
  employeeGroup: string;
  employeeClassification: string;
  workLocation: string;
  shift: string;
  reportingManagerId: string;
  reportingManagerName: string;
  noticePeriodDays: number;
  offerLetterValidityDays: number;
  totalExperienceYears: number;
  totalExperienceMonths: number;
  priorWorkExperiences: PriorWorkExperience[];
  languageProficiencies: LanguageProficiency[];
}

interface StatutoryDetails {
  panNo: string;
  aadharNo: string;
  uanNo: string;
  pfAccountNo: string;
  esiNo: string;
  passportNo: string;
  passportExpiry: string;
  drivingLicenseNo: string;
  drivingLicenseExpiry: string;
  voterIdNo: string;
  rationCardNo: string;
  documents: { [key: string]: UploadedDoc[] };
}

interface EducationRecord {
  id: string;
  qualification: string;
  specialization: string;
  institution: string;
  university: string;
  yearOfPassing: string;
  percentage: string;
  grade: string;
  documents: UploadedDoc[];
}

interface FamilyMember {
  id: string;
  relationship: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  occupation: string;
  phone: string;
  isDependent: boolean;
  isNominee: boolean;
  nominationPercentage: number;
  nominationPurpose: string[];
  documents: UploadedDoc[];
}

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  branchAddress: string;
  accountType: string;
  isPrimary: boolean;
  swiftCode: string;
  micrCode: string;
  documents: UploadedDoc[];
}

interface EmployeeDocuments {
  photo: string;
  specimenSignature: string;
  thumbImpression: string;
  offerLetter: UploadedDoc[];
  appointmentLetter: UploadedDoc[];
  experienceCertificates: UploadedDoc[];
  relievingLetter: UploadedDoc[];
  educationCertificates: UploadedDoc[];
  idProofs: UploadedDoc[];
  addressProofs: UploadedDoc[];
  medicalCertificates: UploadedDoc[];
  otherDocuments: UploadedDoc[];
}

// ─── Leave Balance Types ──────────────────────────────────────────────────────

interface LeaveOpeningBalance {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  leaveTypeColor: string;
  financialYear: string;
  openingBalance: number;
  remarks: string;
}

interface PeriodLeaveTransaction {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  leaveTypeColor: string;
  payPeriodId: string;
  payPeriodName: string;
  financialYear: string;
  openingBalance: number;
  accrued: number;
  availed: number;
  encashed: number;
  lapsed: number;
  closingBalance: number;
  leaveRequestId?: string;
  remarks: string;
}

interface LeaveAvailedRecord {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  leaveTypeColor: string;
  payPeriodId: string;
  payPeriodName: string;
  fromDate: string;
  toDate: string;
  days: number;
  isHalfDay: boolean;
  reason: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  approvedBy: string;
}

interface EmployeeLeaveData {
  openingBalances: LeaveOpeningBalance[];
  periodTransactions: PeriodLeaveTransaction[];
  availedRecords: LeaveAvailedRecord[];
}

interface EmployeeFormData {
  personal: PersonalDetails;
  employment: EmploymentDetails;
  statutory: StatutoryDetails;
  education: EducationRecord[];
  family: FamilyMember[];
  bank: BankAccount[];
  documents: EmployeeDocuments;
  salaryStructure: EmployeeSalaryStructure;
  leaveData: EmployeeLeaveData;
}

// ─── Leave Color Map ──────────────────────────────────────────────────────────

const LEAVE_COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string; light: string; bar: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', light: 'bg-blue-50', bar: 'bg-blue-500' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', light: 'bg-rose-50', bar: 'bg-rose-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', light: 'bg-emerald-50', bar: 'bg-emerald-500' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500', light: 'bg-pink-50', bar: 'bg-pink-500' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500', light: 'bg-cyan-50', bar: 'bg-cyan-500' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500', light: 'bg-violet-50', bar: 'bg-violet-500' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', light: 'bg-orange-50', bar: 'bg-orange-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', light: 'bg-amber-50', bar: 'bg-amber-500' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', light: 'bg-indigo-50', bar: 'bg-indigo-500' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500', light: 'bg-teal-50', bar: 'bg-teal-500' },
};

function getLeaveColor(color: string) {
  return LEAVE_COLOR_MAP[color] ?? LEAVE_COLOR_MAP['blue'];
}

// ─── Seed Leave Data ──────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const FINANCIAL_YEAR = `${CURRENT_YEAR - 1}-${String(CURRENT_YEAR).slice(-2)}`;

const EMPTY_LEAVE_DATA: EmployeeLeaveData = {
  openingBalances: [],
  periodTransactions: [],
  availedRecords: [],
};

// ─── Auto-User Creation Modal ─────────────────────────────────────────────────

interface AutoUserCreationModalProps {
  employeeId: string;
  employeeName: string;
  email: string;
  onConfirm: (password: string) => void;
  onSkip: () => void;
  onClose: () => void;
}

const AutoUserCreationModal = ({ employeeId, employeeName, email, onConfirm, onSkip, onClose }: AutoUserCreationModalProps) => {
  const [customPassword, setCustomPassword] = useState(employeeId);
  const [showPassword, setShowPassword] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  const finalPassword = useCustom ? customPassword : employeeId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <UserPlus size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-indigo-900">Create System User Account</h2>
              <p className="text-xs text-indigo-600">Auto-generate login credentials for this employee</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700">
              <p className="font-semibold mb-1">Employee saved successfully!</p>
              <p>A system user account will be created for <strong>{employeeName}</strong> so they can log in to the HRMS portal.</p>
            </div>
          </div>

          <div className="bg-accent/30 rounded-xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Login Credentials</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-border">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Username</p>
                <p className="text-sm font-bold font-mono text-primary">{employeeId}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-border">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Default Password</p>
                <p className="text-sm font-bold font-mono text-amber-600">{useCustom ? '(custom)' : employeeId}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setUseCustom(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${useCustom ? 'bg-primary' : 'bg-border'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useCustom ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <div>
                <span className="text-sm font-medium">Set a custom initial password</span>
                <p className="text-[10px] text-muted-foreground">Override the default Employee ID password</p>
              </div>
            </label>

            <AnimatePresence>
              {useCustom && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative">
                    <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full pl-9 pr-10 p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono transition-all"
                      placeholder="Enter custom password"
                      value={customPassword}
                      onChange={e => setCustomPassword(e.target.value)}
                    />
                    <button
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <Lock size={13} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">
              The employee will be prompted to change their password on first login.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
          <button onClick={onSkip} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Skip — Create User Later
          </button>
          <button
            onClick={() => onConfirm(finalPassword)}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
          >
            <UserPlus size={15} /> Create User Account
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Employee List ────────────────────────────────────────────────────────────

interface EmployeeListItem {
  id: string;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  reportingManagerId: string | null;
  avatar: string;
}

// ─── DB-backed master & employee loaders (no hardcoded data) ───────────────────
const sbAny = supabase as unknown as { from: (t: string) => any };

type MasterItem = { id: string; name: string };
const masterCache = new Map<string, MasterItem[]>();
async function loadMaster(table: string): Promise<MasterItem[]> {
  if (masterCache.has(table)) return masterCache.get(table)!;
  const { data } = await sbAny.from(table).select('id, name').order('name');
  const rows = (data ?? []) as MasterItem[];
  masterCache.set(table, rows);
  return rows;
}
/** Live (session-cached) list of {id,name} from a master table, e.g. useMaster('designations'). */
function useMaster(table: string): MasterItem[] {
  const [rows, setRows] = useState<MasterItem[]>(() => masterCache.get(table) ?? []);
  useEffect(() => {
    let active = true;
    void loadMaster(table).then(r => { if (active) setRows(r); });
    return () => { active = false; };
  }, [table]);
  return rows;
}

// Departments carry a `location_id` so the Employment tab can scope them to the
// selected work location (employees are positioned into a location → department).
type DeptItem = { id: string; name: string; location_id: string | null };
let deptCache: DeptItem[] | null = null;
function useDepartmentsList(): DeptItem[] {
  const [rows, setRows] = useState<DeptItem[]>(() => deptCache ?? []);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!deptCache) {
        const { data } = await sbAny.from('departments').select('id, name, location_id').order('name');
        deptCache = (data ?? []) as DeptItem[];
      }
      if (active) setRows(deptCache);
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

const initialsOf = (name: string) => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Build a Supabase `employees` row from the form, resolving master names to FK ids.
async function buildEmployeeRow(form: EmployeeFormData): Promise<Record<string, unknown>> {
  const [desig, dept, grade, etype, ecat, egrp, wloc, shft] = await Promise.all([
    loadMaster('designations'), loadMaster('departments'), loadMaster('employee_grades'),
    loadMaster('employee_types'), loadMaster('employee_categories'), loadMaster('employee_groups'),
    loadMaster('work_locations'), loadMaster('shifts'),
  ]);
  const idByName = (list: MasterItem[], name: string) => list.find(x => x.name === name)?.id ?? null;
  const p = form.personal, em = form.employment;
  return {
    employee_id: em.currentEmployeeId || em.employeeId,
    current_employee_id: em.currentEmployeeId || null,
    service_book_no: em.serviceBookNo || null,
    attendance_system_id: em.attendanceSystemId?.trim() || null,
    first_name: p.firstName.trim(), middle_name: p.middleName || null, last_name: p.lastName.trim(),
    father_name: p.fatherName || null, mother_name: p.motherName || null,
    date_of_birth: p.dateOfBirth || null, place_of_birth: p.placeOfBirth || null,
    nationality: p.nationality || 'Indian', identification_marks: p.identificationMarks || null,
    mobile_number: p.mobile?.trim() || null, email: p.email?.trim() || null,
    gender: p.gender || null, marital_status: p.maritalStatus || null, blood_group: p.bloodGroup || null,
    anniversary_date: (p.maritalStatus === 'Married' && p.anniversaryDate) ? p.anniversaryDate : null,
    religion: p.religion || null, caste: p.caste || null, mother_tongue: p.motherTongue || null,
    photo_url: p.photo || null, signature_url: p.specimenSignature || null, thumb_impression_url: p.thumbImpression || null,
    present_address_line1: p.presentAddress.line1 || null, present_address_line2: p.presentAddress.line2 || null,
    present_city: p.presentAddress.city || null, present_district: p.presentAddress.district || null,
    present_state: p.presentAddress.state || null, present_pincode: p.presentAddress.pincode || null,
    present_country: p.presentAddress.country || 'India',
    permanent_address_line1: p.permanentAddress.line1 || null, permanent_address_line2: p.permanentAddress.line2 || null,
    permanent_city: p.permanentAddress.city || null, permanent_district: p.permanentAddress.district || null,
    permanent_state: p.permanentAddress.state || null, permanent_pincode: p.permanentAddress.pincode || null,
    permanent_country: p.permanentAddress.country || 'India',
    same_address: p.sameAsPresent,
    date_of_joining: em.dateOfJoining || null, date_of_confirmation: em.dateOfConfirmation || null,
    probation_period_months: em.probationPeriodMonths || 0,
    designation_id: idByName(desig, em.designation), department_id: idByName(dept, em.department),
    section: em.section || null, grade_id: idByName(grade, em.grade),
    employee_type_id: idByName(etype, em.employeeType), employee_category_id: idByName(ecat, em.employeeCategory),
    employee_group_id: idByName(egrp, em.employeeGroup), work_location_id: idByName(wloc, em.workLocation),
    shift_id: idByName(shft, em.shift),
    reporting_manager_id: em.reportingManagerId && isUuid(em.reportingManagerId) ? em.reportingManagerId : null,
    notice_period_days: em.noticePeriodDays || 0, offer_letter_validity_days: em.offerLetterValidityDays || 0,
    total_experience_years: em.totalExperienceYears || 0, total_experience_months: em.totalExperienceMonths || 0,
    status: 'Active', employee_classification: em.employeeClassification || null,
  };
}

// ─── Employee child-table mapping (one-to-many records per employee) ───────────
const dOrNull = (v: string) => (v && v.trim() ? v : null);

const statutoryHasData = (s: StatutoryDetails) =>
  [s.panNo, s.aadharNo, s.uanNo, s.pfAccountNo, s.esiNo, s.passportNo, s.passportExpiry,
   s.drivingLicenseNo, s.drivingLicenseExpiry, s.voterIdNo, s.rationCardNo].some(v => (v ?? '').trim());

function statutoryToRow(s: StatutoryDetails, empId: string): Record<string, unknown> {
  return {
    employee_id: empId, pan_no: s.panNo || null, aadhar_no: s.aadharNo || null, uan_no: s.uanNo || null,
    pf_account_no: s.pfAccountNo || null, esi_no: s.esiNo || null, passport_no: s.passportNo || null,
    passport_expiry: dOrNull(s.passportExpiry), driving_license_no: s.drivingLicenseNo || null,
    driving_license_expiry: dOrNull(s.drivingLicenseExpiry), voter_id_no: s.voterIdNo || null,
    ration_card_no: s.rationCardNo || null,
  };
}
function educationToRow(e: EducationRecord, empId: string): Record<string, unknown> {
  return {
    employee_id: empId, qualification: e.qualification.trim(), specialization: e.specialization || null,
    institution: e.institution || null, university: e.university || null, year_of_passing: e.yearOfPassing || null,
    percentage: e.percentage || null, grade: e.grade || null,
  };
}
function familyToRow(f: FamilyMember, empId: string): Record<string, unknown> {
  return {
    employee_id: empId, relationship: f.relationship.trim(), name: f.name.trim(),
    date_of_birth: dOrNull(f.dateOfBirth), gender: f.gender || null, occupation: f.occupation || null,
    phone: f.phone || null, is_dependent: f.isDependent, is_nominee: f.isNominee,
    nomination_percentage: f.nominationPercentage || 0, nomination_purpose: f.nominationPurpose ?? [],
  };
}
function empBankToRow(b: BankAccount, empId: string): Record<string, unknown> {
  return {
    employee_id: empId, bank_name: b.bankName.trim(), account_name: b.accountName.trim(),
    account_number: b.accountNumber.trim(), ifsc_code: b.ifscCode.trim(), branch_name: b.branchName || null,
    branch_address: b.branchAddress || null, account_type: b.accountType || 'Savings', is_primary: b.isPrimary,
    swift_code: b.swiftCode || null, micr_code: b.micrCode || null,
  };
}
function languageToRow(l: LanguageProficiency, empId: string): Record<string, unknown> {
  return { employee_id: empId, language: l.language.trim(), speak_level: l.speak, read_level: l.read, write_level: l.write };
}
function workExpToRow(w: PriorWorkExperience, empId: string): Record<string, unknown> {
  return {
    employee_id: empId, company_name: w.companyName.trim(), designation: w.designation || null,
    department: w.department || null, from_date: dOrNull(w.fromDate), to_date: dOrNull(w.toDate),
    years_of_experience: w.yearsOfExperience || 0, months_of_experience: w.monthsOfExperience || 0,
    reason_for_leaving: w.reasonForLeaving || null, last_salary: w.lastSalary || null,
    reference_name: w.referenceName || null, reference_designation: w.referenceDesignation || null,
    reference_phone: w.referencePhone || null, reference_email: w.referenceEmail || null,
  };
}

// Replace-all persistence of every child collection for an employee (DB is the source of truth).
/** Employee opening leave balance → leave_balances row. Opening balance seeds the
 *  closing balance; accrual/usage are tracked separately as leave is processed. */
function leaveBalanceToRow(ob: LeaveOpeningBalance, empId: string): Record<string, unknown> {
  const startYear = parseInt(ob.financialYear.slice(0, 4), 10) || new Date().getFullYear();
  const opening = Number(ob.openingBalance) || 0;
  return {
    employee_id: empId, leave_type_id: ob.leaveTypeId, year: startYear,
    opening_balance: opening, accrued: 0, used: 0, pending: 0,
    encashed: 0, lapsed: 0, closing_balance: opening,
  };
}

async function persistEmployeeChildren(empId: string, form: EmployeeFormData): Promise<string | null> {
  const replace = async (table: string, rows: Record<string, unknown>[]): Promise<string | null> => {
    const del = await sbAny.from(table).delete().eq('employee_id', empId);
    if (del.error) return del.error.message;
    if (rows.length) {
      const ins = await sbAny.from(table).insert(rows);
      if (ins.error) return ins.error.message;
    }
    return null;
  };
  const steps: [string, Record<string, unknown>[]][] = [
    ['employee_statutory', statutoryHasData(form.statutory) ? [statutoryToRow(form.statutory, empId)] : []],
    ['employee_education', form.education.filter(e => e.qualification.trim()).map(e => educationToRow(e, empId))],
    ['employee_family', form.family.filter(f => f.relationship.trim() && f.name.trim()).map(f => familyToRow(f, empId))],
    ['employee_bank_accounts', form.bank.filter(b => b.bankName.trim() && b.accountName.trim() && b.accountNumber.trim() && b.ifscCode.trim()).map(b => empBankToRow(b, empId))],
    ['employee_languages', form.employment.languageProficiencies.filter(l => l.language.trim()).map(l => languageToRow(l, empId))],
    ['employee_work_experience', form.employment.priorWorkExperiences.filter(w => w.companyName.trim()).map(w => workExpToRow(w, empId))],
    ['leave_balances', form.leaveData.openingBalances.filter(ob => isUuid(ob.leaveTypeId)).map(ob => leaveBalanceToRow(ob, empId))],
  ];
  for (const [table, rows] of steps) {
    const err = await replace(table, rows);
    if (err) return err;
  }
  return null;
}

/** Reporting-manager candidate list, sourced live from the employees table. */
function useEmployeeList(): EmployeeListItem[] {
  const [rows, setRows] = useState<EmployeeListItem[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await sbAny.from('employees')
        .select('id, employee_id, first_name, middle_name, last_name, reporting_manager_id, designation:designations(name), department:departments(name)')
        .order('first_name');
      const list: EmployeeListItem[] = (data ?? []).map((r: any) => {
        const name = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ');
        return {
          id: r.id,
          employeeId: r.employee_id ?? '',
          name,
          designation: r.designation?.name ?? '',
          department: r.department?.name ?? '',
          reportingManagerId: r.reporting_manager_id ?? null,
          avatar: initialsOf(name),
        };
      });
      if (active) setRows(list);
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

const NATIONALITIES = ['Indian', 'American', 'British', 'Canadian', 'Australian', 'German', 'French', 'Japanese', 'Chinese', 'Singaporean', 'UAE', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const QUALIFICATIONS = ['SSC / 10th', 'HSC / 12th', 'Diploma', 'B.A.', 'B.Sc.', 'B.Com.', 'B.E. / B.Tech.', 'B.B.A.', 'B.C.A.', 'M.A.', 'M.Sc.', 'M.Com.', 'M.E. / M.Tech.', 'M.B.A.', 'M.C.A.', 'Ph.D.', 'CA', 'CS', 'ICWA', 'LLB', 'MBBS', 'Other'];
const RELATIONSHIPS = ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Father-in-Law', 'Mother-in-Law', 'Grandfather', 'Grandmother', 'Other'];
const NOMINATION_PURPOSES = ['PF', 'ESI', 'Gratuity', 'Insurance', 'General'];
const ACCOUNT_TYPES = ['Savings', 'Current', 'Salary'];
const REASON_FOR_LEAVING = ['Better Opportunity', 'Higher Salary', 'Career Growth', 'Relocation', 'Personal Reasons', 'Company Closure', 'Contract End', 'Termination', 'Retirement', 'Health Reasons', 'Other'];
const PROFICIENCY_LEVELS: ProficiencyLevel[] = ['None', 'Basic', 'Intermediate', 'Advanced', 'Native'];
const PROFICIENCY_COLORS: Record<ProficiencyLevel, { bg: string; text: string; border: string }> = {
  None: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  Basic: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  Intermediate: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  Advanced: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  Native: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
};
const COMMON_LANGUAGES = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Odia', 'Assamese', 'French', 'German', 'Spanish', 'Japanese', 'Chinese (Mandarin)', 'Arabic', 'Other'];

// Leave types for the opening-balance entry — sourced live from the leave_types
// master (Configuration → Leave Type Master). No hardcoded leave types.
interface LeaveTypeOption { id: string; name: string; code: string; color: string }
let leaveTypeOptionsCache: LeaveTypeOption[] | null = null;
function useLeaveTypeOptions(): LeaveTypeOption[] {
  const [rows, setRows] = useState<LeaveTypeOption[]>(() => leaveTypeOptionsCache ?? []);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!leaveTypeOptionsCache) {
        const { data } = await sbAny.from('leave_types').select('id, name, code, color').eq('is_active', true).order('name');
        leaveTypeOptionsCache = (data ?? []).map((r: any) => ({ id: r.id, name: r.name ?? '', code: r.code ?? '', color: r.color ?? 'blue' }));
      }
      if (active) setRows(leaveTypeOptionsCache ?? []);
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

const PAY_PERIODS = [
  { id: 'PP001', name: 'April 2025', fromDate: '2025-04-01', toDate: '2025-04-30' },
  { id: 'PP002', name: 'May 2025', fromDate: '2025-05-01', toDate: '2025-05-31' },
  { id: 'PP003', name: 'June 2025', fromDate: '2025-06-01', toDate: '2025-06-30' },
  { id: 'PP004', name: 'July 2025', fromDate: '2025-07-01', toDate: '2025-07-31' },
];

const FINANCIAL_YEARS_LIST = [`${CURRENT_YEAR - 1}-${String(CURRENT_YEAR).slice(-2)}`, `${CURRENT_YEAR}-${String(CURRENT_YEAR + 1).slice(-2)}`];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateEmployeeId(prefix: string = 'EMP', existingCount: number = 0): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const seq = String(existingCount + 1).padStart(4, '0');
  return `${prefix}${year}${seq}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string): string {
  if (type.includes('pdf')) return '📄';
  if (type.includes('image')) return '🖼️';
  if (type.includes('word') || type.includes('document')) return '📝';
  return '📎';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function emptyAddress(): Address {
  return { line1: '', line2: '', city: '', district: '', state: '', pincode: '', country: 'India' };
}

function emptyPersonal(): PersonalDetails {
  return {
    firstName: '', middleName: '', lastName: '',
    fatherName: '', motherName: '',
    dateOfBirth: '', placeOfBirth: '', nationality: 'Indian',
    mobile: '', email: '',
    identificationMarks: '', gender: '', maritalStatus: '', anniversaryDate: '',
    bloodGroup: '', religion: '', caste: '', motherTongue: '',
    photo: '', specimenSignature: '', thumbImpression: '',
    presentAddress: emptyAddress(), permanentAddress: emptyAddress(),
    sameAsPresent: false,
  };
}

function emptyPriorWorkExperience(): PriorWorkExperience {
  return {
    id: `PWE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    companyName: '', designation: '', department: '',
    fromDate: '', toDate: '',
    yearsOfExperience: 0, monthsOfExperience: 0,
    reasonForLeaving: '', lastSalary: '',
    referenceName: '', referenceDesignation: '',
    referencePhone: '', referenceEmail: '',
    documents: [],
  };
}

function emptyLanguageProficiency(): LanguageProficiency {
  return {
    id: `LANG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    language: '',
    speak: 'None',
    read: 'None',
    write: 'None',
  };
}

function emptyEmployment(empId: string): EmploymentDetails {
  return {
    employeeId: empId,
    currentEmployeeId: empId,
    serviceBookNo: '',
    attendanceSystemId: '',
    dateOfJoining: '',
    dateOfConfirmation: '',
    probationPeriodMonths: 6,
    designation: '',
    department: '',
    section: '',
    grade: '',
    employeeType: 'Permanent',
    employeeCategory: 'General',
    employeeGroup: 'Technical Staff',
    employeeClassification: 'Employee',
    workLocation: '',
    shift: 'General Shift',
    reportingManagerId: '',
    reportingManagerName: '',
    noticePeriodDays: 30,
    offerLetterValidityDays: 30,
    totalExperienceYears: 0,
    totalExperienceMonths: 0,
    priorWorkExperiences: [],
    languageProficiencies: [
      { id: 'LANG-DEFAULT-1', language: 'English', speak: 'Advanced', read: 'Advanced', write: 'Advanced' },
      { id: 'LANG-DEFAULT-2', language: 'Hindi', speak: 'Intermediate', read: 'Intermediate', write: 'Basic' },
    ],
  };
}

function emptyStatutory(): StatutoryDetails {
  return {
    panNo: '', aadharNo: '', uanNo: '', pfAccountNo: '',
    esiNo: '', passportNo: '', passportExpiry: '',
    drivingLicenseNo: '', drivingLicenseExpiry: '',
    voterIdNo: '', rationCardNo: '', documents: {},
  };
}

function emptyEducation(): EducationRecord {
  return {
    id: `EDU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    qualification: '', specialization: '', institution: '',
    university: '', yearOfPassing: '', percentage: '', grade: '',
    documents: [],
  };
}

function emptyFamilyMember(): FamilyMember {
  return {
    id: `FAM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    relationship: '', name: '', dateOfBirth: '', gender: '',
    occupation: '', phone: '', isDependent: false, isNominee: false,
    nominationPercentage: 0, nominationPurpose: [], documents: [],
  };
}

function emptyBankAccount(): BankAccount {
  return {
    id: `BNK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    bankName: '', accountName: '', accountNumber: '', ifscCode: '',
    branchName: '', branchAddress: '', accountType: 'Savings',
    isPrimary: false, swiftCode: '', micrCode: '', documents: [],
  };
}

function emptyDocuments(): EmployeeDocuments {
  return {
    photo: '', specimenSignature: '', thumbImpression: '',
    offerLetter: [], appointmentLetter: [], experienceCertificates: [],
    relievingLetter: [], educationCertificates: [], idProofs: [],
    addressProofs: [], medicalCertificates: [], otherDocuments: [],
  };
}

function emptyLeaveData(): EmployeeLeaveData {
  return {
    openingBalances: [],
    periodTransactions: [],
    availedRecords: [],
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
  className?: string;
}

const Field = ({ label, required, children, hint, className = '' }: FieldProps) => (
  <div className={className}>
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
  action?: React.ReactNode;
}

const SectionHeader = ({ icon: Icon, title, subtitle, accentColor = 'text-primary', accentBg = 'bg-primary/10', action }: SectionHeaderProps) => (
  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border">
    <div className={`p-2 ${accentBg} rounded-lg shrink-0`}>
      <Icon size={18} className={accentColor} />
    </div>
    <div className="flex-1">
      <h3 className="font-bold text-sm">{title}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// ─── Leave Balance Summary Widget ─────────────────────────────────────────────

interface LeaveBalanceSummaryWidgetProps {
  leaveData: EmployeeLeaveData;
  onNavigateToLeaveTab: () => void;
}

const LeaveBalanceSummaryWidget = ({ leaveData, onNavigateToLeaveTab }: LeaveBalanceSummaryWidgetProps) => {
  // Compute current balance per leave type from period transactions
  const leaveBalanceSummary = useMemo(() => {
    const map = new Map<string, {
      leaveTypeId: string;
      leaveTypeName: string;
      leaveTypeCode: string;
      leaveTypeColor: string;
      totalAccrued: number;
      totalAvailed: number;
      currentBalance: number;
      openingBalance: number;
    }>();

    // Seed from opening balances
    leaveData.openingBalances.forEach(ob => {
      map.set(ob.leaveTypeId, {
        leaveTypeId: ob.leaveTypeId,
        leaveTypeName: ob.leaveTypeName,
        leaveTypeCode: ob.leaveTypeCode,
        leaveTypeColor: ob.leaveTypeColor,
        totalAccrued: 0,
        totalAvailed: 0,
        currentBalance: ob.openingBalance,
        openingBalance: ob.openingBalance,
      });
    });

    // Aggregate period transactions — use the latest closing balance per leave type
    const latestByLeaveType = new Map<string, PeriodLeaveTransaction>();
    leaveData.periodTransactions.forEach(pt => {
      const existing = latestByLeaveType.get(pt.leaveTypeId);
      if (!existing || pt.payPeriodId > existing.payPeriodId) {
        latestByLeaveType.set(pt.leaveTypeId, pt);
      }
    });

    latestByLeaveType.forEach((pt, leaveTypeId) => {
      const totalAccrued = leaveData.periodTransactions
        .filter(t => t.leaveTypeId === leaveTypeId)
        .reduce((s, t) => s + t.accrued, 0);
      const totalAvailed = leaveData.periodTransactions
        .filter(t => t.leaveTypeId === leaveTypeId)
        .reduce((s, t) => s + t.availed, 0);

      const existing = map.get(leaveTypeId);
      map.set(leaveTypeId, {
        leaveTypeId,
        leaveTypeName: pt.leaveTypeName,
        leaveTypeCode: pt.leaveTypeCode,
        leaveTypeColor: pt.leaveTypeColor,
        totalAccrued,
        totalAvailed,
        currentBalance: pt.closingBalance,
        openingBalance: existing?.openingBalance ?? 0,
      });
    });

    return Array.from(map.values());
  }, [leaveData]);

  if (leaveBalanceSummary.length === 0) return null;

  const totalAvailable = leaveBalanceSummary.reduce((s, l) => s + l.currentBalance, 0);
  const totalAvailed = leaveBalanceSummary.reduce((s, l) => s + l.totalAvailed, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-teal-50 to-emerald-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <CalendarDays size={18} className="text-teal-600" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-teal-900">Leave Balance Summary</h3>
            <p className="text-[10px] text-teal-600 mt-0.5">Current available balance · FY {FINANCIAL_YEAR}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-teal-700">{totalAvailable.toFixed(1)}</p>
            <p className="text-[10px] text-teal-600 font-medium">Available</p>
          </div>
          <div className="w-px h-8 bg-teal-200" />
          <div className="text-center">
            <p className="text-lg font-bold text-rose-600">{totalAvailed}</p>
            <p className="text-[10px] text-rose-500 font-medium">Used</p>
          </div>
          <button
            onClick={onNavigateToLeaveTab}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Eye size={12} /> View Details
          </button>
        </div>
      </div>

      {/* Leave Type Balances Grid */}
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {leaveBalanceSummary.map((leave, i) => {
            const colorStyle = getLeaveColor(leave.leaveTypeColor);
            const totalAllocated = leave.openingBalance + leave.totalAccrued;
            const usedPct = totalAllocated > 0 ? Math.min((leave.totalAvailed / totalAllocated) * 100, 100) : 0;
            const availablePct = totalAllocated > 0 ? Math.min((leave.currentBalance / totalAllocated) * 100, 100) : 0;
            const isLow = availablePct < 25 && totalAllocated > 0;
            const isEmpty = leave.currentBalance === 0;

            return (
              <motion.div
                key={leave.leaveTypeId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isEmpty
                    ? 'bg-gray-50 border-gray-200'
                    : isLow
                    ? 'bg-amber-50 border-amber-200'
                    : `${colorStyle.light} ${colorStyle.border}`
                }`}
              >
                {/* Leave Type Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>
                      {leave.leaveTypeCode}
                    </span>
                  </div>
                  {isLow && !isEmpty && (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <AlertCircle size={8} /> Low
                    </span>
                  )}
                  {isEmpty && (
                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full">
                      Nil
                    </span>
                  )}
                </div>

                {/* Leave Type Name */}
                <p className={`text-xs font-semibold mb-1 truncate ${isEmpty ? 'text-gray-500' : colorStyle.text}`}>
                  {leave.leaveTypeName}
                </p>

                {/* Balance Display */}
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className={`text-2xl font-bold leading-none ${isEmpty ? 'text-gray-400' : colorStyle.text}`}>
                      {leave.currentBalance % 1 === 0 ? leave.currentBalance : leave.currentBalance.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">days available</p>
                  </div>
                  {leave.totalAvailed > 0 && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-rose-500">{leave.totalAvailed}</p>
                      <p className="text-[10px] text-muted-foreground">used</p>
                    </div>
                  )}
                </div>

                {/* Progress Bar — Used vs Available */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden border border-white/50 shadow-inner">
                    {totalAllocated > 0 ? (
                      <div className="h-full flex rounded-full overflow-hidden">
                        {/* Used portion */}
                        {usedPct > 0 && (
                          <div
                            className="h-full bg-rose-400 transition-all duration-500"
                            style={{ width: `${usedPct}%` }}
                          />
                        )}
                        {/* Available portion */}
                        {availablePct > 0 && (
                          <div
                            className={`h-full ${colorStyle.bar} transition-all duration-500`}
                            style={{ width: `${availablePct}%` }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="h-full bg-gray-200 rounded-full" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                      {leave.totalAvailed}d used
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${colorStyle.dot} inline-block`} />
                      {leave.currentBalance % 1 === 0 ? leave.currentBalance : leave.currentBalance.toFixed(1)}d avail.
                    </span>
                  </div>
                </div>

                {/* Accrued this year */}
                {leave.totalAccrued > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/50">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <TrendingUp size={9} className="text-emerald-500" />
                      +{leave.totalAccrued}d accrued this FY
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-3 h-2 rounded-sm bg-rose-400 inline-block" />
            Used days
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-3 h-2 rounded-sm bg-teal-500 inline-block" />
            Available days
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
            <AlertCircle size={10} />
            Low balance (&lt;25% remaining)
          </div>
          <button
            onClick={onNavigateToLeaveTab}
            className="ml-auto text-[10px] font-semibold text-teal-600 hover:underline flex items-center gap-1"
          >
            <CalendarDays size={10} /> View full leave ledger →
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Doc Upload Zone ──────────────────────────────────────────────────────────

interface DocUploadZoneProps {
  label: string;
  /** Unique key for this upload zone within the employee (e.g. sub-record id). */
  zoneKey: string;
  compact?: boolean;
}

// Backed by Supabase Storage (private `documents` bucket) + the `documents` table.
// Files are saved securely, viewed via short-lived signed URLs, and Aadhaar-eSignable.
const DocUploadZone = ({ label, zoneKey, compact }: DocUploadZoneProps) => {
  const signer = useContext(SignerContext);
  return (
    <SecureDocUploadZone
      entityType="employee"
      entityRef={`${signer.id || 'unsaved'}/${zoneKey}`}
      label={label}
      signerName={signer.name}
      signerId={signer.id}
      compact={compact}
    />
  );
};

// ─── Image Upload Zone ────────────────────────────────────────────────────────

interface ImageUploadZoneProps {
  label: string;
  hint: string;
  dataUrl: string;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
  icon: React.ElementType;
  accentBg?: string;
  accentColor?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Optional: receive the raw File too (e.g. to upload the photo to storage). */
  onFile?: (file: File) => void;
}

const ImageUploadZone = ({ label, hint, dataUrl, onUpload, onRemove, icon: Icon, accentBg = 'bg-primary/10', accentColor = 'text-primary', size = 'md', onFile }: ImageUploadZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => { onUpload(e.target?.result as string); toast.success(`${label} uploaded.`); };
    reader.readAsDataURL(file);
    onFile?.(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const sizeMap = { sm: 'w-20 h-20', md: 'w-28 h-28', lg: 'w-36 h-36' };

  if (dataUrl) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={`${sizeMap[size]} rounded-xl border-2 border-primary/30 bg-white shadow-md overflow-hidden relative group`}>
          <img src={dataUrl} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-1">
              <button onClick={() => inputRef.current?.click()} className="p-1.5 bg-white rounded-lg shadow text-xs font-semibold hover:bg-gray-100 transition-colors">
                <Camera size={12} />
              </button>
              <button onClick={onRemove} className="p-1.5 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-colors">
                <Trash size={12} />
              </button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">{label}</p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`${sizeMap[size]} rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
          dragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/40 hover:bg-accent/30'
        }`}
      >
        <div className={`p-2 ${accentBg} rounded-lg`}>
          <Icon size={size === 'sm' ? 14 : size === 'md' ? 18 : 22} className={accentColor} />
        </div>
        <p className="text-[10px] text-muted-foreground text-center px-2">{hint}</p>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">{label}</p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
    </div>
  );
};

// Employee photo zone — uploads the photo to the PRIVATE employee-photos bucket,
// stores the object path on employees.photo_url, primes the avatar cache, and
// resolves a short-lived signed URL for the form preview.
const PhotoUploadZone = ({ dataUrl, onUpload, onRemove }: { dataUrl: string; onUpload: (url: string) => void; onRemove: () => void }) => {
  const signer = useContext(SignerContext);
  const handleFile = async (file: File) => {
    const { path, error } = await uploadEmployeePhoto(signer.id || 'unsaved', file);
    if (error || !path) { toast.error(`Photo upload failed: ${error ?? 'unknown error'}`); return; }
    if (signer.id) { void updateEmployeePhotoUrl(signer.id, path); primeEmployeePhoto(signer.id, path); }
    const signed = await resolvePhotoUrl(path);
    if (signed) onUpload(signed); // swap the base64 preview for the secure URL
    toast.success('Photo uploaded & saved securely.');
  };
  return (
    <ImageUploadZone
      label="Employee Photo" hint="Upload Photo" dataUrl={dataUrl}
      onUpload={onUpload} onRemove={onRemove} onFile={file => void handleFile(file)}
      icon={Camera} accentBg="bg-violet-100" accentColor="text-violet-600" size="lg"
    />
  );
};

// ─── Toggle Switch ────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

const ToggleSwitch = ({ value, onChange, label, description }: ToggleSwitchProps) => (
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

// ─── Address Block ────────────────────────────────────────────────────────────

interface AddressBlockProps {
  label: string;
  address: Address;
  onChange: (addr: Address) => void;
  accentBg?: string;
  accentBorder?: string;
}

const AddressBlock = ({ label, address, onChange, accentBg = 'bg-accent/30', accentBorder = 'border-border' }: AddressBlockProps) => (
  <div className={`p-4 rounded-xl border ${accentBg} ${accentBorder} space-y-3`}>
    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
      <Home size={13} /> {label}
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="md:col-span-2">
        <Field label="Address Line 1">
          <input type="text" className={inputCls} placeholder="House / Flat No., Building, Street" value={address.line1} onChange={e => onChange({ ...address, line1: e.target.value })} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Address Line 2">
          <input type="text" className={inputCls} placeholder="Area, Locality, Landmark" value={address.line2} onChange={e => onChange({ ...address, line2: e.target.value })} />
        </Field>
      </div>
      <Field label="City">
        <input type="text" className={inputCls} placeholder="City" value={address.city} onChange={e => onChange({ ...address, city: e.target.value })} />
      </Field>
      <Field label="District">
        <input type="text" className={inputCls} placeholder="District" value={address.district} onChange={e => onChange({ ...address, district: e.target.value })} />
      </Field>
      <Field label="State">
        <select className={selectCls} value={address.state} onChange={e => onChange({ ...address, state: e.target.value })}>
          <option value="">— Select State —</option>
          {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="PIN Code">
        <input type="text" className={inputCls} placeholder="6-digit PIN" maxLength={6} value={address.pincode} onChange={e => onChange({ ...address, pincode: e.target.value.replace(/\D/g, '') })} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Country">
          <input type="text" className={inputCls} value={address.country} onChange={e => onChange({ ...address, country: e.target.value })} />
        </Field>
      </div>
    </div>
  </div>
);

// ─── Reporting Manager Selector ───────────────────────────────────────────────

interface ReportingManagerSelectorProps {
  selectedId: string;
  selectedName: string;
  onSelect: (id: string, name: string) => void;
  currentEmployeeId?: string;
}

const ReportingManagerSelector = ({ selectedId, selectedName, onSelect, currentEmployeeId }: ReportingManagerSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showOrgChart, setShowOrgChart] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const EMPLOYEE_LIST = useEmployeeList();

  const filtered = useMemo(() =>
    EMPLOYEE_LIST.filter(e =>
      e.id !== currentEmployeeId &&
      (e.name.toLowerCase().includes(search.toLowerCase()) ||
       e.designation.toLowerCase().includes(search.toLowerCase()) ||
       e.department.toLowerCase().includes(search.toLowerCase()) ||
       e.employeeId.toLowerCase().includes(search.toLowerCase()))
    ),
    [search, currentEmployeeId, EMPLOYEE_LIST]
  );

  const selectedEmployee = EMPLOYEE_LIST.find(e => e.id === selectedId);

  const buildOrgTree = (parentId: string | null, depth: number = 0): React.ReactNode => {
    const children = EMPLOYEE_LIST.filter(e => e.reportingManagerId === parentId && e.id !== currentEmployeeId);
    if (children.length === 0) return null;
    return (
      <div className={depth > 0 ? 'ml-5 border-l-2 border-border pl-3' : ''}>
        {children.map(emp => (
          <div key={emp.id}>
            <button
              onClick={() => { onSelect(emp.id, emp.name); setOpen(false); setShowOrgChart(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-primary/5 group mb-1 ${selectedId === emp.id ? 'bg-primary/10 border border-primary/20' : ''}`}
            >
              <EmployeeAvatar employeeCode={emp.employeeId} initials={emp.avatar} name={emp.name} size={32} rounded="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{emp.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{emp.designation} · {emp.department}</p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded shrink-0">{emp.employeeId}</span>
              {selectedId === emp.id && <CheckCircle2 size={14} className="text-primary shrink-0" />}
            </button>
            {buildOrgTree(emp.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
          open ? 'border-primary bg-primary/5' : 'border-border bg-accent/50 hover:border-primary/40'
        }`}
      >
        {selectedEmployee ? (
          <>
            <EmployeeAvatar employeeCode={selectedEmployee.employeeId} initials={selectedEmployee.avatar} name={selectedEmployee.name} size={32} rounded="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{selectedEmployee.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{selectedEmployee.designation} · {selectedEmployee.department}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onSelect('', ''); }}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <User size={16} className="text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground flex-1">Select Reporting Manager</span>
            <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-border space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, designation, department..."
                  className="w-full pl-8 pr-4 py-2 bg-accent/50 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOrgChart(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!showOrgChart ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  <Users size={12} /> List View
                </button>
                <button
                  onClick={() => setShowOrgChart(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${showOrgChart ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  <Network size={12} /> Org Structure
                </button>
                {selectedId && (
                  <button
                    onClick={() => { onSelect('', ''); setOpen(false); }}
                    className="ml-auto flex items-center gap-1 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <X size={11} /> Clear
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {!showOrgChart ? (
                <>
                  {filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <User size={24} className="mx-auto mb-2 opacity-40" />
                      No employees found
                    </div>
                  ) : (
                    filtered.map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => { onSelect(emp.id, emp.name); setOpen(false); setSearch(''); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-primary/5 mb-1 ${selectedId === emp.id ? 'bg-primary/10 border border-primary/20' : ''}`}
                      >
                        <EmployeeAvatar employeeCode={emp.employeeId} initials={emp.avatar} name={emp.name} size={32} rounded="lg" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{emp.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{emp.designation} · {emp.department}</p>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded shrink-0">{emp.employeeId}</span>
                        {selectedId === emp.id && <CheckCircle2 size={14} className="text-primary shrink-0" />}
                      </button>
                    ))
                  )}
                </>
              ) : (
                <div className="p-2">
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <Network size={14} className="text-primary" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Organisation Hierarchy</span>
                  </div>
                  {buildOrgTree(null)}
                </div>
              )}
            </div>

            <div className="px-3 py-2 border-t border-border bg-accent/20">
              <p className="text-[10px] text-muted-foreground">{EMPLOYEE_LIST.filter(e => e.id !== currentEmployeeId).length} employees available</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Proficiency Badge ────────────────────────────────────────────────────────

interface ProficiencyBadgeProps {
  level: ProficiencyLevel;
  onClick: () => void;
}

const ProficiencyBadge = ({ level, onClick }: ProficiencyBadgeProps) => {
  const style = PROFICIENCY_COLORS[level];
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:opacity-80 hover:scale-105 ${style.bg} ${style.text} ${style.border}`}
    >
      {level}
    </button>
  );
};

// ─── Language Proficiency Row ─────────────────────────────────────────────────

interface LanguageProficiencyRowProps {
  record: LanguageProficiency;
  index: number;
  onUpdate: (updates: Partial<LanguageProficiency>) => void;
  onRemove: () => void;
}

const LanguageProficiencyRow = ({ record, index, onUpdate, onRemove }: LanguageProficiencyRowProps) => {
  const cycleProficiency = (current: ProficiencyLevel): ProficiencyLevel => {
    const idx = PROFICIENCY_LEVELS.indexOf(current);
    return PROFICIENCY_LEVELS[(idx + 1) % PROFICIENCY_LEVELS.length];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="grid grid-cols-12 gap-3 items-center p-3 bg-accent/30 rounded-xl border border-border hover:bg-accent/50 transition-colors group"
    >
      <div className="col-span-3">
        <select
          className="w-full p-2.5 bg-white border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none"
          value={record.language}
          onChange={e => onUpdate({ language: e.target.value })}
        >
          <option value="">— Select Language —</option>
          {COMMON_LANGUAGES.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>
      <div className="col-span-2 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          <Volume2 size={10} /> Speak
        </div>
        <ProficiencyBadge level={record.speak} onClick={() => onUpdate({ speak: cycleProficiency(record.speak) })} />
      </div>
      <div className="col-span-2 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          <BookOpenCheck size={10} /> Read
        </div>
        <ProficiencyBadge level={record.read} onClick={() => onUpdate({ read: cycleProficiency(record.read) })} />
      </div>
      <div className="col-span-2 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          <PenLine size={10} /> Write
        </div>
        <ProficiencyBadge level={record.write} onClick={() => onUpdate({ write: cycleProficiency(record.write) })} />
      </div>
      <div className="col-span-2 flex items-center justify-center">
        {record.language && (record.speak !== 'None' || record.read !== 'None' || record.write !== 'None') ? (
          <span className="text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 size={9} /> Set
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>
      <div className="col-span-1 flex justify-end">
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Tab: Personal Details ────────────────────────────────────────────────────

interface PersonalTabProps {
  data: PersonalDetails;
  onChange: (data: PersonalDetails) => void;
  employeeId?: string | null;
}

const PersonalTab = ({ data, onChange }: PersonalTabProps) => {
  const handleDocUpload = (field: 'photo' | 'specimenSignature' | 'thumbImpression', dataUrl: string) => {
    onChange({ ...data, [field]: dataUrl });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Camera} title="Photo, Signature & Thumb Impression" subtitle="Upload employee photo, specimen signature, and thumb impression" accentColor="text-violet-600" accentBg="bg-violet-100" />
        <div className="flex items-start gap-8 flex-wrap">
          <PhotoUploadZone dataUrl={data.photo} onUpload={url => onChange({ ...data, photo: url })} onRemove={() => onChange({ ...data, photo: '' })} />
          <ImageUploadZone label="Specimen Signature" hint="Upload Signature" dataUrl={data.specimenSignature} onUpload={url => handleDocUpload('specimenSignature', url)} onRemove={() => onChange({ ...data, specimenSignature: '' })} icon={FileText} accentBg="bg-blue-100" accentColor="text-blue-600" size="md" />
          <ImageUploadZone label="Thumb Impression" hint="Upload Thumb" dataUrl={data.thumbImpression} onUpload={url => handleDocUpload('thumbImpression', url)} onRemove={() => onChange({ ...data, thumbImpression: '' })} icon={Fingerprint} accentBg="bg-emerald-100" accentColor="text-emerald-600" size="md" />
          <div className="flex-1 min-w-[200px]">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 space-y-1">
                  <p className="font-semibold">Upload Guidelines</p>
                  <p>• Photo: Passport size, white background, max 2 MB</p>
                  <p>• Signature: Clear scan on white paper, max 2 MB</p>
                  <p>• Thumb: Clear impression on white paper, max 2 MB</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={User} title="Personal Information" subtitle="Full name, date of birth, and personal details" accentColor="text-blue-600" accentBg="bg-blue-100" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="First Name" required>
            <input type="text" className={inputCls} placeholder="First name" value={data.firstName} onChange={e => onChange({ ...data, firstName: e.target.value })} />
          </Field>
          <Field label="Middle Name">
            <input type="text" className={inputCls} placeholder="Middle name" value={data.middleName} onChange={e => onChange({ ...data, middleName: e.target.value })} />
          </Field>
          <Field label="Last Name / Surname" required>
            <input type="text" className={inputCls} placeholder="Last name / Surname" value={data.lastName} onChange={e => onChange({ ...data, lastName: e.target.value })} />
          </Field>
          <Field label="Father's Name">
            <input type="text" className={inputCls} placeholder="Father's full name" value={data.fatherName} onChange={e => onChange({ ...data, fatherName: e.target.value })} />
          </Field>
          <Field label="Mother's Name">
            <input type="text" className={inputCls} placeholder="Mother's full name" value={data.motherName} onChange={e => onChange({ ...data, motherName: e.target.value })} />
          </Field>
          <Field label="Date of Birth" required>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <DateInput className={`${inputCls} pl-9`} value={data.dateOfBirth} onChange={e => onChange({ ...data, dateOfBirth: e.target.value })} />
            </div>
          </Field>
          <Field label="Place of Birth">
            <input type="text" className={inputCls} placeholder="City, State, Country" value={data.placeOfBirth} onChange={e => onChange({ ...data, placeOfBirth: e.target.value })} />
          </Field>
          <Field label="Mobile Number" hint="Employee contact number">
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="tel" className={`${inputCls} pl-9`} placeholder="+91 98765 43210" value={data.mobile} onChange={e => onChange({ ...data, mobile: e.target.value })} />
            </div>
          </Field>
          <Field label="Email">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" className={`${inputCls} pl-9`} placeholder="name@company.com" value={data.email} onChange={e => onChange({ ...data, email: e.target.value })} />
            </div>
          </Field>
          <Field label="Nationality" required>
            <select className={selectCls} value={data.nationality} onChange={e => onChange({ ...data, nationality: e.target.value })}>
              {NATIONALITIES.map(n => <option key={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Gender" required>
            <select className={selectCls} value={data.gender} onChange={e => onChange({ ...data, gender: e.target.value })}>
              <option value="">— Select Gender —</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
              <option>Prefer not to say</option>
            </select>
          </Field>
          <Field label="Marital Status">
            <select className={selectCls} value={data.maritalStatus} onChange={e => onChange({ ...data, maritalStatus: e.target.value })}>
              <option value="">— Select —</option>
              <option>Single</option>
              <option>Married</option>
              <option>Divorced</option>
              <option>Widowed</option>
              <option>Separated</option>
            </select>
          </Field>
          {data.maritalStatus === 'Married' && (
            <Field label="Anniversary Date" hint="Used to send anniversary greetings">
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <DateInput className={`${inputCls} pl-9`} value={data.anniversaryDate} onChange={e => onChange({ ...data, anniversaryDate: e.target.value })} />
              </div>
            </Field>
          )}
          <Field label="Blood Group">
            <select className={selectCls} value={data.bloodGroup} onChange={e => onChange({ ...data, bloodGroup: e.target.value })}>
              <option value="">— Select —</option>
              {BLOOD_GROUPS.map(bg => <option key={bg}>{bg}</option>)}
            </select>
          </Field>
          <Field label="Religion">
            <select className={selectCls} value={data.religion} onChange={e => onChange({ ...data, religion: e.target.value })}>
              <option value="">— Select —</option>
              <option>Hindu</option>
              <option>Muslim</option>
              <option>Christian</option>
              <option>Sikh</option>
              <option>Buddhist</option>
              <option>Jain</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Caste / Community">
            <input type="text" className={inputCls} placeholder="Caste or community" value={data.caste} onChange={e => onChange({ ...data, caste: e.target.value })} />
          </Field>
          <Field label="Mother Tongue">
            <input type="text" className={inputCls} placeholder="e.g. Hindi, Marathi, Tamil" value={data.motherTongue} onChange={e => onChange({ ...data, motherTongue: e.target.value })} />
          </Field>
          <div className="md:col-span-3">
            <Field label="Identification Marks">
              <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Describe any visible identification marks..." value={data.identificationMarks} onChange={e => onChange({ ...data, identificationMarks: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={MapPin} title="Address Details" subtitle="Present and permanent residential address" accentColor="text-emerald-600" accentBg="bg-emerald-100" />
        <div className="space-y-4">
          <AddressBlock
            label="Present Address"
            address={data.presentAddress}
            onChange={addr => {
              const updates: Partial<PersonalDetails> = { presentAddress: addr };
              if (data.sameAsPresent) updates.permanentAddress = addr;
              onChange({ ...data, ...updates });
            }}
            accentBg="bg-blue-50"
            accentBorder="border-blue-200"
          />
          <div className="flex items-center gap-3 px-4 py-3 bg-accent/30 rounded-xl border border-border">
            <ToggleSwitch
              value={data.sameAsPresent}
              onChange={v => onChange({ ...data, sameAsPresent: v, permanentAddress: v ? data.presentAddress : data.permanentAddress })}
              label="Permanent address is same as present address"
            />
          </div>
          {!data.sameAsPresent && (
            <AddressBlock
              label="Permanent Address"
              address={data.permanentAddress}
              onChange={addr => onChange({ ...data, permanentAddress: addr })}
              accentBg="bg-emerald-50"
              accentBorder="border-emerald-200"
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Prior Work Experience Card ───────────────────────────────────────────────

interface PriorWorkExperienceCardProps {
  record: PriorWorkExperience;
  index: number;
  onUpdate: (updates: Partial<PriorWorkExperience>) => void;
  onRemove: () => void;
}

const PriorWorkExperienceCard = ({ record, index, onUpdate, onRemove }: PriorWorkExperienceCardProps) => {
  const [expanded, setExpanded] = useState(true);

  const handleDocUpload = (files: FileList) => {
    const newDocs: UploadedDoc[] = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB limit.`); processed++; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({ id: `PWE-DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, uploadedAt: todayFormatted(), dataUrl: e.target?.result as string });
        processed++;
        if (processed === files.length) { onUpdate({ documents: [...record.documents, ...newDocs] }); if (newDocs.length > 0) toast.success(`${newDocs.length} document(s) uploaded.`); }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs">{index + 1}</div>
          <span className="font-bold text-sm text-amber-800">{record.companyName || 'New Work Experience'}</span>
          {record.designation && <span className="text-xs text-amber-600">— {record.designation}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-600 transition-colors">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Company Name" required>
                  <input type="text" className={inputCls} placeholder="Previous company name" value={record.companyName} onChange={e => onUpdate({ companyName: e.target.value })} />
                </Field>
                <Field label="Designation" required>
                  <input type="text" className={inputCls} placeholder="e.g. Software Engineer" value={record.designation} onChange={e => onUpdate({ designation: e.target.value })} />
                </Field>
                <Field label="Department">
                  <input type="text" className={inputCls} placeholder="e.g. Engineering" value={record.department} onChange={e => onUpdate({ department: e.target.value })} />
                </Field>
                <Field label="From Date" required>
                  <DateInput className={inputCls} value={record.fromDate} onChange={e => onUpdate({ fromDate: e.target.value })} />
                </Field>
                <Field label="To Date" required>
                  <DateInput className={inputCls} value={record.toDate} onChange={e => onUpdate({ toDate: e.target.value })} />
                </Field>
                <Field label="Reason for Leaving">
                  <select className={selectCls} value={record.reasonForLeaving} onChange={e => onUpdate({ reasonForLeaving: e.target.value })}>
                    <option value="">— Select Reason —</option>
                    {REASON_FOR_LEAVING.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>
              <div className="pt-3 border-t border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Experience Documents</p>
                <DocUploadZone label="Experience Certificate / Relieving Letter" zoneKey={`exp-${record.id}`} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Tab: Employment Details ──────────────────────────────────────────────────

interface EmploymentTabProps {
  data: EmploymentDetails;
  onChange: (data: EmploymentDetails) => void;
  onRegenerateId: () => void;
}

const EmploymentTab = ({ data, onChange, onRegenerateId }: EmploymentTabProps) => {
  // Option lists sourced live from the DB master tables (no hardcoded values).
  const designations = useMaster('designations');
  const allDepartments = useDepartmentsList();
  const grades = useMaster('employee_grades');
  const employeeTypes = useMaster('employee_types');
  const employeeCategories = useMaster('employee_categories');
  const employeeGroups = useMaster('employee_groups');
  const classifications = useMaster('employee_classifications');
  const workLocations = useMaster('work_locations');
  const shifts = useMaster('shifts');

  // Departments are scoped to the chosen work location (location → department).
  const selectedLocationId = workLocations.find(l => l.name === data.workLocation)?.id ?? null;
  const departments = useMemo(
    () => (selectedLocationId ? allDepartments.filter(d => d.location_id === selectedLocationId) : []),
    [allDepartments, selectedLocationId],
  );

  // Picking a work location resets the department (it belongs to that location).
  const onWorkLocationChange = (name: string) => {
    onChange({ ...data, workLocation: name, department: '' });
  };

  const addPriorExperience = () => onChange({ ...data, priorWorkExperiences: [...data.priorWorkExperiences, emptyPriorWorkExperience()] });
  const updatePriorExperience = (id: string, updates: Partial<PriorWorkExperience>) => onChange({ ...data, priorWorkExperiences: data.priorWorkExperiences.map(e => e.id === id ? { ...e, ...updates } : e) });
  const removePriorExperience = (id: string) => { onChange({ ...data, priorWorkExperiences: data.priorWorkExperiences.filter(e => e.id !== id) }); toast.info('Work experience record removed.'); };
  const addLanguage = () => onChange({ ...data, languageProficiencies: [...data.languageProficiencies, emptyLanguageProficiency()] });
  const updateLanguage = (id: string, updates: Partial<LanguageProficiency>) => onChange({ ...data, languageProficiencies: data.languageProficiencies.map(l => l.id === id ? { ...l, ...updates } : l) });
  const removeLanguage = (id: string) => { onChange({ ...data, languageProficiencies: data.languageProficiencies.filter(l => l.id !== id) }); toast.info('Language removed.'); };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Hash} title="Employee ID Configuration" subtitle="Automatic and manual employee ID settings" accentColor="text-indigo-600" accentBg="bg-indigo-100" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Auto-Generated Employee ID" hint="System-generated unique employee identifier">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" className={`${inputCls} pl-9 font-mono bg-green-50 border-green-200 text-green-800 font-bold`} value={data.employeeId} readOnly />
              </div>
              <button onClick={onRegenerateId} className="p-3 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-colors" title="Regenerate ID">
                <RefreshCw size={16} />
              </button>
              <button onClick={() => { navigator.clipboard.writeText(data.employeeId); toast.success('Employee ID copied!'); }} className="p-3 bg-accent text-muted-foreground rounded-xl hover:bg-accent/80 transition-colors" title="Copy ID">
                <Copy size={16} />
              </button>
            </div>
          </Field>
          <Field label="Current / Override Employee ID">
            <input type="text" className={`${inputCls} font-mono`} placeholder="e.g. EMP2024001" value={data.currentEmployeeId} onChange={e => onChange({ ...data, currentEmployeeId: e.target.value })} />
          </Field>
          <Field label="Service Book No.">
            <input type="text" className={`${inputCls} font-mono`} placeholder="e.g. SB/2024/001" value={data.serviceBookNo} onChange={e => onChange({ ...data, serviceBookNo: e.target.value })} />
          </Field>
          <Field label="Attendance Entry System ID" hint="Device / biometric enrollment ID used to map attendance punch logs to this employee">
            <div className="relative">
              <Fingerprint size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" className={`${inputCls} pl-9 font-mono`} placeholder="e.g. 1001 / BIO-0457" value={data.attendanceSystemId} onChange={e => onChange({ ...data, attendanceSystemId: e.target.value })} />
            </div>
          </Field>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Calendar} title="Joining & Confirmation Details" accentColor="text-blue-600" accentBg="bg-blue-100" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Date of Joining" required>
            <DateInput className={inputCls} value={data.dateOfJoining} onChange={e => onChange({ ...data, dateOfJoining: e.target.value })} />
          </Field>
          <Field label="Probation Period (Months)">
            <input type="number" className={inputCls} min={0} max={24} value={data.probationPeriodMonths} onChange={e => onChange({ ...data, probationPeriodMonths: parseInt(e.target.value) || 0 })} />
          </Field>
          <Field label="Date of Confirmation">
            <DateInput className={inputCls} value={data.dateOfConfirmation} onChange={e => onChange({ ...data, dateOfConfirmation: e.target.value })} />
          </Field>
          <Field label="Notice Period (Days)">
            <input type="number" className={inputCls} min={0} max={180} value={data.noticePeriodDays} onChange={e => onChange({ ...data, noticePeriodDays: parseInt(e.target.value) || 0 })} />
          </Field>
          <Field label="Offer Letter Validity (Days)">
            <input type="number" className={inputCls} min={1} max={365} value={data.offerLetterValidityDays} onChange={e => onChange({ ...data, offerLetterValidityDays: parseInt(e.target.value) || 30 })} />
          </Field>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Briefcase} title="Work Location & Position" subtitle="Position the employee into a work location, then a department within it, then the rest of the role details." accentColor="text-violet-600" accentBg="bg-violet-100" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Work Location" required hint="Select the location the employee is posted to first">
            <select className={selectCls} value={data.workLocation} onChange={e => onWorkLocationChange(e.target.value)}>
              <option value="">— Select Location —</option>
              {workLocations.map(l => <option key={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Department" required hint={data.workLocation ? 'Departments within the selected location' : 'Select a work location first'}>
            <select
              className={selectCls}
              value={data.department}
              disabled={!data.workLocation}
              onChange={e => onChange({ ...data, department: e.target.value })}
            >
              <option value="">
                {!data.workLocation ? '— Select a work location first —' : departments.length ? '— Select Department —' : '— No departments in this location —'}
              </option>
              {departments.map(d => <option key={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Section / Sub-Department">
            <input type="text" className={inputCls} placeholder="e.g. Frontend Dev" value={data.section} onChange={e => onChange({ ...data, section: e.target.value })} />
          </Field>
          <Field label="Designation" required>
            <select className={selectCls} value={data.designation} onChange={e => onChange({ ...data, designation: e.target.value })}>
              <option value="">— Select Designation —</option>
              {designations.map(d => <option key={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Grade">
            <select className={selectCls} value={data.grade} onChange={e => onChange({ ...data, grade: e.target.value })}>
              <option value="">— Select Grade —</option>
              {grades.map(g => <option key={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Employee Type" required>
            <select className={selectCls} value={data.employeeType} onChange={e => onChange({ ...data, employeeType: e.target.value })}>
              <option value="">— Select Type —</option>
              {employeeTypes.map(t => <option key={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Employee Category">
            <select className={selectCls} value={data.employeeCategory} onChange={e => onChange({ ...data, employeeCategory: e.target.value })}>
              <option value="">— Select Category —</option>
              {employeeCategories.map(c => <option key={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Employee Group">
            <select className={selectCls} value={data.employeeGroup} onChange={e => onChange({ ...data, employeeGroup: e.target.value })}>
              <option value="">— Select Group —</option>
              {employeeGroups.map(g => <option key={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Employee Classification" required hint="Statutory labour-law classification of the engagement">
            <select className={selectCls} value={data.employeeClassification} onChange={e => onChange({ ...data, employeeClassification: e.target.value })}>
              <option value="">— Select Classification —</option>
              {classifications.map(c => <option key={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Shift">
            <select className={selectCls} value={data.shift} onChange={e => onChange({ ...data, shift: e.target.value })}>
              <option value="">— Select Shift —</option>
              {shifts.map(s => <option key={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-5 pt-5 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-100 rounded-lg"><Network size={16} className="text-indigo-600" /></div>
            <div>
              <h4 className="font-bold text-sm">Reporting Manager</h4>
              <p className="text-[10px] text-muted-foreground">Select from the employee list</p>
            </div>
          </div>
          <ReportingManagerSelector
            selectedId={data.reportingManagerId}
            selectedName={data.reportingManagerName}
            onSelect={(id, name) => onChange({ ...data, reportingManagerId: id, reportingManagerName: name })}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader
          icon={Languages}
          title="Language Proficiency"
          subtitle="Add languages known with proficiency levels. Click a badge to cycle through levels."
          accentColor="text-teal-600"
          accentBg="bg-teal-100"
          action={
            <button onClick={addLanguage} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-xs font-semibold shadow-sm">
              <Plus size={14} /> Add Language
            </button>
          }
        />
        {data.languageProficiencies.length === 0 ? (
          <div className="text-center py-10 bg-accent/20 rounded-xl border-2 border-dashed border-border">
            <Languages size={22} className="text-teal-600 mx-auto mb-2" />
            <p className="font-semibold text-muted-foreground text-sm">No languages added</p>
            <button onClick={addLanguage} className="mt-3 flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium mx-auto shadow-sm">
              <Plus size={15} /> Add Language
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {data.languageProficiencies.map((lang, i) => (
              <LanguageProficiencyRow key={lang.id} record={lang} index={i} onUpdate={updates => updateLanguage(lang.id, updates)} onRemove={() => removeLanguage(lang.id)} />
            ))}
            <button onClick={addLanguage} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 border-2 border-dashed border-teal-300 text-teal-700 rounded-xl hover:bg-teal-50 transition-colors text-sm font-medium mt-2">
              <Plus size={15} /> Add Another Language
            </button>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader
          icon={Building2}
          title="Prior Work Experience"
          subtitle="Add all previous employment records with reference details"
          accentColor="text-amber-600"
          accentBg="bg-amber-100"
          action={
            <button onClick={addPriorExperience} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-xs font-semibold shadow-sm">
              <Plus size={14} /> Add Experience
            </button>
          }
        />
        {data.priorWorkExperiences.length === 0 ? (
          <div className="text-center py-12 bg-accent/20 rounded-xl border-2 border-dashed border-border">
            <Building2 size={24} className="text-amber-600 mx-auto mb-2" />
            <p className="font-semibold text-muted-foreground">No prior work experience added</p>
            <button onClick={addPriorExperience} className="mt-3 flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium mx-auto shadow-sm">
              <Plus size={15} /> Add Work Experience
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {data.priorWorkExperiences.map((exp, i) => (
              <PriorWorkExperienceCard key={exp.id} record={exp} index={i} onUpdate={updates => updatePriorExperience(exp.id, updates)} onRemove={() => removePriorExperience(exp.id)} />
            ))}
            <button onClick={addPriorExperience} className="w-full flex items-center justify-center gap-2 px-5 py-3 border-2 border-dashed border-amber-300 text-amber-700 rounded-xl hover:bg-amber-50 transition-colors text-sm font-medium">
              <Plus size={15} /> Add Another Work Experience
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Statutory Details ───────────────────────────────────────────────────

interface StatutoryTabProps {
  data: StatutoryDetails;
  onChange: (data: StatutoryDetails) => void;
}

const STATUTORY_FIELDS_CONFIG = [
  { key: 'panNo', label: 'PAN No.', placeholder: 'e.g. ABCDE1234F', icon: Receipt, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', description: 'Permanent Account Number — Income Tax', maxLength: 10, docLabel: 'PAN Card Copy', uppercase: true },
  { key: 'aadharNo', label: 'Aadhaar No.', placeholder: 'e.g. 1234 5678 9012', icon: IdCard, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', description: 'Unique Identification Authority of India', maxLength: 14, docLabel: 'Aadhaar Card Copy', uppercase: false },
  { key: 'uanNo', label: 'UAN No.', placeholder: 'e.g. 100123456789', icon: BadgeCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', description: 'Universal Account Number — EPFO', maxLength: 12, docLabel: 'UAN Card / EPF Passbook', uppercase: false },
  { key: 'pfAccountNo', label: 'PF Account No.', placeholder: 'e.g. MH/BAN/0012345/000/0000001', icon: Shield, color: 'text-teal-600', bgColor: 'bg-teal-50 border-teal-200', description: 'Provident Fund Account Number', docLabel: 'PF Account Statement', uppercase: true },
  { key: 'esiNo', label: 'ESI No.', placeholder: 'e.g. 41-00-123456-000-0001', icon: Stethoscope, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200', description: 'Employee State Insurance Number', docLabel: 'ESI Card Copy', uppercase: false },
  { key: 'passportNo', label: 'Passport No.', placeholder: 'e.g. A1234567', icon: Globe, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', description: 'Passport Number', maxLength: 8, docLabel: 'Passport Copy', uppercase: true },
  { key: 'drivingLicenseNo', label: 'Driving License No.', placeholder: 'e.g. MH01 20110012345', icon: Navigation, color: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-200', description: 'Driving License Number', docLabel: 'Driving License Copy', uppercase: true },
  { key: 'voterIdNo', label: 'Voter ID No.', placeholder: 'e.g. ABC1234567', icon: Flag, color: 'text-rose-600', bgColor: 'bg-rose-50 border-rose-200', description: 'Election Commission Voter ID', maxLength: 10, docLabel: 'Voter ID Card Copy', uppercase: true },
  { key: 'rationCardNo', label: 'Ration Card No.', placeholder: 'e.g. MH-123456789', icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200', description: 'Ration Card Number', docLabel: 'Ration Card Copy', uppercase: false },
];

const StatutoryTab = ({ data, onChange }: StatutoryTabProps) => {
  const handleUpload = (fieldKey: string, files: FileList) => {
    const newDocs: UploadedDoc[] = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB limit.`); processed++; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({ id: `${fieldKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, uploadedAt: todayFormatted(), dataUrl: e.target?.result as string });
        processed++;
        if (processed === files.length) {
          const updatedDocs = { ...data.documents, [fieldKey]: [...(data.documents[fieldKey] ?? []), ...newDocs] };
          onChange({ ...data, documents: updatedDocs });
          if (newDocs.length > 0) toast.success(`${newDocs.length} document(s) uploaded.`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSign = (fieldKey: string, docId: string, sig: SignatureData) => {
    const updatedDocs = { ...data.documents, [fieldKey]: (data.documents[fieldKey] ?? []).map(d => d.id === docId ? { ...d, signature: sig } : d) };
    onChange({ ...data, documents: updatedDocs });
  };

  const handleRemove = (fieldKey: string, docId: string) => {
    const updatedDocs = { ...data.documents, [fieldKey]: (data.documents[fieldKey] ?? []).filter(d => d.id !== docId) };
    onChange({ ...data, documents: updatedDocs });
    toast.info('Document removed.');
  };

  const filledCount = STATUTORY_FIELDS_CONFIG.filter(f => (data as any)[f.key]?.toString().trim()).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm"><Shield size={18} className="text-rose-600" /></div>
          <div>
            <p className="font-bold text-sm text-rose-800">Statutory & Identity Documents</p>
            <p className="text-xs text-rose-700">Government-issued identification and statutory registration numbers</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-rose-700">{filledCount}/{STATUTORY_FIELDS_CONFIG.length}</p>
          <p className="text-[10px] text-rose-600">Fields filled</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {STATUTORY_FIELDS_CONFIG.map(field => {
          const Icon = field.icon;
          const fieldDocs = data.documents[field.key] ?? [];
          const fieldValue = (data as any)[field.key] as string;
          const hasExpiry = field.key === 'passportNo' || field.key === 'drivingLicenseNo';
          const expiryKey = field.key === 'passportNo' ? 'passportExpiry' : 'drivingLicenseExpiry';
          const expiryValue = (data as any)[expiryKey] as string;

          return (
            <motion.div key={field.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`p-5 rounded-xl border-2 ${field.bgColor} transition-all`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg shadow-sm"><Icon size={18} className={field.color} /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">{field.label}</h3>
                    {fieldValue?.trim() && <CheckCircle2 size={14} className="text-green-500" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{field.description}</p>
                </div>
              </div>
              <div className={`grid ${hasExpiry ? 'grid-cols-2 gap-3' : 'grid-cols-1'}`}>
                <input
                  type="text"
                  className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono shadow-sm transition-all"
                  placeholder={field.placeholder}
                  maxLength={(field as any).maxLength}
                  value={fieldValue ?? ''}
                  onChange={e => {
                    const val = field.uppercase ? e.target.value.toUpperCase() : e.target.value;
                    onChange({ ...data, [field.key]: val });
                  }}
                />
                {hasExpiry && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Expiry Date</p>
                    <DateInput className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all" value={expiryValue ?? ''} onChange={e => onChange({ ...data, [expiryKey]: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="mt-3">
                <DocUploadZone label={field.docLabel} zoneKey={`stat-${field.key}`} compact />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tab: Education ───────────────────────────────────────────────────────────

interface EducationTabProps {
  data: EducationRecord[];
  onChange: (data: EducationRecord[]) => void;
}

const EducationTab = ({ data, onChange }: EducationTabProps) => {
  const addRecord = () => onChange([...data, emptyEducation()]);
  const updateRecord = (id: string, updates: Partial<EducationRecord>) => onChange(data.map(r => r.id === id ? { ...r, ...updates } : r));
  const removeRecord = (id: string) => { onChange(data.filter(r => r.id !== id)); toast.info('Education record removed.'); };

  const handleDocUpload = (id: string, files: FileList) => {
    const newDocs: UploadedDoc[] = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB limit.`); processed++; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({ id: `EDU-DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, uploadedAt: todayFormatted(), dataUrl: e.target?.result as string });
        processed++;
        if (processed === files.length) { const rec = data.find(r => r.id === id); if (rec) updateRecord(id, { documents: [...rec.documents, ...newDocs] }); if (newDocs.length > 0) toast.success(`${newDocs.length} document(s) uploaded.`); }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex-1 mr-4">
          <div className="p-2 bg-white rounded-lg shadow-sm"><GraduationCap size={18} className="text-indigo-600" /></div>
          <div>
            <p className="font-bold text-sm text-indigo-800">Educational Qualifications</p>
            <p className="text-xs text-indigo-700">Add all educational qualifications from SSC to highest degree.</p>
          </div>
          <span className="text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full ml-auto">{data.length} record{data.length !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={addRecord} className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity shadow-md text-sm font-medium whitespace-nowrap">
          <Plus size={16} /> Add Qualification
        </button>
      </div>

      {data.length === 0 && (
        <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
          <GraduationCap size={28} className="text-indigo-600 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No educational qualifications added</p>
          <button onClick={addRecord} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto">
            <Plus size={15} /> Add Qualification
          </button>
        </div>
      )}

      <div className="space-y-4">
        {data.map((rec, i) => (
          <motion.div key={rec.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 border-b border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">{i + 1}</div>
                <span className="font-bold text-sm text-indigo-800">{rec.qualification || 'New Qualification'}</span>
                {rec.institution && <span className="text-xs text-indigo-600">— {rec.institution}</span>}
              </div>
              <button onClick={() => removeRecord(rec.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Qualification" required>
                  <select className={selectCls} value={rec.qualification} onChange={e => updateRecord(rec.id, { qualification: e.target.value })}>
                    <option value="">— Select —</option>
                    {QUALIFICATIONS.map(q => <option key={q}>{q}</option>)}
                  </select>
                </Field>
                <Field label="Specialization / Stream">
                  <input type="text" className={inputCls} placeholder="e.g. Computer Science" value={rec.specialization} onChange={e => updateRecord(rec.id, { specialization: e.target.value })} />
                </Field>
                <Field label="Year of Passing" required>
                  <input type="text" className={inputCls} placeholder="e.g. 2020" maxLength={4} value={rec.yearOfPassing} onChange={e => updateRecord(rec.id, { yearOfPassing: e.target.value.replace(/\D/g, '') })} />
                </Field>
                <Field label="Institution / College" required>
                  <input type="text" className={inputCls} placeholder="College / School name" value={rec.institution} onChange={e => updateRecord(rec.id, { institution: e.target.value })} />
                </Field>
                <Field label="University / Board">
                  <input type="text" className={inputCls} placeholder="University or Board name" value={rec.university} onChange={e => updateRecord(rec.id, { university: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Percentage / CGPA">
                    <input type="text" className={inputCls} placeholder="e.g. 85.5%" value={rec.percentage} onChange={e => updateRecord(rec.id, { percentage: e.target.value })} />
                  </Field>
                  <Field label="Grade / Class">
                    <select className={selectCls} value={rec.grade} onChange={e => updateRecord(rec.id, { grade: e.target.value })}>
                      <option value="">— Select —</option>
                      <option>Distinction</option>
                      <option>First Class</option>
                      <option>Second Class</option>
                      <option>Pass Class</option>
                    </select>
                  </Field>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Education Certificates</p>
                <DocUploadZone label="Degree / Certificate / Marksheet" zoneKey={`edu-${rec.id}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── Tab: Family Details ──────────────────────────────────────────────────────

interface FamilyTabProps {
  data: FamilyMember[];
  onChange: (data: FamilyMember[]) => void;
}

const FamilyTab = ({ data, onChange }: FamilyTabProps) => {
  const addMember = () => onChange([...data, emptyFamilyMember()]);
  const updateMember = (id: string, updates: Partial<FamilyMember>) => onChange(data.map(m => m.id === id ? { ...m, ...updates } : m));
  const removeMember = (id: string) => { onChange(data.filter(m => m.id !== id)); toast.info('Family member removed.'); };

  const handleDocUpload = (id: string, files: FileList) => {
    const newDocs: UploadedDoc[] = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB limit.`); processed++; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({ id: `FAM-DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, uploadedAt: todayFormatted(), dataUrl: e.target?.result as string });
        processed++;
        if (processed === files.length) { const member = data.find(m => m.id === id); if (member) updateMember(id, { documents: [...member.documents, ...newDocs] }); if (newDocs.length > 0) toast.success(`${newDocs.length} document(s) uploaded.`); }
      };
      reader.readAsDataURL(file);
    });
  };

  const totalNominationPct = data.filter(m => m.isNominee).reduce((s, m) => s + m.nominationPercentage, 0);
  const nominees = data.filter(m => m.isNominee);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl flex-1 mr-4">
          <div className="p-2 bg-white rounded-lg shadow-sm"><Users size={18} className="text-rose-600" /></div>
          <div>
            <p className="font-bold text-sm text-rose-800">Family Details & Nomination</p>
            <p className="text-xs text-rose-700">Add family members, mark dependents, and configure nominations.</p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-[10px] font-bold bg-white text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">{data.length} member{data.length !== 1 ? 's' : ''}</span>
            <span className="text-[10px] font-bold bg-white text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{nominees.length} nominee{nominees.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button onClick={addMember} className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity shadow-md text-sm font-medium whitespace-nowrap">
          <Plus size={16} /> Add Member
        </button>
      </div>

      {nominees.length > 0 && (
        <div className={`p-4 rounded-xl border-2 ${totalNominationPct === 100 ? 'bg-green-50 border-green-200' : totalNominationPct > 100 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`font-bold text-sm mb-2 ${totalNominationPct === 100 ? 'text-green-800' : totalNominationPct > 100 ? 'text-red-800' : 'text-amber-800'}`}>
            Nomination Summary — Total: {totalNominationPct}%
          </p>
          <div className="flex flex-wrap gap-2">
            {nominees.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-border text-xs">
                <span className="font-semibold">{m.name || 'Unnamed'}</span>
                <span className="text-muted-foreground">({m.relationship})</span>
                <span className="font-bold text-primary">{m.nominationPercentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 && (
        <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
          <Users size={28} className="text-rose-600 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No family members added</p>
          <button onClick={addMember} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto">
            <Plus size={15} /> Add Family Member
          </button>
        </div>
      )}

      <div className="space-y-4">
        {data.map((member, i) => (
          <motion.div key={member.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-rose-50 border-b border-rose-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 font-bold text-xs">{i + 1}</div>
                <span className="font-bold text-sm text-rose-800">{member.name || 'New Family Member'}</span>
                {member.relationship && <span className="text-xs text-rose-600">— {member.relationship}</span>}
                {member.isNominee && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">{member.nominationPercentage}% Nominee</span>}
              </div>
              <button onClick={() => removeMember(member.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Relationship" required>
                  <select className={selectCls} value={member.relationship} onChange={e => updateMember(member.id, { relationship: e.target.value })}>
                    <option value="">— Select —</option>
                    {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Full Name" required>
                  <input type="text" className={inputCls} placeholder="Full name" value={member.name} onChange={e => updateMember(member.id, { name: e.target.value })} />
                </Field>
                <Field label="Date of Birth">
                  <DateInput className={inputCls} value={member.dateOfBirth} onChange={e => updateMember(member.id, { dateOfBirth: e.target.value })} />
                </Field>
                <Field label="Gender">
                  <select className={selectCls} value={member.gender} onChange={e => updateMember(member.id, { gender: e.target.value })}>
                    <option value="">— Select —</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Occupation">
                  <input type="text" className={inputCls} placeholder="e.g. Student, Homemaker" value={member.occupation} onChange={e => updateMember(member.id, { occupation: e.target.value })} />
                </Field>
                <Field label="Phone Number">
                  <input type="tel" className={inputCls} placeholder="+91 98765 43210" value={member.phone} onChange={e => updateMember(member.id, { phone: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-accent/30 rounded-xl border border-border">
                <ToggleSwitch value={member.isDependent} onChange={v => updateMember(member.id, { isDependent: v })} label="Dependent" description="Financially dependent on the employee" />
                <ToggleSwitch value={member.isNominee} onChange={v => updateMember(member.id, { isNominee: v, nominationPercentage: v ? member.nominationPercentage : 0 })} label="Nominee" description="Nominee for statutory benefits" />
              </div>
              {member.isNominee && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nomination Percentage (%)" required>
                      <input type="number" className="w-full p-3 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-300 text-sm shadow-sm transition-all" min={0} max={100} value={member.nominationPercentage} onChange={e => updateMember(member.id, { nominationPercentage: parseInt(e.target.value) || 0 })} />
                    </Field>
                    <div>
                      <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Nomination Purpose</label>
                      <div className="flex flex-wrap gap-2">
                        {NOMINATION_PURPOSES.map(purpose => {
                          const isSelected = member.nominationPurpose.includes(purpose);
                          return (
                            <button key={purpose} onClick={() => { const updated = isSelected ? member.nominationPurpose.filter(p => p !== purpose) : [...member.nominationPurpose, purpose]; updateMember(member.id, { nominationPurpose: updated }); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isSelected ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}>
                              {purpose}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="pt-3 border-t border-border">
                <DocUploadZone label="Birth Certificate / Relationship Proof" zoneKey={`fam-${member.id}`} compact />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── Tab: Bank Details ────────────────────────────────────────────────────────

interface BankTabProps {
  data: BankAccount[];
  onChange: (data: BankAccount[]) => void;
}

const BankTab = ({ data, onChange }: BankTabProps) => {
  const addAccount = () => { const newAcc = emptyBankAccount(); if (data.length === 0) newAcc.isPrimary = true; onChange([...data, newAcc]); };
  const updateAccount = (id: string, updates: Partial<BankAccount>) => onChange(data.map(a => a.id === id ? { ...a, ...updates } : a));
  const removeAccount = (id: string) => { const acc = data.find(a => a.id === id); if (acc?.isPrimary && data.length > 1) { toast.error('Cannot delete primary account.'); return; } onChange(data.filter(a => a.id !== id)); toast.info('Bank account removed.'); };
  const setPrimary = (id: string) => { onChange(data.map(a => ({ ...a, isPrimary: a.id === id }))); toast.success('Primary account updated.'); };

  const handleDocUpload = (id: string, files: FileList) => {
    const newDocs: UploadedDoc[] = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB limit.`); processed++; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({ id: `BNK-DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, uploadedAt: todayFormatted(), dataUrl: e.target?.result as string });
        processed++;
        if (processed === files.length) { const acc = data.find(a => a.id === id); if (acc) updateAccount(id, { documents: [...acc.documents, ...newDocs] }); if (newDocs.length > 0) toast.success(`${newDocs.length} document(s) uploaded.`); }
      };
      reader.readAsDataURL(file);
    });
  };

  const primaryAccount = data.find(a => a.isPrimary);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl flex-1 mr-4">
          <div className="p-2 bg-white rounded-lg shadow-sm"><Banknote size={18} className="text-blue-600" /></div>
          <div>
            <p className="font-bold text-sm text-blue-800">Bank Account Details</p>
            <p className="text-xs text-blue-700">Add bank accounts for salary disbursement. Mark one as primary for payroll.</p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-[10px] font-bold bg-white text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{data.length} account{data.length !== 1 ? 's' : ''}</span>
            {primaryAccount && <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={9} /> {primaryAccount.bankName || 'Primary set'}</span>}
          </div>
        </div>
        <button onClick={addAccount} className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity shadow-md text-sm font-medium whitespace-nowrap">
          <Plus size={16} /> Add Account
        </button>
      </div>

      {data.length === 0 && (
        <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
          <Banknote size={28} className="text-blue-600 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No bank accounts added</p>
          <button onClick={addAccount} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto">
            <Plus size={15} /> Add Bank Account
          </button>
        </div>
      )}

      <div className="space-y-4">
        {data.map((acc, i) => (
          <motion.div key={acc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`bg-card rounded-xl border-2 shadow-sm overflow-hidden ${acc.isPrimary ? 'border-primary' : 'border-border'}`}>
            <div className={`h-1.5 w-full ${acc.isPrimary ? 'bg-primary' : 'bg-border'}`} />
            <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">{i + 1}</div>
                <span className="font-bold text-sm text-blue-800">{acc.bankName || 'New Bank Account'}</span>
                {acc.isPrimary && <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">Primary</span>}
              </div>
              <div className="flex items-center gap-2">
                {!acc.isPrimary && <button onClick={() => setPrimary(acc.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary border border-primary/20 transition-colors"><CheckCircle2 size={12} /> Set Primary</button>}
                <button onClick={() => removeAccount(acc.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Bank Name" required>
                  <input type="text" className={inputCls} placeholder="e.g. HDFC Bank" value={acc.bankName} onChange={e => updateAccount(acc.id, { bankName: e.target.value })} />
                </Field>
                <Field label="Account Type" required>
                  <select className={selectCls} value={acc.accountType} onChange={e => updateAccount(acc.id, { accountType: e.target.value })}>
                    {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Account Name" required>
                  <input type="text" className={inputCls} placeholder="Account holder name" value={acc.accountName} onChange={e => updateAccount(acc.id, { accountName: e.target.value })} />
                </Field>
                <Field label="Account Number" required>
                  <input type="text" className={`${inputCls} font-mono`} placeholder="e.g. 50200012345678" value={acc.accountNumber} onChange={e => updateAccount(acc.id, { accountNumber: e.target.value })} />
                </Field>
                <Field label="IFSC Code" required>
                  <input type="text" className={`${inputCls} font-mono uppercase`} placeholder="e.g. HDFC0001234" maxLength={11} value={acc.ifscCode} onChange={e => updateAccount(acc.id, { ifscCode: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Branch Name">
                  <input type="text" className={inputCls} placeholder="e.g. Andheri West Branch" value={acc.branchName} onChange={e => updateAccount(acc.id, { branchName: e.target.value })} />
                </Field>
              </div>
              <div className="pt-3 border-t border-border">
                <DocUploadZone label="Cancelled Cheque / Passbook" zoneKey={`bank-${acc.id}`} compact />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── Tab: Documents ───────────────────────────────────────────────────────────

interface DocumentsTabProps {
  data: EmployeeDocuments;
  onChange: (data: EmployeeDocuments) => void;
}

const DOCUMENT_CATEGORIES = [
  { key: 'offerLetter', label: 'Offer Letter', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', desc: 'Original offer letter from current employer' },
  { key: 'appointmentLetter', label: 'Appointment Letter', icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: 'Appointment / joining letter' },
  { key: 'experienceCertificates', label: 'Experience Certificates', icon: Briefcase, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', desc: 'Experience certificates from previous employers' },
  { key: 'relievingLetter', label: 'Relieving Letter', icon: UserCheck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', desc: 'Relieving letter from previous employer' },
  { key: 'educationCertificates', label: 'Education Certificates', icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', desc: 'Degree certificates, marksheets, and transcripts' },
  { key: 'idProofs', label: 'ID Proofs', icon: IdCard, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', desc: 'Aadhaar, PAN, Passport, Voter ID, Driving License' },
  { key: 'addressProofs', label: 'Address Proofs', icon: Home, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', desc: 'Utility bills, bank statement, Aadhaar, Passport' },
  { key: 'medicalCertificates', label: 'Medical Certificates', icon: Stethoscope, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', desc: 'Pre-employment medical fitness certificate' },
  { key: 'otherDocuments', label: 'Other Documents', icon: Paperclip, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', desc: 'Any other relevant documents' },
];

const DocumentsTab = ({ data, onChange }: DocumentsTabProps) => {
  const handleUpload = (fieldKey: string, files: FileList) => {
    const newDocs: UploadedDoc[] = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB limit.`); processed++; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({ id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, uploadedAt: todayFormatted(), dataUrl: e.target?.result as string });
        processed++;
        if (processed === files.length) { const existing = (data as any)[fieldKey] as UploadedDoc[]; onChange({ ...data, [fieldKey]: [...existing, ...newDocs] }); if (newDocs.length > 0) toast.success(`${newDocs.length} document(s) uploaded.`); }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemove = (fieldKey: string, docId: string) => {
    const existing = (data as any)[fieldKey] as UploadedDoc[];
    onChange({ ...data, [fieldKey]: existing.filter((d: UploadedDoc) => d.id !== docId) });
    toast.info('Document removed.');
  };

  const handleSign = (fieldKey: string, docId: string, sig: SignatureData) => {
    const existing = (data as any)[fieldKey] as UploadedDoc[];
    onChange({ ...data, [fieldKey]: existing.map((d: UploadedDoc) => d.id === docId ? { ...d, signature: sig } : d) });
  };

  const totalDocs = DOCUMENT_CATEGORIES.reduce((s, cat) => s + ((data as any)[cat.key] as UploadedDoc[]).length, 0);

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Camera} title="Photo, Signature & Thumb Impression" accentColor="text-violet-600" accentBg="bg-violet-100" />
        <div className="flex items-start gap-8 flex-wrap">
          <PhotoUploadZone dataUrl={data.photo} onUpload={url => onChange({ ...data, photo: url })} onRemove={() => onChange({ ...data, photo: '' })} />
          <ImageUploadZone label="Specimen Signature" hint="Upload Signature" dataUrl={data.specimenSignature} onUpload={url => onChange({ ...data, specimenSignature: url })} onRemove={() => onChange({ ...data, specimenSignature: '' })} icon={FileText} accentBg="bg-blue-100" accentColor="text-blue-600" size="md" />
          <ImageUploadZone label="Thumb Impression" hint="Upload Thumb" dataUrl={data.thumbImpression} onUpload={url => onChange({ ...data, thumbImpression: url })} onRemove={() => onChange({ ...data, thumbImpression: '' })} icon={Fingerprint} accentBg="bg-emerald-100" accentColor="text-emerald-600" size="md" />
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
        <div className="p-2 bg-white rounded-lg shadow-sm"><FileText size={18} className="text-indigo-600" /></div>
        <div>
          <p className="font-bold text-sm text-indigo-800">Employee Documents Repository</p>
          <p className="text-xs text-indigo-700">{totalDocs} document{totalDocs !== 1 ? 's' : ''} uploaded so far.</p>
        </div>
        <span className="ml-auto text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">{totalDocs} files</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DOCUMENT_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const docs = (data as any)[cat.key] as UploadedDoc[];
          return (
            <div key={cat.key} className={`p-5 rounded-xl border-2 ${cat.bg} ${cat.border}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg shadow-sm"><Icon size={16} className={cat.color} /></div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{cat.label}</p>
                  <p className="text-[10px] text-muted-foreground">{cat.desc}</p>
                </div>
                {docs.length > 0 && <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-border text-muted-foreground">{docs.length} file{docs.length > 1 ? 's' : ''}</span>}
              </div>
              <DocUploadZone label={cat.label} zoneKey={`doc-${cat.key}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tab: Leave Balances ──────────────────────────────────────────────────────

type LeaveBalanceSubTab = 'opening' | 'period-wise' | 'availed';

interface LeaveBalancesTabProps {
  data: EmployeeLeaveData;
  onChange: (data: EmployeeLeaveData) => void;
  employeeName: string;
  leaveTypeOptions: LeaveTypeOption[];
}

const LeaveBalancesTab = ({ data, onChange, employeeName, leaveTypeOptions }: LeaveBalancesTabProps) => {
  const [activeSubTab, setActiveSubTab] = useState<LeaveBalanceSubTab>('opening');
  const [selectedFY, setSelectedFY] = useState(FINANCIAL_YEAR);
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState('All');
  const [selectedLeaveTypeFilter, setSelectedLeaveTypeFilter] = useState('All');
  const [openingModal, setOpeningModal] = useState(false);
  const [editingOpening, setEditingOpening] = useState<LeaveOpeningBalance | null>(null);
  const [openingForm, setOpeningForm] = useState<Omit<LeaveOpeningBalance, 'id'>>({
    leaveTypeId: '', leaveTypeName: '', leaveTypeCode: '', leaveTypeColor: 'blue',
    financialYear: FINANCIAL_YEAR, openingBalance: 0, remarks: '',
  });

  const openAddOpening = () => {
    setEditingOpening(null);
    setOpeningForm({ leaveTypeId: '', leaveTypeName: '', leaveTypeCode: '', leaveTypeColor: 'blue', financialYear: selectedFY, openingBalance: 0, remarks: '' });
    setOpeningModal(true);
  };

  const openEditOpening = (ob: LeaveOpeningBalance) => {
    setEditingOpening(ob);
    setOpeningForm({ leaveTypeId: ob.leaveTypeId, leaveTypeName: ob.leaveTypeName, leaveTypeCode: ob.leaveTypeCode, leaveTypeColor: ob.leaveTypeColor, financialYear: ob.financialYear, openingBalance: ob.openingBalance, remarks: ob.remarks });
    setOpeningModal(true);
  };

  const saveOpening = () => {
    if (!openingForm.leaveTypeId) { toast.error('Please select a leave type.'); return; }
    const alreadyExists = data.openingBalances.some(ob =>
      ob.leaveTypeId === openingForm.leaveTypeId &&
      ob.financialYear === openingForm.financialYear &&
      (editingOpening ? ob.id !== editingOpening.id : true)
    );
    if (alreadyExists) { toast.error('Opening balance for this leave type and financial year already exists.'); return; }

    if (editingOpening) {
      onChange({ ...data, openingBalances: data.openingBalances.map(ob => ob.id === editingOpening.id ? { ...ob, ...openingForm } : ob) });
      toast.success('Opening balance updated.');
    } else {
      const newOB: LeaveOpeningBalance = { ...openingForm, id: `OB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      onChange({ ...data, openingBalances: [...data.openingBalances, newOB] });
      toast.success('Opening balance added.');
    }
    setOpeningModal(false);
  };

  const deleteOpening = (id: string) => {
    onChange({ ...data, openingBalances: data.openingBalances.filter(ob => ob.id !== id) });
    toast.info('Opening balance removed.');
  };

  const handleLeaveTypeSelect = (ltId: string) => {
    const lt = leaveTypeOptions.find(l => l.id === ltId);
    if (lt) {
      setOpeningForm(f => ({ ...f, leaveTypeId: lt.id, leaveTypeName: lt.name, leaveTypeCode: lt.code, leaveTypeColor: lt.color }));
    }
  };

  const filteredOpeningBalances = data.openingBalances.filter(ob => ob.financialYear === selectedFY);

  const filteredPeriodTransactions = useMemo(() => {
    return data.periodTransactions.filter(pt => {
      const matchFY = pt.financialYear === selectedFY;
      const matchPeriod = selectedPeriodFilter === 'All' || pt.payPeriodId === selectedPeriodFilter;
      const matchLeaveType = selectedLeaveTypeFilter === 'All' || pt.leaveTypeId === selectedLeaveTypeFilter;
      return matchFY && matchPeriod && matchLeaveType;
    });
  }, [data.periodTransactions, selectedFY, selectedPeriodFilter, selectedLeaveTypeFilter]);

  const filteredAvailedRecords = useMemo(() => {
    return data.availedRecords.filter(ar => {
      const matchPeriod = selectedPeriodFilter === 'All' || ar.payPeriodId === selectedPeriodFilter;
      const matchLeaveType = selectedLeaveTypeFilter === 'All' || ar.leaveTypeId === selectedLeaveTypeFilter;
      return matchPeriod && matchLeaveType;
    });
  }, [data.availedRecords, selectedPeriodFilter, selectedLeaveTypeFilter]);

  const totalOpeningBalance = filteredOpeningBalances.reduce((s, ob) => s + ob.openingBalance, 0);
  const totalAccrued = filteredPeriodTransactions.reduce((s, pt) => s + pt.accrued, 0);
  const totalAvailed = filteredPeriodTransactions.reduce((s, pt) => s + pt.availed, 0);

  const uniqueLeaveTypesInPeriod = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string; code: string; color: string }[] = [];
    data.periodTransactions.forEach(pt => {
      if (!seen.has(pt.leaveTypeId)) {
        seen.add(pt.leaveTypeId);
        result.push({ id: pt.leaveTypeId, name: pt.leaveTypeName, code: pt.leaveTypeCode, color: pt.leaveTypeColor });
      }
    });
    return result;
  }, [data.periodTransactions]);

  const periodSummaryByLeaveType = useMemo(() => {
    const map = new Map<string, { leaveTypeId: string; leaveTypeName: string; leaveTypeCode: string; leaveTypeColor: string; totalAccrued: number; totalAvailed: number; currentBalance: number }>();
    filteredPeriodTransactions.forEach(pt => {
      const existing = map.get(pt.leaveTypeId);
      if (existing) {
        existing.totalAccrued += pt.accrued;
        existing.totalAvailed += pt.availed;
        existing.currentBalance = pt.closingBalance;
      } else {
        map.set(pt.leaveTypeId, {
          leaveTypeId: pt.leaveTypeId,
          leaveTypeName: pt.leaveTypeName,
          leaveTypeCode: pt.leaveTypeCode,
          leaveTypeColor: pt.leaveTypeColor,
          totalAccrued: pt.accrued,
          totalAvailed: pt.availed,
          currentBalance: pt.closingBalance,
        });
      }
    });
    return Array.from(map.values());
  }, [filteredPeriodTransactions]);

  const subTabs: { key: LeaveBalanceSubTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'opening', label: 'Opening Balance', icon: Wallet, count: filteredOpeningBalances.length },
    { key: 'period-wise', label: 'Period-wise Allotment & Availment', icon: BarChart3, count: filteredPeriodTransactions.length },
    { key: 'availed', label: 'Leaves Availed (Pay Period Wise)', icon: CalendarDays, count: filteredAvailedRecords.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl">
        <div className="p-3 bg-white rounded-xl shadow-sm">
          <CalendarDays size={24} className="text-teal-600" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-base text-teal-900">Leave Balance Summary</h2>
          <p className="text-xs text-teal-700 mt-0.5">
            {employeeName ? `Leave opening balance, period-wise allotment, availment, and closing balance for ${employeeName}.` : 'Leave opening balance, period-wise allotment, availment, and closing balance.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold text-teal-700 uppercase tracking-wide mb-1">Financial Year</label>
            <select
              className="px-3 py-2 bg-white border border-teal-300 rounded-lg outline-none text-sm font-semibold text-teal-800 appearance-none"
              value={selectedFY}
              onChange={e => setSelectedFY(e.target.value)}
            >
              {FINANCIAL_YEARS_LIST.map(fy => <option key={fy}>{fy}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Opening Balance', value: totalOpeningBalance, sub: 'Total days', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Wallet },
          { label: 'Total Accrued', value: totalAccrued, sub: `FY ${selectedFY}`, color: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: TrendingUp },
          { label: 'Total Availed', value: totalAvailed, sub: `FY ${selectedFY}`, color: 'bg-rose-100', iconColor: 'text-rose-600', icon: TrendingDown },
          { label: 'Current Balance', value: (totalOpeningBalance + totalAccrued - totalAvailed).toFixed(1), sub: 'Available days', color: 'bg-teal-100', iconColor: 'text-teal-600', icon: BarChart3 },
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

      <div className="flex items-center gap-0.5 bg-accent/50 p-1 rounded-xl overflow-x-auto">
        {subTabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex-1 justify-center ${isActive ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <TabIcon size={14} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeSubTab === 'opening' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Opening balance represents the leave days carried forward from the previous financial year or manually set at the beginning of the year. These are the starting balances before any accrual or availment in FY <strong>{selectedFY}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">
                  Opening Balances — FY {selectedFY}
                </h3>
                <button
                  onClick={openAddOpening}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-semibold shadow-sm"
                >
                  <Plus size={13} /> Add Opening Balance
                </button>
              </div>

              {filteredOpeningBalances.length === 0 ? (
                <div className="text-center py-12 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Wallet size={22} className="text-blue-600" />
                  </div>
                  <p className="font-semibold text-muted-foreground text-sm">No opening balances for FY {selectedFY}</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Add opening balances for each leave type</p>
                  <button onClick={openAddOpening} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium mx-auto">
                    <Plus size={15} /> Add Opening Balance
                  </button>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">Leave Type</th>
                          <th className="px-4 py-3 font-semibold">Financial Year</th>
                          <th className="px-4 py-3 font-semibold text-center">Opening Balance (Days)</th>
                          <th className="px-4 py-3 font-semibold">Remarks</th>
                          <th className="px-4 py-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredOpeningBalances.map((ob, i) => {
                          const colorStyle = getLeaveColor(ob.leaveTypeColor);
                          return (
                            <motion.tr key={ob.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors group">
                              <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{i + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>{ob.leaveTypeCode}</span>
                                  <span className="font-semibold text-sm">{ob.leaveTypeName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground font-medium">FY {ob.financialYear}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-lg font-bold text-blue-600">{ob.openingBalance}</span>
                                <span className="text-xs text-muted-foreground ml-1">days</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{ob.remarks || '—'}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEditOpening(ob)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => deleteOpening(ob.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-accent/30 border-t-2 border-border">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Opening Balance</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-lg font-bold text-blue-700">{totalOpeningBalance}</span>
                            <span className="text-xs text-muted-foreground ml-1">days</span>
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'period-wise' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700">
                  Period-wise view shows the leave balance movement for each pay period — opening balance, accrued days, availed days, and closing balance per leave type.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Pay Period</label>
                  <select className="px-3 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={selectedPeriodFilter} onChange={e => setSelectedPeriodFilter(e.target.value)}>
                    <option value="All">All Periods</option>
                    {PAY_PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Leave Type</label>
                  <select className="px-3 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={selectedLeaveTypeFilter} onChange={e => setSelectedLeaveTypeFilter(e.target.value)}>
                    <option value="All">All Leave Types</option>
                    {uniqueLeaveTypesInPeriod.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                  </select>
                </div>
                <div className="ml-auto text-xs text-muted-foreground self-end pb-2">{filteredPeriodTransactions.length} records</div>
              </div>

              {periodSummaryByLeaveType.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {periodSummaryByLeaveType.map(summary => {
                    const colorStyle = getLeaveColor(summary.leaveTypeColor);
                    return (
                      <motion.div key={summary.leaveTypeId} whileHover={{ y: -2 }} className={`p-4 rounded-xl border-2 ${colorStyle.light} ${colorStyle.border}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>{summary.leaveTypeCode}</span>
                          <span className="font-bold text-sm">{summary.leaveTypeName}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Accrued</p>
                            <p className={`text-base font-bold ${colorStyle.text}`}>{summary.totalAccrued}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Availed</p>
                            <p className="text-base font-bold text-rose-600">{summary.totalAvailed}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Balance</p>
                            <p className="text-base font-bold text-emerald-600">{summary.currentBalance}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {filteredPeriodTransactions.length === 0 ? (
                <div className="text-center py-12 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <BarChart3 size={28} className="text-emerald-600 mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground text-sm">No period-wise transactions found</p>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Pay Period</th>
                          <th className="px-4 py-3 font-semibold">Leave Type</th>
                          <th className="px-4 py-3 font-semibold text-center">Opening</th>
                          <th className="px-4 py-3 font-semibold text-center text-emerald-700">Accrued</th>
                          <th className="px-4 py-3 font-semibold text-center text-rose-700">Availed</th>
                          <th className="px-4 py-3 font-semibold text-center text-amber-700">Encashed</th>
                          <th className="px-4 py-3 font-semibold text-center text-gray-500">Lapsed</th>
                          <th className="px-4 py-3 font-semibold text-center text-blue-700">Closing</th>
                          <th className="px-4 py-3 font-semibold">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredPeriodTransactions.map((pt, i) => {
                          const colorStyle = getLeaveColor(pt.leaveTypeColor);
                          return (
                            <motion.tr key={pt.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Clock size={13} className="text-muted-foreground shrink-0" />
                                  <span className="text-sm font-semibold">{pt.payPeriodName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>{pt.leaveTypeCode}</span>
                                  <span className="text-sm font-medium">{pt.leaveTypeName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-sm">{pt.openingBalance}</td>
                              <td className="px-4 py-3 text-center">
                                {pt.accrued > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600">
                                    <TrendingUp size={12} /> +{pt.accrued}
                                  </span>
                                ) : <span className="text-muted-foreground text-sm">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {pt.availed > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-sm font-bold text-rose-600">
                                    <TrendingDown size={12} /> -{pt.availed}
                                  </span>
                                ) : <span className="text-muted-foreground text-sm">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {pt.encashed > 0 ? <span className="text-sm font-bold text-amber-600">-{pt.encashed}</span> : <span className="text-muted-foreground text-sm">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {pt.lapsed > 0 ? <span className="text-sm font-bold text-gray-500">-{pt.lapsed}</span> : <span className="text-muted-foreground text-sm">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${pt.closingBalance > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {pt.closingBalance}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{pt.remarks || '—'}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'availed' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <Info size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700">
                  This section shows all approved leave requests grouped by pay period.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Pay Period</label>
                  <select className="px-3 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={selectedPeriodFilter} onChange={e => setSelectedPeriodFilter(e.target.value)}>
                    <option value="All">All Periods</option>
                    {PAY_PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Leave Type</label>
                  <select className="px-3 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={selectedLeaveTypeFilter} onChange={e => setSelectedLeaveTypeFilter(e.target.value)}>
                    <option value="All">All Leave Types</option>
                    {uniqueLeaveTypesInPeriod.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                  </select>
                </div>
                <div className="ml-auto text-xs text-muted-foreground self-end pb-2">{filteredAvailedRecords.length} records · {filteredAvailedRecords.reduce((s, r) => s + r.days, 0)} days total</div>
              </div>

              {filteredAvailedRecords.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Records', value: filteredAvailedRecords.length, color: 'bg-rose-100', textColor: 'text-rose-700' },
                    { label: 'Total Days Availed', value: filteredAvailedRecords.reduce((s, r) => s + r.days, 0), color: 'bg-amber-100', textColor: 'text-amber-700' },
                    { label: 'Approved', value: filteredAvailedRecords.filter(r => r.status === 'Approved').length, color: 'bg-green-100', textColor: 'text-green-700' },
                    { label: 'Pending', value: filteredAvailedRecords.filter(r => r.status === 'Pending').length, color: 'bg-blue-100', textColor: 'text-blue-700' },
                  ].map((card, i) => (
                    <div key={i} className={`p-4 rounded-xl border ${card.color} text-center`}>
                      <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
                      <p className={`text-[10px] font-medium uppercase tracking-wide ${card.textColor}`}>{card.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {filteredAvailedRecords.length === 0 ? (
                <div className="text-center py-12 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <CalendarDays size={28} className="text-rose-600 mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground text-sm">No leave availed records found</p>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">Pay Period</th>
                          <th className="px-4 py-3 font-semibold">Leave Type</th>
                          <th className="px-4 py-3 font-semibold">From Date</th>
                          <th className="px-4 py-3 font-semibold">To Date</th>
                          <th className="px-4 py-3 font-semibold text-center">Days</th>
                          <th className="px-4 py-3 font-semibold">Reason</th>
                          <th className="px-4 py-3 font-semibold">Approved By</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredAvailedRecords.map((ar, i) => {
                          const colorStyle = getLeaveColor(ar.leaveTypeColor);
                          const statusStyle = ar.status === 'Approved'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : ar.status === 'Pending'
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-red-100 text-red-700 border-red-200';
                          return (
                            <motion.tr key={ar.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors">
                              <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{i + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Clock size={13} className="text-muted-foreground shrink-0" />
                                  <span className="text-sm font-semibold">{ar.payPeriodName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>{ar.leaveTypeCode}</span>
                                  <span className="text-sm font-medium">{ar.leaveTypeName}</span>
                                  {ar.isHalfDay && <span className="text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">Half Day</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium">{formatDate(ar.fromDate)}</p>
                                  <p className="text-[10px] text-muted-foreground">{new Date(ar.fromDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium">{formatDate(ar.toDate)}</p>
                                  <p className="text-[10px] text-muted-foreground">{new Date(ar.toDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-base font-bold px-2.5 py-1 rounded-full ${colorStyle.bg} ${colorStyle.text}`}>
                                  {ar.days}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{ar.reason}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{ar.approvedBy || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle}`}>
                                  {ar.status === 'Approved' && <CheckCircle2 size={10} />}
                                  {ar.status === 'Pending' && <Clock size={10} />}
                                  {ar.status === 'Rejected' && <X size={10} />}
                                  {ar.status}
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-accent/30 border-t-2 border-border">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Days Availed</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-base font-bold text-rose-700">{filteredAvailedRecords.reduce((s, r) => s + r.days, 0)}</span>
                            <span className="text-xs text-muted-foreground ml-1">days</span>
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {filteredAvailedRecords.length > 0 && (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
                    <BarChart3 size={16} className="text-primary" />
                    <h3 className="font-bold text-sm">Pay Period-wise Availed Summary</h3>
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {PAY_PERIODS.map(period => {
                      const periodRecords = filteredAvailedRecords.filter(r => r.payPeriodId === period.id);
                      if (periodRecords.length === 0) return null;
                      const totalDays = periodRecords.reduce((s, r) => s + r.days, 0);
                      return (
                        <motion.div key={period.id} whileHover={{ y: -2 }} className="bg-accent/30 rounded-xl border border-border p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Clock size={14} className="text-primary shrink-0" />
                            <span className="font-bold text-sm">{period.name}</span>
                          </div>
                          <div className="space-y-2">
                            {periodRecords.map(ar => {
                              const colorStyle = getLeaveColor(ar.leaveTypeColor);
                              return (
                                <div key={ar.id} className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colorStyle.bg} ${colorStyle.text}`}>{ar.leaveTypeCode}</span>
                                    <span className="text-xs text-muted-foreground">{formatDate(ar.fromDate)}</span>
                                  </div>
                                  <span className={`text-xs font-bold ${colorStyle.text}`}>{ar.days}d</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total</span>
                            <span className="text-sm font-bold text-rose-600">{totalDays} days</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {openingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-blue-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl"><Wallet size={18} className="text-blue-600" /></div>
                  <div>
                    <h2 className="text-base font-bold text-blue-900">{editingOpening ? 'Edit Opening Balance' : 'Add Opening Balance'}</h2>
                    <p className="text-xs text-blue-600">FY {openingForm.financialYear}</p>
                  </div>
                </div>
                <button onClick={() => setOpeningModal(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <Field label="Leave Type" required>
                  <select
                    className={selectCls}
                    value={openingForm.leaveTypeId}
                    onChange={e => handleLeaveTypeSelect(e.target.value)}
                    disabled={!!editingOpening}
                  >
                    <option value="">— Select Leave Type —</option>
                    {leaveTypeOptions.map(lt => (
                      <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
                    ))}
                  </select>
                </Field>
                <Field label="Financial Year" required>
                  <select className={selectCls} value={openingForm.financialYear} onChange={e => setOpeningForm(f => ({ ...f, financialYear: e.target.value }))}>
                    {FINANCIAL_YEARS_LIST.map(fy => <option key={fy}>{fy}</option>)}
                  </select>
                </Field>
                <Field label="Opening Balance (Days)" required hint="Number of leave days carried forward or manually set">
                  <div className="relative">
                    <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      className={`${inputCls} pl-9`}
                      min={0}
                      max={365}
                      step={0.5}
                      value={openingForm.openingBalance}
                      onChange={e => setOpeningForm(f => ({ ...f, openingBalance: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </Field>
                <Field label="Remarks">
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={2}
                    placeholder="e.g. Carried forward from previous year, Manual adjustment"
                    value={openingForm.remarks}
                    onChange={e => setOpeningForm(f => ({ ...f, remarks: e.target.value }))}
                  />
                </Field>
                {openingForm.leaveTypeId && (
                  <div className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl border border-border">
                    {(() => {
                      const lt = leaveTypeOptions.find(l => l.id === openingForm.leaveTypeId);
                      if (!lt) return null;
                      const colorStyle = getLeaveColor(lt.color);
                      return (
                        <>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>{lt.code}</span>
                          <span className="text-sm font-semibold">{lt.name}</span>
                          <span className="ml-auto text-lg font-bold text-blue-600">{openingForm.openingBalance} days</span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setOpeningModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={saveOpening} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                  <Save size={15} /> {editingOpening ? 'Save Changes' : 'Add Balance'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Tab: Salary Structure ────────────────────────────────────────────────────

// ─── Assets under the employee's charge (allocate via Configuration → Asset Management) ──
const EmployeeAssetsTab = ({ employeeId, employeeName }: { employeeId?: string; employeeName: string }) => {
  const { assets, reload } = useEmployeeAssets(employeeId);
  const fmtDate = (s: string) => { if (!s) return '—'; const d = new Date(s + 'T00:00:00'); const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return isNaN(d.getTime()) ? s : `${String(d.getDate()).padStart(2,'0')}/${m[d.getMonth()]}/${d.getFullYear()}`; };
  const handover = async (id: string, name: string) => {
    const { error } = await returnAsset(id);
    if (error) { toast.error(error); return; }
    toast.success(`${name} handed over / returned.`);
    reload();
  };
  if (!employeeId) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <SectionHeader icon={Boxes} title="Assets Under Charge" subtitle="Company assets allocated to this employee." accentColor="text-cyan-600" accentBg="bg-cyan-100" />
        <div className="flex items-center gap-3 p-5 bg-accent/30 border border-dashed border-border rounded-xl justify-center text-sm text-muted-foreground"><Info size={16} /> Save the employee first, then allocate assets from <strong>Configuration → Asset Management</strong>.</div>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
      <SectionHeader icon={Boxes} title="Assets Under Charge" subtitle="Company assets allocated to this employee — all must be handed over before relieving." accentColor="text-cyan-600" accentBg="bg-cyan-100" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{assets.length} asset{assets.length !== 1 ? 's' : ''} allocated. Allocate new assets from Configuration → Asset Management.</span>
        {assets.length > 0 && <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1"><AlertCircle size={12} /> Pending handover on relieving: {assets.length}</span>}
      </div>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-accent/50 text-muted-foreground text-[10px] uppercase tracking-wider">
            <tr><th className="px-4 py-2.5 font-semibold">Product ID</th><th className="px-4 py-2.5 font-semibold">Asset</th><th className="px-4 py-2.5 font-semibold">Category</th><th className="px-4 py-2.5 font-semibold">Serial / Mobile</th><th className="px-4 py-2.5 font-semibold">Allocated On</th><th className="px-4 py-2.5 font-semibold text-right">Handover</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assets.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No assets allocated to this employee.</td></tr>}
            {assets.map(a => (
              <tr key={a.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 font-mono text-xs font-semibold">{a.productId}</td>
                <td className="px-4 py-2.5"><p className="font-medium">{a.name}</p>{a.makeModel && <p className="text-[10px] text-muted-foreground">{a.makeModel}</p>}</td>
                <td className="px-4 py-2.5 text-xs">{a.categoryName}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{a.serialNumber || a.mobileNumber || '—'}</td>
                <td className="px-4 py-2.5 text-xs">{fmtDate(a.allocatedOn)}</td>
                <td className="px-4 py-2.5 text-right"><button onClick={() => handover(a.id, a.name)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-xs font-medium hover:bg-amber-100"><Undo2 size={13} /> Handover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Handover returns the asset to the company pool (status → Available) and records it in the asset's allocation history.</p>
    </div>
  );
};

interface SalaryStructureTabProps {
  data: EmployeeSalaryStructure;
  onChange: (data: EmployeeSalaryStructure) => void;
  structures: SalaryStructure[];
  /** Employee uuid (edit mode) — enables save-on-slider-commit. */
  employeeId?: string;
  /** Employee work-location name — used to resolve the state PT slab. */
  workLocation?: string;
}

const SalaryStructureTab = ({ data, onChange, structures, employeeId, workLocation }: SalaryStructureTabProps) => {
  const [savingCtc, setSavingCtc] = useState(false);
  const ctcCommitRef = useRef(data.ctcMonthly);
  // Baseline (CTC + component values) captured when a slider drag begins, so each drag
  // scales the Fixed-amount components proportionally without compounding rounding.
  const sliderBaseRef = useRef<{ ctc: number; values: Record<string, number> } | null>(null);
  const byId = (sid: string) => structures.find(s => s.id === sid);
  const structure: SalaryStructure | undefined = data.structureId ? byId(data.structureId) : undefined;

  const selectStructure = (structureId: string) => {
    sliderBaseRef.current = null; // new structure → fresh baseline
    const struct = byId(structureId);
    if (!struct) {
      onChange(emptyEmployeeSalaryStructure());
      return;
    }
    onChange({
      structureId: struct.id,
      structureName: struct.name,
      structureCode: struct.code,
      ctcMonthly: data.ctcMonthly || 0,
      componentValues: defaultComponentValues(struct),
      vpfPercentage: data.vpfPercentage || 0,
    });
  };

  // On releasing the slider, persist the salary structure for this employee (edit mode).
  // For a new employee (no uuid yet) it is saved with the rest of the record on Save.
  const commitCtc = async (cvOverride?: Record<string, number>) => {
    sliderBaseRef.current = null; // next drag re-captures the (now scaled) baseline
    if (!data.structureId) return;
    if (!employeeId) { toast.info('CTC set — the salary structure will be saved with the employee.'); return; }
    setSavingCtc(true);
    const { error } = await upsertEmployeeAssignment({
      empId: employeeId, structureId: data.structureId, ctcMonthly: ctcCommitRef.current,
      componentValues: cvOverride ?? data.componentValues, vpfPercentage: data.vpfPercentage || 0,
    });
    setSavingCtc(false);
    if (error) toast.error(`Could not save salary structure: ${error}`);
    else toast.success(`Salary structure saved at CTC ₹${Math.round(ctcCommitRef.current).toLocaleString('en-IN')}/month.`);
  };

  const setComponentValue = (componentId: string, value: number) =>
    onChange({ ...data, componentValues: { ...data.componentValues, [componentId]: value } });

  const breakdown = useMemo(
    () => (structure ? computeSalaryBreakdown(structure, data.ctcMonthly, data.componentValues) : null),
    [structure, data.ctcMonthly, data.componentValues]
  );

  // Statutory PF/ESI computed from Payroll Settings (ceiling-aware) + VPF, for the
  // breakdown display and CTC — mirrors what payroll will deduct.
  const settings = usePayrollSettingsForBreakdown();
  const establishment = useEstablishment();
  // PF / ESI wage bases — sum of the components configured in Payroll Settings
  // (fallback: Basic for PF, gross for ESI when none configured).
  const pfWages = useMemo(() => (breakdown && settings ? wageBaseFromComponents(breakdown.lineItems, settings.statutory.pfWageComponents, breakdown.basicMonthly) : 0), [breakdown, settings]);
  const esiWages = useMemo(() => (breakdown && settings ? wageBaseFromComponents(breakdown.lineItems, settings.statutory.esiWageComponents, breakdown.grossMonthly) : 0), [breakdown, settings]);
  // Professional Tax — from the employee work-location's STATE slab (matches payroll).
  const [ptSlabs, setPtSlabs] = useState<PtSlab[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!workLocation) { if (active) setPtSlabs([]); return; }
      const { data: wl } = await (supabase as unknown as { from: (t: string) => any }).from('work_locations').select('state').eq('name', workLocation).maybeSingle();
      const state = (wl as { state?: string } | null)?.state;
      const slabs = state ? await loadPtSlabs(state) : [];
      if (active) setPtSlabs(slabs);
    })();
    return () => { active = false; };
  }, [workLocation]);
  const ptMonthly = useMemo(() => (breakdown ? ptForGross(ptSlabs, breakdown.grossMonthly) : 0), [ptSlabs, breakdown]);
  const stat = useMemo(() => {
    if (!breakdown || !settings) return null;
    const eff = resolveEffectiveStatutory(settings.statutory, null);
    return computeStatutory(pfWages, esiWages, eff, ptMonthly, data.vpfPercentage || 0);
  }, [breakdown, settings, pfWages, esiWages, ptMonthly, data.vpfPercentage]);
  // Monthly statutory-bonus accrual for the CTC composition — MINIMUM bonus % on the
  // configured bonus wage base (capped at the calculation ceiling), only when the
  // employee's bonus wages are within the eligibility limit.
  // Statutory bonus for eligible employees; ex-gratia (same base, configurable %) for
  // those above the eligibility wage when ex-gratia is enabled in Payroll Settings.
  const bonusInfo = useMemo(() => {
    if (!breakdown || !settings?.bonusEnabled) return { amount: 0, isExgratia: false };
    const bonusWages = wageBaseFromComponents(breakdown.lineItems, settings.bonusWageComponents, breakdown.basicMonthly);
    const base = Math.min(bonusWages, settings.bonusWageCeiling || bonusWages);
    const aboveEligibility = settings.bonusEligibilityLimit > 0 && bonusWages > settings.bonusEligibilityLimit;
    if (aboveEligibility) {
      if (!settings.bonusExgratiaEnabled) return { amount: 0, isExgratia: false };
      return { amount: Math.round((settings.bonusExgratiaPercentage / 100) * base), isExgratia: true };
    }
    return { amount: Math.round((settings.bonusMinPercentage / 100) * base), isExgratia: false };
  }, [breakdown, settings]);
  const bonusPerMonth = bonusInfo.amount;
  // Gratuity monthly accrual ≈ 4.81% of Basic (15 / (26 × 12)).
  const gratuityPerMonth = useMemo(() => (breakdown && settings?.gratuityEnabled ? Math.round((15 / (26 * 12)) * breakdown.basicMonthly) : 0), [breakdown, settings]);

  // Deduction lines for the breakdown — PF/ESI replaced by the ceiling-aware statutory
  // values (Payroll Settings), VPF added, so the breakdown matches what payroll deducts.
  const dedLines = useMemo(() => {
    if (!breakdown) return [] as { key: string; name: string; amount: number }[];
    const out = breakdown.deductions.map(l => ({
      key: l.componentId,
      name: l.componentName,
      amount: stat ? (l.statutoryType === 'pf' ? stat.pfEmployee : l.statutoryType === 'esi' ? stat.esiEmployee : l.statutoryType === 'professional_tax' ? stat.pt : l.amount) : l.amount,
    }));
    if (stat && stat.vpf > 0) out.push({ key: 'vpf', name: 'Voluntary PF', amount: stat.vpf });
    return out;
  }, [breakdown, stat]);
  const totalDed = dedLines.reduce((s, l) => s + l.amount, 0);
  // Net take-home rounded to the nearest ₹100 (earnings are already in ₹100 multiples).
  const netRoundCode = (establishment.netRoundoff ?? 'nearest_100') as RoundCode;
  const netMonthly = breakdown ? Math.max(0, roundTo(breakdown.grossMonthly + breakdown.totalReimbursements - totalDed, netRoundCode)) : 0;

  // "Structure based on" — drive the whole structure from any of four figures.
  type StructBasis = 'monthly_ctc' | 'annual_ctc' | 'monthly_gross' | 'monthly_net';
  const [structBasis, setStructBasis] = useState<StructBasis>('monthly_ctc');
  const STRUCT_BASIS_OPTIONS: { key: StructBasis; label: string }[] = [
    { key: 'monthly_ctc', label: 'Monthly CTC' },
    { key: 'annual_ctc', label: 'Annual CTC' },
    { key: 'monthly_gross', label: 'Monthly Gross' },
    { key: 'monthly_net', label: 'Monthly Net Take-Home' },
  ];
  // Current value of the active basis, derived from the live breakdown.
  const basisCurrentValue = !breakdown ? 0
    : structBasis === 'monthly_ctc' ? data.ctcMonthly
    : structBasis === 'annual_ctc' ? data.ctcMonthly * 12
    : structBasis === 'monthly_gross' ? breakdown.grossMonthly
    : netMonthly;
  const lastSolvedCvRef = useRef<Record<string, number> | undefined>(undefined);
  // Solve the structure for a target value of the active basis; optionally persist.
  const applyBasisValue = (val: number, persist: boolean) => {
    if (!structure || !settings || !(val >= 0)) return;
    const solverBasis: RevisionBasis = structBasis === 'monthly_gross' ? 'Gross' : structBasis === 'monthly_net' ? 'TakeHome' : 'CTC';
    const target = structBasis === 'annual_ctc' ? val / 12 : val;
    const res = solveForTarget(solverBasis, target, structure, data.ctcMonthly, data.componentValues, settings.statutory, ptSlabs, null, data.vpfPercentage || 0, netRoundCode);
    // Balancing rule: if Basic outweighs the rest of the earnings, step Custom-valued
    // components up to higher listed values until balanced.
    const balancedCv = balanceBasicViaCustom(structure, res.ctcMonthly, res.componentValues);
    ctcCommitRef.current = res.ctcMonthly;
    lastSolvedCvRef.current = balancedCv;
    onChange({ ...data, ctcMonthly: res.ctcMonthly, componentValues: balancedCv });
    if (persist) void commitCtc(balancedCv);
  };

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const configurableComponents = structure ? structure.components.filter(isConfigurable) : [];

  // Monthly cost-to-company total (gross + reimbursements + employer statutory + gratuity + bonus).
  const grossCtcMonthly = breakdown ? breakdown.grossMonthly + breakdown.totalReimbursements : 0;
  const ctcMonthlyTotal = grossCtcMonthly + (stat?.pfEmployer ?? 0) + (stat?.esiEmployer ?? 0) + gratuityPerMonth + bonusPerMonth;

  // Export the salary settings (components + statutory + CTC + yearly) as a print-ready PDF.
  const exportSalaryPdf = () => {
    if (!breakdown || !structure) return;
    const yr = (n: number) => Math.round(n) * 12;
    const cur = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sec = (title: string, rows: Array<[string, number, boolean?]>, color: string) => `
      <h3 style="margin:16px 0 6px;font-size:13px;color:${color}">${esc(title)}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr><th style="text-align:left;padding:5px 8px;background:#f1f5f9">Component</th><th style="text-align:right;padding:5px 8px;background:#f1f5f9">Monthly</th><th style="text-align:right;padding:5px 8px;background:#f1f5f9">Annual</th></tr></thead>
        <tbody>${rows.map(([n, v, bold]) => `<tr${bold ? ' style="font-weight:700;background:#f8fafc"' : ''}><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0">${esc(n)}</td><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${cur(v)}</td><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${cur(yr(v))}</td></tr>`).join('')}</tbody>
      </table>`;
    const earnRows: Array<[string, number, boolean?]> = breakdown.earnings.map(l => [l.componentName, l.amount] as [string, number]);
    earnRows.push(['Gross Earnings', breakdown.grossMonthly, true]);
    const dedRows: Array<[string, number, boolean?]> = dedLines.map(l => [l.name, l.amount] as [string, number]);
    dedRows.push(['Total Deductions', totalDed, true]);
    const ctcRows: Array<[string, number, boolean?]> = [
      ['Gross (Earnings + Reimbursements)', grossCtcMonthly],
      ...(stat && stat.pfEmployer > 0 ? [['Employer PF', stat.pfEmployer] as [string, number]] : []),
      ...(stat && stat.esiEmployer > 0 ? [['Employer ESI', stat.esiEmployer] as [string, number]] : []),
      ...(gratuityPerMonth > 0 ? [['Gratuity (accrual)', gratuityPerMonth] as [string, number]] : []),
      ...(bonusPerMonth > 0 ? [[bonusInfo.isExgratia ? `Ex-gratia (${settings?.bonusExgratiaPercentage ?? 8.33}%)` : `Statutory Bonus (min ${settings?.bonusMinPercentage ?? 8.33}%)`, bonusPerMonth] as [string, number]] : []),
      ['Total CTC', ctcMonthlyTotal, true],
    ];
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Salary Structure — ${esc(structure.name)}</title>
      <style>*{box-sizing:border-box}body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;color:#0f172a}
      .toolbar{position:sticky;top:0;background:#1e293b;color:#fff;padding:10px 16px;display:flex;gap:10px;justify-content:flex-end}
      .toolbar span{margin-right:auto;font-weight:600}.toolbar button{background:#fff;color:#1e293b;border:0;border-radius:6px;padding:6px 14px;font-weight:600;cursor:pointer}
      .page{padding:28px 32px}.est{font-size:14px;font-weight:700;color:#334155}h1{font-size:18px;margin:2px 0}.sub{font-size:12px;color:#64748b;margin-bottom:8px}
      .totals{margin-top:14px;padding:10px 14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;display:flex;justify-content:space-between;font-weight:700;color:#065f46}
      @media print{.toolbar{display:none}.page{padding:0}}</style></head>
      <body><div class="toolbar no-print"><span>Salary Structure & CTC</span><button onclick="window.print()">Print / Save as PDF</button><button onclick="window.close()">Close</button></div>
      <div class="page">
        ${establishment.name ? `<div class="est">${esc(establishment.name)}</div>` : ''}
        <h1>Salary Structure &amp; CTC</h1>
        <div class="sub">${esc(structure.name)} (${esc(structure.code)}) · Monthly CTC ${cur(data.ctcMonthly || 0)} · Annual CTC ${cur((data.ctcMonthly || 0) * 12)}</div>
        ${sec('Earnings', earnRows, '#16a34a')}
        ${sec('Deductions', dedRows, '#dc2626')}
        <div class="totals"><span>Net Take-Home</span><span>${cur(netMonthly)} / mo &nbsp;·&nbsp; ${cur(yr(netMonthly))} / yr</span></div>
        ${sec('Cost to Company (CTC)', ctcRows, '#4f46e5')}
        <div class="totals"><span>Total Annual CTC</span><span>${cur(yr(ctcMonthlyTotal))}</span></div>
        <p style="margin-top:14px;font-size:10px;color:#94a3b8">Computer-generated salary statement. PF/ESI ceiling-aware; PT per state slab; statutory bonus at the minimum rate.</p>
      </div></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else { toast.info('Allow pop-ups to export the salary PDF.'); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6">
      <SectionHeader
        icon={Wallet}
        title="Salary Structure"
        subtitle="Assign a salary structure and configure component values per the structure rules (Fixed / Variable / Custom Listed Values)."
        accentColor="text-emerald-600"
        accentBg="bg-emerald-100"
      />

      {/* Structure + CTC selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Salary Structure" required hint="Determines the components and value-setting rules for this employee.">
          <div className="relative">
            <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              className={`${selectCls} pl-9`}
              value={data.structureId}
              onChange={e => selectStructure(e.target.value)}
            >
              <option value="">— Select a salary structure —</option>
              {structures.filter(s => s.isActive).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Structure based on" required hint="Build the structure from any figure — the slider re-solves CTC & components; computation rules (Fixed / Variable / Custom) stay the same.">
          <select className={`${selectCls}`} value={structBasis} onChange={e => setStructBasis(e.target.value as StructBasis)} disabled={!structure}>
            {STRUCT_BASIS_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <div className="relative mt-3">
            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="number"
              min={0}
              step={structBasis === 'annual_ctc' ? 10000 : 1000}
              className={`${inputCls} pl-9`}
              placeholder={STRUCT_BASIS_OPTIONS.find(o => o.key === structBasis)?.label}
              value={Math.round(basisCurrentValue) || ''}
              onChange={e => applyBasisValue(parseFloat(e.target.value) || 0, false)}
              onBlur={() => { if (structure && employeeId) void commitCtc(lastSolvedCvRef.current); }}
              disabled={!structure}
            />
          </div>
          {/* Basis slider — drag to re-solve the structure; release to save. */}
          {(() => {
            const annual = structBasis === 'annual_ctc';
            const floor = annual ? 120000 : 10000;
            const ceil = Math.max(annual ? 3600000 : 300000, Math.ceil((basisCurrentValue * 1.5) / (annual ? 100000 : 10000)) * (annual ? 100000 : 10000));
            const step = annual ? 10000 : 1000;
            return (
              <div className={`mt-3 ${!structure ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                  type="range" min={floor} max={ceil} step={step}
                  value={Math.min(Math.max(basisCurrentValue || floor, floor), ceil)}
                  onChange={e => applyBasisValue(parseFloat(e.target.value) || 0, false)}
                  onPointerUp={() => { if (structure && employeeId) void commitCtc(lastSolvedCvRef.current); }}
                  onKeyUp={() => { if (structure && employeeId) void commitCtc(lastSolvedCvRef.current); }}
                  disabled={!structure}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                  <span>₹{(floor / (annual ? 100000 : 1000)).toFixed(0)}{annual ? 'L' : 'k'}</span>
                  <span className="font-semibold text-emerald-700">
                    {savingCtc ? 'Saving…' : `₹${Math.round(basisCurrentValue || 0).toLocaleString('en-IN')}`}
                    {employeeId ? ' · drag & release to save' : ''}
                  </span>
                  <span>₹{(ceil / (annual ? 100000 : 1000)).toFixed(0)}{annual ? 'L' : 'k'}</span>
                </div>
              </div>
            );
          })()}
        </Field>

        <Field label="Voluntary PF (VPF) %" hint="Extra employee PF over the statutory rate, on the PF wage base.">
          <div className="relative">
            <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="number"
              min={0}
              max={88}
              step={1}
              className={`${inputCls} pl-9`}
              placeholder="e.g. 10"
              value={data.vpfPercentage || ''}
              onChange={e => onChange({ ...data, vpfPercentage: parseFloat(e.target.value) || 0 })}
              disabled={!structure}
            />
          </div>
        </Field>
      </div>


      {!structure && (
        <div className="flex items-center gap-3 p-5 bg-accent/30 border border-dashed border-border rounded-xl text-center justify-center">
          <Info size={16} className="text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Select a salary structure above to configure this employee's salary components.</p>
        </div>
      )}

      {structure && (
        <>
          {/* Component configuration */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold flex items-center gap-2"><Layers size={15} className="text-emerald-600" /> Component Configuration</h4>
              <span className="text-[10px] text-muted-foreground">{configurableComponents.length} of {structure.components.length} components are employee-configurable</span>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(['fixed', 'variable', 'custom'] as const).map(vt => (
                <span key={vt} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${VALUE_TYPE_META[vt].bg} ${VALUE_TYPE_META[vt].text} ${VALUE_TYPE_META[vt].border}`}>
                  {VALUE_TYPE_META[vt].label}
                </span>
              ))}
            </div>

            <div className="space-y-2">
              {structure.components.map(comp => {
                const vt = VALUE_TYPE_META[comp.valueType];
                const ct = COMPONENT_TYPE_META[comp.componentType];
                const resolved = resolveComponentValue(comp, data.componentValues);
                const rawLine = breakdown?.lineItems.find(l => l.componentId === comp.componentId)?.amount ?? 0;
                // PF/ESI shown ceiling-aware (PF on min(Basic, ₹15k); ESI = 0 above the ₹21k gross ceiling) —
                // matches the actual deduction, not the raw % of the structure.
                const lineAmount = stat && comp.statutoryType === 'pf' ? stat.pfEmployee
                  : stat && comp.statutoryType === 'esi' ? stat.esiEmployee
                  : rawLine;
                const pfCapped = comp.statutoryType === 'pf' && settings != null && breakdown != null && pfWages > settings.statutory.pfWageCeiling;
                const esiNa = comp.statutoryType === 'esi' && settings != null && breakdown != null && esiWages > settings.statutory.esiWageCeiling;
                return (
                  <div key={comp.componentId} className="flex flex-col md:flex-row md:items-center gap-3 p-3 bg-accent/20 border border-border rounded-xl">
                    {/* Identity */}
                    <div className="flex items-center gap-3 md:w-72 shrink-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ct.bg} ${ct.text} ${ct.border}`}>{comp.componentType}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{comp.componentName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{comp.componentCode} · {comp.calculationBasis}</p>
                      </div>
                    </div>

                    {/* Value-type rule badge */}
                    <div className="md:w-40 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${vt.bg} ${vt.text} ${vt.border}`}>
                        {vt.shortLabel}
                      </span>
                    </div>

                    {/* Input per rule */}
                    <div className="flex-1 min-w-0">
                      {comp.valueType === 'fixed' && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <Lock size={12} className="text-blue-500 shrink-0" />
                          <span className="text-xs text-blue-700">
                            {comp.calculationBasis === 'Fixed'
                              ? <>Fixed at <strong>₹{comp.value.toLocaleString('en-IN')}</strong></>
                              : <><strong>{comp.value}%</strong> of {comp.calculationBasis.replace('Percentage of ', '')}</>}
                          </span>
                        </div>
                      )}

                      {comp.valueType === 'variable' && (
                        <div className="relative">
                          <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
                          <input
                            type="number"
                            min={0}
                            step={100}
                            className={`${inputCls} pl-9 border-amber-300 focus:ring-amber-200`}
                            placeholder="Enter amount for this employee"
                            value={data.componentValues[comp.componentId] ?? ''}
                            onChange={e => setComponentValue(comp.componentId, parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}

                      {comp.valueType === 'custom' && (
                        <div className="relative">
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
                          <select
                            className={`${selectCls} border-violet-300 focus:ring-violet-200`}
                            value={data.componentValues[comp.componentId] ?? comp.selectedCustomValue}
                            onChange={e => setComponentValue(comp.componentId, parseFloat(e.target.value) || 0)}
                          >
                            {comp.customValues.map(v => (
                              <option key={v} value={v}>₹{v.toLocaleString('en-IN')}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Computed monthly amount */}
                    <div className="md:w-32 shrink-0 text-right">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Monthly</p>
                      <p className={`text-sm font-bold ${comp.componentType === 'Deduction' ? 'text-red-600' : 'text-foreground'}`}>
                        {comp.componentType === 'Deduction' ? '−' : ''}{fmt(lineAmount)}
                      </p>
                      {pfCapped && <p className="text-[9px] text-amber-600 font-medium">{resolved}% on ₹{settings!.statutory.pfWageCeiling.toLocaleString('en-IN')} ceiling</p>}
                      {esiNa && <p className="text-[9px] text-amber-600 font-medium">Gross &gt; ₹{settings!.statutory.esiWageCeiling.toLocaleString('en-IN')} — N/A</p>}
                      {!pfCapped && !esiNa && comp.calculationBasis !== 'Fixed' && <p className="text-[9px] text-muted-foreground">@ {resolved}%</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown summary */}
          {breakdown && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-accent/20 border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold flex items-center gap-2"><Receipt size={15} className="text-emerald-600" /> Salary Breakdown (Monthly)</h4>
                  <button type="button" onClick={exportSalaryPdf} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent">
                    <FileText size={13} /> Export PDF
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-2">Earnings</p>
                    <div className="space-y-1.5">
                      {breakdown.earnings.map(l => (
                        <div key={l.componentId} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{l.componentName}</span>
                          <span className="font-semibold">{fmt(l.amount)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border font-bold">
                        <span>Gross Earnings</span><span className="text-green-700">{fmt(breakdown.grossMonthly)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-2">Deductions</p>
                    <div className="space-y-1.5">
                      {dedLines.length === 0 && <p className="text-xs text-muted-foreground">No deductions</p>}
                      {dedLines.map(l => (
                        <div key={l.key} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{l.name}</span>
                          <span className="font-semibold text-red-600">−{fmt(l.amount)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border font-bold">
                        <span>Total Deductions</span><span className="text-red-600">−{fmt(totalDed)}</span>
                      </div>
                    </div>
                    {breakdown.reimbursements.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide mt-4 mb-2">Reimbursements</p>
                        <div className="space-y-1.5">
                          {breakdown.reimbursements.map(l => (
                            <div key={l.componentId} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{l.componentName}</span>
                              <span className="font-semibold text-violet-600">{fmt(l.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 flex flex-col justify-center gap-3">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Net Take-Home (Monthly)</p>
                  <p className="text-3xl font-bold text-emerald-800 mt-1">{fmt(netMonthly)}</p>
                  <p className="text-[10px] text-emerald-600 mt-1">Gross {fmt(breakdown.grossMonthly)} − Deductions {fmt(totalDed)}{breakdown.totalReimbursements > 0 ? ` + Reimb. ${fmt(breakdown.totalReimbursements)}` : ''}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/70 border border-emerald-200 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-emerald-600 uppercase">Annual CTC</p>
                    <p className="text-sm font-bold text-emerald-800">{fmt(data.ctcMonthly * 12)}</p>
                  </div>
                  <div className="bg-white/70 border border-emerald-200 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-emerald-600 uppercase">Annual Net</p>
                    <p className="text-sm font-bold text-emerald-800">{fmt(breakdown.netMonthly * 12)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Statutory (Payroll Settings, ceiling-aware) + CTC composition */}
          {breakdown && stat && settings && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Shield size={15} className="text-emerald-600" /> Statutory Deductions <span className="text-[10px] font-normal text-muted-foreground">(per Payroll Settings)</span></h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Provident Fund (employee {settings.statutory.pfEmployeeRate}%{settings.statutory.pfApplyOn === 'Ceiling' ? `, ceiling ${fmt(settings.statutory.pfWageCeiling)}` : ''})</span><span className="font-semibold text-red-600">−{fmt(stat.pfEmployee)}</span></div>
                  {(data.vpfPercentage || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Voluntary PF ({data.vpfPercentage}%)</span><span className="font-semibold text-red-600">−{fmt(stat.vpf)}</span></div>}
                  <div className="flex justify-between pt-1.5 border-t border-border font-bold"><span>Total Employee PF (incl. VPF)</span><span className="text-red-600">−{fmt(employeePf(stat))}</span></div>
                  <div className="flex justify-between pt-1.5"><span className="text-muted-foreground">ESI (employee {settings.statutory.esiEmployeeRate}%{breakdown.grossMonthly > settings.statutory.esiWageCeiling ? ' — above ceiling, N/A' : ''})</span><span className="font-semibold text-red-600">{stat.esiEmployee > 0 ? `−${fmt(stat.esiEmployee)}` : '—'}</span></div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">PF is on min(Basic, ceiling); ESI applies only when gross ≤ {fmt(settings.statutory.esiWageCeiling)}. Professional Tax is finalised per the state slab during payroll.</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5">
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><DollarSign size={15} className="text-indigo-600" /> Cost to Company (CTC)</h4>
                {(() => {
                  const grossCtc = breakdown.grossMonthly + breakdown.totalReimbursements;
                  const ctcMonthly = grossCtc + stat.pfEmployer + stat.esiEmployer + gratuityPerMonth + bonusPerMonth;
                  const row = (label: string, val: number) => (
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{fmt(val)}</span></div>
                  );
                  return (
                    <div className="space-y-1.5">
                      {row('Gross (earnings + reimbursements)', grossCtc)}
                      {row('Employer PF', stat.pfEmployer)}
                      {stat.esiEmployer > 0 && row('Employer ESI', stat.esiEmployer)}
                      {gratuityPerMonth > 0 && row('Gratuity (per month)', gratuityPerMonth)}
                      {bonusPerMonth > 0 && row(bonusInfo.isExgratia ? 'Ex-gratia (per month)' : 'Statutory Bonus (per month)', bonusPerMonth)}
                      <div className="flex justify-between pt-2 border-t border-indigo-200 font-bold text-sm"><span>Monthly CTC</span><span className="text-indigo-800">{fmt(ctcMonthly)}</span></div>
                      <div className="flex justify-between text-[11px] text-indigo-600"><span>Annual CTC</span><span className="font-bold">{fmt(ctcMonthly * 12)}</span></div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              These component values are saved against the employee. When you <strong>Run Payroll</strong>, the payroll engine reads each employee's
              configured values to compute their gross, deductions and net pay. <strong>Fixed</strong> components apply uniformly,
              <strong> Variable</strong> components use the amount entered here, and <strong>Custom Listed</strong> components use the value selected from the allowed list.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeMaster() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const generatedId = useMemo(() => buildEmployeeId(defaultEmpIdPattern(), { serial: 1 }), []);
  const [idPattern, setIdPattern] = useState<EmpIdPattern>(defaultEmpIdPattern());
  const [empCount, setEmpCount] = useState(0);

  const [form, setForm] = useState<EmployeeFormData>({
    personal: emptyPersonal(),
    employment: emptyEmployment(generatedId),
    statutory: emptyStatutory(),
    education: [],
    family: [],
    bank: [],
    documents: emptyDocuments(),
    salaryStructure: emptyEmployeeSalaryStructure(),
    leaveData: EMPTY_LEAVE_DATA,
  });

  const [activeTab, setActiveTab] = useState<EmployeeTab>('personal');
  const [saved, setSaved] = useState(false);
  const [showUserCreationModal, setShowUserCreationModal] = useState(false);
  const [createdUserInfo, setCreatedUserInfo] = useState<{ employeeId: string; name: string; email: string; uuid: string; department: string } | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [generatedPasswordInfo, setGeneratedPasswordInfo] = useState<{ loginId: string; password: string; emailed: boolean; hasEmail: boolean } | null>(null);

  // Hydrate the core employee record from the DB when editing an existing employee.
  useEffect(() => {
    if (!isEdit || !id) return;
    let active = true;
    void (async () => {
      const [{ data }, desig, dept, grade, etype, ecat, egrp, wloc, shft, statRes, eduRes, famRes, bankRes, langRes, expRes, lbRes] = await Promise.all([
        sbAny.from('employees').select('*').eq('id', id).maybeSingle(),
        loadMaster('designations'), loadMaster('departments'), loadMaster('employee_grades'),
        loadMaster('employee_types'), loadMaster('employee_categories'), loadMaster('employee_groups'),
        loadMaster('work_locations'), loadMaster('shifts'),
        sbAny.from('employee_statutory').select('*').eq('employee_id', id).maybeSingle(),
        sbAny.from('employee_education').select('*').eq('employee_id', id).order('created_at'),
        sbAny.from('employee_family').select('*').eq('employee_id', id).order('created_at'),
        sbAny.from('employee_bank_accounts').select('*').eq('employee_id', id).order('created_at'),
        sbAny.from('employee_languages').select('*').eq('employee_id', id).order('created_at'),
        sbAny.from('employee_work_experience').select('*').eq('employee_id', id).order('created_at'),
        sbAny.from('leave_balances').select('*, leave_types(name, code, color)').eq('employee_id', id),
      ]);
      if (!active || !data) return;
      const r = data as Record<string, any>;
      const nameById = (list: MasterItem[], fkId: string | null) => list.find(x => x.id === fkId)?.name ?? '';
      const st = statRes.data as Record<string, any> | null;
      const education: EducationRecord[] = (eduRes.data ?? []).map((x: any) => ({
        id: x.id, qualification: x.qualification ?? '', specialization: x.specialization ?? '', institution: x.institution ?? '',
        university: x.university ?? '', yearOfPassing: x.year_of_passing ?? '', percentage: x.percentage ?? '', grade: x.grade ?? '', documents: [],
      }));
      const family: FamilyMember[] = (famRes.data ?? []).map((x: any) => ({
        id: x.id, relationship: x.relationship ?? '', name: x.name ?? '', dateOfBirth: x.date_of_birth ?? '', gender: x.gender ?? '',
        occupation: x.occupation ?? '', phone: x.phone ?? '', isDependent: Boolean(x.is_dependent), isNominee: Boolean(x.is_nominee),
        nominationPercentage: Number(x.nomination_percentage ?? 0), nominationPurpose: x.nomination_purpose ?? [], documents: [],
      }));
      const bank: BankAccount[] = (bankRes.data ?? []).map((x: any) => ({
        id: x.id, bankName: x.bank_name ?? '', accountName: x.account_name ?? '', accountNumber: x.account_number ?? '', ifscCode: x.ifsc_code ?? '',
        branchName: x.branch_name ?? '', branchAddress: x.branch_address ?? '', accountType: x.account_type ?? 'Savings',
        isPrimary: Boolean(x.is_primary), swiftCode: x.swift_code ?? '', micrCode: x.micr_code ?? '', documents: [],
      }));
      const languageProficiencies: LanguageProficiency[] = (langRes.data ?? []).map((x: any) => ({
        id: x.id, language: x.language ?? '', speak: x.speak_level ?? 'None', read: x.read_level ?? 'None', write: x.write_level ?? 'None',
      }));
      const openingBalances: LeaveOpeningBalance[] = (lbRes.data ?? []).map((x: any) => {
        const yr = Number(x.year) || CURRENT_YEAR;
        return {
          id: x.id,
          leaveTypeId: x.leave_type_id ?? '',
          leaveTypeName: x.leave_types?.name ?? '',
          leaveTypeCode: x.leave_types?.code ?? '',
          leaveTypeColor: x.leave_types?.color ?? 'blue',
          financialYear: `${yr}-${String((yr + 1) % 100).padStart(2, '0')}`,
          openingBalance: Number(x.opening_balance ?? 0),
          remarks: '',
        };
      });
      const priorWorkExperiences: PriorWorkExperience[] = (expRes.data ?? []).map((x: any) => ({
        id: x.id, companyName: x.company_name ?? '', designation: x.designation ?? '', department: x.department ?? '',
        fromDate: x.from_date ?? '', toDate: x.to_date ?? '', yearsOfExperience: Number(x.years_of_experience ?? 0),
        monthsOfExperience: Number(x.months_of_experience ?? 0), reasonForLeaving: x.reason_for_leaving ?? '', lastSalary: x.last_salary ?? '',
        referenceName: x.reference_name ?? '', referenceDesignation: x.reference_designation ?? '', referencePhone: x.reference_phone ?? '',
        referenceEmail: x.reference_email ?? '', documents: [],
      }));
      setForm(f => ({
        ...f,
        personal: {
          ...f.personal,
          firstName: r.first_name ?? '', middleName: r.middle_name ?? '', lastName: r.last_name ?? '',
          fatherName: r.father_name ?? '', motherName: r.mother_name ?? '', dateOfBirth: r.date_of_birth ?? '',
          placeOfBirth: r.place_of_birth ?? '', nationality: r.nationality ?? '', identificationMarks: r.identification_marks ?? '',
          mobile: r.mobile_number ?? '', email: r.email ?? '',
          gender: r.gender ?? '', maritalStatus: r.marital_status ?? '', anniversaryDate: r.anniversary_date ?? '', bloodGroup: r.blood_group ?? '',
          religion: r.religion ?? '', caste: r.caste ?? '', motherTongue: r.mother_tongue ?? '',
          photo: r.photo_url ?? '', specimenSignature: r.signature_url ?? '', thumbImpression: r.thumb_impression_url ?? '',
          sameAsPresent: Boolean(r.same_address),
          presentAddress: {
            line1: r.present_address_line1 ?? '', line2: r.present_address_line2 ?? '', city: r.present_city ?? '',
            district: r.present_district ?? '', state: r.present_state ?? '', pincode: r.present_pincode ?? '', country: r.present_country ?? 'India',
          },
          permanentAddress: {
            line1: r.permanent_address_line1 ?? '', line2: r.permanent_address_line2 ?? '', city: r.permanent_city ?? '',
            district: r.permanent_district ?? '', state: r.permanent_state ?? '', pincode: r.permanent_pincode ?? '', country: r.permanent_country ?? 'India',
          },
        },
        employment: {
          ...f.employment,
          employeeId: r.employee_id ?? '', currentEmployeeId: r.current_employee_id ?? r.employee_id ?? '',
          serviceBookNo: r.service_book_no ?? '', attendanceSystemId: r.attendance_system_id ?? '',
          dateOfJoining: r.date_of_joining ?? '', dateOfConfirmation: r.date_of_confirmation ?? '',
          probationPeriodMonths: r.probation_period_months ?? 0, section: r.section ?? '',
          designation: nameById(desig, r.designation_id), department: nameById(dept, r.department_id),
          grade: nameById(grade, r.grade_id), employeeType: nameById(etype, r.employee_type_id),
          employeeCategory: nameById(ecat, r.employee_category_id), employeeGroup: nameById(egrp, r.employee_group_id),
          employeeClassification: r.employee_classification ?? '', workLocation: nameById(wloc, r.work_location_id),
          shift: nameById(shft, r.shift_id), reportingManagerId: r.reporting_manager_id ?? '',
          noticePeriodDays: r.notice_period_days ?? 0, offerLetterValidityDays: r.offer_letter_validity_days ?? 0,
          totalExperienceYears: r.total_experience_years ?? 0, totalExperienceMonths: r.total_experience_months ?? 0,
          languageProficiencies, priorWorkExperiences,
        },
        statutory: {
          ...f.statutory,
          panNo: st?.pan_no ?? '', aadharNo: st?.aadhar_no ?? '', uanNo: st?.uan_no ?? '', pfAccountNo: st?.pf_account_no ?? '',
          esiNo: st?.esi_no ?? '', passportNo: st?.passport_no ?? '', passportExpiry: st?.passport_expiry ?? '',
          drivingLicenseNo: st?.driving_license_no ?? '', drivingLicenseExpiry: st?.driving_license_expiry ?? '',
          voterIdNo: st?.voter_id_no ?? '', rationCardNo: st?.ration_card_no ?? '',
        },
        education,
        family,
        bank,
        leaveData: { openingBalances, periodTransactions: [], availedRecords: [] },
      }));
    })();
    return () => { active = false; };
  }, [isEdit, id]);

  // Copy the assigned salary structure (from Salary Structure Assignment) into the
  // employee record when editing — so it can be personalised per employee.
  useEffect(() => {
    if (!isEdit || !id) return;
    let active = true;
    void (async () => {
      const a = await getEmployeeAssignment(id);
      if (!active || !a) return;
      setForm(f => ({
        ...f,
        salaryStructure: {
          structureId: a.structureId, structureName: a.structureName, structureCode: a.structureCode,
          ctcMonthly: a.ctcMonthly, componentValues: a.componentValues, vpfPercentage: a.vpfPercentage,
        },
      }));
    })();
    return () => { active = false; };
  }, [isEdit, id]);

  // Load the Employee ID generation pattern (Establishment Master) + current
  // employee count, so new IDs follow the configured pattern with a running serial.
  useEffect(() => {
    if (isEdit) return;
    let active = true;
    void (async () => {
      const [estRes, countRes] = await Promise.all([
        sbAny.from('establishment').select('employee_id_pattern').limit(1).maybeSingle(),
        sbAny.from('employees').select('id', { count: 'exact', head: true }),
      ]);
      if (!active) return;
      const p = estRes.data?.employee_id_pattern as EmpIdPattern | null;
      if (p && Array.isArray(p.segments)) setIdPattern(p);
      setEmpCount(countRes.count ?? 0);
    })();
    return () => { active = false; };
  }, [isEdit]);

  // The next Employee ID, derived live from the pattern + this employee's
  // joining/birth dates + the running serial (serialStart + existing count).
  const nextEmployeeId = useMemo(
    () => buildEmployeeId(idPattern, { serial: idPattern.serialStart + empCount, doj: form.employment.dateOfJoining, dob: form.personal.dateOfBirth }),
    [idPattern, empCount, form.employment.dateOfJoining, form.personal.dateOfBirth],
  );

  // Keep the auto-generated ID in sync (new employees only; manual overrides in the
  // separate Override field are preserved).
  useEffect(() => {
    if (isEdit || !idPattern.enabled) return;
    setForm(f => {
      if (f.employment.employeeId === nextEmployeeId) return f;
      const keepOverride = f.employment.currentEmployeeId && f.employment.currentEmployeeId !== f.employment.employeeId;
      return { ...f, employment: { ...f.employment, employeeId: nextEmployeeId, currentEmployeeId: keepOverride ? f.employment.currentEmployeeId : nextEmployeeId } };
    });
  }, [nextEmployeeId, isEdit, idPattern.enabled]);

  const handleRegenerateId = () => {
    setForm(f => ({ ...f, employment: { ...f.employment, employeeId: nextEmployeeId, currentEmployeeId: nextEmployeeId } }));
    toast.success('Employee ID regenerated from the establishment pattern.');
  };

  const handleSave = async () => {
    if (!form.personal.firstName || !form.personal.lastName) {
      toast.error('First Name and Last Name are required.');
      setActiveTab('personal');
      return;
    }
    if (!form.employment.designation || !form.employment.department) {
      toast.error('Designation and Department are required.');
      setActiveTab('employment');
      return;
    }
    if (!form.employment.dateOfJoining) {
      toast.error('Date of Joining is required.');
      setActiveTab('employment');
      return;
    }

    // Persist the core employee record to the Supabase `employees` table.
    const row = await buildEmployeeRow(form);
    let employeeUuid: string;
    if (isEdit && id) {
      const { error } = await sbAny.from('employees').update(row).eq('id', id);
      if (error) { toast.error(error.message); return; }
      employeeUuid = id;
    } else {
      const { data, error } = await sbAny.from('employees').insert(row).select('id').single();
      if (error) { toast.error(error.message); return; }
      employeeUuid = data.id;
    }

    // Persist all child collections (statutory, education, family, bank, languages, work experience).
    const childErr = await persistEmployeeChildren(employeeUuid, form);
    if (childErr) { toast.error(childErr); return; }

    setSaved(true);

    const fullNameForSave = [form.personal.firstName, form.personal.middleName, form.personal.lastName].filter(Boolean).join(' ');
    const employeeId = form.employment.currentEmployeeId || form.employment.employeeId;

    // Persist the per-employee salary structure (DB) so Payroll + Salary Structure
    // Assignment read the same source. Component values carry the personalisation.
    if (form.salaryStructure.structureId && employeeUuid) {
      const aErr = await upsertEmployeeAssignment({
        empId: employeeUuid,
        structureId: form.salaryStructure.structureId,
        ctcMonthly: form.salaryStructure.ctcMonthly,
        componentValues: form.salaryStructure.componentValues,
        vpfPercentage: form.salaryStructure.vpfPercentage,
        effectiveFrom: form.employment.dateOfJoining || undefined,
      });
      if (aErr.error) { toast.error(aErr.error); return; }
    }

    if (!isEdit) {
      const fullName = [form.personal.firstName, form.personal.middleName, form.personal.lastName].filter(Boolean).join(' ');
      setCreatedUserInfo({
        employeeId: form.employment.currentEmployeeId || form.employment.employeeId,
        name: fullName, email: '', uuid: employeeUuid, department: form.employment.department || '',
      });
      setShowUserCreationModal(true);
    } else {
      toast.success(`Employee ${form.personal.firstName} ${form.personal.lastName} updated successfully!`);
    }
  };

  // Generate a fresh portal password for this employee, flag must-change, and notify by email.
  const handleGeneratePassword = async () => {
    const loginId = form.employment.currentEmployeeId || form.employment.employeeId;
    if (!loginId) { toast.error('No Employee ID available.'); return; }
    setResettingPassword(true);
    const res = await resetPasswordAndNotify(loginId);
    setResettingPassword(false);
    if (res.error || !res.password) {
      toast.error(res.error ?? 'Could not generate password. Is a user account created for this employee?');
      return;
    }
    setGeneratedPasswordInfo({
      loginId,
      password: res.password,
      emailed: !!res.notified,
      hasEmail: !!res.account?.email,
    });
  };

  const handleUserCreationConfirm = async (password: string) => {
    if (!createdUserInfo) return;
    const loginId = createdUserInfo.employeeId;
    // Create the User Master (system_users) record: login ID = Employee ID, password = Employee ID (or custom).
    const userRow = {
      name: createdUserInfo.name || loginId,
      email: loginId,            // no employee email captured — Employee ID doubles as the login/email
      login_id: loginId,
      password: password || loginId,
      role: 'Employee',
      status: 'Active',
      avatar: (createdUserInfo.name || loginId).split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      department: createdUserInfo.department || null,
      two_factor_enabled: false,
      employee_id: createdUserInfo.uuid || null,
    };
    // New accounts must change their password on first login.
    const { error } = await sbAny.from('system_users').upsert({ ...userRow, must_change_password: true }, { onConflict: 'login_id' });
    setShowUserCreationModal(false);
    if (error) {
      toast.error(`Employee saved, but user account could not be created: ${error.message}`, { autoClose: 6000 });
    } else {
      // Notify the employee of their portal credentials by email.
      const email = form.personal.email?.trim() || null;
      await sendNotificationEmail({
        employeeId: createdUserInfo.uuid || null,
        toEmail: email,
        category: 'credentials',
        subject: 'Your SakthiHR Self-Service Login',
        message: `<p>Welcome to SakthiHR, ${createdUserInfo.name || loginId}! Your Employee Self-Service login has been created.</p>` +
          `<p><strong>Login ID:</strong> ${loginId}<br/><strong>Password:</strong> ${password || loginId}</p>` +
          `<p>Please log in and change your password on first login.</p>`,
      });
      toast.success(
        `✓ Employee saved & User account created! Login ID & password: ${loginId}${email ? ' · credentials emailed' : ''}`,
        { autoClose: 5000 },
      );
    }
    setTimeout(() => navigate('/employees'), 1500);
  };

  const handleUserCreationSkip = () => {
    setShowUserCreationModal(false);
    toast.success(`Employee ${form.personal.firstName} ${form.personal.lastName} saved successfully!`);
    setTimeout(() => navigate('/employees'), 1500);
  };

  const handleUserCreationClose = () => {
    setShowUserCreationModal(false);
    toast.success(`Employee ${form.personal.firstName} ${form.personal.lastName} saved successfully!`);
  };

  const getTabCompletion = (tab: EmployeeTab): number => {
    if (tab === 'personal') {
      const fields = [form.personal.firstName, form.personal.lastName, form.personal.dateOfBirth, form.personal.gender, form.personal.nationality];
      return Math.round((fields.filter(Boolean).length / fields.length) * 100);
    }
    if (tab === 'employment') {
      const fields = [form.employment.designation, form.employment.department, form.employment.dateOfJoining, form.employment.workLocation, form.employment.employeeType];
      return Math.round((fields.filter(Boolean).length / fields.length) * 100);
    }
    if (tab === 'statutory') {
      const fields = [form.statutory.panNo, form.statutory.aadharNo];
      return Math.round((fields.filter(Boolean).length / fields.length) * 100);
    }
    if (tab === 'education') return form.education.length > 0 ? 100 : 0;
    if (tab === 'family') return form.family.length > 0 ? 100 : 0;
    if (tab === 'bank') return form.bank.length > 0 ? 100 : 0;
    if (tab === 'documents') return form.documents.photo ? 100 : 0;
    if (tab === 'salary-structure') return form.salaryStructure.structureId && form.salaryStructure.ctcMonthly > 0 ? 100 : 0;
    if (tab === 'leave-balances') return form.leaveData.openingBalances.length > 0 ? 100 : 0;
    return 0;
  };

  const overallCompletion = Math.round(
    (getTabCompletion('personal') + getTabCompletion('employment') + getTabCompletion('statutory') +
     getTabCompletion('education') + getTabCompletion('family') + getTabCompletion('bank') +
     getTabCompletion('documents') + getTabCompletion('salary-structure') + getTabCompletion('leave-balances')) / 9
  );

  const tabs: { key: EmployeeTab; label: string; icon: React.ElementType; badge?: string | number }[] = [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'employment', label: 'Employment', icon: Briefcase, badge: form.employment.priorWorkExperiences.length > 0 ? form.employment.priorWorkExperiences.length : undefined },
    { key: 'statutory', label: 'Statutory', icon: Shield },
    { key: 'education', label: 'Education', icon: GraduationCap, badge: form.education.length || undefined },
    { key: 'family', label: 'Family', icon: Users, badge: form.family.length || undefined },
    { key: 'bank', label: 'Bank', icon: Banknote, badge: form.bank.length || undefined },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'salary-structure', label: 'Salary Structure', icon: Wallet, badge: form.salaryStructure.structureCode || undefined },
    { key: 'leave-balances', label: 'Leave Balances', icon: CalendarDays, badge: form.leaveData.openingBalances.length > 0 ? form.leaveData.openingBalances.length : undefined },
    { key: 'assets', label: 'Assets', icon: Boxes },
  ];

  const fullName = [form.personal.firstName, form.personal.middleName, form.personal.lastName].filter(Boolean).join(' ');
  const leaveTypeOptions = useLeaveTypeOptions();
  const dbStructures = useDbStructures();
  const filledLanguages = form.employment.languageProficiencies.filter(l => l.language).length;

  // Compute current leave balance for summary widget
  const leaveBalanceSummaryForWidget = useMemo(() => {
    const map = new Map<string, { leaveTypeId: string; leaveTypeName: string; leaveTypeCode: string; leaveTypeColor: string; totalAccrued: number; totalAvailed: number; currentBalance: number; openingBalance: number }>();
    form.leaveData.openingBalances.forEach(ob => {
      map.set(ob.leaveTypeId, {
        leaveTypeId: ob.leaveTypeId,
        leaveTypeName: ob.leaveTypeName,
        leaveTypeCode: ob.leaveTypeCode,
        leaveTypeColor: ob.leaveTypeColor,
        totalAccrued: 0,
        totalAvailed: 0,
        currentBalance: ob.openingBalance,
        openingBalance: ob.openingBalance,
      });
    });
    const latestByLeaveType = new Map<string, PeriodLeaveTransaction>();
    form.leaveData.periodTransactions.forEach(pt => {
      const existing = latestByLeaveType.get(pt.leaveTypeId);
      if (!existing || pt.payPeriodId > existing.payPeriodId) {
        latestByLeaveType.set(pt.leaveTypeId, pt);
      }
    });
    latestByLeaveType.forEach((pt, leaveTypeId) => {
      const totalAccrued = form.leaveData.periodTransactions.filter(t => t.leaveTypeId === leaveTypeId).reduce((s, t) => s + t.accrued, 0);
      const totalAvailed = form.leaveData.periodTransactions.filter(t => t.leaveTypeId === leaveTypeId).reduce((s, t) => s + t.availed, 0);
      const existing = map.get(leaveTypeId);
      map.set(leaveTypeId, {
        leaveTypeId,
        leaveTypeName: pt.leaveTypeName,
        leaveTypeCode: pt.leaveTypeCode,
        leaveTypeColor: pt.leaveTypeColor,
        totalAccrued,
        totalAvailed,
        currentBalance: pt.closingBalance,
        openingBalance: existing?.openingBalance ?? 0,
      });
    });
    return Array.from(map.values());
  }, [form.leaveData]);

  const totalAvailableLeave = leaveBalanceSummaryForWidget.reduce((s, l) => s + l.currentBalance, 0);

  return (
    <SignerContext.Provider value={{ name: fullName, id: form.employment.currentEmployeeId || form.employment.employeeId }}>
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/employees')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              {form.personal.photo ? (
                <div className="w-10 h-10 rounded-xl border border-border bg-white overflow-hidden shadow-sm">
                  <img src={form.personal.photo} alt="Employee" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User size={22} className="text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">
                  {isEdit ? `Edit Employee — ${fullName || id}` : fullName ? `New Employee — ${fullName}` : 'New Employee Entry'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {form.employment.employeeId && (
                    <span className="font-mono font-bold text-primary mr-2">{form.employment.currentEmployeeId || form.employment.employeeId}</span>
                  )}
                  {form.employment.designation && form.employment.department && `${form.employment.designation} · ${form.employment.department}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isEdit && (
                <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <UserPlus size={14} className="text-indigo-600 shrink-0" />
                  <span className="text-xs font-medium text-indigo-700">Auto-user on save</span>
                </div>
              )}
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-lg">
                <div className="w-24 h-1.5 bg-accent rounded-full">
                  <div className={`h-full rounded-full transition-all ${overallCompletion >= 80 ? 'bg-green-500' : overallCompletion >= 50 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${overallCompletion}%` }} />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{overallCompletion}% complete</span>
              </div>
              {saved && !showUserCreationModal && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium">
                  <CheckCircle2 size={14} /> Saved
                </motion.div>
              )}
              {isEdit && (
                <button onClick={handleGeneratePassword} disabled={resettingPassword} className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-medium text-sm disabled:opacity-50">
                  {resettingPassword ? <RefreshCw size={16} className="animate-spin" /> : <Key size={16} />} Generate Password
                </button>
              )}
              <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md font-medium text-sm">
                <Save size={16} /> {isEdit ? 'Update Employee' : 'Save Employee'}
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex items-center gap-0.5 mt-3 overflow-x-auto">
            {tabs.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              const completion = getTabCompletion(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg border-b-2 whitespace-nowrap ${
                    isActive
                      ? 'text-primary border-primary bg-primary/5'
                      : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  <TabIcon size={15} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground'}`}>
                      {tab.badge}
                    </span>
                  )}
                  {(tab.key === 'personal' || tab.key === 'employment') && (
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                      completion === 100 ? 'bg-green-100 text-green-700' :
                      completion >= 50 ? 'bg-amber-100 text-amber-700' :
                      isActive ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground'
                    }`}>
                      {completion === 100 ? '✓' : `${completion}%`}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-8 pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {[
              { label: 'Employee ID', value: form.employment.currentEmployeeId || form.employment.employeeId || '—', icon: Hash, color: 'bg-primary/10', iconColor: 'text-primary' },
              { label: 'Name', value: fullName || '—', icon: User, color: 'bg-blue-100', iconColor: 'text-blue-600' },
              { label: 'Father', value: form.personal.fatherName || '—', icon: User, color: 'bg-indigo-100', iconColor: 'text-indigo-600' },
              { label: 'Mother', value: form.personal.motherName || '—', icon: User, color: 'bg-pink-100', iconColor: 'text-pink-600' },
              { label: 'Designation', value: form.employment.designation || '—', icon: Briefcase, color: 'bg-violet-100', iconColor: 'text-violet-600' },
              { label: 'Reporting To', value: form.employment.reportingManagerName || '—', icon: Network, color: 'bg-indigo-100', iconColor: 'text-indigo-600' },
              { label: 'Languages', value: `${filledLanguages} known`, icon: Languages, color: 'bg-teal-100', iconColor: 'text-teal-600' },
              {
                label: 'Leave Balance',
                value: `${totalAvailableLeave.toFixed(1)}d avail.`,
                icon: CalendarDays,
                color: totalAvailableLeave > 10 ? 'bg-emerald-100' : totalAvailableLeave > 5 ? 'bg-amber-100' : 'bg-rose-100',
                iconColor: totalAvailableLeave > 10 ? 'text-emerald-600' : totalAvailableLeave > 5 ? 'text-amber-600' : 'text-rose-600',
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -3 }}
                onClick={i === 7 ? () => setActiveTab('leave-balances') : undefined}
                className={`bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3 ${i === 7 ? 'cursor-pointer hover:border-teal-300 hover:shadow-md transition-all' : ''}`}
              >
                <div className={`p-2 ${card.color} rounded-xl shrink-0`}><card.icon size={16} className={card.iconColor} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="font-bold text-xs mt-0.5 truncate">{card.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Leave Balance Summary Widget — shown on all tabs except leave-balances itself */}
          {activeTab !== 'leave-balances' && leaveBalanceSummaryForWidget.length > 0 && (
            <div className="mb-6">
              <LeaveBalanceSummaryWidget
                leaveData={form.leaveData}
                onNavigateToLeaveTab={() => setActiveTab('leave-balances')}
              />
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="px-8 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'personal' && (
                <PersonalTab data={form.personal} onChange={personal => setForm(f => ({ ...f, personal }))} employeeId={id} />
              )}
              {activeTab === 'employment' && (
                <EmploymentTab data={form.employment} onChange={employment => setForm(f => ({ ...f, employment }))} onRegenerateId={handleRegenerateId} />
              )}
              {activeTab === 'statutory' && (
                <StatutoryTab data={form.statutory} onChange={statutory => setForm(f => ({ ...f, statutory }))} />
              )}
              {activeTab === 'education' && (
                <EducationTab data={form.education} onChange={education => setForm(f => ({ ...f, education }))} />
              )}
              {activeTab === 'family' && (
                <FamilyTab data={form.family} onChange={family => setForm(f => ({ ...f, family }))} />
              )}
              {activeTab === 'bank' && (
                <BankTab data={form.bank} onChange={bank => setForm(f => ({ ...f, bank }))} />
              )}
              {activeTab === 'documents' && (
                <div className="space-y-5">
                  <DocumentsTab data={form.documents} onChange={documents => setForm(f => ({ ...f, documents }))} />
                  <EmployeeDocumentFormats employeeId={id} />
                </div>
              )}
              {activeTab === 'salary-structure' && (
                <SalaryStructureTab data={form.salaryStructure} onChange={salaryStructure => setForm(f => ({ ...f, salaryStructure }))} structures={dbStructures} employeeId={id} workLocation={form.employment.workLocation} />
              )}
              {activeTab === 'leave-balances' && (
                <LeaveBalancesTab
                  data={form.leaveData}
                  onChange={leaveData => setForm(f => ({ ...f, leaveData }))}
                  employeeName={fullName}
                  leaveTypeOptions={leaveTypeOptions}
                />
              )}
              {activeTab === 'assets' && <EmployeeAssetsTab employeeId={id} employeeName={fullName} />}
            </motion.div>
          </AnimatePresence>

          {/* Bottom Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={() => {
                const idx = tabs.findIndex(t => t.key === activeTab);
                if (idx > 0) setActiveTab(tabs[idx - 1].key);
              }}
              disabled={activeTab === 'personal'}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              {activeTab !== 'personal' ? `Previous: ${tabs[tabs.findIndex(t => t.key === activeTab) - 1]?.label}` : 'Previous'}
            </button>

            <div className="flex items-center gap-3">
              {activeTab !== 'leave-balances' ? (
                <button
                  onClick={() => {
                    const idx = tabs.findIndex(t => t.key === activeTab);
                    if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].key);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md font-medium text-sm"
                >
                  Next: {tabs[tabs.findIndex(t => t.key === activeTab) + 1]?.label}
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-8 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md font-medium text-sm"
                >
                  <Save size={16} /> {isEdit ? 'Update Employee' : 'Save Employee'}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Auto User Creation Modal */}
      <AnimatePresence>
        {showUserCreationModal && createdUserInfo && (
          <AutoUserCreationModal
            employeeId={createdUserInfo.employeeId}
            employeeName={createdUserInfo.name}
            email={createdUserInfo.email}
            onConfirm={handleUserCreationConfirm}
            onSkip={handleUserCreationSkip}
            onClose={handleUserCreationClose}
          />
        )}
      </AnimatePresence>

      {/* Generated-password result modal */}
      <AnimatePresence>
        {generatedPasswordInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl"><Key size={20} className="text-amber-600" /></div>
                  <div>
                    <h2 className="text-base font-bold text-amber-900">New Password Generated</h2>
                    <p className="text-xs text-amber-600">The employee must change it on first login</p>
                  </div>
                </div>
                <button onClick={() => setGeneratedPasswordInfo(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-accent/30 rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Login ID</p>
                      <p className="text-sm font-bold font-mono text-primary">{generatedPasswordInfo.loginId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">New Password</p>
                      <p className="text-sm font-bold font-mono text-amber-600">{generatedPasswordInfo.password}</p>
                    </div>
                  </div>
                </div>
                <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border ${generatedPasswordInfo.hasEmail ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                  {generatedPasswordInfo.hasEmail
                    ? <CheckCircle2 size={14} className="text-green-600 shrink-0 mt-0.5" />
                    : <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />}
                  <p className={`text-[11px] ${generatedPasswordInfo.hasEmail ? 'text-green-700' : 'text-amber-700'}`}>
                    {generatedPasswordInfo.hasEmail
                      ? 'The new password has been emailed to the employee.'
                      : 'No email address on file — add one in the Personal tab to email the password. Share it manually for now.'}
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-accent/10">
                <button onClick={() => { navigator.clipboard.writeText(generatedPasswordInfo.password); toast.success('Password copied!'); }} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium">
                  <Copy size={15} /> Copy Password
                </button>
                <button onClick={() => setGeneratedPasswordInfo(null)} className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">Done</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </SignerContext.Provider>
  );
}