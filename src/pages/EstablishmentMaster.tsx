import DateInput from '../components/DateInput';
import { formatDate, todayFormatted } from '../utils/date';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase/client';
import { uploadLetterheadImage } from '../lib/storage';
import DocumentSignControl from '../components/DocumentSignControl';
import SecureDocUploadZone from '../components/SecureDocUploadZone';
import { uploadDocument, listDocuments, deleteDocument, signDocument, openDocument, type StoredDocument } from '../lib/documents';
import type { SignatureData } from '../components/AadhaarOTPSigning';
import {
  type EmpIdPattern, type EmpIdSegment, type EmpIdSegmentType,
  defaultEmpIdPattern, newSegment, sampleEmployeeId, SEGMENT_META, YEAR_FORMATS, DOB_FORMATS,
} from '../lib/employeeId';
import { ROUND_OPTIONS, type RoundCode } from '../data/salaryStructures';
import { sendEmployeeEmail } from '../lib/email';
import {
  Building2,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown, ChevronUp,
  X,
  Search,
  Globe,
  Phone,
  Mail,
  Hash,
  Users,
  FolderTree,
  CheckCircle2,
  AlertCircle,
  Save,
  ChevronLeft,
  Landmark,
  Shield,
  CreditCard,
  Receipt,
  Briefcase,
  FileText,
  BadgeCheck,
  Upload,
  Eye,
  Paperclip,
  Home,
  IdCard,
  User,
  DollarSign,
  Calendar,
  Banknote,
  Building,
  Info,
  LayoutList,
  FileCheck,
  Download,
  Image,
  Camera,
  Trash,
  Layout,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  FileImage,
  Printer,
  Star,
  Copy,
  Send,
  ToggleLeft,
  ToggleRight,
  Layers
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { toast } from 'react-toastify';
import BulkImport from '../components/configuration/BulkImport';

// ─── Types ────────────────────────────────────────────────────────────────────

type EstablishmentTab = 'basic' | 'locations' | 'departments' | 'statutory' | 'bank' | 'documents' | 'letterhead';

interface WorkLocation {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  status: 'Active' | 'Inactive';
  employeeCount: number;
  statutory: LocationStatutory;
  bankAccounts: BankAccount[];
  letterhead: LocationLetterhead;
}

interface LocationStatutory {
  linNo: string;
  epfCodeNo: string;
  esiCodeNo: string;
  panNo: string;
  gstCode: string;
  tanNo: string;
  cinNo: string;
  ptNo: string;
  documents: DocumentStore;
}

interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  locationId: string;
  headName: string;
  employeeCount: number;
  status: 'Active' | 'Inactive';
  children?: Department[];
}

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  branchAddress: string;
  accountType: 'Current' | 'Savings' | 'Overdraft' | 'Cash Credit';
  isPrimary: boolean;
  swiftCode: string;
  micrCode: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

// ─── Letterhead Types ─────────────────────────────────────────────────────────

type TextAlignment = 'left' | 'center' | 'right';
type FontSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';

interface LetterheadSection {
  enabled: boolean;
  logoDataUrl: string;
  logoPosition: 'left' | 'center' | 'right';
  logoSize: 'sm' | 'md' | 'lg';
  // Header image (full-width banner image)
  headerImageDataUrl: string;
  headerImageHeight: 'sm' | 'md' | 'lg';
  companyName: string;
  companyNameSize: FontSize;
  companyNameAlignment: TextAlignment;
  companyNameColor: string;
  tagline: string;
  taglineAlignment: TextAlignment;
  taglineColor: string;
  addressLine: string;
  addressAlignment: TextAlignment;
  contactLine: string;
  contactAlignment: TextAlignment;
  websiteLine: string;
  websiteAlignment: TextAlignment;
  dividerEnabled: boolean;
  dividerColor: string;
  dividerThickness: 'thin' | 'medium' | 'thick';
  backgroundColor: string;
  customHtml: string;
  useCustomHtml: boolean;
}

interface LetterheadFooter {
  enabled: boolean;
  // Footer image (full-width banner image)
  footerImageDataUrl: string;
  footerImageHeight: 'sm' | 'md' | 'lg';
  line1: string;
  line1Alignment: TextAlignment;
  line1Color: string;
  line2: string;
  line2Alignment: TextAlignment;
  line2Color: string;
  showPageNumber: boolean;
  pageNumberAlignment: TextAlignment;
  dividerEnabled: boolean;
  dividerColor: string;
  dividerThickness: 'thin' | 'medium' | 'thick';
  backgroundColor: string;
  customHtml: string;
  useCustomHtml: boolean;
}

interface LetterheadUsage {
  payslip: boolean;
  offerLetter: boolean;
  memo: boolean;
  transferLetter: boolean;
  experienceLetter: boolean;
  relievingLetter: boolean;
  appointmentLetter: boolean;
  warningLetter: boolean;
}

interface LocationLetterhead {
  id: string;
  isActive: boolean;
  header: LetterheadSection;
  footer: LetterheadFooter;
  usage: LetterheadUsage;
  paperSize: 'A4' | 'Letter' | 'Legal';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  updatedAt: string;
}

interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dataUrl: string;
  category: string;
  description: string;
  signature?: SignatureData;
}

interface DocumentStore {
  [fieldKey: string]: UploadedDoc[];
}

interface PersonDetails {
  name: string;
  designation: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

interface EstablishmentData {
  name: string;
  shortName: string;
  incorporationDate: string;
  industryType: string;
  entityType: string;
  website: string;
  email: string;
  phone: string;
  currency: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  logoDataUrl: string;
  occupier: PersonDetails;
  manager: PersonDetails;
  employeeIdPattern: EmpIdPattern;
  netRoundoff: RoundCode;
  // Email / SMTP
  emailEnabled: boolean;
  emailProvider: 'smtp' | 'off';
  emailHost: string;
  emailPort: string;
  emailSecure: boolean;
  emailUsername: string;
  emailPassword: string;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
];

const INDUSTRY_TYPES = [
  'Manufacturing', 'Information Technology', 'Banking & Finance',
  'Healthcare', 'Retail & E-Commerce', 'Construction', 'Education',
  'Hospitality', 'Logistics & Transport', 'Consulting', 'Other'
];

const ENTITY_TYPES = [
  'Private Limited Company', 'Public Limited Company', 'Limited Liability Partnership',
  'Partnership Firm', 'Sole Proprietorship', 'One Person Company', 'Trust / NGO', 'Government Body'
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

const DOCUMENT_CATEGORIES = [
  'Incorporation Certificate', 'PAN Card', 'GST Registration', 'EPF Registration',
  'ESI Registration', 'TAN Allotment', 'LIN Certificate', 'PT Registration',
  'CIN Certificate', 'Bank Statement', 'Audited Financials', 'Board Resolution',
  'MOA / AOA', 'Lease Agreement', 'Insurance Policy', 'Other',
];

const REPORT_TYPES: { key: keyof LetterheadUsage; label: string; icon: string }[] = [
  { key: 'payslip', label: 'Payslip', icon: '💰' },
  { key: 'offerLetter', label: 'Offer Letter', icon: '📋' },
  { key: 'memo', label: 'Memo', icon: '📝' },
  { key: 'transferLetter', label: 'Transfer Letter', icon: '🔄' },
  { key: 'experienceLetter', label: 'Experience Letter', icon: '🏆' },
  { key: 'relievingLetter', label: 'Relieving Letter', icon: '👋' },
  { key: 'appointmentLetter', label: 'Appointment Letter', icon: '✅' },
  { key: 'warningLetter', label: 'Warning Letter', icon: '⚠️' },
];

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'xs', label: 'Extra Small' },
  { value: 'sm', label: 'Small' },
  { value: 'base', label: 'Normal' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
  { value: '2xl', label: '2X Large' },
];

const FONT_SIZE_MAP: Record<FontSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};

const ALIGN_MAP: Record<TextAlignment, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyStatutory = (): LocationStatutory => ({
  linNo: '', epfCodeNo: '', esiCodeNo: '', panNo: '', gstCode: '', tanNo: '', cinNo: '', ptNo: '',
  documents: {},
});

const emptyBankAccounts = (): BankAccount[] => [];

const emptyLetterhead = (locationName: string, address: string, phone: string, email: string, website: string): LocationLetterhead => ({
  id: `LH-${Date.now()}`,
  isActive: false,
  header: {
    enabled: true,
    logoDataUrl: '',
    logoPosition: 'left',
    logoSize: 'md',
    headerImageDataUrl: '',
    headerImageHeight: 'md',
    companyName: locationName,
    companyNameSize: 'xl',
    companyNameAlignment: 'center',
    companyNameColor: '#1e3a5f',
    tagline: '',
    taglineAlignment: 'center',
    taglineColor: '#6b7280',
    addressLine: address,
    addressAlignment: 'center',
    contactLine: phone ? `Tel: ${phone}${email ? ' | Email: ' + email : ''}` : '',
    contactAlignment: 'center',
    websiteLine: website,
    websiteAlignment: 'center',
    dividerEnabled: true,
    dividerColor: '#1e3a5f',
    dividerThickness: 'medium',
    backgroundColor: '#ffffff',
    customHtml: '',
    useCustomHtml: false,
  },
  footer: {
    enabled: true,
    footerImageDataUrl: '',
    footerImageHeight: 'sm',
    line1: 'This is a computer-generated document.',
    line1Alignment: 'center',
    line1Color: '#6b7280',
    line2: '',
    line2Alignment: 'center',
    line2Color: '#6b7280',
    showPageNumber: true,
    pageNumberAlignment: 'right',
    dividerEnabled: true,
    dividerColor: '#1e3a5f',
    dividerThickness: 'medium',
    backgroundColor: '#ffffff',
    customHtml: '',
    useCustomHtml: false,
  },
  usage: {
    payslip: true,
    offerLetter: true,
    memo: true,
    transferLetter: true,
    experienceLetter: true,
    relievingLetter: true,
    appointmentLetter: true,
    warningLetter: true,
  },
  paperSize: 'A4',
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 25,
  marginRight: 25,
  updatedAt: todayFormatted(),
});

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

const emptyPerson = (): PersonDetails => ({
  name: '', designation: '', phone: '', email: '',
  addressLine1: '', addressLine2: '', city: '', district: '', state: '', pincode: '',
});

// ─── Supabase row mapping (DB-only persistence) ────────────────────────────────
type DbRow = Record<string, unknown> & { id: string };
const eNum = (v: unknown, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));

// establishment (single-row identity table)
function rowToEstData(r: DbRow): EstablishmentData {
  return {
    name: (r.name as string) ?? '', shortName: (r.short_name as string) ?? '',
    incorporationDate: (r.incorporation_date as string) ?? '', industryType: (r.industry_type as string) ?? '',
    entityType: (r.entity_type as string) ?? '', website: (r.website as string) ?? '',
    email: (r.email as string) ?? '', phone: (r.phone as string) ?? '',
    currency: (r.currency_code as string) ?? 'INR', addressLine1: (r.address_line1 as string) ?? '',
    addressLine2: (r.address_line2 as string) ?? '', city: (r.city as string) ?? '',
    district: (r.district as string) ?? '', state: (r.state as string) ?? '',
    pincode: (r.pincode as string) ?? '', country: (r.country as string) ?? 'India',
    logoDataUrl: (r.logo_url as string) ?? '',
    occupier: {
      name: (r.occupier_name as string) ?? '', designation: (r.occupier_designation as string) ?? '',
      phone: (r.occupier_phone as string) ?? '', email: (r.occupier_email as string) ?? '',
      addressLine1: (r.occupier_address_line1 as string) ?? '', addressLine2: (r.occupier_address_line2 as string) ?? '',
      city: (r.occupier_city as string) ?? '', district: (r.occupier_district as string) ?? '',
      state: (r.occupier_state as string) ?? '', pincode: (r.occupier_pincode as string) ?? '',
    },
    manager: {
      name: (r.manager_name as string) ?? '', designation: (r.manager_designation as string) ?? '',
      phone: (r.manager_phone as string) ?? '', email: (r.manager_email as string) ?? '',
      addressLine1: (r.manager_address_line1 as string) ?? '', addressLine2: (r.manager_address_line2 as string) ?? '',
      city: (r.manager_city as string) ?? '', district: (r.manager_district as string) ?? '',
      state: (r.manager_state as string) ?? '', pincode: (r.manager_pincode as string) ?? '',
    },
    employeeIdPattern: (r.employee_id_pattern as EmpIdPattern | null) ?? defaultEmpIdPattern(),
    netRoundoff: (r.net_roundoff as RoundCode) ?? 'nearest_100',
    emailEnabled: Boolean(r.email_enabled),
    emailProvider: ((r.email_provider as 'smtp' | 'off') ?? 'smtp'),
    emailHost: (r.email_host as string) ?? '',
    emailPort: r.email_port != null ? String(r.email_port) : '',
    emailSecure: r.email_secure === undefined || r.email_secure === null ? true : Boolean(r.email_secure),
    emailUsername: (r.email_username as string) ?? '',
    emailPassword: (r.email_password as string) ?? '',
    emailFromName: (r.email_from_name as string) ?? '',
    emailFromAddress: (r.email_from_address as string) ?? '',
    emailReplyTo: (r.email_reply_to as string) ?? '',
  };
}
function estDataToRow(d: EstablishmentData): Record<string, unknown> {
  const pc = (p: PersonDetails, pre: string) => ({
    [`${pre}_name`]: p.name || null, [`${pre}_designation`]: p.designation || null,
    [`${pre}_phone`]: p.phone || null, [`${pre}_email`]: p.email || null,
    [`${pre}_address_line1`]: p.addressLine1 || null, [`${pre}_address_line2`]: p.addressLine2 || null,
    [`${pre}_city`]: p.city || null, [`${pre}_district`]: p.district || null,
    [`${pre}_state`]: p.state || null, [`${pre}_pincode`]: p.pincode || null,
  });
  return {
    name: d.name.trim(), short_name: d.shortName || null, incorporation_date: d.incorporationDate || null,
    industry_type: d.industryType || null, entity_type: d.entityType || null, website: d.website || null,
    email: d.email || null, phone: d.phone || null, currency_code: d.currency || 'INR',
    address_line1: d.addressLine1 || null, address_line2: d.addressLine2 || null, city: d.city || null,
    district: d.district || null, state: d.state || null, pincode: d.pincode || null, country: d.country || null,
    logo_url: d.logoDataUrl || null, ...pc(d.occupier, 'occupier'), ...pc(d.manager, 'manager'),
    employee_id_pattern: d.employeeIdPattern,
    net_roundoff: d.netRoundoff || 'nearest_100',
    email_enabled: d.emailEnabled,
    email_provider: d.emailProvider || 'smtp',
    email_host: d.emailHost?.trim() || null,
    email_port: d.emailPort?.trim() ? Number(d.emailPort) : null,
    email_secure: d.emailSecure,
    email_username: d.emailUsername?.trim() || null,
    email_password: d.emailPassword || null,
    email_from_name: d.emailFromName?.trim() || null,
    email_from_address: d.emailFromAddress?.trim() || null,
    email_reply_to: d.emailReplyTo?.trim() || null,
  };
}

// departments
function rowToDept(r: DbRow): Department {
  return {
    id: r.id, name: (r.name as string) ?? '', code: (r.code as string) ?? '',
    parentId: (r.parent_id as string) ?? null, locationId: (r.location_id as string) ?? '',
    headName: (r.head_name as string) ?? '', employeeCount: eNum(r.employee_count),
    status: (r.status as Department['status']) ?? 'Active',
  };
}
function deptToRow(d: { name: string; code: string; parentId: string | null; locationId: string; headName: string; status: 'Active' | 'Inactive' }): Record<string, unknown> {
  return {
    name: d.name.trim(), code: d.code.trim(), parent_id: d.parentId || null,
    location_id: d.locationId || null, head_name: d.headName || null, status: d.status,
  };
}

