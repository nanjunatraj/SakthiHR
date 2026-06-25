import DateInput from '../components/DateInput';
import { formatDate, todayFormatted } from '../utils/date';
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase/client';
import { uploadLetterheadImage } from '../lib/storage';
import SecureDocUploadZone from '../components/SecureDocUploadZone';
import type { SignatureData } from '../components/AadhaarOTPSigning';
import {
  Building2, MapPin, Plus, Pencil, Trash2, X, Search, Globe,
  Phone, Mail, Hash, Users, CheckCircle2, AlertCircle, Save,
  ChevronLeft, Shield, CreditCard, Receipt, Briefcase, FileText,
  BadgeCheck, Upload, Eye, Paperclip, Banknote, Building, Info,
  Layout, AlignLeft, AlignCenter, AlignRight, FileImage, Printer,
  Download, Copy, Trash, Camera, Image, Layers, ToggleLeft,
  Calendar, DollarSign, Star, ChevronDown, ChevronRight, Filter,
  LayoutList, FileCheck, ExternalLink, Home, IdCard, Factory,
  Navigation, Tag, User, Wrench, ClipboardList, CalendarDays,
  UserCheck, CalendarRange
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { toast } from 'react-toastify';

// ─── Types ────────────────────────────────────────────────────────────────────

type LocationTab = 'details' | 'statutory' | 'bank' | 'letterhead';

interface FactoryPersonDetails {
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
  documents: DocumentStore;
}

interface FactoryDetails {
  isFactory: boolean;
  registrationDate: string;
  validityFrom: string;
  validityTo: string;
  commencementOfWorkDate: string;
  maxWorkersPerDay: number;
  factoryLicenseLimit: number;
  factoryGpsLatitude: string;
  factoryGpsLongitude: string;
  nicCode: string;
  fullPostalAddress: string;
  factoryDocuments: DocumentStore;
  factoryManager: FactoryPersonDetails;
  factoryOccupier: FactoryPersonDetails;
}

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
  holidayListId: string;
  holidayListName: string;
  statutory: LocationStatutory;
  bankAccounts: BankAccount[];
  letterhead: LocationLetterhead;
  factory: FactoryDetails;
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

type TextAlignment = 'left' | 'center' | 'right';
type FontSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';

interface LetterheadSection {
  enabled: boolean;
  logoDataUrl: string;
  logoPosition: 'left' | 'center' | 'right';
  logoSize: 'sm' | 'md' | 'lg';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
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
  xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl',
};

const ALIGN_MAP: Record<TextAlignment, string> = {
  left: 'text-left', center: 'text-center', right: 'text-right',
};

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

// ─── Holiday Lists (sourced from Holiday List Master) ─────────────────────────
// These entries mirror the holiday lists defined in HolidayListMaster.tsx.
// The first entry represents "not assigned" (empty id).

const CURRENT_YEAR = new Date().getFullYear();

const AVAILABLE_HOLIDAY_LISTS: { id: string; name: string; year: number; status: string }[] = [
  { id: '', name: '— Not Assigned —', year: 0, status: '' },
  { id: 'HL001', name: `Holiday List ${CURRENT_YEAR}`, year: CURRENT_YEAR, status: 'Active' },
  { id: 'HL002', name: `Holiday List ${CURRENT_YEAR} (India)`, year: CURRENT_YEAR, status: 'Active' },
  { id: 'HL003', name: `Holiday List ${CURRENT_YEAR - 1}`, year: CURRENT_YEAR - 1, status: 'Archived' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyStatutory = (): LocationStatutory => ({
  linNo: '', epfCodeNo: '', esiCodeNo: '', panNo: '', gstCode: '', tanNo: '', cinNo: '', ptNo: '',
  documents: {},
});

const emptyFactoryPerson = (): FactoryPersonDetails => ({
  name: '', designation: '', phone: '', email: '',
  addressLine1: '', addressLine2: '', city: '', district: '', state: '', pincode: '',
  documents: {},
});

const emptyFactory = (): FactoryDetails => ({
  isFactory: false,
  registrationDate: '',
  validityFrom: '',
  validityTo: '',
  commencementOfWorkDate: '',
  maxWorkersPerDay: 0,
  factoryLicenseLimit: 0,
  factoryGpsLatitude: '',
  factoryGpsLongitude: '',
  nicCode: '',
  fullPostalAddress: '',
  factoryDocuments: {},
  factoryManager: emptyFactoryPerson(),
  factoryOccupier: emptyFactoryPerson(),
});

const emptyLetterhead = (locationName: string, address: string, phone: string, email: string): LocationLetterhead => ({
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
    websiteLine: '',
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
    payslip: true, offerLetter: true, memo: true, transferLetter: true,
    experienceLetter: true, relievingLetter: true, appointmentLetter: true, warningLetter: true,
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
      entityType="work_location"
      entityRef={entityRef ?? `work_location/${fieldKey}`}
      label={label}
      signerName="Authorised Signatory"
      signerId="—"
    />
  </div>
);

// ─── Image Upload Zone ────────────────────────────────────────────────────────

interface ImageUploadZoneProps {
  label: string;
  hint: string;
  dataUrl: string;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
}

const ImageUploadZone = ({ label, hint, dataUrl, onUpload, onRemove }: ImageUploadZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Uploads to the public `letterhead-assets` Storage bucket; stores the public URL.
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
              <button onClick={() => inputRef.current?.click()} className="px-3 py-1.5 bg-white text-gray-800 text-xs font-semibold rounded-lg shadow-md hover:bg-gray-100 transition-colors">Replace</button>
              <button onClick={onRemove} className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors">Remove</button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">Hover over image to replace or remove</p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
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
      <div className="p-2.5 bg-purple-100 rounded-xl shrink-0"><FileImage size={18} className="text-purple-600" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <Upload size={16} className="text-muted-foreground shrink-0" />
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
    </div>
  );
};

// ─── Letterhead Preview ───────────────────────────────────────────────────────

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

  return (
    <div className="bg-white rounded-xl border-2 border-border shadow-lg overflow-hidden" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-border">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Live Preview — {letterhead.paperSize}</span>
        <span className="text-[10px] text-muted-foreground">Margins: {letterhead.marginTop}mm top · {letterhead.marginBottom}mm bottom</span>
      </div>
      {header.enabled && (
        <div style={{ backgroundColor: header.backgroundColor, padding: '16px 24px 12px' }}>
          {header.useCustomHtml ? (
            <div className="text-xs text-muted-foreground italic text-center py-4 border-2 border-dashed border-border rounded-lg">Custom HTML Header — renders in actual document</div>
          ) : (
            <>
              {header.headerImageDataUrl && (
                <div style={{ margin: '-16px -24px 12px', overflow: 'hidden' }}>
                  <img src={header.headerImageDataUrl} alt="Header Banner" style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain' }} />
                </div>
              )}
              {header.logoDataUrl && (
                <div className={`flex ${logoAlignMap[header.logoPosition]} mb-2`}>
                  <img src={header.logoDataUrl} alt="Logo" className={`${logoSizeMap[header.logoSize]} object-contain`} />
                </div>
              )}
              {header.companyName && (
                <p className={`font-bold ${FONT_SIZE_MAP[header.companyNameSize]} ${ALIGN_MAP[header.companyNameAlignment]}`} style={{ color: header.companyNameColor }}>{header.companyName}</p>
              )}
              {header.tagline && <p className={`text-xs mt-0.5 ${ALIGN_MAP[header.taglineAlignment]}`} style={{ color: header.taglineColor }}>{header.tagline}</p>}
              {header.addressLine && <p className={`text-xs mt-1 ${ALIGN_MAP[header.addressAlignment]}`} style={{ color: '#6b7280' }}>{header.addressLine}</p>}
              {header.contactLine && <p className={`text-xs mt-0.5 ${ALIGN_MAP[header.contactAlignment]}`} style={{ color: '#6b7280' }}>{header.contactLine}</p>}
              {header.websiteLine && <p className={`text-xs mt-0.5 ${ALIGN_MAP[header.websiteAlignment]}`} style={{ color: '#6b7280' }}>{header.websiteLine}</p>}
              {header.dividerEnabled && <div className="mt-3" style={dividerStyle(header.dividerColor, header.dividerThickness)} />}
            </>
          )}
        </div>
      )}
      <div className="px-6 py-8 bg-white">
        <div className="space-y-2">
          <div className="h-2 bg-gray-100 rounded w-1/3" />
          <div className="h-2 bg-gray-100 rounded w-full" />
          <div className="h-2 bg-gray-100 rounded w-5/6" />
          <div className="h-2 bg-gray-100 rounded w-full" />
          <div className="h-2 bg-gray-100 rounded w-4/5" />
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-4 italic">— Document content area —</p>
      </div>
      {footer.enabled && (
        <div style={{ backgroundColor: footer.backgroundColor, padding: '12px 24px 16px' }}>
          {footer.useCustomHtml ? (
            <div className="text-xs text-muted-foreground italic text-center py-4 border-2 border-dashed border-border rounded-lg">Custom HTML Footer — renders in actual document</div>
          ) : (
            <>
              {footer.dividerEnabled && <div className="mb-3" style={dividerStyle(footer.dividerColor, footer.dividerThickness)} />}
              {footer.line1 && <p className={`text-xs ${ALIGN_MAP[footer.line1Alignment]}`} style={{ color: footer.line1Color }}>{footer.line1}</p>}
              {footer.line2 && <p className={`text-xs mt-0.5 ${ALIGN_MAP[footer.line2Alignment]}`} style={{ color: footer.line2Color }}>{footer.line2}</p>}
              {footer.showPageNumber && <p className={`text-[10px] mt-1 text-muted-foreground ${ALIGN_MAP[footer.pageNumberAlignment]}`}>Page 1 of 1</p>}
              {footer.footerImageDataUrl && (
                <div style={{ margin: '8px -24px -16px', overflow: 'hidden' }}>
                  <img src={footer.footerImageDataUrl} alt="Footer Banner" style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain' }} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── PDF Export ───────────────────────────────────────────────────────────────

function generateLetterheadPDF(letterhead: LocationLetterhead, locationName: string, companyName: string) {
  const { header, footer } = letterhead;
  const dividerCss = (color: string, thickness: 'thin' | 'medium' | 'thick') =>
    `border-top: ${thickness === 'thin' ? 1 : thickness === 'medium' ? 2 : 3}px solid ${color};`;
  const alignCss = (a: TextAlignment) => a === 'left' ? 'left' : a === 'center' ? 'center' : 'right';
  const fontSizeCss = (s: FontSize) => {
    const map: Record<FontSize, string> = { xs: '10px', sm: '12px', base: '14px', lg: '18px', xl: '22px', '2xl': '28px' };
    return map[s];
  };
  const logoSizePx = { sm: '32px', md: '48px', lg: '64px' };
  const logoAlignFlex = { left: 'flex-start', center: 'center', right: 'flex-end' };

  const headerHtml = header.useCustomHtml ? header.customHtml : `
    ${header.headerImageDataUrl ? `<div style="margin:-${letterhead.marginTop}mm -${letterhead.marginRight}mm 8px -${letterhead.marginLeft}mm;overflow:hidden;"><img src="${header.headerImageDataUrl}" style="display:block;width:100%;height:auto;object-fit:contain;" /></div>` : ''}
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
    ${footer.footerImageDataUrl ? `<div style="margin:8px -${letterhead.marginRight}mm -${letterhead.marginBottom}mm -${letterhead.marginLeft}mm;overflow:hidden;"><img src="${footer.footerImageDataUrl}" style="display:block;width:100%;height:auto;object-fit:contain;" /></div>` : ''}
  `;

  const paperDimensions = { A4: { width: '210mm', height: '297mm' }, Letter: { width: '216mm', height: '279mm' }, Legal: { width: '216mm', height: '356mm' } };
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
      The header and footer shown represent the actual layout that will appear on all official documents.
    </p>
    <p style="font-size:11px;color:#374151;line-height:1.7;margin:0 0 20px 0;">
      Paper size: <strong>${letterhead.paperSize}</strong>, margins: ${letterhead.marginTop}mm top, ${letterhead.marginBottom}mm bottom, ${letterhead.marginLeft}mm left, ${letterhead.marginRight}mm right.
    </p>
    <p style="font-size:11px;color:#374151;margin:0 0 4px 0;">Yours sincerely,</p>
    <br/>
    <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 2px 0;">HR Department</p>
    <p style="font-size:11px;color:#374151;margin:0;">${companyName}</p>
  `;

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Letterhead Preview — ${locationName}</title>
  <style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: Arial, Helvetica, sans-serif; background: #f3f4f6; }
  .page { width: ${dims.width}; min-height: ${dims.height}; background: white; margin: 0 auto; display: flex; flex-direction: column; box-shadow: 0 4px 24px rgba(0,0,0,0.15); }
  .header { background: ${header.backgroundColor}; padding: ${letterhead.marginTop}mm ${letterhead.marginRight}mm 12px ${letterhead.marginLeft}mm; }
  .content { flex: 1; padding: 20px ${letterhead.marginRight}mm 20px ${letterhead.marginLeft}mm; }
  .footer { background: ${footer.backgroundColor}; padding: 12px ${letterhead.marginRight}mm ${letterhead.marginBottom}mm ${letterhead.marginLeft}mm; }
  @media print { body { background: white; } .page { box-shadow: none; margin: 0; width: 100%; min-height: 100vh; } .no-print { display: none !important; } }
  </style></head><body>
  <div class="no-print" style="background:#1e3a5f;color:white;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;">
    <span style="font-size:14px;font-weight:600;">📄 Letterhead Preview — ${locationName}</span>
    <div style="display:flex;gap:12px;">
      <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">✕ Close</button>
    </div>
  </div>
  <div style="padding:24px 0;background:#f3f4f6;" class="no-print"><p style="text-align:center;font-size:12px;color:#6b7280;margin-bottom:16px;">Use browser Print (Ctrl+P) → Save as PDF to export.</p></div>
  <div class="page"><div class="header">${headerHtml}</div><div class="content">${sampleContent}</div><div class="footer">${footerHtml}</div></div>
  </body></html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=900,height=700,scrollbars=yes');
  if (!win) { toast.error('Popup blocked. Please allow popups for this site.'); URL.revokeObjectURL(url); return; }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast.success('PDF preview opened. Use Print → Save as PDF to export.');
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

// ─── Supabase row mapping (DB-only persistence) ────────────────────────────────
// Documents (binary uploads) remain a Storage concern and are not persisted here;
// all structured location config is stored in and retrieved from the DB.
type DbRow = Record<string, unknown> & { id: string };
const wlNum = (v: unknown, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));
const dateOrNull = (v: string) => (v && v.trim() ? v : null);

function rowToBank(r: DbRow): BankAccount {
  return {
    id: r.id,
    bankName: (r.bank_name as string) ?? '',
    accountName: (r.account_name as string) ?? '',
    accountNumber: (r.account_number as string) ?? '',
    ifscCode: (r.ifsc_code as string) ?? '',
    branchName: (r.branch_name as string) ?? '',
    branchAddress: (r.branch_address as string) ?? '',
    accountType: (r.account_type as BankAccount['accountType']) ?? 'Current',
    isPrimary: Boolean(r.is_primary),
    swiftCode: (r.swift_code as string) ?? '',
    micrCode: (r.micr_code as string) ?? '',
    status: (r.status as BankAccount['status']) ?? 'Active',
    createdAt: r.created_at ? formatDate(r.created_at as string) : '',
  };
}
function bankToRow(b: BankAccount, locationId: string): Record<string, unknown> {
  return {
    location_id: locationId, bank_name: b.bankName, account_name: b.accountName,
    account_number: b.accountNumber, ifsc_code: b.ifscCode, branch_name: b.branchName,
    branch_address: b.branchAddress, account_type: b.accountType, is_primary: b.isPrimary,
    swift_code: b.swiftCode || null, micr_code: b.micrCode || null, status: b.status,
  };
}

function rowToPersonFromLoc(r: DbRow, prefix: string): FactoryPersonDetails {
  return {
    name: (r[`${prefix}_name`] as string) ?? '',
    designation: (r[`${prefix}_designation`] as string) ?? '',
    phone: (r[`${prefix}_phone`] as string) ?? '',
    email: (r[`${prefix}_email`] as string) ?? '',
    addressLine1: (r[`${prefix}_address_line1`] as string) ?? '',
    addressLine2: (r[`${prefix}_address_line2`] as string) ?? '',
    city: (r[`${prefix}_city`] as string) ?? '',
    district: (r[`${prefix}_district`] as string) ?? '',
    state: (r[`${prefix}_state`] as string) ?? '',
    pincode: (r[`${prefix}_pincode`] as string) ?? '',
    documents: {},
  };
}

function rowToLetterhead(r: DbRow | undefined, fallbackName: string): LocationLetterhead {
  if (!r) return emptyLetterhead(fallbackName, '', '', '');
  return {
    id: r.id,
    isActive: Boolean(r.is_active),
    header: {
      enabled: Boolean(r.header_enabled),
      logoDataUrl: (r.header_logo_url as string) ?? '',
      logoPosition: (r.header_logo_position as 'left' | 'center' | 'right') ?? 'left',
      logoSize: (r.header_logo_size as 'sm' | 'md' | 'lg') ?? 'md',
      headerImageDataUrl: (r.header_image_url as string) ?? '',
      headerImageHeight: (r.header_image_height as 'sm' | 'md' | 'lg') ?? 'md',
      companyName: (r.header_company_name as string) ?? '',
      companyNameSize: (r.header_company_name_size as FontSize) ?? 'xl',
      companyNameAlignment: (r.header_company_name_align as TextAlignment) ?? 'center',
      companyNameColor: (r.header_company_name_color as string) ?? '#1e3a5f',
      tagline: (r.header_tagline as string) ?? '',
      taglineAlignment: (r.header_tagline_alignment as TextAlignment) ?? 'center',
      taglineColor: (r.header_tagline_color as string) ?? '#6b7280',
      addressLine: (r.header_address_line as string) ?? '',
      addressAlignment: (r.header_address_alignment as TextAlignment) ?? 'center',
      contactLine: (r.header_contact_line as string) ?? '',
      contactAlignment: (r.header_contact_alignment as TextAlignment) ?? 'center',
      websiteLine: (r.header_website_line as string) ?? '',
      websiteAlignment: (r.header_website_alignment as TextAlignment) ?? 'center',
      dividerEnabled: Boolean(r.header_divider_enabled),
      dividerColor: (r.header_divider_color as string) ?? '#1e3a5f',
      dividerThickness: (r.header_divider_thickness as 'thin' | 'medium' | 'thick') ?? 'medium',
      backgroundColor: (r.header_bg_color as string) ?? '#ffffff',
      customHtml: (r.header_custom_html as string) ?? '',
      useCustomHtml: Boolean(r.header_use_custom_html),
    },
    footer: {
      enabled: Boolean(r.footer_enabled),
      footerImageDataUrl: (r.footer_image_url as string) ?? '',
      footerImageHeight: (r.footer_image_height as 'sm' | 'md' | 'lg') ?? 'sm',
      line1: (r.footer_line1 as string) ?? '',
      line1Alignment: (r.footer_line1_alignment as TextAlignment) ?? 'center',
      line1Color: (r.footer_line1_color as string) ?? '#6b7280',
      line2: (r.footer_line2 as string) ?? '',
      line2Alignment: (r.footer_line2_alignment as TextAlignment) ?? 'center',
      line2Color: (r.footer_line2_color as string) ?? '#6b7280',
      showPageNumber: Boolean(r.footer_show_page_number),
      pageNumberAlignment: (r.footer_page_number_align as TextAlignment) ?? 'right',
      dividerEnabled: Boolean(r.footer_divider_enabled),
      dividerColor: (r.footer_divider_color as string) ?? '#1e3a5f',
      dividerThickness: (r.footer_divider_thickness as 'thin' | 'medium' | 'thick') ?? 'medium',
      backgroundColor: (r.footer_bg_color as string) ?? '#ffffff',
      customHtml: (r.footer_custom_html as string) ?? '',
      useCustomHtml: Boolean(r.footer_use_custom_html),
    },
    usage: {
      payslip: Boolean(r.use_for_payslip),
      offerLetter: Boolean(r.use_for_offer_letter),
      memo: Boolean(r.use_for_memo),
      transferLetter: Boolean(r.use_for_transfer_letter),
      experienceLetter: Boolean(r.use_for_experience_letter),
      relievingLetter: Boolean(r.use_for_relieving_letter),
      appointmentLetter: Boolean(r.use_for_appointment_letter),
      warningLetter: Boolean(r.use_for_warning_letter),
    },
    paperSize: (r.paper_size as LocationLetterhead['paperSize']) ?? 'A4',
    marginTop: wlNum(r.margin_top, 20),
    marginBottom: wlNum(r.margin_bottom, 20),
    marginLeft: wlNum(r.margin_left, 25),
    marginRight: wlNum(r.margin_right, 25),
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

function rowToLocation(r: DbRow, bankRows: DbRow[], lhRow: DbRow | undefined): WorkLocation {
  return {
    id: r.id,
    name: (r.name as string) ?? '',
    code: (r.code as string) ?? '',
    address: (r.address as string) ?? '',
    city: (r.city as string) ?? '',
    state: (r.state as string) ?? '',
    country: (r.country as string) ?? 'India',
    phone: (r.phone as string) ?? '',
    email: (r.email as string) ?? '',
    status: (r.status as WorkLocation['status']) ?? 'Active',
    employeeCount: wlNum(r.employee_count),
    holidayListId: '',
    holidayListName: '',
    statutory: {
      linNo: (r.lin_no as string) ?? '', epfCodeNo: (r.epf_code_no as string) ?? '',
      esiCodeNo: (r.esi_code_no as string) ?? '', panNo: (r.pan_no as string) ?? '',
      gstCode: (r.gst_code as string) ?? '', tanNo: (r.tan_no as string) ?? '',
      cinNo: (r.cin_no as string) ?? '', ptNo: (r.pt_no as string) ?? '', documents: {},
    },
    bankAccounts: bankRows.filter(b => b.location_id === r.id).map(rowToBank),
    letterhead: rowToLetterhead(lhRow, (r.name as string) ?? ''),
    factory: {
      isFactory: Boolean(r.is_factory),
      registrationDate: (r.factory_registration_date as string) ?? '',
      validityFrom: (r.factory_validity_from as string) ?? '',
      validityTo: (r.factory_validity_to as string) ?? '',
      commencementOfWorkDate: (r.factory_commencement_date as string) ?? '',
      maxWorkersPerDay: wlNum(r.factory_max_workers_per_day),
      factoryLicenseLimit: wlNum(r.factory_license_limit),
      factoryGpsLatitude: (r.factory_gps_latitude as string) ?? '',
      factoryGpsLongitude: (r.factory_gps_longitude as string) ?? '',
      nicCode: (r.factory_nic_code as string) ?? '',
      fullPostalAddress: (r.factory_full_postal_address as string) ?? '',
      factoryDocuments: {},
      factoryManager: rowToPersonFromLoc(r, 'factory_manager'),
      factoryOccupier: rowToPersonFromLoc(r, 'factory_occupier'),
    },
  };
}

function personCols(p: FactoryPersonDetails, prefix: string): Record<string, unknown> {
  return {
    [`${prefix}_name`]: p.name || null, [`${prefix}_designation`]: p.designation || null,
    [`${prefix}_phone`]: p.phone || null, [`${prefix}_email`]: p.email || null,
    [`${prefix}_address_line1`]: p.addressLine1 || null, [`${prefix}_address_line2`]: p.addressLine2 || null,
    [`${prefix}_city`]: p.city || null, [`${prefix}_district`]: p.district || null,
    [`${prefix}_state`]: p.state || null, [`${prefix}_pincode`]: p.pincode || null,
  };
}
function locationToRow(loc: WorkLocation): Record<string, unknown> {
  const st = loc.statutory, fac = loc.factory;
  return {
    name: loc.name.trim(), code: loc.code.trim(), address: loc.address || null, city: loc.city || null,
    state: loc.state || null, country: loc.country || null, phone: loc.phone || null, email: loc.email || null,
    status: loc.status, employee_count: wlNum(loc.employeeCount),
    lin_no: st.linNo || null, epf_code_no: st.epfCodeNo || null, esi_code_no: st.esiCodeNo || null,
    pan_no: st.panNo || null, gst_code: st.gstCode || null, tan_no: st.tanNo || null,
    cin_no: st.cinNo || null, pt_no: st.ptNo || null,
    is_factory: fac.isFactory,
    factory_registration_date: dateOrNull(fac.registrationDate), factory_validity_from: dateOrNull(fac.validityFrom),
    factory_validity_to: dateOrNull(fac.validityTo), factory_commencement_date: dateOrNull(fac.commencementOfWorkDate),
    factory_max_workers_per_day: wlNum(fac.maxWorkersPerDay), factory_license_limit: wlNum(fac.factoryLicenseLimit),
    factory_gps_latitude: fac.factoryGpsLatitude || null, factory_gps_longitude: fac.factoryGpsLongitude || null,
    factory_nic_code: fac.nicCode || null, factory_full_postal_address: fac.fullPostalAddress || null,
    ...personCols(fac.factoryOccupier, 'factory_occupier'),
    ...personCols(fac.factoryManager, 'factory_manager'),
  };
}

// ─── Factory Person Card ──────────────────────────────────────────────────────

interface FactoryPersonCardProps {
  role: 'occupier' | 'manager';
  label: string;
  legalNote: string;
  accentBg: string;
  accentBorder: string;
  accentColor: string;
  accentTextDark: string;
  accentTextMid: string;
  icon: React.ElementType;
  person: FactoryPersonDetails;
  locationId: string;
  onUpdatePerson: (updates: Partial<FactoryPersonDetails>) => void;
  // Legacy form-state doc handlers, accepted but ignored — storage is now the DB.
  onDocUpload?: (fieldKey: string, files: FileList) => void;
  onDocRemove?: (fieldKey: string, docId: string) => void;
  onDocSign?: (fieldKey: string, docId: string, sig: SignatureData) => void;
}

function FactoryPersonCard({
  role, label, legalNote, accentBg, accentBorder, accentColor, accentTextDark, accentTextMid,
  icon: Icon, person, locationId, onUpdatePerson
}: FactoryPersonCardProps) {
  const idProofKey = `${role}_idProof`;
  const addressProofKey = `${role}_addressProof`;

  return (
    <div className={`rounded-xl border-2 ${accentBg} ${accentBorder} p-5 space-y-5`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Icon size={20} className={accentColor} />
        </div>
        <div>
          <h3 className="font-bold text-sm">{label}</h3>
          <p className="text-[10px] text-muted-foreground">Personal details, residential address & identity documents</p>
        </div>
        {person.name && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-border text-green-600">
            <CheckCircle2 size={11} /> Filled
          </span>
        )}
      </div>

      <div className={`flex items-start gap-3 p-3 bg-white/70 border ${accentBorder} rounded-xl`}>
        <Info size={14} className={`${accentColor} shrink-0 mt-0.5`} />
        <p className={`text-xs ${accentTextMid}`}>{legalNote}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="Full Name" required>
            <input type="text" className={whiteInputCls} placeholder={`Full name of ${label}`} value={person.name} onChange={e => onUpdatePerson({ name: e.target.value })} />
          </Field>
        </div>
        <Field label="Designation">
          <input type="text" className={whiteInputCls} placeholder={role === 'occupier' ? 'e.g. Managing Director, Proprietor' : 'e.g. Factory Manager, Works Manager'} value={person.designation} onChange={e => onUpdatePerson({ designation: e.target.value })} />
        </Field>
        <Field label="Phone Number">
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="tel" className={`${whiteInputCls} pl-8`} placeholder="+91 98765 43210" value={person.phone} onChange={e => onUpdatePerson({ phone: e.target.value })} />
          </div>
        </Field>
        <div className="md:col-span-2">
          <Field label="Email Address">
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" className={`${whiteInputCls} pl-8`} placeholder={`${role}@company.com`} value={person.email} onChange={e => onUpdatePerson({ email: e.target.value })} />
            </div>
          </Field>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Home size={14} className={accentColor} />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Residential Address</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Address Line 1">
              <input type="text" className={whiteInputCls} placeholder="House / Flat No., Building, Street" value={person.addressLine1} onChange={e => onUpdatePerson({ addressLine1: e.target.value })} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Address Line 2">
              <input type="text" className={whiteInputCls} placeholder="Area, Locality, Landmark" value={person.addressLine2} onChange={e => onUpdatePerson({ addressLine2: e.target.value })} />
            </Field>
          </div>
          <Field label="City">
            <input type="text" className={whiteInputCls} placeholder="City" value={person.city} onChange={e => onUpdatePerson({ city: e.target.value })} />
          </Field>
          <Field label="District">
            <input type="text" className={whiteInputCls} placeholder="District" value={person.district} onChange={e => onUpdatePerson({ district: e.target.value })} />
          </Field>
          <Field label="State">
            <select className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all appearance-none" value={person.state} onChange={e => onUpdatePerson({ state: e.target.value })}>
              <option value="">— Select State —</option>
              {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="PIN Code">
            <input type="text" className={whiteInputCls} placeholder="6-digit PIN" maxLength={6} value={person.pincode} onChange={e => onUpdatePerson({ pincode: e.target.value.replace(/\D/g, '') })} />
          </Field>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <IdCard size={14} className={accentColor} />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Identity & Address Documents</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <IdCard size={14} className={accentColor} />
              <span className="text-xs font-bold">ID Proof</span>
              {(person.documents[idProofKey]?.length ?? 0) > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded-full">
                  {person.documents[idProofKey].length} file{person.documents[idProofKey].length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Aadhaar, Passport, Voter ID, Driving Licence</p>
            <DocUploadZone fieldKey={idProofKey} label="ID Proof" entityRef={`work_location/${locationId}/${idProofKey}`} />
          </div>
          <div className="p-4 bg-white rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Home size={14} className={accentColor} />
              <span className="text-xs font-bold">Address Proof</span>
              {(person.documents[addressProofKey]?.length ?? 0) > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded-full">
                  {person.documents[addressProofKey].length} file{person.documents[addressProofKey].length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Utility Bill, Bank Statement, Aadhaar, Passport</p>
            <DocUploadZone fieldKey={addressProofKey} label="Address Proof" entityRef={`work_location/${locationId}/${addressProofKey}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Factory Section ──────────────────────────────────────────────────────────

interface FactorySectionProps {
  factory: FactoryDetails;
  locationId: string;
  onUpdate: (factory: FactoryDetails) => void;
}

function FactorySection({ factory, locationId, onUpdate }: FactorySectionProps) {
  const updateFactory = (updates: Partial<FactoryDetails>) => {
    onUpdate({ ...factory, ...updates });
  };

  const updateManager = (updates: Partial<FactoryPersonDetails>) => {
    onUpdate({ ...factory, factoryManager: { ...factory.factoryManager, ...updates } });
  };

  const updateOccupier = (updates: Partial<FactoryPersonDetails>) => {
    onUpdate({ ...factory, factoryOccupier: { ...factory.factoryOccupier, ...updates } });
  };

  // Factory / occupier / manager document uploads are handled by the DB-backed
  // DocUploadZone (Supabase Storage + `documents` table), not in-session state.

  const handleGetGPS = () => {
    if (!navigator.geolocation) { toast.error('Geolocation is not supported by your browser.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateFactory({ factoryGpsLatitude: pos.coords.latitude.toFixed(6), factoryGpsLongitude: pos.coords.longitude.toFixed(6) });
        toast.success('GPS coordinates captured successfully.');
      },
      () => { toast.error('Unable to retrieve location. Please enter coordinates manually.'); }
    );
  };

  return (
    <div className="space-y-5">
      <div className={`rounded-xl border-2 p-5 transition-all ${factory.isFactory ? 'bg-orange-50 border-orange-300' : 'bg-accent/30 border-border'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${factory.isFactory ? 'bg-orange-100' : 'bg-accent'}`}>
              <Factory size={22} className={factory.isFactory ? 'text-orange-600' : 'text-muted-foreground'} />
            </div>
            <div>
              <h3 className="font-bold text-base">Is this a Factory?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Enable if this location is registered under the Factories Act, 1948.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {factory.isFactory && (
              <span className="text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Factory size={10} /> Factory Registered
              </span>
            )}
            <div onClick={() => updateFactory({ isFactory: !factory.isFactory })} className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${factory.isFactory ? 'bg-orange-500' : 'bg-border'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${factory.isFactory ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {factory.isFactory && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Factories Act Compliance</p>
                  <p className="text-xs text-amber-700 mt-0.5">Under the Factories Act, 1948, all factories must maintain accurate registration details, license validity, worker limits, and appoint a qualified Factory Manager and Occupier.</p>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <SectionHeader icon={ClipboardList} title="Factory Registration & License Details" subtitle="Registration date, validity period, and license information" accentColor="text-orange-600" accentBg="bg-orange-100" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Factory Registration Date" required hint="Date of initial factory registration">
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <DateInput className={`${inputCls} pl-9`} value={factory.registrationDate} onChange={e => updateFactory({ registrationDate: e.target.value })} />
                    </div>
                  </Field>
                  <Field label="Commencement of Work Date" required hint="Date when factory operations commenced">
                    <div className="relative">
                      <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <DateInput className={`${inputCls} pl-9`} value={factory.commencementOfWorkDate} onChange={e => updateFactory({ commencementOfWorkDate: e.target.value })} />
                    </div>
                  </Field>
                  <Field label="License Validity From" required>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <DateInput className={`${inputCls} pl-9`} value={factory.validityFrom} onChange={e => updateFactory({ validityFrom: e.target.value })} />
                    </div>
                  </Field>
                  <Field label="License Validity To" required>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <DateInput className={`${inputCls} pl-9`} value={factory.validityTo} onChange={e => updateFactory({ validityTo: e.target.value })} />
                    </div>
                    {factory.validityTo && new Date(factory.validityTo) < new Date() && (
                      <p className="text-[10px] text-destructive mt-1 flex items-center gap-1"><AlertCircle size={10} /> License has expired. Please renew immediately.</p>
                    )}
                  </Field>
                  <Field label="Maximum Workers Per Day" required>
                    <div className="relative">
                      <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="number" className={`${inputCls} pl-9`} min={0} placeholder="e.g. 500" value={factory.maxWorkersPerDay || ''} onChange={e => updateFactory({ maxWorkersPerDay: parseInt(e.target.value) || 0 })} />
                    </div>
                  </Field>
                  <Field label="Factory License Limit" required>
                    <div className="relative">
                      <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="number" className={`${inputCls} pl-9`} min={0} placeholder="e.g. 500" value={factory.factoryLicenseLimit || ''} onChange={e => updateFactory({ factoryLicenseLimit: parseInt(e.target.value) || 0 })} />
                    </div>
                  </Field>
                  <Field label="NIC Code" required hint="National Industrial Classification code">
                    <div className="relative">
                      <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="text" className={`${inputCls} pl-9 font-mono`} placeholder="e.g. 26100" maxLength={10} value={factory.nicCode} onChange={e => updateFactory({ nicCode: e.target.value })} />
                    </div>
                  </Field>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <SectionHeader icon={Navigation} title="Factory GPS Location" subtitle="Geographic coordinates of the factory premises" accentColor="text-blue-600" accentBg="bg-blue-100" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="GPS Latitude" hint="Decimal degrees format (e.g. 19.076090)">
                    <div className="relative">
                      <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="text" className={`${inputCls} pl-9 font-mono`} placeholder="e.g. 19.076090" value={factory.factoryGpsLatitude} onChange={e => updateFactory({ factoryGpsLatitude: e.target.value })} />
                    </div>
                  </Field>
                  <Field label="GPS Longitude" hint="Decimal degrees format (e.g. 72.877426)">
                    <div className="relative">
                      <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="text" className={`${inputCls} pl-9 font-mono`} placeholder="e.g. 72.877426" value={factory.factoryGpsLongitude} onChange={e => updateFactory({ factoryGpsLongitude: e.target.value })} />
                    </div>
                  </Field>
                </div>
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <button onClick={handleGetGPS} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                    <Navigation size={14} /> Capture Current GPS Location
                  </button>
                  {factory.factoryGpsLatitude && factory.factoryGpsLongitude && (
                    <a href={`https://maps.google.com/?q=${factory.factoryGpsLatitude},${factory.factoryGpsLongitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                      <Globe size={14} /> View on Google Maps
                    </a>
                  )}
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <SectionHeader icon={MapPin} title="Full Postal Address of Factory" subtitle="Complete registered postal address as per factory license" accentColor="text-emerald-600" accentBg="bg-emerald-100" />
                <Field label="Full Postal Address" required hint="Complete address as it appears on the factory license">
                  <textarea className={`${inputCls} resize-none`} rows={4} placeholder="Enter the complete postal address of the factory..." value={factory.fullPostalAddress} onChange={e => updateFactory({ fullPostalAddress: e.target.value })} />
                </Field>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <SectionHeader icon={UserCheck} title="Factory Occupier Details" subtitle="Occupier of the factory as required under Section 2(n) of the Factories Act, 1948" accentColor="text-sky-600" accentBg="bg-sky-100" />
                <FactoryPersonCard
                  role="occupier" label="Factory Occupier"
                  legalNote="Under Section 2(n) of the Factories Act, 1948, the 'Occupier' means the person who has ultimate control over the affairs of the factory."
                  accentBg="bg-sky-50" accentBorder="border-sky-200" accentColor="text-sky-600" accentTextDark="text-sky-800" accentTextMid="text-sky-700"
                  icon={UserCheck} person={factory.factoryOccupier} onUpdatePerson={updateOccupier} locationId={locationId}
                />
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <SectionHeader icon={Wrench} title="Factory Manager Details" subtitle="Appointed Factory Manager as required under Section 7A of the Factories Act, 1948" accentColor="text-violet-600" accentBg="bg-violet-100" />
                <FactoryPersonCard
                  role="manager" label="Factory Manager"
                  legalNote="Under Section 7A of the Factories Act, 1948, every factory must appoint a competent person as Factory Manager who is responsible for the health, safety, and welfare of workers."
                  accentBg="bg-violet-50" accentBorder="border-violet-200" accentColor="text-violet-600" accentTextDark="text-violet-800" accentTextMid="text-violet-700"
                  icon={Wrench} person={factory.factoryManager} onUpdatePerson={updateManager} locationId={locationId}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Location Detail View ─────────────────────────────────────────────────────

interface LocationDetailProps {
  location: WorkLocation;
  onUpdate: (loc: WorkLocation) => void;
  onBack: () => void;
}

type LetterheadSubTab = 'header' | 'footer' | 'usage' | 'settings';

function LocationDetail({ location, onUpdate, onBack }: LocationDetailProps) {
  const [activeTab, setActiveTab] = useState<LocationTab>('details');
  const [letterheadSubTab, setLetterheadSubTab] = useState<LetterheadSubTab>('header');
  const [showPreview, setShowPreview] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loc = location;
  const lh = loc.letterhead;

  const updateLoc = (updates: Partial<WorkLocation>) => {
    onUpdate({ ...loc, ...updates });
  };

  const updateStatutory = (key: keyof LocationStatutory, value: string) => {
    onUpdate({ ...loc, statutory: { ...loc.statutory, [key]: value } });
  };

  const handleStatutoryUpload = (fieldKey: string, files: FileList) => {
    const newDocs: UploadedDoc[] = [];
    let processed = 0;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB limit.`); processed++; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({ id: `${fieldKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, uploadedAt: todayFormatted(), dataUrl: e.target?.result as string, category: fieldKey, description: '' });
        processed++;
        if (processed === files.length) {
          const updatedDocs = { ...loc.statutory.documents, [fieldKey]: [...(loc.statutory.documents[fieldKey] ?? []), ...newDocs] };
          onUpdate({ ...loc, statutory: { ...loc.statutory, documents: updatedDocs } });
          if (newDocs.length > 0) toast.success(`${newDocs.length} document(s) uploaded.`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleStatutoryRemoveDoc = (fieldKey: string, docId: string) => {
    const updatedDocs = { ...loc.statutory.documents, [fieldKey]: (loc.statutory.documents[fieldKey] ?? []).filter(d => d.id !== docId) };
    onUpdate({ ...loc, statutory: { ...loc.statutory, documents: updatedDocs } });
    toast.info('Document removed.');
  };

  const handleStatutorySignDoc = (fieldKey: string, docId: string, sig: SignatureData) => {
    const updatedDocs = { ...loc.statutory.documents, [fieldKey]: (loc.statutory.documents[fieldKey] ?? []).map(d => d.id === docId ? { ...d, signature: sig } : d) };
    onUpdate({ ...loc, statutory: { ...loc.statutory, documents: updatedDocs } });
  };

  const updateBankAccounts = (accounts: BankAccount[]) => {
    onUpdate({ ...loc, bankAccounts: accounts });
  };

  const updateLetterhead = (updates: Partial<LocationLetterhead>) => {
    onUpdate({ ...loc, letterhead: { ...lh, ...updates, updatedAt: todayFormatted() } });
  };

  const updateHeader = (updates: Partial<LetterheadSection>) => {
    updateLetterhead({ header: { ...lh.header, ...updates } });
  };

  const updateFooter = (updates: Partial<LetterheadFooter>) => {
    updateLetterhead({ footer: { ...lh.footer, ...updates } });
  };

  const updateUsage = (updates: Partial<LetterheadUsage>) => {
    updateLetterhead({ usage: { ...lh.usage, ...updates } });
  };

  const handleLogoUpload = async (file: File) => {
    const { url, error } = await uploadLetterheadImage('letterheads/logos', file);
    if (error || !url) { toast.error(error ?? 'Upload failed.'); return; }
    updateHeader({ logoDataUrl: url });
    toast.success('Letterhead logo uploaded.');
  };

  const filledStatutory = STATUTORY_FIELDS.filter(f => loc.statutory[f.key as keyof LocationStatutory]?.toString().trim()).length;
  const usageCount = Object.values(lh.usage).filter(Boolean).length;

  // Derive the selected holiday list entry for display
  const selectedHolidayList = AVAILABLE_HOLIDAY_LISTS.find(hl => hl.id === loc.holidayListId);

  const tabs: { key: LocationTab; label: string; icon: React.ElementType; badge?: string }[] = [
    { key: 'details', label: 'Location Details', icon: Building2, badge: loc.factory.isFactory ? 'Factory' : undefined },
    { key: 'statutory', label: 'Statutory & Compliance', icon: Shield, badge: `${filledStatutory}/${STATUTORY_FIELDS.length}` },
    { key: 'bank', label: 'Bank Details', icon: Banknote, badge: `${loc.bankAccounts.length}` },
    { key: 'letterhead', label: 'Letterhead', icon: Layout, badge: lh.isActive ? 'Active' : undefined },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 size={20} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">{loc.name}</h2>
                <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{loc.code}</span>
                <StatusBadge status={loc.status} />
                {loc.factory.isFactory && (
                  <span className="text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Factory size={9} /> Factory
                  </span>
                )}
                {lh.isActive && (
                  <span className="text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Layout size={9} /> Letterhead Active
                  </span>
                )}
                {loc.holidayListId && (
                  <span className="text-[9px] font-bold bg-teal-100 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <CalendarRange size={9} /> {loc.holidayListName}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{loc.address}, {loc.city}, {loc.state} · {loc.employeeCount} employees</p>
            </div>
          </div>
          <button onClick={() => { toast.success(`${loc.name} saved successfully!`); }} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
            <Save size={15} /> Save Changes
          </button>
        </div>

        <div className="flex items-center gap-0.5 overflow-x-auto">
          {tabs.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg border-b-2 whitespace-nowrap ${isActive ? 'text-primary border-primary bg-primary/5' : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50'}`}>
                <TabIcon size={15} />
                {tab.label}
                {tab.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : tab.key === 'letterhead' && lh.isActive ? 'bg-purple-100 text-purple-700' : tab.key === 'details' && loc.factory.isFactory ? 'bg-orange-100 text-orange-700' : 'bg-accent text-muted-foreground'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>

            {/* ── Details Tab ── */}
            {activeTab === 'details' && (
              <div className="space-y-6 max-w-3xl">
                {/* Basic Location Info */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <SectionHeader icon={Building2} title="Location Information" subtitle="Basic details and contact information for this work location" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                      <Field label="Location Name" required>
                        <input type="text" className={inputCls} value={loc.name} onChange={e => updateLoc({ name: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Location Code" required>
                      <div className="relative">
                        <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="text" className={`${inputCls} pl-8 font-mono`} value={loc.code} onChange={e => updateLoc({ code: e.target.value.toUpperCase() })} />
                      </div>
                    </Field>
                    <Field label="Status">
                      <select className={selectCls} value={loc.status} onChange={e => updateLoc({ status: e.target.value as 'Active' | 'Inactive' })}>
                        <option>Active</option><option>Inactive</option>
                      </select>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Address">
                        <input type="text" className={inputCls} placeholder="Street address" value={loc.address} onChange={e => updateLoc({ address: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="City">
                      <input type="text" className={inputCls} value={loc.city} onChange={e => updateLoc({ city: e.target.value })} />
                    </Field>
                    <Field label="State">
                      <select className={selectCls} value={loc.state} onChange={e => updateLoc({ state: e.target.value })}>
                        <option value="">— Select State —</option>
                        {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Country">
                      <input type="text" className={inputCls} value={loc.country} onChange={e => updateLoc({ country: e.target.value })} />
                    </Field>
                    <Field label="Phone">
                      <div className="relative">
                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="text" className={`${inputCls} pl-8`} value={loc.phone} onChange={e => updateLoc({ phone: e.target.value })} />
                      </div>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Email">
                        <div className="relative">
                          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input type="email" className={`${inputCls} pl-8`} value={loc.email} onChange={e => updateLoc({ email: e.target.value })} />
                        </div>
                      </Field>
                    </div>
                  </div>
                </div>

                {/* Holiday List Assignment */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <SectionHeader
                    icon={CalendarRange}
                    title="Holiday List Assignment"
                    subtitle="Assign a holiday list from the Holiday List Master to this work location"
                    accentColor="text-teal-600"
                    accentBg="bg-teal-100"
                  />
                  <div className="space-y-4">
                    <Field
                      label="Holiday List"
                      hint="Select from the holiday lists defined in Leave Setup → Holiday List Master. The assigned list will be used for attendance generation and payroll processing."
                    >
                      <div className="relative">
                        <CalendarRange size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <select
                          className={`${selectCls} pl-9`}
                          value={loc.holidayListId}
                          onChange={e => {
                            const selected = AVAILABLE_HOLIDAY_LISTS.find(hl => hl.id === e.target.value);
                            updateLoc({
                              holidayListId: e.target.value,
                              holidayListName: selected?.name ?? '',
                            });
                          }}
                        >
                          {AVAILABLE_HOLIDAY_LISTS.map(hl => (
                            <option key={hl.id} value={hl.id}>
                              {hl.name}{hl.year > 0 ? ` (${hl.year})` : ''}
                              {hl.status === 'Archived' ? ' — Archived' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>

                    {loc.holidayListId ? (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl"
                      >
                        <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-teal-800">
                            Assigned: <span className="text-teal-700">{loc.holidayListName}</span>
                            {selectedHolidayList?.year ? (
                              <span className="ml-2 text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-300 px-2 py-0.5 rounded-full">
                                {selectedHolidayList.year}
                              </span>
                            ) : null}
                            {selectedHolidayList?.status === 'Archived' && (
                              <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                Archived
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-teal-700 mt-0.5">
                            Holidays from this list will be automatically marked as <strong>Holiday</strong> when generating attendance for employees at <strong>{loc.name}</strong>.
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">No Holiday List Assigned</p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            Without a holiday list, attendance generation will not mark any days as holidays for employees at this location. Please assign a holiday list from <strong>Leave Setup → Holiday List Master</strong>.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Employees', value: loc.employeeCount, icon: Users, color: 'bg-blue-100', iconColor: 'text-blue-600' },
                    { label: 'Statutory Fields', value: `${filledStatutory}/${STATUTORY_FIELDS.length}`, icon: Shield, color: 'bg-rose-100', iconColor: 'text-rose-600' },
                    { label: 'Bank Accounts', value: loc.bankAccounts.length, icon: Banknote, color: 'bg-emerald-100', iconColor: 'text-emerald-600' },
                    { label: 'Factory Status', value: loc.factory.isFactory ? 'Registered' : 'Not a Factory', icon: Factory, color: loc.factory.isFactory ? 'bg-orange-100' : 'bg-gray-100', iconColor: loc.factory.isFactory ? 'text-orange-600' : 'text-gray-400' },
                  ].map((card, i) => (
                    <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
                      <div className={`p-2 ${card.color} rounded-xl`}><card.icon size={18} className={card.iconColor} /></div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                        <p className="font-bold text-sm mt-0.5">{card.value}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Factory Section */}
                <FactorySection factory={loc.factory} locationId={loc.id} onUpdate={(factory) => updateLoc({ factory })} />
              </div>
            )}

            {/* ── Statutory Tab ── */}
            {activeTab === 'statutory' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm"><Shield size={18} className="text-rose-600" /></div>
                    <div>
                      <p className="font-bold text-sm text-rose-800">{loc.name} — Statutory & Compliance</p>
                      <p className="text-xs text-rose-700">{loc.address}, {loc.city}, {loc.state}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-rose-700">{filledStatutory}/{STATUTORY_FIELDS.length}</p>
                      <p className="text-[10px] text-rose-600">Fields filled</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Compliance Notice</p>
                    <p className="text-xs text-amber-700 mt-0.5">Ensure all registration numbers are accurate and match official government records for <strong>{loc.name}</strong>.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {STATUTORY_FIELDS.map(field => {
                    const Icon = field.icon;
                    const fieldDocs = loc.statutory.documents[field.key] ?? [];
                    const fieldValue = loc.statutory[field.key as keyof LocationStatutory] as string;
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
                            const val = field.key === 'panNo' || field.key === 'gstCode' || field.key === 'tanNo' ? e.target.value.toUpperCase() : e.target.value;
                            updateStatutory(field.key as keyof LocationStatutory, val);
                          }}
                        />
                        <DocUploadZone fieldKey={field.key} label={field.docLabel} entityRef={`work_location/${loc.id}/${field.key}`} />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Bank Tab ── */}
            {activeTab === 'bank' && (
              <BankDetailsTab location={loc} onUpdateBankAccounts={updateBankAccounts} />
            )}

            {/* ── Letterhead Tab ── */}
            {activeTab === 'letterhead' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm"><Layout size={18} className="text-purple-600" /></div>
                    <div>
                      <p className="font-bold text-sm text-purple-800">{loc.name} — Letterhead Designer</p>
                      <p className="text-xs text-purple-700">Design header and footer for all official documents at this location.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-purple-700">Active:</span>
                      <div onClick={() => updateLetterhead({ isActive: !lh.isActive })} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${lh.isActive ? 'bg-green-500' : 'bg-border'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${lh.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                      <span className={`text-xs font-bold ${lh.isActive ? 'text-green-600' : 'text-muted-foreground'}`}>{lh.isActive ? 'Yes' : 'No'}</span>
                    </div>
                    <button onClick={() => setShowPreview(v => !v)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${showPreview ? 'bg-purple-600 text-white border-purple-600' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                      <Eye size={13} /> {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                    <button onClick={() => generateLetterheadPDF(lh, loc.name, 'Nexus Technologies Pvt. Ltd.')} className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm">
                      <Download size={13} /> Export PDF
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    The letterhead designed here will be applied to all selected report types for <strong>{loc.name}</strong>. Last updated: <strong>{lh.updatedAt}</strong>
                  </p>
                </div>

                <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="space-y-4">
                    <div className="flex items-center gap-0.5 bg-accent/50 p-1 rounded-xl">
                      {([
                        { key: 'header' as LetterheadSubTab, label: 'Header Design', icon: Layout },
                        { key: 'footer' as LetterheadSubTab, label: 'Footer Design', icon: AlignLeft },
                        { key: 'usage' as LetterheadSubTab, label: 'Report Usage', icon: FileText },
                        { key: 'settings' as LetterheadSubTab, label: 'Page Settings', icon: Printer },
                      ]).map(tab => {
                        const TabIcon = tab.icon;
                        const isActive = letterheadSubTab === tab.key;
                        return (
                          <button key={tab.key} onClick={() => setLetterheadSubTab(tab.key)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all flex-1 justify-center ${isActive ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            <TabIcon size={13} />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div key={letterheadSubTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
                        {letterheadSubTab === 'header' && (
                          <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-sm flex items-center gap-2"><Layout size={15} className="text-purple-600" /> Header Configuration</h3>
                              <ToggleSwitch value={lh.header.enabled} onChange={v => updateHeader({ enabled: v })} label="Enable Header" />
                            </div>
                            {lh.header.enabled && (
                              <div className="space-y-4">
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                  <ToggleSwitch value={lh.header.useCustomHtml} onChange={v => updateHeader({ useCustomHtml: v })} label="Use Custom HTML" description="Advanced: write raw HTML for full control over header layout" />
                                </div>
                                {lh.header.useCustomHtml ? (
                                  <Field label="Custom HTML Code" hint="Write valid HTML. Use inline styles for formatting.">
                                    <textarea className={`${inputCls} font-mono text-xs resize-none`} rows={8} placeholder="<div style='text-align:center;'><h1>Company Name</h1></div>" value={lh.header.customHtml} onChange={e => updateHeader({ customHtml: e.target.value })} />
                                  </Field>
                                ) : (
                                  <>
                                    <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><FileImage size={13} className="text-purple-600" /> Header Banner Image</span>
                                      </div>
                                      <ImageUploadZone label="Upload Header Banner Image" hint="PNG, JPG, SVG — max 5 MB. Auto-fits to the full page width (height scales to the image's aspect ratio)." dataUrl={lh.header.headerImageDataUrl} onUpload={dataUrl => updateHeader({ headerImageDataUrl: dataUrl })} onRemove={() => updateHeader({ headerImageDataUrl: '' })} />
                                      {lh.header.headerImageDataUrl && (
                                        <p className="text-[11px] text-muted-foreground">Auto-sized to the full page width — design the banner at the page's aspect ratio for the cleanest fit.</p>
                                      )}
                                    </div>
                                    <div className="p-4 bg-accent/30 rounded-xl border border-border">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Company Logo</span>
                                        {lh.header.logoDataUrl && (
                                          <button onClick={() => updateHeader({ logoDataUrl: '' })} className="text-xs text-destructive hover:underline flex items-center gap-1"><Trash size={11} /> Remove</button>
                                        )}
                                      </div>
                                      {lh.header.logoDataUrl ? (
                                        <div className="flex items-center gap-4">
                                          <div className="w-16 h-16 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden shadow-sm">
                                            <img src={lh.header.logoDataUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                                          </div>
                                          <div className="flex-1 space-y-2">
                                            <Field label="Logo Position">
                                              <select className={selectCls} value={lh.header.logoPosition} onChange={e => updateHeader({ logoPosition: e.target.value as any })}>
                                                <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                                              </select>
                                            </Field>
                                            <Field label="Logo Size">
                                              <select className={selectCls} value={lh.header.logoSize} onChange={e => updateHeader({ logoSize: e.target.value as any })}>
                                                <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option>
                                              </select>
                                            </Field>
                                          </div>
                                        </div>
                                      ) : (
                                        <div onClick={() => logoInputRef.current?.click()} className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all">
                                          <div className="p-2 bg-purple-100 rounded-lg"><FileImage size={16} className="text-purple-600" /></div>
                                          <div>
                                            <p className="text-sm font-medium">Upload Letterhead Logo</p>
                                            <p className="text-xs text-muted-foreground">PNG, JPG, SVG — max 2 MB</p>
                                          </div>
                                          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); e.target.value = ''; }} />
                                        </div>
                                      )}
                                    </div>
                                    <Field label="Company Name">
                                      <input type="text" className={inputCls} placeholder="Company / Location name" value={lh.header.companyName} onChange={e => updateHeader({ companyName: e.target.value })} />
                                    </Field>
                                    <div className="grid grid-cols-3 gap-3">
                                      <Field label="Font Size">
                                        <select className={selectCls} value={lh.header.companyNameSize} onChange={e => updateHeader({ companyNameSize: e.target.value as FontSize })}>
                                          {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                      </Field>
                                      <Field label="Alignment">
                                        <AlignButtons value={lh.header.companyNameAlignment} onChange={v => updateHeader({ companyNameAlignment: v })} />
                                      </Field>
                                      <Field label="Color">
                                        <div className="flex items-center gap-2">
                                          <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={lh.header.companyNameColor} onChange={e => updateHeader({ companyNameColor: e.target.value })} />
                                          <input type="text" className={`${inputCls} font-mono text-xs`} value={lh.header.companyNameColor} onChange={e => updateHeader({ companyNameColor: e.target.value })} />
                                        </div>
                                      </Field>
                                    </div>
                                    <Field label="Tagline / Subtitle" hint="Optional — appears below company name">
                                      <input type="text" className={inputCls} placeholder="e.g. Excellence in Every Step" value={lh.header.tagline} onChange={e => updateHeader({ tagline: e.target.value })} />
                                    </Field>
                                    <Field label="Address Line">
                                      <input type="text" className={inputCls} placeholder="Full address" value={lh.header.addressLine} onChange={e => updateHeader({ addressLine: e.target.value })} />
                                    </Field>
                                    <Field label="Contact Line" hint="Phone, email in one line">
                                      <input type="text" className={inputCls} placeholder="Tel: +91 22 4000 1000 | Email: admin@nexus.com" value={lh.header.contactLine} onChange={e => updateHeader({ contactLine: e.target.value })} />
                                    </Field>
                                    <Field label="Website Line">
                                      <input type="text" className={inputCls} placeholder="www.nexus.com" value={lh.header.websiteLine} onChange={e => updateHeader({ websiteLine: e.target.value })} />
                                    </Field>
                                    <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                      <ToggleSwitch value={lh.header.dividerEnabled} onChange={v => updateHeader({ dividerEnabled: v })} label="Show Divider Line" description="Horizontal line separating header from content" />
                                      {lh.header.dividerEnabled && (
                                        <div className="grid grid-cols-2 gap-3">
                                          <Field label="Divider Color">
                                            <div className="flex items-center gap-2">
                                              <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={lh.header.dividerColor} onChange={e => updateHeader({ dividerColor: e.target.value })} />
                                              <input type="text" className={`${inputCls} font-mono text-xs`} value={lh.header.dividerColor} onChange={e => updateHeader({ dividerColor: e.target.value })} />
                                            </div>
                                          </Field>
                                          <Field label="Thickness">
                                            <select className={selectCls} value={lh.header.dividerThickness} onChange={e => updateHeader({ dividerThickness: e.target.value as any })}>
                                              <option value="thin">Thin (1px)</option><option value="medium">Medium (2px)</option><option value="thick">Thick (3px)</option>
                                            </select>
                                          </Field>
                                        </div>
                                      )}
                                    </div>
                                    <Field label="Header Background Color">
                                      <div className="flex items-center gap-2">
                                        <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={lh.header.backgroundColor} onChange={e => updateHeader({ backgroundColor: e.target.value })} />
                                        <input type="text" className={`${inputCls} font-mono text-xs`} value={lh.header.backgroundColor} onChange={e => updateHeader({ backgroundColor: e.target.value })} />
                                        <button onClick={() => updateHeader({ backgroundColor: '#ffffff' })} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground">Reset</button>
                                      </div>
                                    </Field>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {letterheadSubTab === 'footer' && (
                          <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-sm flex items-center gap-2"><AlignLeft size={15} className="text-purple-600" /> Footer Configuration</h3>
                              <ToggleSwitch value={lh.footer.enabled} onChange={v => updateFooter({ enabled: v })} label="Enable Footer" />
                            </div>
                            {lh.footer.enabled && (
                              <div className="space-y-4">
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                  <ToggleSwitch value={lh.footer.useCustomHtml} onChange={v => updateFooter({ useCustomHtml: v })} label="Use Custom HTML" description="Advanced: write raw HTML for full control over footer layout" />
                                </div>
                                {lh.footer.useCustomHtml ? (
                                  <Field label="Custom HTML Code">
                                    <textarea className={`${inputCls} font-mono text-xs resize-none`} rows={8} placeholder="<div style='text-align:center;font-size:10px;'>Confidential Document</div>" value={lh.footer.customHtml} onChange={e => updateFooter({ customHtml: e.target.value })} />
                                  </Field>
                                ) : (
                                  <>
                                    <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                      <ToggleSwitch value={lh.footer.dividerEnabled} onChange={v => updateFooter({ dividerEnabled: v })} label="Show Divider Line" description="Horizontal line separating content from footer" />
                                      {lh.footer.dividerEnabled && (
                                        <div className="grid grid-cols-2 gap-3">
                                          <Field label="Divider Color">
                                            <div className="flex items-center gap-2">
                                              <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={lh.footer.dividerColor} onChange={e => updateFooter({ dividerColor: e.target.value })} />
                                              <input type="text" className={`${inputCls} font-mono text-xs`} value={lh.footer.dividerColor} onChange={e => updateFooter({ dividerColor: e.target.value })} />
                                            </div>
                                          </Field>
                                          <Field label="Thickness">
                                            <select className={selectCls} value={lh.footer.dividerThickness} onChange={e => updateFooter({ dividerThickness: e.target.value as any })}>
                                              <option value="thin">Thin (1px)</option><option value="medium">Medium (2px)</option><option value="thick">Thick (3px)</option>
                                            </select>
                                          </Field>
                                        </div>
                                      )}
                                    </div>
                                    <div className="space-y-3">
                                      <Field label="Footer Line 1">
                                        <input type="text" className={inputCls} placeholder="e.g. This is a computer-generated document." value={lh.footer.line1} onChange={e => updateFooter({ line1: e.target.value })} />
                                      </Field>
                                      <div className="grid grid-cols-2 gap-3">
                                        <Field label="Alignment"><AlignButtons value={lh.footer.line1Alignment} onChange={v => updateFooter({ line1Alignment: v })} /></Field>
                                        <Field label="Color">
                                          <div className="flex items-center gap-2">
                                            <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={lh.footer.line1Color} onChange={e => updateFooter({ line1Color: e.target.value })} />
                                            <input type="text" className={`${inputCls} font-mono text-xs`} value={lh.footer.line1Color} onChange={e => updateFooter({ line1Color: e.target.value })} />
                                          </div>
                                        </Field>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <Field label="Footer Line 2" hint="Optional second line">
                                        <input type="text" className={inputCls} placeholder="e.g. Confidential — For addressee only" value={lh.footer.line2} onChange={e => updateFooter({ line2: e.target.value })} />
                                      </Field>
                                      <div className="grid grid-cols-2 gap-3">
                                        <Field label="Alignment"><AlignButtons value={lh.footer.line2Alignment} onChange={v => updateFooter({ line2Alignment: v })} /></Field>
                                        <Field label="Color">
                                          <div className="flex items-center gap-2">
                                            <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={lh.footer.line2Color} onChange={e => updateFooter({ line2Color: e.target.value })} />
                                            <input type="text" className={`${inputCls} font-mono text-xs`} value={lh.footer.line2Color} onChange={e => updateFooter({ line2Color: e.target.value })} />
                                          </div>
                                        </Field>
                                      </div>
                                    </div>
                                    <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                      <ToggleSwitch value={lh.footer.showPageNumber} onChange={v => updateFooter({ showPageNumber: v })} label="Show Page Number" description="Automatically adds page number to footer" />
                                      {lh.footer.showPageNumber && (
                                        <Field label="Page Number Alignment"><AlignButtons value={lh.footer.pageNumberAlignment} onChange={v => updateFooter({ pageNumberAlignment: v })} /></Field>
                                      )}
                                    </div>
                                    <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><FileImage size={13} className="text-purple-600" /> Footer Banner Image</span>
                                      </div>
                                      <ImageUploadZone label="Upload Footer Banner Image" hint="PNG, JPG, SVG — max 5 MB. Auto-fits to the full page width (height scales to the image's aspect ratio)." dataUrl={lh.footer.footerImageDataUrl} onUpload={dataUrl => updateFooter({ footerImageDataUrl: dataUrl })} onRemove={() => updateFooter({ footerImageDataUrl: '' })} />
                                      {lh.footer.footerImageDataUrl && (
                                        <p className="text-[11px] text-muted-foreground">Auto-sized to the full page width — design the banner at the page's aspect ratio for the cleanest fit.</p>
                                      )}
                                    </div>
                                    <Field label="Footer Background Color">
                                      <div className="flex items-center gap-2">
                                        <input type="color" className="w-10 h-10 rounded-lg border border-border cursor-pointer" value={lh.footer.backgroundColor} onChange={e => updateFooter({ backgroundColor: e.target.value })} />
                                        <input type="text" className={`${inputCls} font-mono text-xs`} value={lh.footer.backgroundColor} onChange={e => updateFooter({ backgroundColor: e.target.value })} />
                                        <button onClick={() => updateFooter({ backgroundColor: '#ffffff' })} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground">Reset</button>
                                      </div>
                                    </Field>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {letterheadSubTab === 'usage' && (
                          <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-sm flex items-center gap-2"><FileText size={15} className="text-purple-600" /> Report Usage</h3>
                              <span className="text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">{usageCount} / {REPORT_TYPES.length} selected</span>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                              <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                              <p className="text-xs text-blue-700">Select which document types should use this letterhead for <strong>{loc.name}</strong>.</p>
                            </div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Document Types</span>
                              <div className="flex gap-2">
                                <button onClick={() => updateUsage(Object.fromEntries(REPORT_TYPES.map(r => [r.key, true])) as unknown as LetterheadUsage)} className="text-xs text-primary hover:underline font-medium">Select All</button>
                                <span className="text-muted-foreground">·</span>
                                <button onClick={() => updateUsage(Object.fromEntries(REPORT_TYPES.map(r => [r.key, false])) as unknown as LetterheadUsage)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear All</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              {REPORT_TYPES.map(report => (
                                <motion.div key={report.key} whileHover={{ x: 2 }} className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${lh.usage[report.key] ? 'border-purple-300 bg-purple-50' : 'border-border bg-accent/20 hover:border-purple-200'}`} onClick={() => updateUsage({ [report.key]: !lh.usage[report.key] })}>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl">{report.icon}</span>
                                    <div>
                                      <p className="font-semibold text-sm">{report.label}</p>
                                      <p className="text-[10px] text-muted-foreground">{lh.usage[report.key] ? 'Letterhead will be applied' : 'No letterhead applied'}</p>
                                    </div>
                                  </div>
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${lh.usage[report.key] ? 'bg-purple-600 border-purple-600' : 'border-border'}`}>
                                    {lh.usage[report.key] && <CheckCircle2 size={12} className="text-white" />}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {letterheadSubTab === 'settings' && (
                          <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
                            <h3 className="font-bold text-sm flex items-center gap-2"><Printer size={15} className="text-purple-600" /> Page & Margin Settings</h3>
                            <Field label="Paper Size">
                              <select className={selectCls} value={lh.paperSize} onChange={e => updateLetterhead({ paperSize: e.target.value as any })}>
                                <option value="A4">A4 (210 × 297 mm)</option>
                                <option value="Letter">Letter (216 × 279 mm)</option>
                                <option value="Legal">Legal (216 × 356 mm)</option>
                              </select>
                            </Field>
                            <div className="p-4 bg-accent/30 rounded-xl border border-border">
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Page Margins (mm)</p>
                              <div className="grid grid-cols-2 gap-4">
                                <Field label="Top Margin"><input type="number" className={inputCls} min={0} max={50} value={lh.marginTop} onChange={e => updateLetterhead({ marginTop: parseInt(e.target.value) || 0 })} /></Field>
                                <Field label="Bottom Margin"><input type="number" className={inputCls} min={0} max={50} value={lh.marginBottom} onChange={e => updateLetterhead({ marginBottom: parseInt(e.target.value) || 0 })} /></Field>
                                <Field label="Left Margin"><input type="number" className={inputCls} min={0} max={50} value={lh.marginLeft} onChange={e => updateLetterhead({ marginLeft: parseInt(e.target.value) || 0 })} /></Field>
                                <Field label="Right Margin"><input type="number" className={inputCls} min={0} max={50} value={lh.marginRight} onChange={e => updateLetterhead({ marginRight: parseInt(e.target.value) || 0 })} /></Field>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Quick Presets</p>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { label: 'Standard', top: 20, bottom: 20, left: 25, right: 25 },
                                  { label: 'Compact', top: 15, bottom: 15, left: 20, right: 20 },
                                  { label: 'Wide', top: 25, bottom: 25, left: 30, right: 30 },
                                ].map(preset => (
                                  <button key={preset.label} onClick={() => updateLetterhead({ marginTop: preset.top, marginBottom: preset.bottom, marginLeft: preset.left, marginRight: preset.right })} className="px-3 py-2 border border-border rounded-lg text-xs font-medium hover:bg-accent hover:border-purple-300 transition-all text-center">
                                    <p className="font-bold">{preset.label}</p>
                                    <p className="text-muted-foreground text-[10px]">{preset.top}/{preset.bottom}/{preset.left}/{preset.right}mm</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm"><Download size={16} className="text-rose-600" /></div>
                                <div>
                                  <p className="font-bold text-sm text-rose-800">Export as PDF</p>
                                  <p className="text-xs text-rose-700">Generate a sample A4 document with dummy content to preview the letterhead.</p>
                                </div>
                              </div>
                              <button onClick={() => generateLetterheadPDF(lh, loc.name, 'Nexus Technologies Pvt. Ltd.')} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-semibold shadow-sm">
                                <Download size={15} /> Generate PDF Preview
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {showPreview && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm flex items-center gap-2"><Eye size={15} className="text-purple-600" /> Live Preview</h3>
                        <span className="text-[10px] text-muted-foreground bg-accent border border-border px-2 py-0.5 rounded-full">{lh.paperSize} · {lh.marginLeft}mm margins</span>
                      </div>
                      <LetterheadPreview letterhead={lh} locationName={loc.name} />
                      <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                        <Info size={12} className="shrink-0" />
                        <span>Preview is approximate. Actual output may vary slightly based on print settings.</span>
                      </div>
                      <button onClick={() => generateLetterheadPDF(lh, loc.name, 'Nexus Technologies Pvt. Ltd.')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors text-sm font-semibold shadow-sm">
                        <Download size={15} /> Export as PDF — Sample A4 Preview
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Header', value: lh.header.enabled ? 'Enabled' : 'Disabled', icon: Layout },
                    { label: 'Footer', value: lh.footer.enabled ? 'Enabled' : 'Disabled', icon: AlignLeft },
                    { label: 'Reports', value: `${usageCount} / ${REPORT_TYPES.length}`, icon: FileText },
                    { label: 'Paper', value: lh.paperSize, icon: Printer },
                  ].map((card, i) => (
                    <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-xl"><card.icon size={18} className="text-purple-600" /></div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                        <p className="font-bold text-sm mt-0.5">{card.value}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Bank Details Tab ─────────────────────────────────────────────────────────

interface BankDetailsTabProps {
  location: WorkLocation;
  onUpdateBankAccounts: (accounts: BankAccount[]) => void;
}

function BankDetailsTab({ location, onUpdateBankAccounts }: BankDetailsTabProps) {
  const [bankModal, setBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [bankForm, setBankForm] = useState<Omit<BankAccount, 'id' | 'createdAt'>>({
    bankName: '', accountName: '', accountNumber: '', ifscCode: '', branchName: '',
    branchAddress: '', accountType: 'Current', isPrimary: false, swiftCode: '', micrCode: '', status: 'Active',
  });

  const accounts = location.bankAccounts;
  const primaryAccount = accounts.find(a => a.isPrimary);
  const activeCount = accounts.filter(a => a.status === 'Active').length;

  const openAddBank = () => {
    setEditingBank(null);
    setBankForm({ bankName: '', accountName: 'Nexus Technologies Pvt. Ltd.', accountNumber: '', ifscCode: '', branchName: '', branchAddress: '', accountType: 'Current', isPrimary: accounts.length === 0, swiftCode: '', micrCode: '', status: 'Active' });
    setBankModal(true);
  };

  const openEditBank = (acc: BankAccount) => {
    setEditingBank(acc);
    setBankForm({ bankName: acc.bankName, accountName: acc.accountName, accountNumber: acc.accountNumber, ifscCode: acc.ifscCode, branchName: acc.branchName, branchAddress: acc.branchAddress, accountType: acc.accountType, isPrimary: acc.isPrimary, swiftCode: acc.swiftCode, micrCode: acc.micrCode, status: acc.status });
    setBankModal(true);
  };

  const saveBank = () => {
    if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.ifscCode) { toast.error('Bank Name, Account Number, and IFSC Code are required.'); return; }
    if (editingBank) {
      const updated = accounts.map(a => a.id === editingBank.id ? { ...a, ...bankForm } : a);
      onUpdateBankAccounts(updated);
      toast.success('Bank account updated.');
    } else {
      const newAcc: BankAccount = { ...bankForm, id: `BNK${Date.now()}`, createdAt: todayFormatted() };
      if (bankForm.isPrimary) {
        onUpdateBankAccounts([...accounts.map(a => ({ ...a, isPrimary: false })), newAcc]);
      } else {
        onUpdateBankAccounts([...accounts, newAcc]);
      }
      toast.success('Bank account added.');
    }
    setBankModal(false);
  };

  const handleSetPrimary = (id: string) => {
    onUpdateBankAccounts(accounts.map(a => ({ ...a, isPrimary: a.id === id })));
    toast.success('Primary account updated.');
  };

  const handleToggleStatus = (id: string) => {
    onUpdateBankAccounts(accounts.map(a => a.id === id ? { ...a, status: a.status === 'Active' ? 'Inactive' : 'Active' } : a));
  };

  const handleDelete = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (acc?.isPrimary && accounts.length > 1) { toast.error('Cannot delete primary account. Set another account as primary first.'); return; }
    onUpdateBankAccounts(accounts.filter(a => a.id !== id));
    toast.info('Bank account removed.');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm"><Banknote size={18} className="text-blue-600" /></div>
          <div>
            <p className="font-bold text-sm text-blue-800">{location.name} — Bank Accounts</p>
            <p className="text-xs text-blue-700">{location.address}, {location.city}, {location.state}</p>
          </div>
        </div>
        <button onClick={openAddBank} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
          <Plus size={15} /> Add Bank Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Accounts', value: accounts.length, sub: `${activeCount} active`, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Banknote },
          { label: 'Primary Account', value: primaryAccount?.bankName ?? 'Not set', sub: primaryAccount?.accountType ?? '—', color: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: CheckCircle2 },
          { label: 'Account Types', value: new Set(accounts.map(a => a.accountType)).size, sub: 'Unique types', color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Building },
        ].map((card, i) => (
          <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
            <div className={`p-2.5 ${card.color} rounded-xl`}><card.icon size={22} className={card.iconColor} /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
              <p className="font-bold text-sm mt-0.5 truncate max-w-[140px]">{card.value}</p>
              <p className="text-[10px] text-muted-foreground">{card.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {accounts.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {accounts.map((acc, i) => (
            <motion.div key={acc.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className={`bg-card rounded-xl border-2 shadow-sm overflow-hidden transition-all ${acc.isPrimary ? 'border-primary' : 'border-border'}`}>
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
                        {acc.isPrimary && <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">Primary</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{acc.branchName}</p>
                    </div>
                  </div>
                  <StatusBadge status={acc.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-accent/40 rounded-lg p-3"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Account Name</p><p className="text-xs font-semibold truncate">{acc.accountName}</p></div>
                  <div className="bg-accent/40 rounded-lg p-3"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Account Type</p><p className="text-xs font-semibold">{acc.accountType}</p></div>
                  <div className="bg-accent/40 rounded-lg p-3"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Account Number</p><p className="text-xs font-mono font-semibold">{'•'.repeat(Math.max(0, acc.accountNumber.length - 4))}{acc.accountNumber.slice(-4)}</p></div>
                  <div className="bg-accent/40 rounded-lg p-3"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">IFSC Code</p><p className="text-xs font-mono font-semibold">{acc.ifscCode}</p></div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  {!acc.isPrimary && (
                    <button onClick={() => handleSetPrimary(acc.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary border border-primary/20 transition-colors">
                      <CheckCircle2 size={12} /> Set Primary
                    </button>
                  )}
                  <button onClick={() => openEditBank(acc)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => handleToggleStatus(acc.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                    {acc.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => handleDelete(acc.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Banknote size={28} className="text-blue-600" /></div>
          <p className="font-semibold text-muted-foreground">No bank accounts for {location.name}</p>
          <p className="text-xs text-muted-foreground mt-1 mb-5">Add a bank account for payroll processing at this location</p>
          <button onClick={openAddBank} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto">
            <Plus size={15} /> Add Bank Account
          </button>
        </div>
      )}

      <AnimatePresence>
        {bankModal && (
          <Modal title={editingBank ? 'Edit Bank Account' : 'Add Bank Account'} onClose={() => setBankModal(false)} wide>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bank Name" required>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" className={`${inputCls} pl-8`} placeholder="e.g. HDFC Bank" value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} />
                  </div>
                </Field>
                <Field label="Account Type" required>
                  <select className={selectCls} value={bankForm.accountType} onChange={e => setBankForm(f => ({ ...f, accountType: e.target.value as BankAccount['accountType'] }))}>
                    <option>Current</option><option>Savings</option><option>Overdraft</option><option>Cash Credit</option>
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
                    <div onClick={() => setBankForm(f => ({ ...f, isPrimary: !f.isPrimary }))} className={`w-10 h-5 rounded-full transition-colors relative ${bankForm.isPrimary ? 'bg-primary' : 'bg-border'}`}>
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

// ─── Main Work Location Master ────────────────────────────────────────────────

interface WorkLocationMasterProps {
  onBack: () => void;
}

export default function WorkLocationMaster({ onBack }: WorkLocationMasterProps) {
  // Stored in and retrieved from Supabase only (work_locations + child tables).
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [locationModal, setLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WorkLocation | null>(null);
  const [locationForm, setLocationForm] = useState<Omit<WorkLocation, 'id' | 'employeeCount' | 'statutory' | 'bankAccounts' | 'letterhead' | 'factory'>>({
    name: '', code: '', address: '', city: '', state: '', country: 'India', phone: '', email: '', status: 'Active',
    holidayListId: '', holidayListName: '',
  });

  const selectedLocation = locations.find(l => l.id === selectedLocationId) ?? null;

  const filteredLocations = useMemo(() =>
    locations.filter(l => {
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.code.toLowerCase().includes(search.toLowerCase()) ||
        l.city.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || l.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [locations, search, statusFilter]
  );

  const sb = supabase as unknown as { from: (t: string) => any };

  // Load all location data (work_locations + bank accounts + letterheads) from the DB.
  const reload = useCallback(async () => {
    const [locRes, bankRes, lhRes] = await Promise.all([
      sb.from('work_locations').select('*').order('created_at', { ascending: true }),
      sb.from('location_bank_accounts').select('*'),
      sb.from('letterheads').select('*'),
    ]);
    if (locRes.error) { toast.error(locRes.error.message); return; }
    const banks: DbRow[] = bankRes.data ?? [];
    const lhByLoc = new Map<string, DbRow>((lhRes.data ?? []).map((r: DbRow) => [r.location_id as string, r]));
    setLocations((locRes.data ?? []).map((r: DbRow) => rowToLocation(r, banks, lhByLoc.get(r.id))));
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // Persist a full location (core + statutory + factory, bank accounts, letterhead) to the DB.
  const persistLocation = useCallback(async (loc: WorkLocation) => {
    const e1 = (await sb.from('work_locations').update(locationToRow(loc)).eq('id', loc.id)).error;
    if (e1) { toast.error(e1.message); return; }
    await sb.from('location_bank_accounts').delete().eq('location_id', loc.id);
    if (loc.bankAccounts.length) {
      await sb.from('location_bank_accounts').insert(loc.bankAccounts.map(b => bankToRow(b, loc.id)));
    }
    await sb.from('letterheads').delete().eq('location_id', loc.id);
    await sb.from('letterheads').insert(letterheadToRow(loc.letterhead, loc.id));
  }, []);

  // Auto-save (debounced) whenever a location's nested details are edited in LocationDetail.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const handleUpdateLocation = (updated: WorkLocation) => {
    setLocations(prev => prev.map(l => l.id === updated.id ? updated : l));
    if (saveTimers.current[updated.id]) clearTimeout(saveTimers.current[updated.id]);
    saveTimers.current[updated.id] = setTimeout(() => { void persistLocation(updated); }, 700);
  };

  const openAddLocation = () => {
    setEditingLocation(null);
    setLocationForm({ name: '', code: '', address: '', city: '', state: '', country: 'India', phone: '', email: '', status: 'Active', holidayListId: '', holidayListName: '' });
    setLocationModal(true);
  };

  const openEditLocation = (loc: WorkLocation) => {
    setEditingLocation(loc);
    setLocationForm({ name: loc.name, code: loc.code, address: loc.address, city: loc.city, state: loc.state, country: loc.country, phone: loc.phone, email: loc.email, status: loc.status, holidayListId: loc.holidayListId, holidayListName: loc.holidayListName });
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
      // Seed a default letterhead row for the new location.
      const lh = emptyLetterhead(locationForm.name, `${locationForm.address}, ${locationForm.city}, ${locationForm.state}`, locationForm.phone, locationForm.email);
      await sb.from('letterheads').insert(letterheadToRow(lh, data.id));
      toast.success('Work location added.');
    }
    await reload();
    setLocationModal(false);
  };

  const deleteLocation = async (id: string) => {
    await sb.from('location_bank_accounts').delete().eq('location_id', id);
    await sb.from('letterheads').delete().eq('location_id', id);
    const err = (await sb.from('work_locations').delete().eq('id', id)).error;
    if (err) { toast.error(err.message); return; }
    if (selectedLocationId === id) setSelectedLocationId(null);
    await reload();
    toast.info('Work location removed.');
  };

  const activeCount = locations.filter(l => l.status === 'Active').length;
  const totalEmployees = locations.reduce((s, l) => s + l.employeeCount, 0);
  const activeLetterheads = locations.filter(l => l.letterhead.isActive).length;
  const totalBankAccounts = locations.reduce((s, l) => s + l.bankAccounts.length, 0);
  const factoryCount = locations.filter(l => l.factory.isFactory).length;
  const assignedHolidayListCount = locations.filter(l => l.holidayListId).length;

  if (selectedLocation) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <LocationDetail
          location={selectedLocation}
          onUpdate={handleUpdateLocation}
          onBack={() => setSelectedLocationId(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <MapPin size={22} className="text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Work Location Master</h1>
                <p className="text-xs text-muted-foreground">Manage work locations with statutory compliance, bank details, factory registration, holiday list assignment, and letterhead configuration.</p>
              </div>
            </div>
            <button onClick={openAddLocation} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
              <Plus size={16} /> Add Location
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: 'Total Locations', value: locations.length, sub: `${activeCount} active`, color: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: MapPin },
              { label: 'Total Employees', value: totalEmployees, sub: 'Across all locations', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
              { label: 'Bank Accounts', value: totalBankAccounts, sub: 'Configured', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: Banknote },
              { label: 'Factory Locations', value: factoryCount, sub: 'Registered factories', color: 'bg-orange-100', iconColor: 'text-orange-600', icon: Factory },
              { label: 'Holiday Lists', value: assignedHolidayListCount, sub: `of ${locations.length} assigned`, color: 'bg-teal-100', iconColor: 'text-teal-600', icon: CalendarRange },
              { label: 'Active Letterheads', value: activeLetterheads, sub: 'Locations with letterhead', color: 'bg-purple-100', iconColor: 'text-purple-600', icon: Layout },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-3">
                <div className={`p-2.5 ${card.color} rounded-xl shrink-0`}><card.icon size={18} className={card.iconColor} /></div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="font-bold text-base mt-0.5">{card.value}</p>
                  <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search by name, code, or city..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}>
              <option value="All">All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filteredLocations.length} of {locations.length} locations</div>
          </div>

          {/* Location Cards */}
          {filteredLocations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredLocations.map((loc, i) => {
                const filledStatutory = STATUTORY_FIELDS.filter(f => loc.statutory[f.key as keyof LocationStatutory]?.toString().trim()).length;
                const bankCount = loc.bankAccounts.length;
                const assignedHL = AVAILABLE_HOLIDAY_LISTS.find(hl => hl.id === loc.holidayListId);
                return (
                  <motion.div key={loc.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -4 }} className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden group">
                    <div className={`h-1.5 w-full ${loc.status === 'Active' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 size={20} className="text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-sm">{loc.name}</h3>
                              {loc.factory.isFactory && (
                                <span className="text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <Factory size={9} /> Factory
                                </span>
                              )}
                              {loc.letterhead.isActive && (
                                <span className="text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <Layout size={9} /> LH
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{loc.code}</span>
                              <StatusBadge status={loc.status} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-3">
                        <MapPin size={12} className="shrink-0 mt-0.5 text-primary/60" />
                        <span className="truncate">{loc.address}, {loc.city}, {loc.state}</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 flex-wrap">
                        <span className="flex items-center gap-1"><Phone size={11} />{loc.phone || '—'}</span>
                        <span className="flex items-center gap-1"><Users size={11} />{loc.employeeCount} emp</span>
                      </div>

                      {/* Holiday List Badge */}
                      <div className="mb-3">
                        {loc.holidayListId ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                            <CalendarRange size={13} className="text-teal-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wide">Holiday List</p>
                              <p className="text-xs font-semibold text-teal-800 truncate">{loc.holidayListName}</p>
                            </div>
                            {assignedHL?.status === 'Archived' && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">Archived</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertCircle size={13} className="text-amber-500 shrink-0" />
                            <p className="text-[10px] font-medium text-amber-700">No holiday list assigned</p>
                          </div>
                        )}
                      </div>

                      {/* Progress Indicators */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground flex items-center gap-1"><Shield size={10} /> Statutory</span>
                          <span className="font-bold text-rose-600">{filledStatutory}/{STATUTORY_FIELDS.length}</span>
                        </div>
                        <div className="w-full h-1.5 bg-accent rounded-full">
                          <div className="h-full bg-rose-400 rounded-full transition-all" style={{ width: `${(filledStatutory / STATUTORY_FIELDS.length) * 100}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground flex items-center gap-1"><Banknote size={10} /> Bank Accounts</span>
                          <span className="font-bold text-blue-600">{bankCount} account{bankCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Feature Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {loc.statutory.epfCodeNo && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">EPF</span>}
                        {loc.statutory.esiCodeNo && <span className="text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full">ESI</span>}
                        {loc.statutory.gstCode && <span className="text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-full">GST</span>}
                        {loc.statutory.panNo && <span className="text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">PAN</span>}
                        {bankCount > 0 && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">Bank</span>}
                        {loc.factory.isFactory && <span className="text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">Factory</span>}
                        {loc.letterhead.isActive && <span className="text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full">Letterhead</span>}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <button onClick={() => setSelectedLocationId(loc.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          <Eye size={12} /> Manage
                        </button>
                        <button onClick={() => openEditLocation(loc)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                          <Pencil size={12} /> Edit
                        </button>
                        <button onClick={() => deleteLocation(loc.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto">
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin size={28} className="text-emerald-600" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {search || statusFilter !== 'All' ? 'No locations match your filters' : 'No work locations added yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                {search || statusFilter !== 'All' ? 'Try adjusting your search or filter criteria' : 'Add your first work location to get started'}
              </p>
              {!search && statusFilter === 'All' && (
                <button onClick={openAddLocation} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto">
                  <Plus size={15} /> Add Location
                </button>
              )}
            </div>
          )}

          {/* Overview Table */}
          {locations.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
                <MapPin size={16} className="text-primary" />
                <h3 className="font-bold text-sm">Location Overview</h3>
                <span className="ml-auto text-xs text-muted-foreground">{locations.length} locations configured</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">City / State</th>
                      <th className="px-4 py-3 font-semibold">Employees</th>
                      <th className="px-4 py-3 font-semibold">Holiday List</th>
                      <th className="px-4 py-3 font-semibold">Statutory</th>
                      <th className="px-4 py-3 font-semibold">Bank</th>
                      <th className="px-4 py-3 font-semibold">Factory</th>
                      <th className="px-4 py-3 font-semibold">Letterhead</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {locations.map((loc, i) => {
                      const filledStatutory = STATUTORY_FIELDS.filter(f => loc.statutory[f.key as keyof LocationStatutory]?.toString().trim()).length;
                      const assignedHL = AVAILABLE_HOLIDAY_LISTS.find(hl => hl.id === loc.holidayListId);
                      return (
                        <motion.tr key={loc.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Building2 size={14} className="text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{loc.name}</p>
                                <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{loc.code}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{loc.city}, {loc.state}</td>
                          <td className="px-4 py-3 font-bold text-sm">{loc.employeeCount}</td>
                          <td className="px-4 py-3">
                            {loc.holidayListId ? (
                              <div className="flex items-center gap-1.5">
                                <CalendarRange size={12} className="text-teal-600 shrink-0" />
                                <span className="text-xs font-semibold text-teal-700 truncate max-w-[140px]">{loc.holidayListName}</span>
                                {assignedHL?.status === 'Archived' && (
                                  <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">Archived</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
                                <AlertCircle size={10} /> Not assigned
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-accent rounded-full">
                                <div className="h-full bg-rose-400 rounded-full" style={{ width: `${(filledStatutory / STATUTORY_FIELDS.length) * 100}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{filledStatutory}/{STATUTORY_FIELDS.length}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold ${loc.bankAccounts.length > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                              {loc.bankAccounts.length} account{loc.bankAccounts.length !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {loc.factory.isFactory ? (
                              <span className="text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                <Factory size={9} /> Registered
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {loc.letterhead.isActive ? (
                              <span className="text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                <Layout size={9} /> Active
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not set</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={loc.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setSelectedLocationId(loc.id)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Eye size={13} /></button>
                              <button onClick={() => openEditLocation(loc)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"><Pencil size={13} /></button>
                              <button onClick={() => deleteLocation(loc.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Location Modal */}
      <AnimatePresence>
        {locationModal && (
          <Modal title={editingLocation ? 'Edit Work Location' : 'Add Work Location'} onClose={() => setLocationModal(false)}>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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

                {/* Holiday List Assignment in Modal */}
                <div className="col-span-2">
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarRange size={16} className="text-teal-600" />
                      <span className="text-sm font-bold text-teal-800">Holiday List Assignment</span>
                    </div>
                    <Field
                      label="Assign Holiday List"
                      hint="Select from the holiday lists defined in Leave Setup → Holiday List Master"
                    >
                      <div className="relative">
                        <CalendarRange size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <select
                          className={`${selectCls} pl-9`}
                          value={locationForm.holidayListId}
                          onChange={e => {
                            const selected = AVAILABLE_HOLIDAY_LISTS.find(hl => hl.id === e.target.value);
                            setLocationForm(f => ({
                              ...f,
                              holidayListId: e.target.value,
                              holidayListName: selected?.name ?? '',
                            }));
                          }}
                        >
                          {AVAILABLE_HOLIDAY_LISTS.map(hl => (
                            <option key={hl.id} value={hl.id}>
                              {hl.name}{hl.year > 0 ? ` (${hl.year})` : ''}
                              {hl.status === 'Archived' ? ' — Archived' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>
                    {locationForm.holidayListId ? (
                      <div className="flex items-center gap-2 text-xs text-teal-700">
                        <CheckCircle2 size={13} className="text-teal-600 shrink-0" />
                        <span>Assigned: <strong>{locationForm.holidayListName}</strong></span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-amber-700">
                        <AlertCircle size={13} className="text-amber-500 shrink-0" />
                        <span>No holiday list assigned — attendance generation will not mark holidays automatically.</span>
                      </div>
                    )}
                  </div>
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
    </div>
  );
}