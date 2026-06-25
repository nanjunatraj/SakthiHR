import { todayFormatted } from '../utils/date';
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SecureDocUploadZone from '../components/SecureDocUploadZone';
import type { SignatureData } from '../components/AadhaarOTPSigning';
import {
  Landmark,
  Building2,
  FileText,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Save,
  Eye,
  Paperclip,
  Hash,
  Phone,
  Mail,
  MapPin,
  Globe,
  ChevronDown,
  ChevronUp,
  Shield,
  CreditCard,
  Briefcase,
  Receipt,
  BadgeCheck,
  Trash2,
  ExternalLink,
  User,
  Users,
  DollarSign,
  Home,
  IdCard
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { toast } from 'react-toastify';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dataUrl: string;
  signature?: SignatureData;
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
  // Basic Info
  name: string;
  shortName: string;
  incorporationDate: string;
  industryType: string;
  entityType: string;
  website: string;
  email: string;
  phone: string;
  currency: string;
  // Address
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  // Statutory
  linNo: string;
  epfCodeNo: string;
  esiCodeNo: string;
  panNo: string;
  gstCode: string;
  tanNo: string;
  cinNo: string;
  ptNo: string;
  // Persons
  occupier: PersonDetails;
  manager: PersonDetails;
}

interface DocumentStore {
  [fieldKey: string]: UploadedDoc[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
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

// ─── Statutory Field Config ───────────────────────────────────────────────────

interface StatutoryField {
  key: keyof EstablishmentData;
  label: string;
  placeholder: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description: string;
  pattern?: string;
  maxLength?: number;
  docLabel: string;
}

const STATUTORY_FIELDS: StatutoryField[] = [
  {
    key: 'linNo',
    label: 'LIN No.',
    placeholder: 'e.g. 1234567890',
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    description: 'Labour Identification Number issued by Ministry of Labour',
    maxLength: 10,
    docLabel: 'LIN Certificate / Labour Registration'
  },
  {
    key: 'epfCodeNo',
    label: 'EPF Code No.',
    placeholder: 'e.g. MH/BAN/0012345/000',
    icon: BadgeCheck,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
    description: 'Employees\' Provident Fund Organisation registration code',
    docLabel: 'EPF Registration Certificate'
  },
  {
    key: 'esiCodeNo',
    label: 'ESI Code No.',
    placeholder: 'e.g. 41-00-123456-000-0001',
    icon: CreditCard,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    description: 'Employees\' State Insurance Corporation registration code',
    docLabel: 'ESI Registration Certificate'
  },
  {
    key: 'panNo',
    label: 'PAN No.',
    placeholder: 'e.g. AAACN1234C',
    icon: Receipt,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    description: 'Permanent Account Number issued by Income Tax Department',
    maxLength: 10,
    pattern: '[A-Z]{5}[0-9]{4}[A-Z]{1}',
    docLabel: 'PAN Card Copy'
  },
  {
    key: 'gstCode',
    label: 'GST Code',
    placeholder: 'e.g. 27AAACN1234C1Z5',
    icon: Briefcase,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 border-rose-200',
    description: 'Goods and Services Tax Identification Number (GSTIN)',
    maxLength: 15,
    docLabel: 'GST Registration Certificate'
  },
  {
    key: 'tanNo',
    label: 'TAN No.',
    placeholder: 'e.g. MUMX12345A',
    icon: Hash,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 border-cyan-200',
    description: 'Tax Deduction and Collection Account Number',
    maxLength: 10,
    docLabel: 'TAN Allotment Letter'
  },
  {
    key: 'cinNo',
    label: 'CIN No.',
    placeholder: 'e.g. U72200MH2010PTC123456',
    icon: FileText,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 border-indigo-200',
    description: 'Corporate Identification Number issued by MCA',
    maxLength: 21,
    docLabel: 'Certificate of Incorporation'
  },
  {
    key: 'ptNo',
    label: 'PT No.',
    placeholder: 'e.g. 27123456789P',
    icon: Building2,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 border-teal-200',
    description: 'Professional Tax Registration Number',
    docLabel: 'PT Registration Certificate'
  }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  name: '',
  designation: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
});

// ─── Document Upload Zone ─────────────────────────────────────────────────────

interface DocUploadZoneProps {
  fieldKey: string;
  label: string;
  // Legacy form-state props are accepted but ignored — storage is now the DB.
  docs?: UploadedDoc[];
  onUpload?: (fieldKey: string, files: FileList) => void;
  onRemove?: (fieldKey: string, docId: string) => void;
  onSign?: (fieldKey: string, docId: string, sig: SignatureData) => void;
}

// Establishment documents are saved to the private `documents` bucket + table,
// viewed via signed URLs, and Aadhaar-eSignable.
const DocUploadZone = ({ fieldKey, label }: DocUploadZoneProps) => (
  <div className="mt-3">
    <SecureDocUploadZone
      entityType="establishment"
      entityRef={`establishment/${fieldKey}`}
      label={label}
      signerName="Authorised Signatory"
      signerId="—"
    />
  </div>
);

// ─── Section Wrapper ──────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section = ({ title, subtitle, icon: Icon, children, defaultOpen = true }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-accent/20 transition-colors text-left"
      >
        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
          <Icon size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-base">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {open ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-border">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Field Wrapper ────────────────────────────────────────────────────────────

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

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none";

// ─── Person Card ──────────────────────────────────────────────────────────────

interface PersonCardProps {
  role: 'occupier' | 'manager';
  label: string;
  accentColor: string;
  accentBg: string;
  icon: React.ElementType;
  person: PersonDetails;
  documents: DocumentStore;
  onChange: (role: 'occupier' | 'manager', field: keyof PersonDetails, value: string) => void;
  onUpload: (fieldKey: string, files: FileList) => void;
  onRemove: (fieldKey: string, docId: string) => void;
  onSign: (fieldKey: string, docId: string, sig: SignatureData) => void;
}

const PersonCard = ({
  role, label, accentColor, accentBg, icon: Icon,
  person, documents, onChange, onUpload, onRemove, onSign
}: PersonCardProps) => {
  const idProofKey = `${role}_idProof`;
  const addressProofKey = `${role}_addressProof`;

  return (
    <div className={`rounded-xl border-2 ${accentBg} p-5 space-y-5`}>
      {/* Card Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Icon size={20} className={accentColor} />
        </div>
        <div>
          <h3 className="font-bold text-sm">{label}</h3>
          <p className="text-[10px] text-muted-foreground">Personal details, address & identity documents</p>
        </div>
        {person.name && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-border text-green-600">
            <CheckCircle2 size={11} /> Filled
          </span>
        )}
      </div>

      {/* Personal Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="Full Name" required>
            <input
              type="text"
              className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all"
              placeholder={`Full name of ${label.toLowerCase()}`}
              value={person.name}
              onChange={e => onChange(role, 'name', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Designation">
          <input
            type="text"
            className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all"
            placeholder="e.g. Managing Director"
            value={person.designation}
            onChange={e => onChange(role, 'designation', e.target.value)}
          />
        </Field>
        <Field label="Phone Number">
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="tel"
              className="w-full pl-8 pr-3 py-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all"
              placeholder="+91 98765 43210"
              value={person.phone}
              onChange={e => onChange(role, 'phone', e.target.value)}
            />
          </div>
        </Field>
        <div className="md:col-span-2">
          <Field label="Email Address">
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                className="w-full pl-8 pr-3 py-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all"
                placeholder="person@company.com"
                value={person.email}
                onChange={e => onChange(role, 'email', e.target.value)}
              />
            </div>
          </Field>
        </div>
      </div>

      {/* Address */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Home size={14} className={accentColor} />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Residential Address</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Address Line 1">
              <input
                type="text"
                className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all"
                placeholder="House / Flat No., Building, Street"
                value={person.addressLine1}
                onChange={e => onChange(role, 'addressLine1', e.target.value)}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Address Line 2">
              <input
                type="text"
                className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all"
                placeholder="Area, Locality, Landmark"
                value={person.addressLine2}
                onChange={e => onChange(role, 'addressLine2', e.target.value)}
              />
            </Field>
          </div>
          <Field label="City">
            <input
              type="text"
              className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all"
              placeholder="City"
              value={person.city}
              onChange={e => onChange(role, 'city', e.target.value)}
            />
          </Field>
          <Field label="District">
            <input
              type="text"
              className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all"
              placeholder="District"
              value={person.district}
              onChange={e => onChange(role, 'district', e.target.value)}
            />
          </Field>
          <Field label="State">
            <select
              className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all appearance-none"
              value={person.state}
              onChange={e => onChange(role, 'state', e.target.value)}
            >
              <option value="">— Select State —</option>
              {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="PIN Code">
            <input
              type="text"
              className="w-full p-3 bg-white border border-white/80 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm transition-all"
              placeholder="6-digit PIN"
              maxLength={6}
              value={person.pincode}
              onChange={e => onChange(role, 'pincode', e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        </div>
      </div>

      {/* Documents */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <IdCard size={14} className={accentColor} />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Identity & Address Documents</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <IdCard size={15} className={accentColor} />
              <span className="text-xs font-bold">ID Proof</span>
              {(documents[idProofKey]?.length ?? 0) > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded-full">
                  {documents[idProofKey].length} file{documents[idProofKey].length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Aadhaar, Passport, Voter ID, Driving Licence</p>
            <DocUploadZone
              fieldKey={idProofKey}
              label="ID Proof"
              docs={documents[idProofKey] ?? []}
              onUpload={onUpload}
              onRemove={onRemove}
              onSign={onSign}
            />
          </div>
          <div className="p-4 bg-white rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Home size={15} className={accentColor} />
              <span className="text-xs font-bold">Address Proof</span>
              {(documents[addressProofKey]?.length ?? 0) > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded-full">
                  {documents[addressProofKey].length} file{documents[addressProofKey].length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Utility Bill, Bank Statement, Aadhaar, Passport</p>
            <DocUploadZone
              fieldKey={addressProofKey}
              label="Address Proof"
              docs={documents[addressProofKey] ?? []}
              onUpload={onUpload}
              onRemove={onRemove}
              onSign={onSign}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EstablishmentSetup() {
  const [data, setData] = useState<EstablishmentData>({
    name: 'Nexus Technologies Pvt. Ltd.',
    shortName: 'NexusTech',
    incorporationDate: '2010-04-01',
    industryType: 'Information Technology',
    entityType: 'Private Limited Company',
    website: 'https://nexus.com',
    email: 'admin@nexus.com',
    phone: '+91 22 4000 1000',
    currency: 'INR',
    addressLine1: '14th Floor, Nexus Tower, BKC',
    addressLine2: 'Bandra Kurla Complex',
    city: 'Mumbai',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    pincode: '400051',
    country: 'India',
    linNo: '',
    epfCodeNo: '',
    esiCodeNo: '',
    panNo: '',
    gstCode: '',
    tanNo: '',
    cinNo: '',
    ptNo: '',
    occupier: emptyPerson(),
    manager: emptyPerson(),
  });

  const [documents, setDocuments] = useState<DocumentStore>({});
  const [saved, setSaved] = useState(false);

  const set = (key: keyof EstablishmentData, value: string) => {
    setData(d => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const setPerson = (role: 'occupier' | 'manager', field: keyof PersonDetails, value: string) => {
    setData(d => ({ ...d, [role]: { ...d[role], [field]: value } }));
    setSaved(false);
  };

  const handleUpload = (fieldKey: string, files: FileList) => {
    const newDocs: UploadedDoc[] = [];
    let processed = 0;

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5 MB limit.`);
        processed++;
        if (processed === files.length && newDocs.length > 0) {
          setDocuments(prev => ({ ...prev, [fieldKey]: [...(prev[fieldKey] ?? []), ...newDocs] }));
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        newDocs.push({
          id: `${fieldKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: todayFormatted(),
          dataUrl: e.target?.result as string
        });
        processed++;
        if (processed === files.length) {
          setDocuments(prev => ({ ...prev, [fieldKey]: [...(prev[fieldKey] ?? []), ...newDocs] }));
          toast.success(`${newDocs.length} document(s) uploaded.`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveDoc = (fieldKey: string, docId: string) => {
    setDocuments(prev => ({ ...prev, [fieldKey]: (prev[fieldKey] ?? []).filter(d => d.id !== docId) }));
    toast.info('Document removed.');
  };

  const handleSignDoc = (fieldKey: string, docId: string, sig: SignatureData) => {
    setDocuments(prev => ({ ...prev, [fieldKey]: (prev[fieldKey] ?? []).map(d => d.id === docId ? { ...d, signature: sig } : d) }));
  };

  const handleSave = () => {
    if (!data.name || !data.panNo) {
      toast.error('Establishment Name and PAN No. are required.');
      return;
    }
    setSaved(true);
    toast.success('Establishment details saved successfully!');
  };

  const totalDocs = Object.values(documents).reduce((s, arr) => s + arr.length, 0);
  const filledStatutory = STATUTORY_FIELDS.filter(f => data[f.key]?.toString().trim()).length;
  const selectedCurrency = CURRENCIES.find(c => c.code === data.currency) ?? CURRENCIES[0];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">

        {/* Header */}
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Establishment Setup</h1>
            <p className="text-muted-foreground">Configure your organisation's legal identity, statutory registrations, and compliance documents.</p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium"
              >
                <CheckCircle2 size={16} />
                Saved
              </motion.div>
            )}
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md font-medium"
            >
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </header>

        {/* Summary Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
            <div className="p-2.5 bg-primary/10 rounded-xl"><Landmark size={22} className="text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Organisation</p>
              <p className="font-bold text-sm mt-0.5 truncate max-w-[140px]">{data.name || '—'}</p>
              <p className="text-[10px] text-muted-foreground">{data.entityType || 'Not set'}</p>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
            <div className="p-2.5 bg-amber-100 rounded-xl"><DollarSign size={22} className="text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Base Currency</p>
              <p className="font-bold text-sm mt-0.5">{selectedCurrency.symbol} {selectedCurrency.code}</p>
              <p className="text-[10px] text-muted-foreground">{selectedCurrency.name}</p>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
            <div className="p-2.5 bg-emerald-100 rounded-xl"><Shield size={22} className="text-emerald-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Statutory Fields</p>
              <p className="font-bold text-sm mt-0.5">{filledStatutory} / {STATUTORY_FIELDS.length} filled</p>
              <div className="w-28 h-1.5 bg-accent rounded-full mt-1.5">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(filledStatutory / STATUTORY_FIELDS.length) * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
            <div className="p-2.5 bg-indigo-100 rounded-xl"><Paperclip size={22} className="text-indigo-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Documents</p>
              <p className="font-bold text-sm mt-0.5">{totalDocs} file{totalDocs !== 1 ? 's' : ''}</p>
              <p className="text-[10px] text-muted-foreground">Across {Object.keys(documents).filter(k => documents[k]?.length > 0).length} categories</p>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">

          {/* ── Basic Information ── */}
          <Section
            title="Basic Information"
            subtitle="Organisation name, type, incorporation details, contact and base currency"
            icon={Building2}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
              <div className="md:col-span-2">
                <Field label="Establishment / Company Name" required>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Full legal name of the organisation"
                    value={data.name}
                    onChange={e => set('name', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Short Name / Trade Name">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Abbreviated or trade name"
                  value={data.shortName}
                  onChange={e => set('shortName', e.target.value)}
                />
              </Field>
              <Field label="Date of Incorporation">
                <input
                  type="date"
                  className={inputCls}
                  value={data.incorporationDate}
                  onChange={e => set('incorporationDate', e.target.value)}
                />
              </Field>
              <Field label="Entity Type" required>
                <select
                  className={selectCls}
                  value={data.entityType}
                  onChange={e => set('entityType', e.target.value)}
                >
                  <option value="">— Select Entity Type —</option>
                  {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Industry Type">
                <select
                  className={selectCls}
                  value={data.industryType}
                  onChange={e => set('industryType', e.target.value)}
                >
                  <option value="">— Select Industry —</option>
                  {INDUSTRY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>

              {/* Currency Selector */}
              <div className="md:col-span-2">
                <Field
                  label="Base Currency"
                  required
                  hint="This currency will be used across all payroll transactions, salary slips, and financial reports."
                >
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                      <DollarSign size={14} className="text-muted-foreground" />
                    </div>
                    <select
                      className={`${selectCls} pl-9`}
                      value={data.currency}
                      onChange={e => set('currency', e.target.value)}
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.symbol} — {c.code} · {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {data.currency && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                      <AlertCircle size={13} className="text-amber-600 shrink-0" />
                      <p className="text-[11px] text-amber-700">
                        <span className="font-semibold">{selectedCurrency.symbol} {selectedCurrency.code}</span> will be applied to all salary calculations, payslips, loan records, and financial reports across the system.
                      </p>
                    </motion.div>
                  )}
                </Field>
              </div>

              <Field label="Official Email" required>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    className={`${inputCls} pl-9`}
                    placeholder="admin@company.com"
                    value={data.email}
                    onChange={e => set('email', e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Phone Number">
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    className={`${inputCls} pl-9`}
                    placeholder="+91 22 4000 1000"
                    value={data.phone}
                    onChange={e => set('phone', e.target.value)}
                  />
                </div>
              </Field>
              <div className="md:col-span-2">
                <Field label="Website">
                  <div className="relative">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="url"
                      className={`${inputCls} pl-9`}
                      placeholder="https://company.com"
                      value={data.website}
                      onChange={e => set('website', e.target.value)}
                    />
                  </div>
                </Field>
              </div>
            </div>
          </Section>

          {/* ── Registered Address ── */}
          <Section
            title="Registered Address"
            subtitle="Official registered address of the establishment"
            icon={MapPin}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
              <div className="md:col-span-2">
                <Field label="Address Line 1" required>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Building name, floor, street"
                    value={data.addressLine1}
                    onChange={e => set('addressLine1', e.target.value)}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Address Line 2">
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Area, locality, landmark"
                    value={data.addressLine2}
                    onChange={e => set('addressLine2', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="City" required>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="City"
                  value={data.city}
                  onChange={e => set('city', e.target.value)}
                />
              </Field>
              <Field label="District" required>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="District"
                  value={data.district}
                  onChange={e => set('district', e.target.value)}
                />
              </Field>
              <Field label="State" required>
                <select
                  className={selectCls}
                  value={data.state}
                  onChange={e => set('state', e.target.value)}
                >
                  <option value="">— Select State —</option>
                  {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="PIN Code" required>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="6-digit PIN code"
                  maxLength={6}
                  value={data.pincode}
                  onChange={e => set('pincode', e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Country">
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Country"
                    value={data.country}
                    onChange={e => set('country', e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* ── Occupier & Manager Details ── */}
          <Section
            title="Occupier & Manager Details"
            subtitle="Responsible persons under Factories Act / Shops & Establishments Act with identity documents"
            icon={Users}
          >
            <div className="mt-4 space-y-6">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <AlertCircle size={17} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">Legal Requirement:</span> Under the Factories Act 1948 and Shops & Establishments Acts, the Occupier and Manager must be registered with the relevant authority. Ensure ID and address proofs are certified copies.
                </p>
              </div>

              <PersonCard
                role="occupier"
                label="Occupier"
                accentColor="text-violet-600"
                accentBg="bg-violet-50 border-violet-200"
                icon={User}
                person={data.occupier}
                documents={documents}
                onChange={setPerson}
                onUpload={handleUpload}
                onRemove={handleRemoveDoc}
                onSign={handleSignDoc}
              />

              <PersonCard
                role="manager"
                label="Manager"
                accentColor="text-sky-600"
                accentBg="bg-sky-50 border-sky-200"
                icon={Users}
                person={data.manager}
                documents={documents}
                onChange={setPerson}
                onUpload={handleUpload}
                onRemove={handleRemoveDoc}
                onSign={handleSignDoc}
              />
            </div>
          </Section>

          {/* ── Statutory & Compliance ── */}
          <Section
            title="Statutory & Compliance Details"
            subtitle="Government registration numbers with supporting document uploads"
            icon={Shield}
          >
            <div className="mt-4 space-y-5">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Compliance Notice</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Ensure all registration numbers are accurate and match official government records.
                    Upload certified copies of each registration certificate for audit readiness.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {STATUTORY_FIELDS.map(field => {
                  const Icon = field.icon;
                  const fieldDocs = documents[field.key] ?? [];
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
                            {data[field.key]?.toString().trim() && (
                              <CheckCircle2 size={14} className="text-green-500" />
                            )}
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
                        value={data[field.key] as string}
                        onChange={e => {
                          const val = field.key === 'panNo' || field.key === 'gstCode' || field.key === 'tanNo'
                            ? e.target.value.toUpperCase()
                            : e.target.value;
                          set(field.key, val);
                        }}
                      />

                      <DocUploadZone
                        fieldKey={field.key}
                        label={field.docLabel}
                        docs={fieldDocs}
                        onUpload={handleUpload}
                        onRemove={handleRemoveDoc}
                        onSign={handleSignDoc}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* ── Document Summary ── */}
          {totalDocs > 0 && (
            <Section
              title="Document Summary"
              subtitle="All uploaded compliance documents across statutory fields and persons"
              icon={FileText}
              defaultOpen={false}
            >
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold rounded-tl-lg">Document</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Size</th>
                      <th className="px-4 py-3 font-semibold">Uploaded</th>
                      <th className="px-4 py-3 font-semibold rounded-tr-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(documents).flatMap(([fieldKey, docs]) =>
                      docs.map(doc => {
                        const statutoryField = STATUTORY_FIELDS.find(f => f.key === fieldKey);
                        let categoryLabel = statutoryField?.label ?? fieldKey;
                        if (fieldKey === 'occupier_idProof') categoryLabel = 'Occupier — ID Proof';
                        else if (fieldKey === 'occupier_addressProof') categoryLabel = 'Occupier — Address Proof';
                        else if (fieldKey === 'manager_idProof') categoryLabel = 'Manager — ID Proof';
                        else if (fieldKey === 'manager_addressProof') categoryLabel = 'Manager — Address Proof';

                        return (
                          <tr key={doc.id} className="hover:bg-accent/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{getFileIcon(doc.type)}</span>
                                <span className="text-sm font-medium truncate max-w-[200px]">{doc.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                                {categoryLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{formatFileSize(doc.size)}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{doc.uploadedAt}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <a
                                  href={doc.dataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <ExternalLink size={12} /> View
                                </a>
                                <button
                                  onClick={() => handleRemoveDoc(fieldKey, doc.id)}
                                  className="flex items-center gap-1 text-xs text-destructive hover:underline"
                                >
                                  <Trash2 size={12} /> Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Save Footer */}
          <div className="flex justify-end gap-3 pt-2 pb-4">
            <button
              onClick={() => {
                setData(d => ({ ...d, linNo: '', epfCodeNo: '', esiCodeNo: '', panNo: '', gstCode: '', tanNo: '', cinNo: '', ptNo: '' }));
                setSaved(false);
                toast.info('Statutory fields cleared.');
              }}
              className="px-5 py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Reset Statutory
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-8 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md font-medium"
            >
              <Save size={18} />
              Save All Changes
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}