// work locations (core + statutory + bank accounts + letterhead; factory columns untouched here)
function rowToBank(r: DbRow): BankAccount {
  return {
    id: r.id, bankName: (r.bank_name as string) ?? '', accountName: (r.account_name as string) ?? '',
    accountNumber: (r.account_number as string) ?? '', ifscCode: (r.ifsc_code as string) ?? '',
    branchName: (r.branch_name as string) ?? '', branchAddress: (r.branch_address as string) ?? '',
    accountType: (r.account_type as BankAccount['accountType']) ?? 'Current', isPrimary: Boolean(r.is_primary),
    swiftCode: (r.swift_code as string) ?? '', micrCode: (r.micr_code as string) ?? '',
    status: (r.status as BankAccount['status']) ?? 'Active',
    createdAt: r.created_at ? formatDate(r.created_at as string) : '',
  };
}
function bankToRow(b: BankAccount, locationId: string): Record<string, unknown> {
  return {
    location_id: locationId, bank_name: b.bankName, account_name: b.accountName, account_number: b.accountNumber,
    ifsc_code: b.ifscCode, branch_name: b.branchName, branch_address: b.branchAddress, account_type: b.accountType,
    is_primary: b.isPrimary, swift_code: b.swiftCode || null, micr_code: b.micrCode || null, status: b.status,
  };
}
function rowToLetterhead(r: DbRow | undefined, fallbackName: string): LocationLetterhead {
  if (!r) return emptyLetterhead(fallbackName, '', '', '', '');
  return {
    id: r.id, isActive: Boolean(r.is_active),
    header: {
      enabled: Boolean(r.header_enabled), logoDataUrl: (r.header_logo_url as string) ?? '',
      logoPosition: (r.header_logo_position as 'left' | 'center' | 'right') ?? 'left',
      logoSize: (r.header_logo_size as 'sm' | 'md' | 'lg') ?? 'md',
      headerImageDataUrl: (r.header_image_url as string) ?? '', headerImageHeight: (r.header_image_height as 'sm' | 'md' | 'lg') ?? 'md',
      companyName: (r.header_company_name as string) ?? '', companyNameSize: (r.header_company_name_size as FontSize) ?? 'xl',
      companyNameAlignment: (r.header_company_name_align as TextAlignment) ?? 'center', companyNameColor: (r.header_company_name_color as string) ?? '#1e3a5f',
      tagline: (r.header_tagline as string) ?? '', taglineAlignment: (r.header_tagline_alignment as TextAlignment) ?? 'center',
      taglineColor: (r.header_tagline_color as string) ?? '#6b7280', addressLine: (r.header_address_line as string) ?? '',
      addressAlignment: (r.header_address_alignment as TextAlignment) ?? 'center', contactLine: (r.header_contact_line as string) ?? '',
      contactAlignment: (r.header_contact_alignment as TextAlignment) ?? 'center', websiteLine: (r.header_website_line as string) ?? '',
      websiteAlignment: (r.header_website_alignment as TextAlignment) ?? 'center', dividerEnabled: Boolean(r.header_divider_enabled),
      dividerColor: (r.header_divider_color as string) ?? '#1e3a5f', dividerThickness: (r.header_divider_thickness as 'thin' | 'medium' | 'thick') ?? 'medium',
      backgroundColor: (r.header_bg_color as string) ?? '#ffffff', customHtml: (r.header_custom_html as string) ?? '',
      useCustomHtml: Boolean(r.header_use_custom_html),
    },
    footer: {
      enabled: Boolean(r.footer_enabled), footerImageDataUrl: (r.footer_image_url as string) ?? '',
      footerImageHeight: (r.footer_image_height as 'sm' | 'md' | 'lg') ?? 'sm', line1: (r.footer_line1 as string) ?? '',
      line1Alignment: (r.footer_line1_alignment as TextAlignment) ?? 'center', line1Color: (r.footer_line1_color as string) ?? '#6b7280',
      line2: (r.footer_line2 as string) ?? '', line2Alignment: (r.footer_line2_alignment as TextAlignment) ?? 'center',
      line2Color: (r.footer_line2_color as string) ?? '#6b7280', showPageNumber: Boolean(r.footer_show_page_number),
      pageNumberAlignment: (r.footer_page_number_align as TextAlignment) ?? 'right', dividerEnabled: Boolean(r.footer_divider_enabled),
      dividerColor: (r.footer_divider_color as string) ?? '#1e3a5f', dividerThickness: (r.footer_divider_thickness as 'thin' | 'medium' | 'thick') ?? 'medium',
      backgroundColor: (r.footer_bg_color as string) ?? '#ffffff', customHtml: (r.footer_custom_html as string) ?? '',
      useCustomHtml: Boolean(r.footer_use_custom_html),
    },
    usage: {
      payslip: Boolean(r.use_for_payslip), offerLetter: Boolean(r.use_for_offer_letter), memo: Boolean(r.use_for_memo),
      transferLetter: Boolean(r.use_for_transfer_letter), experienceLetter: Boolean(r.use_for_experience_letter),
      relievingLetter: Boolean(r.use_for_relieving_letter), appointmentLetter: Boolean(r.use_for_appointment_letter),
      warningLetter: Boolean(r.use_for_warning_letter),
    },
    paperSize: (r.paper_size as LocationLetterhead['paperSize']) ?? 'A4',
    marginTop: eNum(r.margin_top, 20), marginBottom: eNum(r.margin_bottom, 20),
    marginLeft: eNum(r.margin_left, 25), marginRight: eNum(r.margin_right, 25),
    updatedAt: r.updated_at ? formatDate(r.updated_at as string) : '',
  };
}
function letterheadToRow(lh: LocationLetterhead, locationId: string): Record<string, unknown> {
  const h = lh.header, f = lh.footer, u = lh.usage;
  return {
    location_id: locationId, is_active: lh.isActive, paper_size: lh.paperSize,
    margin_top: lh.marginTop, margin_bottom: lh.marginBottom, margin_left: lh.marginLeft, margin_right: lh.marginRight,
    header_enabled: h.enabled, header_logo_url: h.logoDataUrl || null, header_logo_position: h.logoPosition,
    header_logo_size: h.logoSize, header_image_url: h.headerImageDataUrl || null, header_image_height: h.headerImageHeight,
    header_company_name: h.companyName, header_company_name_size: h.companyNameSize, header_company_name_align: h.companyNameAlignment,
    header_company_name_color: h.companyNameColor, header_tagline: h.tagline, header_tagline_alignment: h.taglineAlignment,
    header_tagline_color: h.taglineColor, header_address_line: h.addressLine, header_address_alignment: h.addressAlignment,
    header_contact_line: h.contactLine, header_contact_alignment: h.contactAlignment, header_website_line: h.websiteLine,
    header_website_alignment: h.websiteAlignment, header_divider_enabled: h.dividerEnabled, header_divider_color: h.dividerColor,
    header_divider_thickness: h.dividerThickness, header_bg_color: h.backgroundColor, header_custom_html: h.customHtml || null,
    header_use_custom_html: h.useCustomHtml,
    footer_enabled: f.enabled, footer_image_url: f.footerImageDataUrl || null, footer_image_height: f.footerImageHeight,
    footer_line1: f.line1, footer_line1_alignment: f.line1Alignment, footer_line1_color: f.line1Color,
    footer_line2: f.line2, footer_line2_alignment: f.line2Alignment, footer_line2_color: f.line2Color,
    footer_show_page_number: f.showPageNumber, footer_page_number_align: f.pageNumberAlignment,
    footer_divider_enabled: f.dividerEnabled, footer_divider_color: f.dividerColor, footer_divider_thickness: f.dividerThickness,
    footer_bg_color: f.backgroundColor, footer_custom_html: f.customHtml || null, footer_use_custom_html: f.useCustomHtml,
    use_for_payslip: u.payslip, use_for_offer_letter: u.offerLetter, use_for_memo: u.memo, use_for_transfer_letter: u.transferLetter,
    use_for_experience_letter: u.experienceLetter, use_for_relieving_letter: u.relievingLetter,
    use_for_appointment_letter: u.appointmentLetter, use_for_warning_letter: u.warningLetter,
  };
}
function rowToEstLocation(r: DbRow, bankRows: DbRow[], lhRow: DbRow | undefined): WorkLocation {
  return {
    id: r.id, name: (r.name as string) ?? '', code: (r.code as string) ?? '', address: (r.address as string) ?? '',
    city: (r.city as string) ?? '', state: (r.state as string) ?? '', country: (r.country as string) ?? 'India',
    phone: (r.phone as string) ?? '', email: (r.email as string) ?? '',
    status: (r.status as WorkLocation['status']) ?? 'Active', employeeCount: eNum(r.employee_count),
    statutory: {
      linNo: (r.lin_no as string) ?? '', epfCodeNo: (r.epf_code_no as string) ?? '', esiCodeNo: (r.esi_code_no as string) ?? '',
      panNo: (r.pan_no as string) ?? '', gstCode: (r.gst_code as string) ?? '', tanNo: (r.tan_no as string) ?? '',
      cinNo: (r.cin_no as string) ?? '', ptNo: (r.pt_no as string) ?? '', documents: {},
    },
    bankAccounts: bankRows.filter(b => b.location_id === r.id).map(rowToBank),
    letterhead: rowToLetterhead(lhRow, (r.name as string) ?? ''),
  };
}
function estLocationToRow(loc: WorkLocation): Record<string, unknown> {
  const st = loc.statutory;
  return {
    name: loc.name.trim(), code: loc.code.trim(), address: loc.address || null, city: loc.city || null,
    state: loc.state || null, country: loc.country || null, phone: loc.phone || null, email: loc.email || null,
    status: loc.status, employee_count: eNum(loc.employeeCount),
    lin_no: st.linNo || null, epf_code_no: st.epfCodeNo || null, esi_code_no: st.esiCodeNo || null,
    pan_no: st.panNo || null, gst_code: st.gstCode || null, tan_no: st.tanNo || null,
    cin_no: st.cinNo || null, pt_no: st.ptNo || null,
  };
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none";
const whiteInputCls = "w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all";

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
  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border">
    <div className={`p-2 ${accentBg} rounded-lg shrink-0`}>
      <Icon size={18} className={accentColor} />
    </div>
    <div>
      <h3 className="font-bold text-sm">{title}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: 'Active' | 'Inactive' }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
    status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} />
    {status}
  </span>
);

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

const Modal = ({ title, onClose, children, wide }: ModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 16 }}
      className={`bg-card w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} rounded-2xl shadow-2xl border border-border overflow-hidden`}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <X size={20} />
        </button>
      </div>
      {children}
    </motion.div>
  </div>
);

// ─── Dept Node ────────────────────────────────────────────────────────────────

interface DeptNodeProps {
  node: Department;
  allDepts: Department[];
  depth: number;
  onEdit: (d: Department) => void;
  onDelete: (id: string) => void;
}

const DeptNode = ({ node, allDepts, depth, onEdit, onDelete }: DeptNodeProps) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent/40 transition-colors group ${depth > 0 ? 'ml-6 border-l-2 border-border pl-6' : ''}`}
      >
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-5 h-5 flex items-center justify-center text-muted-foreground transition-transform ${!hasChildren ? 'invisible' : ''}`}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
          depth === 0 ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground'
        }`}>
          {node.code.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{node.name}</span>
            <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{node.code}</span>
            <StatusBadge status={node.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Head: {node.headName} &nbsp;·&nbsp; {node.employeeCount} employees
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(node)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(node.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </motion.div>
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {node.children!.map(child => (
              <DeptNode key={child.id} node={child} allDepts={allDepts} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Statutory Field Config ───────────────────────────────────────────────────

interface StatutoryField {
  key: keyof LocationStatutory;
  label: string;
  placeholder: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description: string;
  maxLength?: number;
  docLabel: string;
}

const STATUTORY_FIELDS: StatutoryField[] = [
  { key: 'linNo', label: 'LIN No.', placeholder: 'e.g. 1234567890', icon: Shield, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', description: 'Labour Identification Number issued by Ministry of Labour', maxLength: 10, docLabel: 'LIN Certificate / Labour Registration' },
  { key: 'epfCodeNo', label: 'EPF Code No.', placeholder: 'e.g. MH/BAN/0012345/000', icon: BadgeCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', description: "Employees' Provident Fund Organisation registration code", docLabel: 'EPF Registration Certificate' },
  { key: 'esiCodeNo', label: 'ESI Code No.', placeholder: 'e.g. 41-00-123456-000-0001', icon: CreditCard, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200', description: "Employees' State Insurance Corporation registration code", docLabel: 'ESI Registration Certificate' },
  { key: 'panNo', label: 'PAN No.', placeholder: 'e.g. AAACN1234C', icon: Receipt, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', description: 'Permanent Account Number issued by Income Tax Department', maxLength: 10, docLabel: 'PAN Card Copy' },
  { key: 'gstCode', label: 'GST Code', placeholder: 'e.g. 27AAACN1234C1Z5', icon: Briefcase, color: 'text-rose-600', bgColor: 'bg-rose-50 border-rose-200', description: 'Goods and Services Tax Identification Number (GSTIN)', maxLength: 15, docLabel: 'GST Registration Certificate' },
  { key: 'tanNo', label: 'TAN No.', placeholder: 'e.g. MUMX12345A', icon: Hash, color: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-200', description: 'Tax Deduction and Collection Account Number', maxLength: 10, docLabel: 'TAN Allotment Letter' },
  { key: 'cinNo', label: 'CIN No.', placeholder: 'e.g. U72200MH2010PTC123456', icon: FileText, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', description: 'Corporate Identification Number issued by MCA', maxLength: 21, docLabel: 'Certificate of Incorporation' },
  { key: 'ptNo', label: 'PT No.', placeholder: 'e.g. 27123456789P', icon: Building2, color: 'text-teal-600', bgColor: 'bg-teal-50 border-teal-200', description: 'Professional Tax Registration Number', docLabel: 'PT Registration Certificate' },
];

// ─── Logo Upload Component ────────────────────────────────────────────────────

interface LogoUploadProps {
  logoDataUrl: string;
  companyName: string;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
}

const LogoUpload = ({ logoDataUrl, companyName, onUpload, onRemove }: LogoUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    const { url, error } = await uploadLetterheadImage('establishment/logo', file);
    if (error || !url) { toast.error(error ?? 'Upload failed.'); return; }
    onUpload(url);
    toast.success('Logo uploaded successfully.');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
      <SectionHeader icon={Image} title="Company Logo" subtitle="Upload your organisation's logo for payslips, reports, and documents" accentColor="text-violet-600" accentBg="bg-violet-50" />
      <div className="flex items-start gap-6">
        <div className="shrink-0">
          <div className={`w-28 h-28 rounded-2xl border-2 flex items-center justify-center overflow-hidden transition-all ${
            logoDataUrl ? 'border-primary/30 bg-white shadow-md' : 'border-dashed border-border bg-accent/30'
          }`}>
            {logoDataUrl ? (
              <img src={logoDataUrl} alt="Company Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Building2 size={32} className="text-muted-foreground/40" />
                <span className="text-[10px] font-medium text-center px-2">
                  {companyName ? companyName.slice(0, 2).toUpperCase() : 'LOGO'}
                </span>
              </div>
            )}
          </div>
          {logoDataUrl && (
            <button
              onClick={onRemove}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-destructive/20"
            >
              <Trash size={12} /> Remove
            </button>
          )}
        </div>
        <div className="flex-1">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/40 hover:bg-accent/30'
            }`}
          >
            <div className="p-3 bg-violet-100 rounded-xl">
              <Camera size={22} className="text-violet-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">{logoDataUrl ? 'Replace Logo' : 'Upload Logo'}</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG, WebP — max 2 MB</p>
            </div>
            <button className="px-4 py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
              {logoDataUrl ? 'Change Logo' : 'Browse File'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Image Upload Zone (for letterhead header/footer images) ──────────────────

interface ImageUploadZoneProps {
  label: string;
  hint: string;
  dataUrl: string;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
  accentColor?: string;
  accentBg?: string;
}

const ImageUploadZone = ({ label, hint, dataUrl, onUpload, onRemove, accentColor = 'text-purple-600', accentBg = 'bg-purple-100' }: ImageUploadZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    const { url, error } = await uploadLetterheadImage('letterheads/banners', file);
    if (error || !url) { toast.error(error ?? 'Upload failed.'); return; }
    onUpload(url);
    toast.success(`${label} uploaded.`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (dataUrl) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-xl overflow-hidden border border-border shadow-sm">
          <img src={dataUrl} alt={label} className="w-full object-cover max-h-32" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <div className="flex gap-2">
              <button
                onClick={() => inputRef.current?.click()}
                className="px-3 py-1.5 bg-white text-gray-800 text-xs font-semibold rounded-lg shadow-md hover:bg-gray-100 transition-colors"
              >
                Replace
              </button>
              <button
                onClick={onRemove}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">Hover over image to replace or remove</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
        dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-purple-400 hover:bg-purple-50'
      }`}
    >
      <div className={`p-2.5 ${accentBg} rounded-xl shrink-0`}>
        <FileImage size={18} className={accentColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <Upload size={16} className="text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
      />
    </div>
  );
};

// ─── Letterhead Preview Component ─────────────────────────────────────────────

interface LetterheadPreviewProps {
  letterhead: LocationLetterhead;
  locationName: string;
}

const LetterheadPreview = ({ letterhead, locationName }: LetterheadPreviewProps) => {
  const { header, footer } = letterhead;

  const dividerStyle = (color: string, thickness: 'thin' | 'medium' | 'thick') => ({
    borderTop: `${thickness === 'thin' ? 1 : thickness === 'medium' ? 2 : 3}px solid ${color}`,
  });

  const logoSizeMap = { sm: 'h-8', md: 'h-12', lg: 'h-16' };
  const logoAlignMap = { left: 'justify-start', center: 'justify-center', right: 'justify-end' };
  const headerImgHeightMap = { sm: '48px', md: '80px', lg: '120px' };
  const footerImgHeightMap = { sm: '40px', md: '64px', lg: '96px' };

  return (
    <div className="bg-white rounded-xl border-2 border-border shadow-lg overflow-hidden" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Paper indicator */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-border">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Live Preview — {letterhead.paperSize}</span>
        <span className="text-[10px] text-muted-foreground">Margins: {letterhead.marginTop}mm top · {letterhead.marginBottom}mm bottom</span>
      </div>

      {/* Header Preview */}
      {header.enabled && (
        <div style={{ backgroundColor: header.backgroundColor, padding: '16px 24px 12px' }}>
          {header.useCustomHtml ? (
            <div className="text-xs text-muted-foreground italic text-center py-4 border-2 border-dashed border-border rounded-lg">
              Custom HTML Header — renders in actual document
            </div>
          ) : (
            <>
              {/* Header Banner Image */}
              {header.headerImageDataUrl && (
                <div className="mb-2 overflow-hidden rounded">
                  <img
                    src={header.headerImageDataUrl}
                    alt="Header Banner"
                    style={{ width: '100%', height: headerImgHeightMap[header.headerImageHeight], objectFit: 'cover' }}
                  />
                </div>
              )}
              {/* Logo Row */}
              {header.logoDataUrl && (
                <div className={`flex ${logoAlignMap[header.logoPosition]} mb-2`}>
                  <img src={header.logoDataUrl} alt="Logo" className={`${logoSizeMap[header.logoSize]} object-contain`} />
                </div>
              )}
              {/* Company Name */}
              {header.companyName && (
                <p className={`font-bold ${FONT_SIZE_MAP[header.companyNameSize]} ${ALIGN_MAP[header.companyNameAlignment]}`} style={{ color: header.companyNameColor }}>
                  {header.companyName}
                </p>
              )}
              {/* Tagline */}
              {header.tagline && (
                <p className={`text-xs mt-0.5 ${ALIGN_MAP[header.taglineAlignment]}`} style={{ color: header.taglineColor }}>
                  {header.tagline}
                </p>
              )}
              {/* Address */}
              {header.addressLine && (
                <p className={`text-xs mt-1 ${ALIGN_MAP[header.addressAlignment]}`} style={{ color: '#6b7280' }}>
                  {header.addressLine}
                </p>
              )}
              {/* Contact */}
              {header.contactLine && (
                <p className={`text-xs mt-0.5 ${ALIGN_MAP[header.contactAlignment]}`} style={{ color: '#6b7280' }}>
                  {header.contactLine}
                </p>
              )}
              {/* Website */}
              {header.websiteLine && (
                <p className={`text-xs mt-0.5 ${ALIGN_MAP[header.websiteAlignment]}`} style={{ color: '#6b7280' }}>
                  {header.websiteLine}
                </p>
              )}
              {/* Divider */}
              {header.dividerEnabled && (
                <div className="mt-3" style={dividerStyle(header.dividerColor, header.dividerThickness)} />
              )}
            </>
          )}
        </div>
      )}

      {/* Content Area Placeholder */}
      <div className="px-6 py-8 bg-white">
        <div className="space-y-2">
          <div className="h-2 bg-gray-100 rounded w-1/3" />
          <div className="h-2 bg-gray-100 rounded w-full" />
          <div className="h-2 bg-gray-100 rounded w-5/6" />
          <div className="h-2 bg-gray-100 rounded w-full" />
          <div className="h-2 bg-gray-100 rounded w-4/5" />
          <div className="h-2 bg-gray-100 rounded w-full" />
          <div className="h-2 bg-gray-100 rounded w-3/4" />
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-4 italic">— Document content area —</p>
      </div>

      {/* Footer Preview */}
      {footer.enabled && (
        <div style={{ backgroundColor: footer.backgroundColor, padding: '12px 24px 16px' }}>
          {footer.useCustomHtml ? (
            <div className="text-xs text-muted-foreground italic text-center py-4 border-2 border-dashed border-border rounded-lg">
              Custom HTML Footer — renders in actual document
            </div>
          ) : (
            <>
              {footer.dividerEnabled && (
                <div className="mb-3" style={dividerStyle(footer.dividerColor, footer.dividerThickness)} />
              )}
              {footer.line1 && (
                <p className={`text-xs ${ALIGN_MAP[footer.line1Alignment]}`} style={{ color: footer.line1Color }}>
                  {footer.line1}
                </p>
              )}
              {footer.line2 && (
                <p className={`text-xs mt-0.5 ${ALIGN_MAP[footer.line2Alignment]}`} style={{ color: footer.line2Color }}>
                  {footer.line2}
                </p>
              )}
              {footer.showPageNumber && (
                <p className={`text-[10px] mt-1 text-muted-foreground ${ALIGN_MAP[footer.pageNumberAlignment]}`}>
                  Page 1 of 1
                </p>
              )}
              {/* Footer Banner Image */}
              {footer.footerImageDataUrl && (
                <div className="mt-2 overflow-hidden rounded">
                  <img
                    src={footer.footerImageDataUrl}
                    alt="Footer Banner"
                    style={{ width: '100%', height: footerImgHeightMap[footer.footerImageHeight], objectFit: 'cover' }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── PDF Export Function ──────────────────────────────────────────────────────

function generateLetterheadPDF(letterhead: LocationLetterhead, locationName: string, companyName: string) {
  const { header, footer } = letterhead;

  const dividerCss = (color: string, thickness: 'thin' | 'medium' | 'thick') =>
    `border-top: ${thickness === 'thin' ? 1 : thickness === 'medium' ? 2 : 3}px solid ${color};`;

  const alignCss = (a: TextAlignment) =>
    a === 'left' ? 'left' : a === 'center' ? 'center' : 'right';

  const fontSizeCss = (s: FontSize) => {
    const map: Record<FontSize, string> = { xs: '10px', sm: '12px', base: '14px', lg: '18px', xl: '22px', '2xl': '28px' };
    return map[s];
  };

  const logoSizePx = { sm: '32px', md: '48px', lg: '64px' };
  const headerImgHeightPx = { sm: '48px', md: '80px', lg: '120px' };
  const footerImgHeightPx = { sm: '40px', md: '64px', lg: '96px' };

  const logoAlignFlex = { left: 'flex-start', center: 'center', right: 'flex-end' };

  const headerHtml = header.useCustomHtml ? header.customHtml : `
    ${header.headerImageDataUrl ? `<div style="margin-bottom:8px;overflow:hidden;border-radius:4px;"><img src="${header.headerImageDataUrl}" style="width:100%;height:${headerImgHeightPx[header.headerImageHeight]};object-fit:cover;" /></div>` : ''}
    ${header.logoDataUrl ? `<div style="display:flex;justify-content:${logoAlignFlex[header.logoPosition]};margin-bottom:8px;"><img src="${header.logoDataUrl}" style="height:${logoSizePx[header.logoSize]};object-fit:contain;" /></div>` : ''}
    ${header.companyName ? `<p style="font-size:${fontSizeCss(header.companyNameSize)};font-weight:bold;text-align:${alignCss(header.companyNameAlignment)};color:${header.companyNameColor};margin:0 0 4px 0;">${header.companyName}</p>` : ''}
    ${header.tagline ? `<p style="font-size:11px;text-align:${alignCss(header.taglineAlignment)};color:${header.taglineColor};margin:0 0 4px 0;">${header.tagline}</p>` : ''}
    ${header.addressLine ? `<p style="font-size:10px;text-align:${alignCss(header.addressAlignment)};color:#6b7280;margin:0 0 2px 0;">${header.addressLine}</p>` : ''}
    ${header.contactLine ? `<p style="font-size:10px;text-align:${alignCss(header.contactAlignment)};color:#6b7280;margin:0 0 2px 0;">${header.contactLine}</p>` : ''}
    ${header.websiteLine ? `<p style="font-size:10px;text-align:${alignCss(header.websiteAlignment)};color:#6b7280;margin:0;">${header.websiteLine}</p>` : ''}
    ${header.dividerEnabled ? `<div style="margin-top:12px;${dividerCss(header.dividerColor, header.dividerThickness)}"></div>` : ''}
  `;

  const footerHtml = footer.useCustomHtml ? footer.customHtml : `
    ${footer.dividerEnabled ? `<div style="margin-bottom:10px;${dividerCss(footer.dividerColor, footer.dividerThickness)}"></div>` : ''}
    ${footer.line1 ? `<p style="font-size:10px;text-align:${alignCss(footer.line1Alignment)};color:${footer.line1Color};margin:0 0 2px 0;">${footer.line1}</p>` : ''}
    ${footer.line2 ? `<p style="font-size:10px;text-align:${alignCss(footer.line2Alignment)};color:${footer.line2Color};margin:0 0 2px 0;">${footer.line2}</p>` : ''}
    ${footer.showPageNumber ? `<p style="font-size:9px;text-align:${alignCss(footer.pageNumberAlignment)};color:#9ca3af;margin:4px 0 0 0;">Page 1 of 1</p>` : ''}
    ${footer.footerImageDataUrl ? `<div style="margin-top:8px;overflow:hidden;border-radius:4px;"><img src="${footer.footerImageDataUrl}" style="width:100%;height:${footerImgHeightPx[footer.footerImageHeight]};object-fit:cover;" /></div>` : ''}
  `;

  const paperDimensions = {
    A4: { width: '210mm', height: '297mm' },
    Letter: { width: '216mm', height: '279mm' },
    Legal: { width: '216mm', height: '356mm' },
  };

  const dims = paperDimensions[letterhead.paperSize];

  const sampleContent = `
    <div style="margin-bottom:20px;">
      <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 4px 0;">Date: ${todayFormatted()}</p>
      <p style="font-size:11px;color:#374151;margin:0 0 4px 0;">Ref No: NX/HR/2025/001</p>
    </div>
    <div style="margin-bottom:16px;">
      <p style="font-size:11px;color:#374151;margin:0 0 4px 0;">To,</p>
      <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 2px 0;">Mr. Rajesh Kumar</p>
      <p style="font-size:11px;color:#374151;margin:0 0 2px 0;">Senior Software Engineer</p>
      <p style="font-size:11px;color:#374151;margin:0;">Employee ID: EMP-2024-0042</p>
    </div>
    <p style="font-size:12px;font-weight:700;color:#111827;margin:0 0 12px 0;text-decoration:underline;">Subject: Sample Document — Letterhead Preview</p>
    <p style="font-size:11px;color:#374151;line-height:1.7;margin:0 0 10px 0;">Dear Mr. Kumar,</p>
    <p style="font-size:11px;color:#374151;line-height:1.7;margin:0 0 10px 0;">
      This is a sample document generated to preview the letterhead design for <strong>${locationName}</strong>. 
      The header and footer shown above and below represent the actual layout that will appear on all official documents 
      including payslips, offer letters, memos, transfer letters, and other HR communications.
    </p>
    <p style="font-size:11px;color:#374151;line-height:1.7;margin:0 0 10px 0;">
      The letterhead has been configured with the following settings: Paper size <strong>${letterhead.paperSize}</strong>, 
      margins of ${letterhead.marginTop}mm (top), ${letterhead.marginBottom}mm (bottom), ${letterhead.marginLeft}mm (left), 
      and ${letterhead.marginRight}mm (right). These settings ensure proper alignment and professional presentation 
      across all printed and digital documents.
    </p>
    <p style="font-size:11px;color:#374151;line-height:1.7;margin:0 0 20px 0;">
      Please review the header and footer design carefully. If any changes are required, you may update the letterhead 
      configuration in the Establishment Master settings under the Letterhead tab.
    </p>
    <p style="font-size:11px;color:#374151;margin:0 0 4px 0;">Yours sincerely,</p>
    <br/>
    <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 2px 0;">HR Department</p>
    <p style="font-size:11px;color:#374151;margin:0;">${companyName}</p>
  `;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Letterhead Preview — ${locationName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #f3f4f6; }
    .page {
      width: ${dims.width};
      min-height: ${dims.height};
      background: white;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    }
    .header {
      background: ${header.backgroundColor};
      padding: ${letterhead.marginTop}mm ${letterhead.marginRight}mm 12px ${letterhead.marginLeft}mm;
    }
    .content {
      flex: 1;
      padding: 20px ${letterhead.marginRight}mm 20px ${letterhead.marginLeft}mm;
    }
    .footer {
      background: ${footer.backgroundColor};
      padding: 12px ${letterhead.marginRight}mm ${letterhead.marginBottom}mm ${letterhead.marginLeft}mm;
    }
    @media print {
      body { background: white; }
      .page { box-shadow: none; margin: 0; width: 100%; min-height: 100vh; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#1e3a5f;color:white;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">
    <span style="font-size:14px;font-weight:600;">📄 Letterhead Preview — ${locationName}</span>
    <div style="display:flex;gap:12px;">
      <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">✕ Close</button>
    </div>
  </div>
  <div style="padding:24px 0;background:#f3f4f6;" class="no-print">
    <p style="text-align:center;font-size:12px;color:#6b7280;margin-bottom:16px;">
      Use your browser's Print function (Ctrl+P / Cmd+P) and select "Save as PDF" to export.
    </p>
  </div>
  <div class="page">
    <div class="header">${headerHtml}</div>
    <div class="content">${sampleContent}</div>
    <div class="footer">${footerHtml}</div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=900,height=700,scrollbars=yes');
  if (!win) {
    toast.error('Popup blocked. Please allow popups for this site.');
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast.success('PDF preview opened. Use Print → Save as PDF to export.');
}

// ─── Alignment Buttons ────────────────────────────────────────────────────────

interface AlignButtonsProps {
  value: TextAlignment;
  onChange: (v: TextAlignment) => void;
}

const AlignButtons = ({ value, onChange }: AlignButtonsProps) => (
  <div className="flex items-center border border-border rounded-lg overflow-hidden">
    {(['left', 'center', 'right'] as TextAlignment[]).map(align => {
      const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
      return (
        <button
          key={align}
          onClick={() => onChange(align)}
          className={`p-2 transition-colors ${value === align ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
        >
          <Icon size={14} />
        </button>
      );
    })}
  </div>
);

// ─── Toggle Switch ────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

const ToggleSwitch = ({ value, onChange, label, description }: ToggleSwitchProps) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-primary' : 'bg-border'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </div>
    <div>
      <span className="text-sm font-medium">{label}</span>
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
    </div>
  </label>
);

// ─── Letterhead Tab ───────────────────────────────────────────────────────────

interface LetterheadTabProps {
  locations: WorkLocation[];
  estData: EstablishmentData;
  onUpdateLetterhead: (locationId: string, letterhead: LocationLetterhead) => void;
}

type LetterheadSubTab = 'header' | 'footer' | 'usage' | 'settings';

const LetterheadTab = ({ locations, estData, onUpdateLetterhead }: LetterheadTabProps) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id ?? '');
  const [activeSubTab, setActiveSubTab] = useState<LetterheadSubTab>('header');
  const [showPreview, setShowPreview] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const letterhead = selectedLocation?.letterhead ?? emptyLetterhead('', '', '', '', '');

  const updateLetterhead = (updates: Partial<LocationLetterhead>) => {
    if (!selectedLocation) return;
    const updated = { ...letterhead, ...updates, updatedAt: todayFormatted() };
    onUpdateLetterhead(selectedLocationId, updated);
  };

  const updateHeader = (updates: Partial<LetterheadSection>) => {
    updateLetterhead({ header: { ...letterhead.header, ...updates } });
  };

  const updateFooter = (updates: Partial<LetterheadFooter>) => {
    updateLetterhead({ footer: { ...letterhead.footer, ...updates } });
  };

  const updateUsage = (updates: Partial<LetterheadUsage>) => {
    updateLetterhead({ usage: { ...letterhead.usage, ...updates } });
  };

  const handleLogoUpload = async (file: File) => {
    const { url, error } = await uploadLetterheadImage('letterheads/logos', file);
    if (error || !url) { toast.error(error ?? 'Upload failed.'); return; }
    updateHeader({ logoDataUrl: url });
    toast.success('Letterhead logo uploaded.');
  };

  const handleCopyFromEstablishment = () => {
    toast.info('Letterhead settings copied from establishment defaults.');
  };

  const handleExportPDF = () => {
    if (!selectedLocation) return;
    generateLetterheadPDF(letterhead, selectedLocation.name, estData.name);
  };

  const usageCount = Object.values(letterhead.usage).filter(Boolean).length;

  const subTabs: { key: LetterheadSubTab; label: string; icon: React.ElementType }[] = [
    { key: 'header', label: 'Header Design', icon: Layout },
    { key: 'footer', label: 'Footer Design', icon: AlignLeft },
    { key: 'usage', label: 'Report Usage', icon: FileText },
    { key: 'settings', label: 'Page Settings', icon: Printer },
  ];

  if (locations.length === 0) {
    return (
      <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
        <Layout size={32} className="text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold text-muted-foreground">No work locations defined</p>
        <p className="text-xs text-muted-foreground mt-1">Add work locations first to configure letterheads per location.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Location Selector */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg"><Layout size={18} className="text-purple-600" /></div>
          <div>
            <h2 className="font-bold text-base">Letterhead Designer</h2>
            <p className="text-xs text-muted-foreground">Design location-wise letterheads for all official documents and reports.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-all shadow-sm"
            >
              <Download size={13} /> Export as PDF
            </button>
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${showPreview ? 'bg-purple-600 text-white border-purple-600' : 'border-border text-muted-foreground hover:bg-accent'}`}
            >
              <Eye size={13} /> {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Select Location:</span>
          <div className="flex flex-wrap gap-2">
            {locations.map(loc => (
              <button
                key={loc.id}
                onClick={() => setSelectedLocationId(loc.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  selectedLocationId === loc.id
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : 'bg-card text-muted-foreground border-border hover:border-purple-300 hover:bg-purple-50'
                }`}
              >
                <Building2 size={14} />
                {loc.name}
                {loc.letterhead.isActive && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${selectedLocationId === loc.id ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedLocation && (
        <motion.div key={selectedLocationId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Location Header Bar */}
          <div className="flex items-center justify-between gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm"><Building2 size={18} className="text-purple-600" /></div>
              <div>
                <p className="font-bold text-sm text-purple-800">{selectedLocation.name}</p>
                <p className="text-xs text-purple-700">{selectedLocation.address}, {selectedLocation.city}, {selectedLocation.state}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-purple-700">Letterhead Active:</span>
                <div
                  onClick={() => updateLetterhead({ isActive: !letterhead.isActive })}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${letterhead.isActive ? 'bg-green-500' : 'bg-border'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${letterhead.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className={`text-xs font-bold ${letterhead.isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {letterhead.isActive ? 'Yes' : 'No'}
                </span>
              </div>
              <button
                onClick={handleCopyFromEstablishment}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-300 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors"
              >
                <Copy size={12} /> Copy from Establishment
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm"
              >
                <Download size={12} /> Export PDF
              </button>
            </div>
          </div>

          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              The letterhead designed here will be automatically applied to all selected report types for <strong>{selectedLocation.name}</strong>. 
              Upload a logo or banner image, configure header/footer text, and select which documents should use this letterhead.
              Use <strong>Export as PDF</strong> to generate a sample A4 preview with dummy content.
              Last updated: <strong>{letterhead.updatedAt}</strong>
            </p>
          </div>

          <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Designer Panel */}
            <div className="space-y-4">
              {/* Sub Tab Bar */}
              <div className="flex items-center gap-0.5 bg-accent/50 p-1 rounded-xl">
                {subTabs.map(tab => {
                  const TabIcon = tab.icon;
                  const isActive = activeSubTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveSubTab(tab.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all flex-1 justify-center ${
                        isActive ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <TabIcon size={13} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSubTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                >
                  {/* ── Header Design ── */}
                  {activeSubTab === 'header' && (
                    <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Layout size={15} className="text-purple-600" /> Header Configuration
                        </h3>
                        <ToggleSwitch
                          value={letterhead.header.enabled}
                          onChange={v => updateHeader({ enabled: v })}
                          label="Enable Header"
                        />
                      </div>

                      {letterhead.header.enabled && (
                        <div className="space-y-4">
                          {/* Custom HTML Toggle */}
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <ToggleSwitch
                              value={letterhead.header.useCustomHtml}
                              onChange={v => updateHeader({ useCustomHtml: v })}
                              label="Use Custom HTML"
                              description="Advanced: write raw HTML for full control over header layout"
                            />
                          </div>

                          {letterhead.header.useCustomHtml ? (
                            <Field label="Custom HTML Code" hint="Write valid HTML. Use inline styles for formatting.">
                              <textarea
                                className={`${inputCls} font-mono text-xs resize-none`}
                                rows={8}
                                placeholder="<div style='text-align:center;'><h1>Company Name</h1></div>"
                                value={letterhead.header.customHtml}
                                onChange={e => updateHeader({ customHtml: e.target.value })}
                              />
                            </Field>
                          ) : (
                            <>
                              {/* Header Banner Image Upload */}
                              <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <FileImage size={13} className="text-purple-600" /> Header Banner Image
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">Optional full-width image at top of header</span>
                                </div>
                                <ImageUploadZone
                                  label="Upload Header Banner Image"
                                  hint="PNG, JPG, SVG — max 5 MB. Displays as full-width banner at top of header."
                                  dataUrl={letterhead.header.headerImageDataUrl}
                                  onUpload={dataUrl => updateHeader({ headerImageDataUrl: dataUrl })}
                                  onRemove={() => updateHeader({ headerImageDataUrl: '' })}
                                />
                                {letterhead.header.headerImageDataUrl && (
                                  <Field label="Banner Image Height">
                                    <select
                                      className={selectCls}
                                      value={letterhead.header.headerImageHeight}
                                      onChange={e => updateHeader({ headerImageHeight: e.target.value as any })}
                                    >
                                      <option value="sm">Small (48px)</option>
                                      <option value="md">Medium (80px)</option>
                                      <option value="lg">Large (120px)</option>
                                    </select>
                                  </Field>
                                )}
                              </div>

                              {/* Logo Upload */}
                              <div className="p-4 bg-accent/30 rounded-xl border border-border">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Company Logo</span>
                                  {letterhead.header.logoDataUrl && (
                                    <button
                                      onClick={() => updateHeader({ logoDataUrl: '' })}
                                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                                    >
                                      <Trash size={11} /> Remove
                                    </button>
                                  )}
                                </div>
                                {letterhead.header.logoDataUrl ? (
                                  <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden shadow-sm">
                                      <img src={letterhead.header.logoDataUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                      <Field label="Logo Position">
                                        <select className={selectCls} value={letterhead.header.logoPosition} onChange={e => updateHeader({ logoPosition: e.target.value as any })}>
                                          <option value="left">Left</option>
                                          <option value="center">Center</option>
                                          <option value="right">Right</option>
                                        </select>
                                      </Field>
                                      <Field label="Logo Size">
                                        <select className={selectCls} value={letterhead.header.logoSize} onChange={e => updateHeader({ logoSize: e.target.value as any })}>
                                          <option value="sm">Small</option>
                                          <option value="md">Medium</option>
                                          <option value="lg">Large</option>
                                        </select>
                                      </Field>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => logoInputRef.current?.click()}
                                    className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
                                  >
                                    <div className="p-2 bg-purple-100 rounded-lg"><FileImage size={16} className="text-purple-600" /></div>
                                    <div>
                                      <p className="text-sm font-medium">Upload Letterhead Logo</p>
                                      <p className="text-xs text-muted-foreground">PNG, JPG, SVG — max 2 MB</p>
                                    </div>
                                    <input
                                      ref={logoInputRef}
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); e.target.value = ''; }}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Company Name */}
                              <div className="grid grid-cols-1 gap-3">
                                <Field label="Company Name">
                                  <input type="text" className={inputCls} placeholder="Company / Location name" value={letterhead.header.companyName} onChange={e => updateHeader({ companyName: e.target.value })} />
                                </Field>
                                <div className="grid grid-cols-3 gap-3">
                                  <Field label="Font Size">
                                    <select className={selectCls} value={letterhead.header.companyNameSize} onChange={e => updateHeader({ companyNameSize: e.target.value as FontSize })}>
                                      {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="Alignment">
                                    <AlignButtons value={letterhead.header.companyNameAlignment} onChange={v => updateHeader({ companyNameAlignment: v })} />
                                  </Field>
                                  <Field label="Color">
                                    <div className="flex items-center gap-2">
                                      <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={letterhead.header.companyNameColor} onChange={e => updateHeader({ companyNameColor: e.target.value })} />
                                      <input type="text" className={`${inputCls} font-mono text-xs`} value={letterhead.header.companyNameColor} onChange={e => updateHeader({ companyNameColor: e.target.value })} />
                                    </div>
                                  </Field>
                                </div>
                              </div>

                              {/* Tagline */}
                              <div className="grid grid-cols-1 gap-3">
                                <Field label="Tagline / Subtitle" hint="Optional — appears below company name">
                                  <input type="text" className={inputCls} placeholder="e.g. Excellence in Every Step" value={letterhead.header.tagline} onChange={e => updateHeader({ tagline: e.target.value })} />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                  <Field label="Alignment">
                                    <AlignButtons value={letterhead.header.taglineAlignment} onChange={v => updateHeader({ taglineAlignment: v })} />
                                  </Field>
                                  <Field label="Color">
                                    <div className="flex items-center gap-2">
                                      <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={letterhead.header.taglineColor} onChange={e => updateHeader({ taglineColor: e.target.value })} />
                                      <input type="text" className={`${inputCls} font-mono text-xs`} value={letterhead.header.taglineColor} onChange={e => updateHeader({ taglineColor: e.target.value })} />
                                    </div>
                                  </Field>
                                </div>
                              </div>

                              {/* Address */}
                              <Field label="Address Line" hint="Full address shown in header">
                                <input type="text" className={inputCls} placeholder="e.g. 14th Floor, Nexus Tower, BKC, Mumbai - 400051" value={letterhead.header.addressLine} onChange={e => updateHeader({ addressLine: e.target.value })} />
                              </Field>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Address Alignment">
                                  <AlignButtons value={letterhead.header.addressAlignment} onChange={v => updateHeader({ addressAlignment: v })} />
                                </Field>
                              </div>

                              {/* Contact */}
                              <Field label="Contact Line" hint="Phone, email in one line">
                                <input type="text" className={inputCls} placeholder="Tel: +91 22 4000 1000 | Email: admin@nexus.com" value={letterhead.header.contactLine} onChange={e => updateHeader({ contactLine: e.target.value })} />
                              </Field>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Contact Alignment">
                                  <AlignButtons value={letterhead.header.contactAlignment} onChange={v => updateHeader({ contactAlignment: v })} />
                                </Field>
                              </div>

                              {/* Website */}
                              <Field label="Website Line">
                                <input type="text" className={inputCls} placeholder="www.nexus.com" value={letterhead.header.websiteLine} onChange={e => updateHeader({ websiteLine: e.target.value })} />
                              </Field>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Website Alignment">
                                  <AlignButtons value={letterhead.header.websiteAlignment} onChange={v => updateHeader({ websiteAlignment: v })} />
                                </Field>
                              </div>

                              {/* Divider */}
                              <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                <ToggleSwitch
                                  value={letterhead.header.dividerEnabled}
                                  onChange={v => updateHeader({ dividerEnabled: v })}
                                  label="Show Divider Line"
                                  description="Horizontal line separating header from content"
                                />
                                {letterhead.header.dividerEnabled && (
                                  <div className="grid grid-cols-2 gap-3">
                                    <Field label="Divider Color">
                                      <div className="flex items-center gap-2">
                                        <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={letterhead.header.dividerColor} onChange={e => updateHeader({ dividerColor: e.target.value })} />
                                        <input type="text" className={`${inputCls} font-mono text-xs`} value={letterhead.header.dividerColor} onChange={e => updateHeader({ dividerColor: e.target.value })} />
                                      </div>
                                    </Field>
                                    <Field label="Thickness">
                                      <select className={selectCls} value={letterhead.header.dividerThickness} onChange={e => updateHeader({ dividerThickness: e.target.value as any })}>
                                        <option value="thin">Thin (1px)</option>
                                        <option value="medium">Medium (2px)</option>
                                        <option value="thick">Thick (3px)</option>
                                      </select>
                                    </Field>
                                  </div>
                                )}
                              </div>

                              {/* Background Color */}
                              <Field label="Header Background Color">
                                <div className="flex items-center gap-2">
                                  <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={letterhead.header.backgroundColor} onChange={e => updateHeader({ backgroundColor: e.target.value })} />
                                  <input type="text" className={`${inputCls} font-mono text-xs`} value={letterhead.header.backgroundColor} onChange={e => updateHeader({ backgroundColor: e.target.value })} />
                                  <button onClick={() => updateHeader({ backgroundColor: '#ffffff' })} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground">Reset</button>
                                </div>
                              </Field>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Footer Design ── */}
                  {activeSubTab === 'footer' && (
                    <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <AlignLeft size={15} className="text-purple-600" /> Footer Configuration
                        </h3>
                        <ToggleSwitch
                          value={letterhead.footer.enabled}
                          onChange={v => updateFooter({ enabled: v })}
                          label="Enable Footer"
                        />
                      </div>

                      {letterhead.footer.enabled && (
                        <div className="space-y-4">
                          {/* Custom HTML Toggle */}
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <ToggleSwitch
                              value={letterhead.footer.useCustomHtml}
                              onChange={v => updateFooter({ useCustomHtml: v })}
                              label="Use Custom HTML"
                              description="Advanced: write raw HTML for full control over footer layout"
                            />
                          </div>

                          {letterhead.footer.useCustomHtml ? (
                            <Field label="Custom HTML Code" hint="Write valid HTML. Use inline styles for formatting.">
                              <textarea
                                className={`${inputCls} font-mono text-xs resize-none`}
                                rows={8}
                                placeholder="<div style='text-align:center;font-size:10px;'>Confidential Document</div>"
                                value={letterhead.footer.customHtml}
                                onChange={e => updateFooter({ customHtml: e.target.value })}
                              />
                            </Field>
                          ) : (
                            <>
                              {/* Divider */}
                              <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                <ToggleSwitch
                                  value={letterhead.footer.dividerEnabled}
                                  onChange={v => updateFooter({ dividerEnabled: v })}
                                  label="Show Divider Line"
                                  description="Horizontal line separating content from footer"
                                />
                                {letterhead.footer.dividerEnabled && (
                                  <div className="grid grid-cols-2 gap-3">
                                    <Field label="Divider Color">
                                      <div className="flex items-center gap-2">
                                        <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={letterhead.footer.dividerColor} onChange={e => updateFooter({ dividerColor: e.target.value })} />
                                        <input type="text" className={`${inputCls} font-mono text-xs`} value={letterhead.footer.dividerColor} onChange={e => updateFooter({ dividerColor: e.target.value })} />
                                      </div>
                                    </Field>
                                    <Field label="Thickness">
                                      <select className={selectCls} value={letterhead.footer.dividerThickness} onChange={e => updateFooter({ dividerThickness: e.target.value as any })}>
                                        <option value="thin">Thin (1px)</option>
                                        <option value="medium">Medium (2px)</option>
                                        <option value="thick">Thick (3px)</option>
                                      </select>
                                    </Field>
                                  </div>
                                )}
                              </div>

                              {/* Footer Line 1 */}
                              <div className="space-y-3">
                                <Field label="Footer Line 1">
                                  <input type="text" className={inputCls} placeholder="e.g. This is a computer-generated document." value={letterhead.footer.line1} onChange={e => updateFooter({ line1: e.target.value })} />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                  <Field label="Alignment">
                                    <AlignButtons value={letterhead.footer.line1Alignment} onChange={v => updateFooter({ line1Alignment: v })} />
                                  </Field>
                                  <Field label="Color">
                                    <div className="flex items-center gap-2">
                                      <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={letterhead.footer.line1Color} onChange={e => updateFooter({ line1Color: e.target.value })} />
                                      <input type="text" className={`${inputCls} font-mono text-xs`} value={letterhead.footer.line1Color} onChange={e => updateFooter({ line1Color: e.target.value })} />
                                    </div>
                                  </Field>
                                </div>
                              </div>

                              {/* Footer Line 2 */}
                              <div className="space-y-3">
                                <Field label="Footer Line 2" hint="Optional second line">
                                  <input type="text" className={inputCls} placeholder="e.g. Confidential — For addressee only" value={letterhead.footer.line2} onChange={e => updateFooter({ line2: e.target.value })} />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                  <Field label="Alignment">
                                    <AlignButtons value={letterhead.footer.line2Alignment} onChange={v => updateFooter({ line2Alignment: v })} />
                                  </Field>
                                  <Field label="Color">
                                    <div className="flex items-center gap-2">
                                      <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={letterhead.footer.line2Color} onChange={e => updateFooter({ line2Color: e.target.value })} />
                                      <input type="text" className={`${inputCls} font-mono text-xs`} value={letterhead.footer.line2Color} onChange={e => updateFooter({ line2Color: e.target.value })} />
                                    </div>
                                  </Field>
                                </div>
                              </div>

                              {/* Page Number */}
                              <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                <ToggleSwitch
                                  value={letterhead.footer.showPageNumber}
                                  onChange={v => updateFooter({ showPageNumber: v })}
                                  label="Show Page Number"
                                  description="Automatically adds page number to footer"
                                />
                                {letterhead.footer.showPageNumber && (
                                  <Field label="Page Number Alignment">
                                    <AlignButtons value={letterhead.footer.pageNumberAlignment} onChange={v => updateFooter({ pageNumberAlignment: v })} />
                                  </Field>
                                )}
                              </div>

                              {/* Footer Banner Image Upload */}
                              <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <FileImage size={13} className="text-purple-600" /> Footer Banner Image
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">Optional full-width image at bottom of footer</span>
                                </div>
                                <ImageUploadZone
                                  label="Upload Footer Banner Image"
                                  hint="PNG, JPG, SVG — max 5 MB. Displays as full-width banner at bottom of footer."
                                  dataUrl={letterhead.footer.footerImageDataUrl}
                                  onUpload={dataUrl => updateFooter({ footerImageDataUrl: dataUrl })}
                                  onRemove={() => updateFooter({ footerImageDataUrl: '' })}
                                />
                                {letterhead.footer.footerImageDataUrl && (
                                  <Field label="Banner Image Height">
                                    <select
                                      className={selectCls}
                                      value={letterhead.footer.footerImageHeight}
                                      onChange={e => updateFooter({ footerImageHeight: e.target.value as any })}
                                    >
                                      <option value="sm">Small (40px)</option>
                                      <option value="md">Medium (64px)</option>
                                      <option value="lg">Large (96px)</option>
                                    </select>
                                  </Field>
                                )}
                              </div>

                              {/* Background Color */}
                              <Field label="Footer Background Color">
                                <div className="flex items-center gap-2">
                                  <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={letterhead.footer.backgroundColor} onChange={e => updateFooter({ backgroundColor: e.target.value })} />
                                  <input type="text" className={`${inputCls} font-mono text-xs`} value={letterhead.footer.backgroundColor} onChange={e => updateFooter({ backgroundColor: e.target.value })} />
                                  <button onClick={() => updateFooter({ backgroundColor: '#ffffff' })} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground">Reset</button>
                                </div>
                              </Field>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Report Usage ── */}
                  {activeSubTab === 'usage' && (
                    <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <FileText size={15} className="text-purple-600" /> Report Usage
                        </h3>
                        <span className="text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                          {usageCount} / {REPORT_TYPES.length} selected
                        </span>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700">
                          Select which document types should use this letterhead for <strong>{selectedLocation.name}</strong>. 
                          The header and footer will be automatically applied when generating these documents.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Document Types</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateUsage(Object.fromEntries(REPORT_TYPES.map(r => [r.key, true])) as unknown as LetterheadUsage)}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              Select All
                            </button>
                            <span className="text-muted-foreground">·</span>
                            <button
                              onClick={() => updateUsage(Object.fromEntries(REPORT_TYPES.map(r => [r.key, false])) as unknown as LetterheadUsage)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>
                        {REPORT_TYPES.map(report => (
                          <motion.div
                            key={report.key}
                            whileHover={{ x: 2 }}
                            className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              letterhead.usage[report.key]
                                ? 'border-purple-300 bg-purple-50'
                                : 'border-border bg-accent/20 hover:border-purple-200'
                            }`}
                            onClick={() => updateUsage({ [report.key]: !letterhead.usage[report.key] })}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{report.icon}</span>
                              <div>
                                <p className="font-semibold text-sm">{report.label}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {letterhead.usage[report.key] ? 'Letterhead will be applied' : 'No letterhead applied'}
                                </p>
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              letterhead.usage[report.key] ? 'bg-purple-600 border-purple-600' : 'border-border'
                            }`}>
                              {letterhead.usage[report.key] && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Page Settings ── */}
                  {activeSubTab === 'settings' && (
                    <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <Printer size={15} className="text-purple-600" /> Page & Margin Settings
                      </h3>

                      <Field label="Paper Size">
                        <select className={selectCls} value={letterhead.paperSize} onChange={e => updateLetterhead({ paperSize: e.target.value as any })}>
                          <option value="A4">A4 (210 × 297 mm)</option>
                          <option value="Letter">Letter (216 × 279 mm)</option>
                          <option value="Legal">Legal (216 × 356 mm)</option>
                        </select>
                      </Field>

                      <div className="p-4 bg-accent/30 rounded-xl border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Page Margins (mm)</p>
                        <div className="grid grid-cols-2 gap-4">
                          <Field label="Top Margin">
                            <input type="number" className={inputCls} min={0} max={50} value={letterhead.marginTop} onChange={e => updateLetterhead({ marginTop: parseInt(e.target.value) || 0 })} />
                          </Field>
                          <Field label="Bottom Margin">
                            <input type="number" className={inputCls} min={0} max={50} value={letterhead.marginBottom} onChange={e => updateLetterhead({ marginBottom: parseInt(e.target.value) || 0 })} />
                          </Field>
                          <Field label="Left Margin">
                            <input type="number" className={inputCls} min={0} max={50} value={letterhead.marginLeft} onChange={e => updateLetterhead({ marginLeft: parseInt(e.target.value) || 0 })} />
                          </Field>
                          <Field label="Right Margin">
                            <input type="number" className={inputCls} min={0} max={50} value={letterhead.marginRight} onChange={e => updateLetterhead({ marginRight: parseInt(e.target.value) || 0 })} />
                          </Field>
                        </div>
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-lg text-xs text-muted-foreground">
                          <Info size={12} className="shrink-0" />
                          <span>Margins define the printable area. Standard recommendation: 20–25mm on all sides.</span>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Quick Presets</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Standard', top: 20, bottom: 20, left: 25, right: 25 },
                            { label: 'Compact', top: 15, bottom: 15, left: 20, right: 20 },
                            { label: 'Wide', top: 25, bottom: 25, left: 30, right: 30 },
                          ].map(preset => (
                            <button
                              key={preset.label}
                              onClick={() => updateLetterhead({ marginTop: preset.top, marginBottom: preset.bottom, marginLeft: preset.left, marginRight: preset.right })}
                              className="px-3 py-2 border border-border rounded-lg text-xs font-medium hover:bg-accent hover:border-purple-300 transition-all text-center"
                            >
                              <p className="font-bold">{preset.label}</p>
                              <p className="text-muted-foreground text-[10px]">{preset.top}/{preset.bottom}/{preset.left}/{preset.right}mm</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Export PDF Section */}
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm"><Download size={16} className="text-rose-600" /></div>
                          <div>
                            <p className="font-bold text-sm text-rose-800">Export as PDF</p>
                            <p className="text-xs text-rose-700">Generate a sample A4 document with dummy content to preview the letterhead.</p>
                          </div>
                        </div>
                        <button
                          onClick={handleExportPDF}
                          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-semibold shadow-sm"
                        >
                          <Download size={15} /> Generate PDF Preview
                        </button>
                        <p className="text-[10px] text-rose-600 text-center mt-2">
                          Opens in a new window. Use browser Print → Save as PDF to export.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Preview Panel */}
            {showPreview && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Eye size={15} className="text-purple-600" /> Live Preview
                  </h3>
                  <span className="text-[10px] text-muted-foreground bg-accent border border-border px-2 py-0.5 rounded-full">
                    {letterhead.paperSize} · {letterhead.marginLeft}mm margins
                  </span>
                </div>
                <LetterheadPreview letterhead={letterhead} locationName={selectedLocation.name} />
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                  <Info size={12} className="shrink-0" />
                  <span>Preview is approximate. Actual output may vary slightly based on print settings and document content.</span>
                </div>
                {/* Export button in preview panel */}
                <button
                  onClick={handleExportPDF}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors text-sm font-semibold shadow-sm"
                >
                  <Download size={15} /> Export as PDF — Sample A4 Preview
                </button>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl"><Layout size={18} className="text-purple-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Header</p>
                <p className="font-bold text-sm mt-0.5">{letterhead.header.enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl"><AlignLeft size={18} className="text-purple-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Footer</p>
                <p className="font-bold text-sm mt-0.5">{letterhead.footer.enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl"><FileText size={18} className="text-purple-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Reports</p>
                <p className="font-bold text-sm mt-0.5">{usageCount} / {REPORT_TYPES.length}</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl"><Printer size={18} className="text-purple-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Paper</p>
                <p className="font-bold text-sm mt-0.5">{letterhead.paperSize}</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ─── Seed Data ────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTree(departments: Department[], parentId: string | null = null): Department[] {
  return departments
    .filter(d => d.parentId === parentId)
    .map(d => ({ ...d, children: buildTree(departments, d.id) }));
}

function flattenTree(tree: Department[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: Department[]) => {
    nodes.forEach(n => { ids.push(n.id); if (n.children?.length) walk(n.children); });
  };
  walk(tree);
  return ids;
}

// ─── Doc Upload Zone ──────────────────────────────────────────────────────────

const DocUploadZone = ({ fieldKey, label, entityRef }: {
  fieldKey: string;
  label: string;
  /** Per-location uniqueness; falls back to the field key. */
  entityRef?: string;
  // Legacy form-state props accepted but ignored — storage is now the DB.
  docs?: UploadedDoc[];
  onUpload?: (fieldKey: string, files: FileList) => void;
  onRemove?: (fieldKey: string, docId: string) => void;
  onSign?: (fieldKey: string, docId: string, sig: SignatureData) => void;
}) => (
  <div className="mt-3">
    <SecureDocUploadZone
      entityType="establishment"
      entityRef={entityRef ?? `establishment/${fieldKey}`}
      label={label}
      signerName="Authorised Signatory"
      signerId="—"
    />
  </div>
);

// ─── Tab: Basic Information ───────────────────────────────────────────────────

interface BasicTabProps {
  data: EstablishmentData;
  onChange: (key: keyof EstablishmentData, value: any) => void;
}

const SEGMENT_TYPES: EmpIdSegmentType[] = ['estCode', 'year', 'dob', 'serial', 'delimiter', 'text'];
const SEGMENT_CHIP: Record<EmpIdSegmentType, string> = {
  estCode: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  year: 'bg-blue-100 text-blue-700 border-blue-200',
  dob: 'bg-violet-100 text-violet-700 border-violet-200',
  serial: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  delimiter: 'bg-amber-100 text-amber-700 border-amber-200',
  text: 'bg-gray-100 text-gray-600 border-gray-200',
};

const EmailConfigCard = ({ data, onChange }: { data: EstablishmentData; onChange: (key: keyof EstablishmentData, value: any) => void }) => {
  const [testTo, setTestTo] = useState('');
  const [sending, setSending] = useState(false);
  const sendTest = async () => {
    if (!testTo.trim()) { toast.error('Enter a recipient email to test.'); return; }
    setSending(true);
    const res = await sendEmployeeEmail({
      toEmail: testTo.trim(), category: 'test', documentTitle: 'SMTP Test — SakthiHR',
      subject: 'SMTP Test — SakthiHR', message: '<p>This is a test email confirming your SMTP configuration works.</p>',
    });
    setSending(false);
    if (res.error) toast.error(`Test failed: ${res.error}`);
    else if (res.status === 'Simulated') toast.success('Logged as Simulated (enable + save SMTP to send for real).');
    else toast.success(`Test queued (status: ${res.status}). Check the Email Communications log.`);
  };
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
      <SectionHeader icon={Mail} title="Email / SMTP" subtitle="Mail employee documents (payslips, letters, reports) with receipt tracking" accentColor="text-blue-600" accentBg="bg-blue-50" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
        <Field label="Provider" hint="SMTP relays through your mail server. Off = simulate (log only).">
          <select className={selectCls} value={data.emailProvider} onChange={e => onChange('emailProvider', e.target.value)}>
            <option value="smtp">SMTP server</option>
            <option value="off">Off (simulate only)</option>
          </select>
        </Field>
        <div className="flex items-end pb-1"><ToggleSwitch value={data.emailEnabled} onChange={v => onChange('emailEnabled', v)} label="Enable sending" description="When off, emails are simulated (logged only)." /></div>
      </div>

      {data.emailProvider === 'smtp' && (
        <>
          <div className="mb-4 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <CheckCircle2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700">Enter your mail server details. <strong>Use port 465 (SSL/TLS).</strong> For Gmail/Google Workspace you must use a 16-character <strong>App Password</strong> (Google Account → Security → 2-Step Verification → App passwords) — not your normal login password. Recipients come from each employee's email in Employee Master; the mail carries the document as an attachment plus tracked "View / Download" and "Confirm Receipt" links that update the per-employee status in <strong>Email Communications</strong>.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="SMTP Host" hint="e.g. smtp.gmail.com, smtp.office365.com">
              <input className={inputCls} placeholder="smtp.example.com" value={data.emailHost} onChange={e => onChange('emailHost', e.target.value)} />
            </Field>
            <Field label="Port" hint="Use 465 (SSL/TLS) — most reliable. Avoid 587/STARTTLS here.">
              <input className={inputCls} placeholder="465" value={data.emailPort} onChange={e => onChange('emailPort', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Username" hint="Usually the full mailbox address.">
              <input className={inputCls} placeholder="payroll@example.com" value={data.emailUsername} onChange={e => onChange('emailUsername', e.target.value)} />
            </Field>
            <Field label="Password" hint="App password / SMTP password. Stored in the establishment record.">
              <input type="password" className={inputCls} placeholder="••••••••" value={data.emailPassword} onChange={e => onChange('emailPassword', e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="From Name" hint="Sender display name.">
              <input className={inputCls} placeholder="SakthiHR Payroll" value={data.emailFromName} onChange={e => onChange('emailFromName', e.target.value)} />
            </Field>
            <Field label="From Address" hint="The sending address (often = username).">
              <input className={inputCls} placeholder="payroll@example.com" value={data.emailFromAddress} onChange={e => onChange('emailFromAddress', e.target.value)} />
            </Field>
            <Field label="Reply-To" hint="Optional reply address.">
              <input className={inputCls} placeholder="optional" value={data.emailReplyTo} onChange={e => onChange('emailReplyTo', e.target.value)} />
            </Field>
            <div className="flex items-end pb-1"><ToggleSwitch value={data.emailSecure} onChange={v => onChange('emailSecure', v)} label="Use TLS/SSL" description="On for port 465; STARTTLS on 587 also works." /></div>
          </div>
          <div className="mt-5">
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Send Test Email</label>
            <div className="flex items-center gap-2 max-w-lg">
              <input className={inputCls} placeholder="you@example.com" value={testTo} onChange={e => setTestTo(e.target.value)} />
              <button type="button" onClick={sendTest} disabled={sending} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"><Send size={14} /> {sending ? 'Sending…' : 'Send Test'}</button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">Save your changes first — the test uses the saved configuration.</p>
          </div>
        </>
      )}
    </div>
  );
};

const EmployeeIdPatternCard = ({ pattern, onChange }: { pattern: EmpIdPattern; onChange: (p: EmpIdPattern) => void }) => {
  const [addType, setAddType] = useState<EmpIdSegmentType>('estCode');
  const update = (patch: Partial<EmpIdPattern>) => onChange({ ...pattern, ...patch });
  const updateSeg = (id: string, patch: Partial<EmpIdSegment>) => update({ segments: pattern.segments.map(s => s.id === id ? { ...s, ...patch } : s) });
  const removeSeg = (id: string) => update({ segments: pattern.segments.filter(s => s.id !== id) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pattern.segments.length) return;
    const next = [...pattern.segments];
    [next[i], next[j]] = [next[j], next[i]];
    update({ segments: next });
  };
  const sample = sampleEmployeeId(pattern);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
      <div className="flex items-center justify-between">
        <SectionHeader icon={Hash} title="Employee ID Generation Pattern" subtitle="Define how new Employee IDs are auto-generated in Employee Master" />
        <div onClick={() => update({ enabled: !pattern.enabled })} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${pattern.enabled ? 'bg-primary' : 'bg-border'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${pattern.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></div>
      </div>

      {/* Live sample */}
      <div className="mb-5 flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200">
        <Eye size={16} className="text-indigo-600 shrink-0" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">Sample Employee ID</p>
          <p className="text-xl font-bold font-mono text-indigo-800 tracking-wide">{sample || '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <Field label="Establishment Code"><input type="text" className={`${inputCls} font-mono uppercase`} placeholder="e.g. SMS" value={pattern.establishmentCode} onChange={e => update({ establishmentCode: e.target.value.toUpperCase() })} /></Field>
        <Field label="Default Delimiter" hint="Separator between segments"><input type="text" className={`${inputCls} font-mono`} maxLength={3} placeholder="- / ." value={pattern.delimiter} onChange={e => update({ delimiter: e.target.value })} /></Field>
        <Field label="Serial Start No."><input type="number" min={0} className={inputCls} value={pattern.serialStart} onChange={e => update({ serialStart: parseInt(e.target.value) || 0 })} /></Field>
      </div>

      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Pattern Segments (in order)</p>
      <div className="space-y-2">
        {pattern.segments.map((seg, i) => (
          <div key={seg.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-accent/20">
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp size={14} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === pattern.segments.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown size={14} /></button>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border w-36 text-center shrink-0 ${SEGMENT_CHIP[seg.type]}`}>{SEGMENT_META[seg.type].label}</span>
            <div className="flex-1">
              {seg.type === 'year' && (
                <select className={selectCls} value={seg.format || 'YY'} onChange={e => updateSeg(seg.id, { format: e.target.value })}>
                  {YEAR_FORMATS.map(f => <option key={f} value={f}>{f === 'YYYY' ? 'YYYY (2025)' : 'YY (25)'}</option>)}
                </select>
              )}
              {seg.type === 'dob' && (
                <select className={selectCls} value={seg.format || 'DDMMYYYY'} onChange={e => updateSeg(seg.id, { format: e.target.value })}>
                  {DOB_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
              {seg.type === 'serial' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Digits:</span>
                  <input type="number" min={1} max={10} className={`${inputCls} w-24`} value={seg.digits ?? 4} onChange={e => updateSeg(seg.id, { digits: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })} />
                  <span className="text-[10px] text-muted-foreground font-mono">→ {String(pattern.serialStart).padStart(seg.digits ?? 4, '0')}</span>
                </div>
              )}
              {seg.type === 'delimiter' && (
                <input type="text" className={`${inputCls} font-mono`} maxLength={3} placeholder={`default "${pattern.delimiter}"`} value={seg.value ?? ''} onChange={e => updateSeg(seg.id, { value: e.target.value })} />
              )}
              {seg.type === 'text' && (
                <input type="text" className={`${inputCls} font-mono`} placeholder="static text" value={seg.value ?? ''} onChange={e => updateSeg(seg.id, { value: e.target.value })} />
              )}
              {seg.type === 'estCode' && <span className="text-xs text-muted-foreground">Uses the Establishment Code above</span>}
            </div>
            <button type="button" onClick={() => removeSeg(seg.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"><Trash2 size={14} /></button>
          </div>
        ))}
        {pattern.segments.length === 0 && <p className="text-xs text-muted-foreground italic py-2">No segments — add at least one below.</p>}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <select className={`${selectCls} w-56`} value={addType} onChange={e => setAddType(e.target.value as EmpIdSegmentType)}>
          {SEGMENT_TYPES.map(t => <option key={t} value={t}>{SEGMENT_META[t].label}</option>)}
        </select>
        <button type="button" onClick={() => update({ segments: [...pattern.segments, newSegment(addType)] })} className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm font-medium"><Plus size={15} /> Add Segment</button>
      </div>
    </div>
  );
};

const BasicTab = ({ data, onChange }: BasicTabProps) => {
  const selectedCurrency = CURRENCIES.find(c => c.code === data.currency) ?? CURRENCIES[0];

  return (
    <div className="space-y-8">
      <LogoUpload
        logoDataUrl={data.logoDataUrl}
        companyName={data.name}
        onUpload={(dataUrl) => onChange('logoDataUrl', dataUrl)}
        onRemove={() => onChange('logoDataUrl', '')}
      />

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Building2} title="Organisation Identity" subtitle="Legal name, type, incorporation and industry details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Establishment / Company Name" required>
              <input type="text" className={inputCls} placeholder="Full legal name of the organisation" value={data.name} onChange={e => onChange('name', e.target.value)} />
            </Field>
          </div>
          <Field label="Short Name / Trade Name">
            <input type="text" className={inputCls} placeholder="Abbreviated or trade name" value={data.shortName} onChange={e => onChange('shortName', e.target.value)} />
          </Field>
          <Field label="Date of Incorporation">
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <DateInput className={`${inputCls} pl-9`} value={data.incorporationDate} onChange={e => onChange('incorporationDate', e.target.value)} />
            </div>
          </Field>
          <Field label="Entity Type" required>
            <select className={selectCls} value={data.entityType} onChange={e => onChange('entityType', e.target.value)}>
              <option value="">— Select Entity Type —</option>
              {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Industry Type">
            <select className={selectCls} value={data.industryType} onChange={e => onChange('industryType', e.target.value)}>
              <option value="">— Select Industry —</option>
              {INDUSTRY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Base Currency" required hint="This currency will be used across all payroll transactions, salary slips, and financial reports.">
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select className={`${selectCls} pl-9`} value={data.currency} onChange={e => onChange('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} — {c.code} · {c.name}</option>)}
                </select>
              </div>
              {data.currency && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle size={13} className="text-amber-600 shrink-0" />
                  <p className="text-[11px] text-amber-700">
                    <span className="font-semibold">{selectedCurrency.symbol} {selectedCurrency.code}</span> will be applied to all salary calculations, payslips, loan records, and financial reports.
                  </p>
                </motion.div>
              )}
            </Field>
          </div>
        </div>
      </div>

      <EmployeeIdPatternCard pattern={data.employeeIdPattern} onChange={p => onChange('employeeIdPattern', p)} />

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Banknote} title="Payroll Round-Off" subtitle="Rounding applied to the net take-home in salary computation" accentColor="text-emerald-600" accentBg="bg-emerald-50" />
        <div className="max-w-sm">
          <Field label="Net Take-Home Round-Off" hint="Applied to each employee's net take-home in the salary structure & payslip.">
            <select className={selectCls} value={data.netRoundoff} onChange={e => onChange('netRoundoff', e.target.value as RoundCode)}>
              {ROUND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <EmailConfigCard data={data} onChange={onChange} />

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Phone} title="Contact Information" subtitle="Official email, phone and website" accentColor="text-teal-600" accentBg="bg-teal-50" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Official Email" required>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" className={`${inputCls} pl-9`} placeholder="admin@company.com" value={data.email} onChange={e => onChange('email', e.target.value)} />
            </div>
          </Field>
          <Field label="Phone Number">
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="tel" className={`${inputCls} pl-9`} placeholder="+91 22 4000 1000" value={data.phone} onChange={e => onChange('phone', e.target.value)} />
            </div>
          </Field>
          <div className="md:col-span-2">
            <Field label="Website">
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="url" className={`${inputCls} pl-9`} placeholder="https://company.com" value={data.website} onChange={e => onChange('website', e.target.value)} />
              </div>
            </Field>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={MapPin} title="Registered Address" subtitle="Official registered address of the establishment" accentColor="text-amber-600" accentBg="bg-amber-50" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Address Line 1" required>
              <input type="text" className={inputCls} placeholder="Building name, floor, street" value={data.addressLine1} onChange={e => onChange('addressLine1', e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Address Line 2">
              <input type="text" className={inputCls} placeholder="Area, locality, landmark" value={data.addressLine2} onChange={e => onChange('addressLine2', e.target.value)} />
            </Field>
          </div>
          <Field label="City" required>
            <input type="text" className={inputCls} placeholder="City" value={data.city} onChange={e => onChange('city', e.target.value)} />
          </Field>
          <Field label="District" required>
            <input type="text" className={inputCls} placeholder="District" value={data.district} onChange={e => onChange('district', e.target.value)} />
          </Field>
          <Field label="State" required>
            <select className={selectCls} value={data.state} onChange={e => onChange('state', e.target.value)}>
              <option value="">— Select State —</option>
              {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="PIN Code" required>
            <input type="text" className={inputCls} placeholder="6-digit PIN code" maxLength={6} value={data.pincode} onChange={e => onChange('pincode', e.target.value.replace(/\D/g, ''))} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Country">
              <input type="text" className={inputCls} placeholder="Country" value={data.country} onChange={e => onChange('country', e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Users} title="Occupier & Manager Details" subtitle="Responsible persons under Factories Act / Shops & Establishments Act" accentColor="text-violet-600" accentBg="bg-violet-50" />
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-5">
          <AlertCircle size={17} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Legal Requirement:</span> Under the Factories Act 1948 and Shops & Establishments Acts, the Occupier and Manager must be registered with the relevant authority.
          </p>
        </div>

        <div className="rounded-xl border-2 bg-violet-50 border-violet-200 p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white rounded-lg shadow-sm"><User size={18} className="text-violet-600" /></div>
            <div>
              <h3 className="font-bold text-sm">Occupier</h3>
              <p className="text-[10px] text-muted-foreground">Personal details and contact information</p>
            </div>
            {data.occupier.name && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-border text-green-600">
                <CheckCircle2 size={11} /> Filled
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Full Name" required>
                <input type="text" className={whiteInputCls} placeholder="Full name of occupier" value={data.occupier.name} onChange={e => onChange('occupier', { ...data.occupier, name: e.target.value })} />
              </Field>
            </div>
            <Field label="Designation">
              <input type="text" className={whiteInputCls} placeholder="e.g. Managing Director" value={data.occupier.designation} onChange={e => onChange('occupier', { ...data.occupier, designation: e.target.value })} />
            </Field>
            <Field label="Phone Number">
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="tel" className={`${whiteInputCls} pl-8`} placeholder="+91 98765 43210" value={data.occupier.phone} onChange={e => onChange('occupier', { ...data.occupier, phone: e.target.value })} />
              </div>
            </Field>
            <div className="md:col-span-2">
              <Field label="Email Address">
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" className={`${whiteInputCls} pl-8`} placeholder="occupier@company.com" value={data.occupier.email} onChange={e => onChange('occupier', { ...data.occupier, email: e.target.value })} />
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div className="rounded-xl border-2 bg-sky-50 border-sky-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white rounded-lg shadow-sm"><Users size={18} className="text-sky-600" /></div>
            <div>
              <h3 className="font-bold text-sm">Manager</h3>
              <p className="text-[10px] text-muted-foreground">Personal details and contact information</p>
            </div>
            {data.manager.name && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-border text-green-600">
                <CheckCircle2 size={11} /> Filled
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Full Name" required>
                <input type="text" className={whiteInputCls} placeholder="Full name of manager" value={data.manager.name} onChange={e => onChange('manager', { ...data.manager, name: e.target.value })} />
              </Field>
            </div>
            <Field label="Designation">
              <input type="text" className={whiteInputCls} placeholder="e.g. Factory Manager" value={data.manager.designation} onChange={e => onChange('manager', { ...data.manager, designation: e.target.value })} />
            </Field>
            <Field label="Phone Number">
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="tel" className={`${whiteInputCls} pl-8`} placeholder="+91 98765 43210" value={data.manager.phone} onChange={e => onChange('manager', { ...data.manager, phone: e.target.value })} />
              </div>
            </Field>
            <div className="md:col-span-2">
              <Field label="Email Address">
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" className={`${whiteInputCls} pl-8`} placeholder="manager@company.com" value={data.manager.email} onChange={e => onChange('manager', { ...data.manager, email: e.target.value })} />
                </div>
              </Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Work Locations ──────────────────────────────────────────────────────

interface LocationsTabProps {
  locations: WorkLocation[];
  departments: Department[];
  onAdd: () => void;
  onEdit: (loc: WorkLocation) => void;
  onDelete: (id: string) => void;
  onAddDept: (locationId: string) => void;
  onEditDept: (dept: Department) => void;
  onDeleteDept: (id: string) => void;
}

const LocationsTab = ({ locations, departments, onAdd, onEdit, onDelete, onAddDept, onEditDept, onDeleteDept }: LocationsTabProps) => {
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Work Locations</h2>
          <p className="text-sm text-muted-foreground">Manage all physical work locations and their departments.</p>
        </div>
        <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
          <Plus size={16} /> Add Location
        </button>
      </div>

      <div className="space-y-4">
        {locations.map((loc, i) => {
          const totalDepts = departments.filter(d => d.locationId === loc.id).length;
          const isExpanded = expandedLocation === loc.id;

          return (
            <motion.div
              key={loc.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            >
              <div className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-sm">{loc.name}</h3>
                    <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{loc.code}</span>
                    <StatusBadge status={loc.status} />
                    {loc.letterhead.isActive && (
                      <span className="text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Layout size={9} /> Letterhead
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2">
                    <MapPin size={12} className="shrink-0 mt-0.5 text-primary/60" />
                    <span>{loc.address}, {loc.city}, {loc.state}, {loc.country}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Phone size={11} />{loc.phone}</span>
                    <span className="flex items-center gap-1"><Mail size={11} />{loc.email}</span>
                    <span className="flex items-center gap-1"><Users size={11} />{loc.employeeCount} employees</span>
                    <span className="flex items-center gap-1"><FolderTree size={11} />{totalDepts} departments</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedLocation(isExpanded ? null : loc.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      isExpanded ? 'bg-primary/10 text-primary border-primary/20' : 'border-border hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    <FolderTree size={12} />
                    Departments
                    <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <button onClick={() => onEdit(loc)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary border border-primary/20 transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => onDelete(loc.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive border border-destructive/20 transition-colors">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="p-5 bg-accent/20">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <FolderTree size={15} className="text-primary" />
                          <span className="font-bold text-sm">Departments — {loc.name}</span>
                          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{totalDepts}</span>
                        </div>
                        <button
                          onClick={() => onAddDept(loc.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity shadow-sm"
                        >
                          <Plus size={13} /> Add Department
                        </button>
                      </div>

                      {totalDepts > 0 ? (
                        <div className="bg-card rounded-xl border border-border overflow-hidden">
                          <div className="p-3 space-y-1">
                            {buildTree(departments.filter(d => d.locationId === loc.id)).map(node => (
                              <DeptNode key={node.id} node={node} allDepts={departments} depth={0} onEdit={onEditDept} onDelete={onDeleteDept} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-card rounded-xl border-2 border-dashed border-border">
                          <FolderTree size={24} className="text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground font-medium">No departments for this location</p>
                          <button
                            onClick={() => onAddDept(loc.id)}
                            className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity mx-auto"
                          >
                            <Plus size={13} /> Add Department
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {locations.length === 0 && (
        <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-primary" />
          </div>
          <p className="font-semibold text-muted-foreground">No work locations added yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-5">Add your first work location to get started</p>
          <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto">
            <Plus size={15} /> Add Location
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Departments ─────────────────────────────────────────────────────────

interface DepartmentsTabProps {
  departments: Department[];
  locations: WorkLocation[];
  onAdd: () => void;
  onEdit: (dept: Department) => void;
  onDelete: (id: string) => void;
  headerExtra?: React.ReactNode;
}

const DepartmentsTab = ({ departments, locations, onAdd, onEdit, onDelete, headerExtra }: DepartmentsTabProps) => {
  const [deptSearch, setDeptSearch] = useState('');
  const [deptLocationFilter, setDeptLocationFilter] = useState('all');

  const filteredDepts = departments.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(deptSearch.toLowerCase()) || d.code.toLowerCase().includes(deptSearch.toLowerCase());
    const matchLoc = deptLocationFilter === 'all' || d.locationId === deptLocationFilter;
    return matchSearch && matchLoc;
  });

  const deptTree = buildTree(filteredDepts);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Department Hierarchy</h2>
          <p className="text-sm text-muted-foreground">Manage departments and sub-departments across all locations.</p>
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
            <Plus size={16} /> Add Department
          </button>
        </div>
      </div>

      <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Search departments..."
            className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
            value={deptSearch}
            onChange={e => setDeptSearch(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm"
          value={deptLocationFilter}
          onChange={e => setDeptLocationFilter(e.target.value)}
        >
          <option value="all">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <CheckCircle2 size={14} className="text-green-600" />
          <span>{departments.filter(d => d.status === 'Active').length} active</span>
          <span className="mx-1">·</span>
          <AlertCircle size={14} className="text-amber-500" />
          <span>{departments.filter(d => d.status === 'Inactive').length} inactive</span>
        </div>
      </div>

      {locations.map(loc => {
        const locTree = deptTree.filter(n => n.locationId === loc.id);
        if (locTree.length === 0 && deptSearch) return null;
        return (
          <div key={loc.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-accent/20">
              <Building2 size={18} className="text-primary" />
              <div>
                <h3 className="font-bold text-sm">{loc.name}</h3>
                <p className="text-xs text-muted-foreground">{loc.city}, {loc.state} · {loc.code}</p>
              </div>
              <span className="ml-auto text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                {departments.filter(d => d.locationId === loc.id).length} dept(s)
              </span>
            </div>
            <div className="p-4 space-y-1">
              {locTree.length > 0 ? locTree.map(node => (
                <DeptNode key={node.id} node={node} allDepts={departments} depth={0} onEdit={onEdit} onDelete={onDelete} />
              )) : (
                <p className="text-sm text-muted-foreground text-center py-6">No departments found for this location.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Tab: Statutory ───────────────────────────────────────────────────────────

interface StatutoryTabProps {
  locations: WorkLocation[];
  onUpdateStatutory: (locationId: string, statutory: LocationStatutory) => void;
}

const StatutoryTab = ({ locations, onUpdateStatutory }: StatutoryTabProps) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id ?? '');

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const statutory = selectedLocation?.statutory ?? emptyStatutory();

  const handleChange = (key: keyof LocationStatutory, value: string) => {
    if (!selectedLocation) return;
    const updated = { ...statutory, [key]: value };
    onUpdateStatutory(selectedLocationId, updated);
  };

  const handleUpload = (fieldKey: string, files: FileList) => {
    if (!selectedLocation) return;
    const newDocs: UploadedDoc[] = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB limit.`); processed++; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({
          id: `${fieldKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name, size: file.size, type: file.type,
          uploadedAt: todayFormatted(),
          dataUrl: e.target?.result as string,
          category: fieldKey, description: '',
        });
        processed++;
        if (processed === files.length) {
          const updatedDocs = { ...statutory.documents, [fieldKey]: [...(statutory.documents[fieldKey] ?? []), ...newDocs] };
          onUpdateStatutory(selectedLocationId, { ...statutory, documents: updatedDocs });
          if (newDocs.length > 0) toast.success(`${newDocs.length} document(s) uploaded.`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveDoc = (fieldKey: string, docId: string) => {
    if (!selectedLocation) return;
    const updatedDocs = { ...statutory.documents, [fieldKey]: (statutory.documents[fieldKey] ?? []).filter(d => d.id !== docId) };
    onUpdateStatutory(selectedLocationId, { ...statutory, documents: updatedDocs });
    toast.info('Document removed.');
  };

  const handleSignDoc = (fieldKey: string, docId: string, sig: SignatureData) => {
    if (!selectedLocation) return;
    const updatedDocs = { ...statutory.documents, [fieldKey]: (statutory.documents[fieldKey] ?? []).map(d => d.id === docId ? { ...d, signature: sig } : d) };
    onUpdateStatutory(selectedLocationId, { ...statutory, documents: updatedDocs });
  };

  const filledStatutory = STATUTORY_FIELDS.filter(f => statutory[f.key as keyof LocationStatutory]?.toString().trim()).length;
  const totalDocs = Object.values(statutory.documents).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-rose-100 rounded-lg"><Shield size={18} className="text-rose-600" /></div>
          <div>
            <h2 className="font-bold text-base">Statutory & Compliance</h2>
            <p className="text-xs text-muted-foreground">Each work location has its own statutory registrations and compliance documents.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Select Location:</span>
          <div className="flex flex-wrap gap-2">
            {locations.map(loc => (
              <button
                key={loc.id}
                onClick={() => setSelectedLocationId(loc.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  selectedLocationId === loc.id
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                    : 'bg-card text-muted-foreground border-border hover:border-rose-300 hover:bg-rose-50'
                }`}
              >
                <Building2 size={14} />
                {loc.name}
                {selectedLocationId === loc.id && <CheckCircle2 size={13} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedLocation && (
        <motion.div key={selectedLocationId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <div className="p-2 bg-white rounded-lg shadow-sm"><Building2 size={18} className="text-rose-600" /></div>
            <div className="flex-1">
              <p className="font-bold text-sm text-rose-800">{selectedLocation.name}</p>
              <p className="text-xs text-rose-700">{selectedLocation.address}, {selectedLocation.city}, {selectedLocation.state}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-rose-700">{filledStatutory}/{STATUTORY_FIELDS.length}</p>
                <p className="text-[10px] text-rose-600">Fields filled</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-rose-700">{totalDocs}</p>
                <p className="text-[10px] text-rose-600">Documents</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Compliance Notice</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Ensure all registration numbers are accurate and match official government records for <strong>{selectedLocation.name}</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {STATUTORY_FIELDS.map(field => {
              const Icon = field.icon;
              const fieldDocs = statutory.documents[field.key] ?? [];
              const fieldValue = statutory[field.key as keyof LocationStatutory] as string;
              return (
                <motion.div
                  key={field.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-5 rounded-xl border-2 ${field.bgColor} transition-all`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Icon size={18} className={field.color} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm">{field.label}</h3>
                        {fieldValue?.trim() && <CheckCircle2 size={14} className="text-green-500" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{field.description}</p>
                    </div>
                    {fieldDocs.length > 0 && (
                      <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                        {fieldDocs.length} doc{fieldDocs.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono shadow-sm transition-all"
                    placeholder={field.placeholder}
                    maxLength={field.maxLength}
                    value={fieldValue ?? ''}
                    onChange={e => {
                      const val = field.key === 'panNo' || field.key === 'gstCode' || field.key === 'tanNo'
                        ? e.target.value.toUpperCase()
                        : e.target.value;
                      handleChange(field.key as keyof LocationStatutory, val);
                    }}
                  />
                  <DocUploadZone
                    fieldKey={field.key}
                    label={field.docLabel}
                    entityRef={`work_location/${selectedLocationId}/${field.key}`}
                  />
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {locations.length === 0 && (
        <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
          <Shield size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No work locations defined</p>
          <p className="text-xs text-muted-foreground mt-1">Add work locations first to configure statutory details per location.</p>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Bank Details ────────────────────────────────────────────────────────

interface BankTabProps {
  locations: WorkLocation[];
  onUpdateBankAccounts: (locationId: string, accounts: BankAccount[]) => void;
  onOpenBankModal: (locationId: string, account?: BankAccount) => void;
}

const BankTab = ({ locations, onUpdateBankAccounts, onOpenBankModal }: BankTabProps) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id ?? '');

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const accounts = selectedLocation?.bankAccounts ?? [];

  const primaryAccount = accounts.find(a => a.isPrimary);
  const activeCount = accounts.filter(a => a.status === 'Active').length;

  const handleSetPrimary = (id: string) => {
    const updated = accounts.map(a => ({ ...a, isPrimary: a.id === id }));
    onUpdateBankAccounts(selectedLocationId, updated);
    toast.success('Primary account updated.');
  };

  const handleToggleStatus = (id: string) => {
    const updated = accounts.map(a => a.id === id ? { ...a, status: a.status === 'Active' ? 'Inactive' as const : 'Active' as const } : a);
    onUpdateBankAccounts(selectedLocationId, updated);
  };

  const handleDelete = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (acc?.isPrimary && accounts.length > 1) {
      toast.error('Cannot delete primary account. Set another account as primary first.');
      return;
    }
    onUpdateBankAccounts(selectedLocationId, accounts.filter(a => a.id !== id));
    toast.info('Bank account removed.');
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg"><Banknote size={18} className="text-blue-600" /></div>
          <div>
            <h2 className="font-bold text-base">Bank Account Details</h2>
            <p className="text-xs text-muted-foreground">Each work location has its own bank accounts for payroll disbursement and transactions.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Select Location:</span>
          <div className="flex flex-wrap gap-2">
            {locations.map(loc => {
              const locAccounts = loc.bankAccounts ?? [];
              return (
                <button
                  key={loc.id}
                  onClick={() => setSelectedLocationId(loc.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    selectedLocationId === loc.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-card text-muted-foreground border-border hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <Building2 size={14} />
                  {loc.name}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    selectedLocationId === loc.id ? 'bg-white/20 text-white' : 'bg-accent text-muted-foreground'
                  }`}>
                    {locAccounts.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedLocation && (
        <motion.div key={selectedLocationId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="flex items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm"><Building2 size={18} className="text-blue-600" /></div>
              <div>
                <p className="font-bold text-sm text-blue-800">{selectedLocation.name}</p>
                <p className="text-xs text-blue-700">{selectedLocation.address}, {selectedLocation.city}, {selectedLocation.state}</p>
              </div>
            </div>
            <button
              onClick={() => onOpenBankModal(selectedLocationId)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
            >
              <Plus size={15} /> Add Bank Account
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-blue-100 rounded-xl"><Banknote size={22} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Accounts</p>
                <p className="font-bold text-lg mt-0.5">{accounts.length}</p>
                <p className="text-[10px] text-muted-foreground">{activeCount} active</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-emerald-100 rounded-xl"><CheckCircle2 size={22} className="text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Primary Account</p>
                <p className="font-bold text-sm mt-0.5 truncate max-w-[140px]">{primaryAccount?.bankName ?? 'Not set'}</p>
                <p className="text-[10px] text-muted-foreground">{primaryAccount?.accountType ?? '—'}</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-violet-100 rounded-xl"><Building size={22} className="text-violet-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Account Types</p>
                <p className="font-bold text-lg mt-0.5">{new Set(accounts.map(a => a.accountType)).size}</p>
                <p className="text-[10px] text-muted-foreground">Unique types</p>
              </div>
            </motion.div>
          </div>

          {accounts.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {accounts.map((acc, i) => (
                <motion.div
                  key={acc.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-card rounded-xl border-2 shadow-sm overflow-hidden transition-all ${acc.isPrimary ? 'border-primary' : 'border-border'}`}
                >
                  <div className={`h-1.5 w-full ${acc.isPrimary ? 'bg-primary' : 'bg-border'}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${acc.isPrimary ? 'bg-primary/10' : 'bg-accent'}`}>
                          <Banknote size={22} className={acc.isPrimary ? 'text-primary' : 'text-muted-foreground'} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm">{acc.bankName}</h3>
                            {acc.isPrimary && (
                              <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">Primary</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{acc.branchName}</p>
                        </div>
                      </div>
                      <StatusBadge status={acc.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-accent/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Account Name</p>
                        <p className="text-xs font-semibold truncate">{acc.accountName}</p>
                      </div>
                      <div className="bg-accent/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Account Type</p>
                        <p className="text-xs font-semibold">{acc.accountType}</p>
                      </div>
                      <div className="bg-accent/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Account Number</p>
                        <p className="text-xs font-mono font-semibold">
                          {'•'.repeat(Math.max(0, acc.accountNumber.length - 4))}{acc.accountNumber.slice(-4)}
                        </p>
                      </div>
                      <div className="bg-accent/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">IFSC Code</p>
                        <p className="text-xs font-mono font-semibold">{acc.ifscCode}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                      {!acc.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(acc.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary border border-primary/20 transition-colors"
                        >
                          <CheckCircle2 size={12} /> Set Primary
                        </button>
                      )}
                      <button
                        onClick={() => onOpenBankModal(selectedLocationId, acc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(acc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                      >
                        {acc.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(acc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Banknote size={28} className="text-blue-600" />
              </div>
              <p className="font-semibold text-muted-foreground">No bank accounts for {selectedLocation.name}</p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">Add a bank account for payroll processing at this location</p>
              <button
                onClick={() => onOpenBankModal(selectedLocationId)}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto"
              >
                <Plus size={15} /> Add Bank Account
              </button>
            </div>
          )}
        </motion.div>
      )}

      {locations.length === 0 && (
        <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
          <Banknote size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No work locations defined</p>
          <p className="text-xs text-muted-foreground mt-1">Add work locations first to configure bank accounts per location.</p>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Documents ───────────────────────────────────────────────────────────

interface DocumentsTabProps {
  documents: UploadedDoc[];
  onUpload: (files: FileList, category: string, description: string) => void;
  onRemove: (id: string) => void;
  onSign: (id: string, sig: SignatureData) => void;
}

// Establishment-wide document repository, backed by the private `documents`
// bucket + table. Files are stored securely, viewed via signed URLs, eSignable.
const DocumentsTab = (_props: DocumentsTabProps) => {
  const ENTITY_TYPE = 'establishment';
  const ENTITY_REF = 'establishment/repository';
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(DOCUMENT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [searchDoc, setSearchDoc] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stored, setStored] = useState<StoredDocument[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => { setStored(await listDocuments(ENTITY_TYPE, ENTITY_REF)); }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  // Map stored rows to the shape this view renders.
  const documents = stored.map(s => ({
    id: s.id,
    name: s.file_name,
    type: s.mime_type ?? '',
    size: s.size_bytes ?? 0,
    uploadedAt: formatDate(s.created_at),
    category: s.category ?? 'Other',
    description: '',
    signature: s.signature ?? undefined,
    stored: s,
  }));

  const doUpload = async (files: FileList, category: string) => {
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} exceeds 10 MB limit.`); continue; }
      const { error } = await uploadDocument(ENTITY_TYPE, ENTITY_REF, category, file);
      if (error) toast.error(`Upload failed for ${file.name}: ${error}`); else ok++;
    }
    setBusy(false);
    if (ok) { toast.success(`${ok} document(s) uploaded securely.`); void refresh(); }
  };

  const doRemove = async (doc: { stored: StoredDocument }) => {
    const err = await deleteDocument(doc.stored);
    if (err) { toast.error(err); return; }
    toast.info('Document removed.');
    void refresh();
  };

  const doSign = async (id: string, sig: SignatureData) => {
    const err = await signDocument(id, sig);
    if (err) { toast.error(err); return; }
    void refresh();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) void doUpload(e.dataTransfer.files, selectedCategory);
  };

  const filteredDocs = documents.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(searchDoc.toLowerCase());
    const matchCat = categoryFilter === 'All' || d.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const totalSize = documents.reduce((s, d) => s + d.size, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Document Management</h2>
          <p className="text-sm text-muted-foreground">Upload and manage all establishment-level documents in one place.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: documents.length, sub: formatFileSize(totalSize), color: 'bg-indigo-100', iconColor: 'text-indigo-600', icon: FileText },
          { label: 'Categories Used', value: new Set(documents.map(d => d.category)).size, sub: `of ${DOCUMENT_CATEGORIES.length} categories`, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: LayoutList },
          { label: 'Recent Uploads', value: documents.filter(d => d.uploadedAt === todayFormatted()).length, sub: 'Today', color: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: Upload },
          { label: 'PDF Files', value: documents.filter(d => d.type.includes('pdf')).length, sub: 'Portable documents', color: 'bg-rose-100', iconColor: 'text-rose-600', icon: FileCheck },
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

      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <SectionHeader icon={Upload} title="Upload Documents" subtitle="Drag & drop or click to upload establishment documents" accentColor="text-indigo-600" accentBg="bg-indigo-50" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Field label="Document Category" required>
            <select className={selectCls} value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              {DOCUMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Description" hint="Brief note about this document">
            <input type="text" className={inputCls} placeholder="e.g. Original certificate, FY 2024-25" value={description} onChange={e => setDescription(e.target.value)} />
          </Field>
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/40 hover:bg-accent/30'
          }`}
        >
          <div className="p-4 bg-indigo-100 rounded-2xl"><Upload size={28} className="text-indigo-600" /></div>
          <div className="text-center">
            <p className="font-semibold text-sm">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DOC, DOCX — max 5 MB per file</p>
          </div>
          <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
            onChange={e => { if (e.target.files) void doUpload(e.target.files, selectedCategory); e.target.value = ''; }} />
        </div>
      </div>

      {documents.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3 flex-wrap">
            <FileText size={16} className="text-primary" />
            <h3 className="font-bold text-sm">All Documents ({documents.length})</h3>
            <div className="ml-auto flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Search documents..." className="pl-8 pr-4 py-1.5 bg-accent/50 border border-border rounded-lg outline-none text-xs focus:ring-2 focus:ring-primary/20 transition-all w-48" value={searchDoc} onChange={e => setSearchDoc(e.target.value)} />
              </div>
              <select className="px-3 py-1.5 border border-border rounded-lg bg-card outline-none text-xs appearance-none" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="All">All Categories</option>
                {DOCUMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {filteredDocs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Size</th>
                    <th className="px-4 py-3 font-semibold">Uploaded</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDocs.map((doc, i) => (
                    <motion.tr key={doc.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getFileIcon(doc.type)}</span>
                          <span className="text-sm font-medium truncate max-w-[200px]">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">{doc.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatFileSize(doc.size)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{doc.uploadedAt}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <DocumentSignControl
                            doc={{ id: doc.id, name: doc.name, category: doc.category }}
                            signerName="Authorised Signatory"
                            signerId="—"
                            signature={doc.signature}
                            source="establishment"
                            onSigned={(sig) => void doSign(doc.id, sig)}
                          />
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => void openDocument(doc.stored)} className="flex items-center gap-1 text-xs text-primary hover:underline"><Eye size={12} /> View</button>
                            <button onClick={() => void doRemove(doc)} className="flex items-center gap-1 text-xs text-destructive hover:underline"><Trash2 size={12} /> Remove</button>
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No documents match your search or filter.</div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EstablishmentMaster() {
  const [activeTab, setActiveTab] = useState<EstablishmentTab>('basic');
  const [saved, setSaved] = useState(false);

  // Stored in and retrieved from Supabase only — no hardcoded organisation data.
  const [estData, setEstData] = useState<EstablishmentData>({
    name: '', shortName: '', incorporationDate: '', industryType: '', entityType: '',
    website: '', email: '', phone: '', currency: 'INR',
    addressLine1: '', addressLine2: '', city: '', district: '', state: '', pincode: '', country: 'India',
    logoDataUrl: '', occupier: emptyPerson(), manager: emptyPerson(),
    employeeIdPattern: defaultEmpIdPattern(),
    netRoundoff: 'nearest_100',
    emailEnabled: false, emailProvider: 'smtp', emailHost: '', emailPort: '', emailSecure: true, emailUsername: '', emailPassword: '', emailFromName: '', emailFromAddress: '', emailReplyTo: '',
  });
  const [estRowId, setEstRowId] = useState<string | null>(null);

  const [allDocuments, setAllDocuments] = useState<UploadedDoc[]>([]);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const sb = supabase as unknown as { from: (t: string) => any };

  // Load establishment identity, work locations and departments from the DB.
  const reloadLocations = useCallback(async () => {
    const [locRes, bankRes, lhRes] = await Promise.all([
      sb.from('work_locations').select('*').order('created_at', { ascending: true }),
      sb.from('location_bank_accounts').select('*'),
      sb.from('letterheads').select('*'),
    ]);
    if (locRes.error) { toast.error(locRes.error.message); return; }
    const banks: DbRow[] = bankRes.data ?? [];
    const lhByLoc = new Map<string, DbRow>((lhRes.data ?? []).map((r: DbRow) => [r.location_id as string, r]));
    setLocations((locRes.data ?? []).map((r: DbRow) => rowToEstLocation(r, banks, lhByLoc.get(r.id))));
  }, []);

  const reloadDepartments = useCallback(async () => {
    const { data, error } = await sb.from('departments').select('*').order('created_at', { ascending: true });
    if (error) { toast.error(error.message); return; }
    setDepartments((data ?? []).map((r: DbRow) => rowToDept(r)));
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await sb.from('establishment').select('*').limit(1).maybeSingle();
      if (data) { setEstData(rowToEstData(data)); setEstRowId(data.id); }
    })();
    void reloadLocations();
    void reloadDepartments();
  }, [reloadLocations, reloadDepartments]);

  // Debounced persistence of a location's nested edits (statutory / bank / letterhead).
  const locTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const persistLocation = useCallback(async (loc: WorkLocation) => {
    const e1 = (await sb.from('work_locations').update(estLocationToRow(loc)).eq('id', loc.id)).error;
    if (e1) { toast.error(e1.message); return; }
    await sb.from('location_bank_accounts').delete().eq('location_id', loc.id);
    if (loc.bankAccounts.length) await sb.from('location_bank_accounts').insert(loc.bankAccounts.map(b => bankToRow(b, loc.id)));
    await sb.from('letterheads').delete().eq('location_id', loc.id);
    await sb.from('letterheads').insert(letterheadToRow(loc.letterhead, loc.id));
  }, []);
  const scheduleLocationPersist = (loc: WorkLocation) => {
    if (locTimers.current[loc.id]) clearTimeout(locTimers.current[loc.id]);
    locTimers.current[loc.id] = setTimeout(() => { void persistLocation(loc); }, 700);
  };

  // Location modal state
  const [locationModal, setLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WorkLocation | null>(null);
  const [locationForm, setLocationForm] = useState<Omit<WorkLocation, 'id' | 'employeeCount' | 'statutory' | 'bankAccounts' | 'letterhead'>>({
    name: '', code: '', address: '', city: '', state: '', country: 'India', phone: '', email: '', status: 'Active'
  });

  // Department modal state
  const [deptModal, setDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState<Omit<Department, 'id' | 'employeeCount' | 'children'>>({
    name: '', code: '', parentId: null, locationId: '', headName: '', status: 'Active'
  });

  // Bank modal state
  const [bankModal, setBankModal] = useState(false);
  const [bankModalLocationId, setBankModalLocationId] = useState<string>('');
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [bankForm, setBankForm] = useState<Omit<BankAccount, 'id' | 'createdAt'>>({
    bankName: '', accountName: '', accountNumber: '', ifscCode: '', branchName: '',
    branchAddress: '', accountType: 'Current', isPrimary: false, swiftCode: '', micrCode: '', status: 'Active',
  });

  const onChange = (key: keyof EstablishmentData, value: any) => {
    setEstData(d => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const handleUpdateStatutory = (locationId: string, statutory: LocationStatutory) => {
    setLocations(prev => prev.map(l => {
      if (l.id !== locationId) return l;
      const updated = { ...l, statutory };
      scheduleLocationPersist(updated);
      return updated;
    }));
    setSaved(false);
  };

  const handleUpdateBankAccounts = (locationId: string, accounts: BankAccount[]) => {
    setLocations(prev => prev.map(l => {
      if (l.id !== locationId) return l;
      const updated = { ...l, bankAccounts: accounts };
      scheduleLocationPersist(updated);
      return updated;
    }));
    setSaved(false);
  };

  const handleUpdateLetterhead = (locationId: string, letterhead: LocationLetterhead) => {
    setLocations(prev => prev.map(l => {
      if (l.id !== locationId) return l;
      const updated = { ...l, letterhead };
      scheduleLocationPersist(updated);
      return updated;
    }));
    setSaved(false);
  };

  const handleOpenBankModal = (locationId: string, account?: BankAccount) => {
    setBankModalLocationId(locationId);
    if (account) {
      setEditingBank(account);
      setBankForm({
        bankName: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber,
        ifscCode: account.ifscCode, branchName: account.branchName, branchAddress: account.branchAddress,
        accountType: account.accountType, isPrimary: account.isPrimary, swiftCode: account.swiftCode,
        micrCode: account.micrCode, status: account.status,
      });
    } else {
      setEditingBank(null);
      const loc = locations.find(l => l.id === locationId);
      setBankForm({
        bankName: '', accountName: estData.name, accountNumber: '', ifscCode: '', branchName: '',
        branchAddress: '', accountType: 'Current', isPrimary: (loc?.bankAccounts ?? []).length === 0,
        swiftCode: '', micrCode: '', status: 'Active',
      });
    }
    setBankModal(true);
  };

  const saveBank = () => {
    if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.ifscCode) {
      toast.error('Bank Name, Account Number, and IFSC Code are required.'); return;
    }
    const loc = locations.find(l => l.id === bankModalLocationId);
    if (!loc) return;
    const accounts = loc.bankAccounts ?? [];

    if (editingBank) {
      const updated = accounts.map(a => a.id === editingBank.id ? { ...a, ...bankForm } : a);
      handleUpdateBankAccounts(bankModalLocationId, updated);
      toast.success('Bank account updated.');
    } else {
      const newAcc: BankAccount = {
        ...bankForm,
        id: `BNK${Date.now()}`,
        createdAt: todayFormatted(),
      };
      if (bankForm.isPrimary) {
        handleUpdateBankAccounts(bankModalLocationId, [...accounts.map(a => ({ ...a, isPrimary: false })), newAcc]);
      } else {
        handleUpdateBankAccounts(bankModalLocationId, [...accounts, newAcc]);
      }
      toast.success('Bank account added.');
    }
    setBankModal(false);
  };

  const handleDocumentUpload = (files: FileList, category: string, description: string) => {
    const newDocs: UploadedDoc[] = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB limit.`); processed++; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({
          id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name, size: file.size, type: file.type,
          uploadedAt: todayFormatted(),
          dataUrl: e.target?.result as string,
          category, description,
        });
        processed++;
        if (processed === files.length) {
          setAllDocuments(prev => [...prev, ...newDocs]);
          if (newDocs.length > 0) toast.success(`${newDocs.length} document(s) uploaded.`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveDocument = (id: string) => {
    setAllDocuments(prev => prev.filter(d => d.id !== id));
    toast.info('Document removed.');
  };

  const handleSignDocument = (id: string, sig: SignatureData) => {
    setAllDocuments(prev => prev.map(d => d.id === id ? { ...d, signature: sig } : d));
  };

  const handleSave = async () => {
    if (!estData.name) { toast.error('Establishment Name is required.'); setActiveTab('basic'); return; }
    const row = estDataToRow(estData);
    if (estRowId) {
      const err = (await sb.from('establishment').update(row).eq('id', estRowId)).error;
      if (err) { toast.error(err.message); return; }
    } else {
      const { data, error } = await sb.from('establishment').insert(row).select('id').single();
      if (error) { toast.error(error.message); return; }
      setEstRowId(data.id);
    }
    setSaved(true);
    toast.success('Establishment details saved successfully!');
  };

  // Location CRUD
  const openAddLocation = () => {
    setEditingLocation(null);
    setLocationForm({ name: '', code: '', address: '', city: '', state: '', country: 'India', phone: '', email: '', status: 'Active' });
    setLocationModal(true);
  };

  const openEditLocation = (loc: WorkLocation) => {
    setEditingLocation(loc);
    setLocationForm({ name: loc.name, code: loc.code, address: loc.address, city: loc.city, state: loc.state, country: loc.country, phone: loc.phone, email: loc.email, status: loc.status });
    setLocationModal(true);
  };

  const saveLocation = async () => {
    if (!locationForm.name || !locationForm.code) { toast.error('Name and Code are required.'); return; }
    const core = {
      name: locationForm.name.trim(), code: locationForm.code.trim(), address: locationForm.address || null,
      city: locationForm.city || null, state: locationForm.state || null, country: locationForm.country || null,
      phone: locationForm.phone || null, email: locationForm.email || null, status: locationForm.status,
    };
    if (editingLocation) {
      const err = (await sb.from('work_locations').update(core).eq('id', editingLocation.id)).error;
      if (err) { toast.error(err.message); return; }
      toast.success('Work location updated.');
    } else {
      const { data, error } = await sb.from('work_locations').insert(core).select('id').single();
      if (error) { toast.error(error.message); return; }
      const lh = emptyLetterhead(locationForm.name, `${locationForm.address}, ${locationForm.city}, ${locationForm.state}`, locationForm.phone, locationForm.email, estData.website);
      await sb.from('letterheads').insert(letterheadToRow(lh, data.id));
      toast.success('Work location added.');
    }
    await reloadLocations();
    setLocationModal(false);
  };

  const deleteLocation = async (id: string) => {
    const hasDepts = departments.some(d => d.locationId === id);
    if (hasDepts) { toast.error('Cannot delete: departments are assigned to this location.'); return; }
    await sb.from('location_bank_accounts').delete().eq('location_id', id);
    await sb.from('letterheads').delete().eq('location_id', id);
    const err = (await sb.from('work_locations').delete().eq('id', id)).error;
    if (err) { toast.error(err.message); return; }
    await reloadLocations();
    toast.info('Work location removed.');
  };

  // Department CRUD
  const openAddDept = (locationId?: string) => {
    setEditingDept(null);
    setDeptForm({ name: '', code: '', parentId: null, locationId: locationId ?? locations[0]?.id ?? '', headName: '', status: 'Active' });
    setDeptModal(true);
  };

  const openEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({ name: dept.name, code: dept.code, parentId: dept.parentId, locationId: dept.locationId, headName: dept.headName, status: dept.status });
    setDeptModal(true);
  };

  const saveDept = async () => {
    if (!deptForm.name || !deptForm.code || !deptForm.locationId) { toast.error('Name, Code, and Location are required.'); return; }
    const err = editingDept
      ? (await sb.from('departments').update(deptToRow(deptForm)).eq('id', editingDept.id)).error
      : (await sb.from('departments').insert(deptToRow(deptForm))).error;
    if (err) { toast.error(err.message); return; }
    await reloadDepartments();
    toast.success(editingDept ? 'Department updated.' : 'Department added.');
    setDeptModal(false);
  };

  const deleteDept = async (id: string) => {
    const tree = buildTree(departments, id);
    const childIds = flattenTree(tree);
    if (childIds.length > 0) { toast.error('Cannot delete: sub-departments exist. Remove them first.'); return; }
    const err = (await sb.from('departments').delete().eq('id', id)).error;
    if (err) { toast.error(err.message); return; }
    await reloadDepartments();
    toast.info('Department removed.');
  };

  const tabs: { key: EstablishmentTab; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'basic', label: 'Basic Information', icon: Building2, color: 'text-blue-600' },
    { key: 'locations', label: 'Work Locations', icon: MapPin, color: 'text-emerald-600' },
    { key: 'departments', label: 'Departments', icon: FolderTree, color: 'text-violet-600' },
    { key: 'statutory', label: 'Statutory & Compliance', icon: Shield, color: 'text-rose-600' },
    { key: 'bank', label: 'Bank Details', icon: Banknote, color: 'text-blue-600' },
    { key: 'documents', label: 'Documents', icon: FileText, color: 'text-indigo-600' },
    { key: 'letterhead', label: 'Letterhead', icon: Layout, color: 'text-purple-600' },
  ];

  const getTabCompletion = (tab: EstablishmentTab): number => {
    if (tab === 'basic') {
      const fields = [estData.name, estData.entityType, estData.email, estData.addressLine1, estData.city, estData.state, estData.pincode];
      return Math.round((fields.filter(Boolean).length / fields.length) * 100);
    }
    if (tab === 'locations') return locations.length > 0 ? 100 : 0;
    if (tab === 'departments') return departments.length > 0 ? 100 : 0;
    if (tab === 'statutory') {
      const totalFields = locations.length * STATUTORY_FIELDS.length;
      if (totalFields === 0) return 0;
      const filled = locations.reduce((s, loc) => s + STATUTORY_FIELDS.filter(f => loc.statutory[f.key as keyof LocationStatutory]?.toString().trim()).length, 0);
      return Math.round((filled / totalFields) * 100);
    }
    if (tab === 'bank') return locations.some(l => (l.bankAccounts ?? []).length > 0) ? 100 : 0;
    if (tab === 'documents') return allDocuments.length > 0 ? 100 : 0;
    if (tab === 'letterhead') return locations.some(l => l.letterhead.isActive) ? 100 : 0;
    return 0;
  };

  const overallCompletion = Math.round(
    (getTabCompletion('basic') + getTabCompletion('locations') + getTabCompletion('departments') +
     getTabCompletion('statutory') + getTabCompletion('bank') + getTabCompletion('documents') + getTabCompletion('letterhead')) / 7
  );

  const totalStatutoryFilled = locations.reduce((s, loc) => s + STATUTORY_FIELDS.filter(f => loc.statutory[f.key as keyof LocationStatutory]?.toString().trim()).length, 0);
  const totalStatutoryFields = locations.length * STATUTORY_FIELDS.length;
  const totalBankAccounts = locations.reduce((s, loc) => s + (loc.bankAccounts ?? []).length, 0);
  const activeLetterheads = locations.filter(l => l.letterhead.isActive).length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">

        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {estData.logoDataUrl ? (
                <div className="w-10 h-10 rounded-xl border border-border bg-white flex items-center justify-center overflow-hidden shadow-sm">
                  <img src={estData.logoDataUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                </div>
              ) : (
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Landmark size={22} className="text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">Establishment Master</h1>
                <p className="text-xs text-muted-foreground">Configure your organisation's legal identity, locations, departments and compliance details.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-lg">
                <div className="w-24 h-1.5 bg-accent rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${overallCompletion >= 80 ? 'bg-green-500' : overallCompletion >= 50 ? 'bg-amber-500' : 'bg-primary'}`}
                    style={{ width: `${overallCompletion}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{overallCompletion}% complete</span>
              </div>
              {saved && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium">
                  <CheckCircle2 size={14} /> Saved
                </motion.div>
              )}
              <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md font-medium text-sm">
                <Save size={16} /> Save Changes
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
                  {tab.key === 'locations' && locations.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground'}`}>
                      {locations.length}
                    </span>
                  )}
                  {tab.key === 'departments' && departments.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground'}`}>
                      {departments.length}
                    </span>
                  )}
                  {tab.key === 'statutory' && totalStatutoryFields > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground'}`}>
                      {totalStatutoryFilled}/{totalStatutoryFields}
                    </span>
                  )}
                  {tab.key === 'bank' && totalBankAccounts > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground'}`}>
                      {totalBankAccounts}
                    </span>
                  )}
                  {tab.key === 'documents' && allDocuments.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground'}`}>
                      {allDocuments.length}
                    </span>
                  )}
                  {tab.key === 'letterhead' && activeLetterheads > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-purple-100 text-purple-700'}`}>
                      {activeLetterheads} active
                    </span>
                  )}
                  {tab.key === 'basic' && (
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                {estData.logoDataUrl ? (
                  <img src={estData.logoDataUrl} alt="Logo" className="w-5 h-5 object-contain" />
                ) : (
                  <Landmark size={18} className="text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Organisation</p>
                <p className="font-bold text-xs mt-0.5 truncate">{estData.name || '—'}</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl"><MapPin size={18} className="text-emerald-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Locations</p>
                <p className="font-bold text-sm mt-0.5">{locations.filter(l => l.status === 'Active').length} active</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-xl"><FolderTree size={18} className="text-violet-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Departments</p>
                <p className="font-bold text-sm mt-0.5">{departments.filter(d => d.status === 'Active').length} active</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-xl"><Shield size={18} className="text-rose-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Statutory</p>
                <p className="font-bold text-sm mt-0.5">{totalStatutoryFilled}/{totalStatutoryFields}</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl"><Banknote size={18} className="text-blue-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Bank Accounts</p>
                <p className="font-bold text-sm mt-0.5">{totalBankAccounts} total</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl"><FileText size={18} className="text-indigo-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Documents</p>
                <p className="font-bold text-sm mt-0.5">{allDocuments.length} files</p>
              </div>
            </motion.div>
            <motion.div
              whileHover={{ y: -3 }}
              onClick={() => setActiveTab('letterhead')}
              className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3 cursor-pointer hover:border-purple-300 transition-all"
            >
              <div className="p-2 bg-purple-100 rounded-xl"><Layout size={18} className="text-purple-600" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Letterheads</p>
                <p className="font-bold text-sm mt-0.5">{activeLetterheads} active</p>
              </div>
            </motion.div>
          </div>
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
              {activeTab === 'basic' && <BasicTab data={estData} onChange={onChange} />}
              {activeTab === 'locations' && (
                <LocationsTab
                  locations={locations}
                  departments={departments}
                  onAdd={openAddLocation}
                  onEdit={openEditLocation}
                  onDelete={deleteLocation}
                  onAddDept={openAddDept}
                  onEditDept={openEditDept}
                  onDeleteDept={deleteDept}
                />
              )}
              {activeTab === 'departments' && (
                <DepartmentsTab
                  departments={departments}
                  locations={locations}
                  headerExtra={
                    <BulkImport
                      title="Department"
                      columns={[
                        { header: 'Name', required: true, example: 'Frontend Engineering' },
                        { header: 'Code', required: true, example: 'ENG-FE', hint: 'Unique department code' },
                        { header: 'Location Code', required: true, example: locations[0]?.code ?? 'HO', hint: 'Must match a Work Location code' },
                        { header: 'Head Name', example: '' },
                        { header: 'Parent Department Code', example: '', hint: 'Optional — code of the parent department' },
                        { header: 'Status', example: 'Active', hint: 'Active or Inactive' },
                      ]}
                      toRecord={(cells) => {
                        const code = (cells['Code'] || '').trim();
                        if (departments.some(d => d.code.toLowerCase() === code.toLowerCase())) return { error: `Code "${code}" already exists` };
                        const loc = locations.find(l => l.code.toLowerCase() === (cells['Location Code'] || '').trim().toLowerCase());
                        if (!loc) return { error: `Unknown Location Code "${cells['Location Code']}"` };
                        const parentCode = (cells['Parent Department Code'] || '').trim();
                        const parent = parentCode ? departments.find(d => d.code.toLowerCase() === parentCode.toLowerCase()) : undefined;
                        if (parentCode && !parent) return { error: `Unknown Parent Department Code "${parentCode}"` };
                        const status = /inactive/i.test(cells['Status'] || '') ? 'Inactive' : 'Active';
                        return deptToRow({ name: cells['Name'].trim(), code, locationId: loc.id, parentId: parent?.id ?? null, headName: cells['Head Name'] || '', status });
                      }}
                      insertRecord={async (record) => (await sb.from('departments').insert(record)).error?.message ?? null}
                      onDone={reloadDepartments}
                    />
                  }
                  onAdd={() => openAddDept()}
                  onEdit={openEditDept}
                  onDelete={deleteDept}
                />
              )}
              {activeTab === 'statutory' && (
                <StatutoryTab
                  locations={locations}
                  onUpdateStatutory={handleUpdateStatutory}
                />
              )}
              {activeTab === 'bank' && (
                <BankTab
                  locations={locations}
                  onUpdateBankAccounts={handleUpdateBankAccounts}
                  onOpenBankModal={handleOpenBankModal}
                />
              )}
              {activeTab === 'documents' && (
                <DocumentsTab
                  documents={allDocuments}
                  onUpload={handleDocumentUpload}
                  onRemove={handleRemoveDocument}
                  onSign={handleSignDocument}
                />
              )}
              {activeTab === 'letterhead' && (
                <LetterheadTab
                  locations={locations}
                  estData={estData}
                  onUpdateLetterhead={handleUpdateLetterhead}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={() => {
                const idx = tabs.findIndex(t => t.key === activeTab);
                if (idx > 0) setActiveTab(tabs[idx - 1].key);
              }}
              disabled={activeTab === 'basic'}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              {activeTab !== 'basic' ? `Previous: ${tabs[tabs.findIndex(t => t.key === activeTab) - 1]?.label}` : 'Previous'}
            </button>

            <div className="flex items-center gap-3">
              {activeTab !== 'letterhead' ? (
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
                <button onClick={handleSave} className="flex items-center gap-2 px-8 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md font-medium text-sm">
                  <Save size={16} /> Save All Changes
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Location Modal */}
      <AnimatePresence>
        {locationModal && (
          <Modal title={editingLocation ? 'Edit Work Location' : 'Add Work Location'} onClose={() => setLocationModal(false)}>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Location Name" required>
                    <input type="text" className={inputCls} placeholder="e.g. Head Office – Mumbai" value={locationForm.name} onChange={e => setLocationForm(f => ({ ...f, name: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Location Code" required>
                  <div className="relative">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" className={`${inputCls} pl-8 font-mono`} placeholder="HO-MUM" value={locationForm.code} onChange={e => setLocationForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                  </div>
                </Field>
                <Field label="Status">
                  <select className={selectCls} value={locationForm.status} onChange={e => setLocationForm(f => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </Field>
                <div className="col-span-2">
                  <Field label="Address">
                    <input type="text" className={inputCls} placeholder="Street address" value={locationForm.address} onChange={e => setLocationForm(f => ({ ...f, address: e.target.value }))} />
                  </Field>
                </div>
                <Field label="City">
                  <input type="text" className={inputCls} placeholder="City" value={locationForm.city} onChange={e => setLocationForm(f => ({ ...f, city: e.target.value }))} />
                </Field>
                <Field label="State">
                  <select className={selectCls} value={locationForm.state} onChange={e => setLocationForm(f => ({ ...f, state: e.target.value }))}>
                    <option value="">— Select State —</option>
                    {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Country">
                  <input type="text" className={inputCls} placeholder="Country" value={locationForm.country} onChange={e => setLocationForm(f => ({ ...f, country: e.target.value }))} />
                </Field>
                <Field label="Phone">
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" className={`${inputCls} pl-8`} placeholder="+91 22 4000 1000" value={locationForm.phone} onChange={e => setLocationForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </Field>
                <div className="col-span-2">
                  <Field label="Email">
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="email" className={`${inputCls} pl-8`} placeholder="location@company.com" value={locationForm.email} onChange={e => setLocationForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </Field>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
              <button onClick={() => setLocationModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveLocation} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
                {editingLocation ? 'Save Changes' : 'Add Location'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Department Modal */}
      <AnimatePresence>
        {deptModal && (
          <Modal title={editingDept ? 'Edit Department' : 'Add Department'} onClose={() => setDeptModal(false)}>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Department Name" required>
                    <input type="text" className={inputCls} placeholder="e.g. Frontend Engineering" value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Department Code" required>
                  <div className="relative">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" className={`${inputCls} pl-8 font-mono`} placeholder="ENG-FE" value={deptForm.code} onChange={e => setDeptForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                  </div>
                </Field>
                <Field label="Status">
                  <select className={selectCls} value={deptForm.status} onChange={e => setDeptForm(f => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </Field>
                <div className="col-span-2">
                  <Field label="Work Location" required>
                    <select className={selectCls} value={deptForm.locationId} onChange={e => setDeptForm(f => ({ ...f, locationId: e.target.value }))}>
                      <option value="">— Select Location —</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Parent Department" hint="Leave blank to create a top-level department.">
                    <select className={selectCls} value={deptForm.parentId ?? ''} onChange={e => setDeptForm(f => ({ ...f, parentId: e.target.value || null }))}>
                      <option value="">— None (Root Department) —</option>
                      {departments.filter(d => editingDept ? d.id !== editingDept.id : true).map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                    </select>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Department Head">
                    <div className="relative">
                      <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="text" className={`${inputCls} pl-8`} placeholder="Full name of department head" value={deptForm.headName} onChange={e => setDeptForm(f => ({ ...f, headName: e.target.value }))} />
                    </div>
                  </Field>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
              <button onClick={() => setDeptModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveDept} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
                {editingDept ? 'Save Changes' : 'Add Department'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Bank Account Modal */}
      <AnimatePresence>
        {bankModal && (
          <Modal title={editingBank ? 'Edit Bank Account' : 'Add Bank Account'} onClose={() => setBankModal(false)} wide>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {bankModalLocationId && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <Building2 size={13} className="shrink-0" />
                  <span>Adding bank account for: <strong>{locations.find(l => l.id === bankModalLocationId)?.name}</strong></span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bank Name" required>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" className={`${inputCls} pl-8`} placeholder="e.g. HDFC Bank" value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} />
                  </div>
                </Field>
                <Field label="Account Type" required>
                  <select className={selectCls} value={bankForm.accountType} onChange={e => setBankForm(f => ({ ...f, accountType: e.target.value as BankAccount['accountType'] }))}>
                    <option>Current</option>
                    <option>Savings</option>
                    <option>Overdraft</option>
                    <option>Cash Credit</option>
                  </select>
                </Field>
                <div className="col-span-2">
                  <Field label="Account Name" required hint="Name as registered with the bank">
                    <input type="text" className={inputCls} placeholder="Company name as per bank records" value={bankForm.accountName} onChange={e => setBankForm(f => ({ ...f, accountName: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Account Number" required>
                  <div className="relative">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" className={`${inputCls} pl-8 font-mono`} placeholder="e.g. 50200012345678" value={bankForm.accountNumber} onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))} />
                  </div>
                </Field>
                <Field label="IFSC Code" required>
                  <div className="relative">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" className={`${inputCls} pl-8 font-mono uppercase`} placeholder="e.g. HDFC0001234" maxLength={11} value={bankForm.ifscCode} onChange={e => setBankForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))} />
                  </div>
                </Field>
                <Field label="Branch Name" required>
                  <input type="text" className={inputCls} placeholder="e.g. BKC Branch" value={bankForm.branchName} onChange={e => setBankForm(f => ({ ...f, branchName: e.target.value }))} />
                </Field>
                <Field label="SWIFT Code" hint="For international transactions">
                  <input type="text" className={`${inputCls} font-mono uppercase`} placeholder="e.g. HDFCINBB" value={bankForm.swiftCode} onChange={e => setBankForm(f => ({ ...f, swiftCode: e.target.value.toUpperCase() }))} />
                </Field>
                <Field label="MICR Code" hint="9-digit MICR code">
                  <input type="text" className={`${inputCls} font-mono`} placeholder="e.g. 400240001" maxLength={9} value={bankForm.micrCode} onChange={e => setBankForm(f => ({ ...f, micrCode: e.target.value.replace(/\D/g, '') }))} />
                </Field>
                <div className="col-span-2">
                  <Field label="Branch Address">
                    <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Full branch address" value={bankForm.branchAddress} onChange={e => setBankForm(f => ({ ...f, branchAddress: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Status">
                  <select className={selectCls} value={bankForm.status} onChange={e => setBankForm(f => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </Field>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setBankForm(f => ({ ...f, isPrimary: !f.isPrimary }))}
                      className={`w-10 h-5 rounded-full transition-colors relative ${bankForm.isPrimary ? 'bg-primary' : 'bg-border'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${bankForm.isPrimary ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <div>
                      <span className="text-sm font-medium">Set as Primary Account</span>
                      <p className="text-[10px] text-muted-foreground">Used for payroll disbursement at this location</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
              <button onClick={() => setBankModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveBank} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
                {editingBank ? 'Save Changes' : 'Add Bank Account'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}