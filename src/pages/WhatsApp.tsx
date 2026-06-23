import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Send, Search, Filter, CheckCheck, Check,
  Clock, AlertCircle, Users, Bell, FileText, Calendar,
  DollarSign, CalendarDays, HandCoins, MinusCircle, X,
  RefreshCw, Download, Plus, ChevronDown, ChevronRight,
  Phone, Mail, Building2, MapPin, Eye, Settings2,
  Loader2, CheckCircle2, XCircle, BarChart3, TrendingUp,
  Inbox, MessageSquare, Zap, Shield, Info, Star,
  ArrowRight, Hash, Layers, Tag, Award, User,
  MoreVertical, Paperclip, Image, Smile, Mic,
  Volume2, VolumeX, Wifi, WifiOff, Activity,
  RotateCcw, ExternalLink, Copy, Trash2, Edit3,
  ChevronUp, AlertTriangle, Globe, Smartphone
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { toast } from 'react-toastify';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationCategory =
  | 'payslip'
  | 'leave'
  | 'attendance'
  | 'loan'
  | 'deduction'
  | 'announcement'
  | 'reminder'
  | 'approval';

type DeliveryStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'blocked';

type MessageStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'partial' | 'failed';

interface WhatsAppContact {
  id: string;
  employeeCode: string;
  name: string;
  phone: string; // Mobile Phone No from Establishment Master
  department: string;
  designation: string;
  location: string;
  avatar: string;
  isOptedIn: boolean;
  isBlocked: boolean;
  lastSeen?: string;
  lastMessageAt?: string;
  unreadCount: number;
  deliveryStats: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
}

interface MessageDelivery {
  contactId: string;
  contactName: string;
  phone: string;
  avatar: string;
  status: DeliveryStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorMessage?: string;
  retryCount: number;
}

interface WhatsAppMessage {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  templateId?: string;
  scheduledAt?: string;
  sentAt?: string;
  status: MessageStatus;
  recipientCount: number;
  deliveries: MessageDelivery[];
  createdBy: string;
  createdAt: string;
  attachments?: string[];
  variables?: Record<string, string>;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: NotificationCategory;
  language: string;
  status: 'approved' | 'pending' | 'rejected';
  body: string;
  variables: string[];
  headerType?: 'text' | 'image' | 'document';
  headerContent?: string;
  footer?: string;
  buttons?: { type: 'quick_reply' | 'url'; text: string; url?: string }[];
  usageCount: number;
  lastUsed?: string;
}

interface ConversationMessage {
  id: string;
  direction: 'outbound' | 'inbound';
  body: string;
  status: DeliveryStatus;
  timestamp: string;
  type: 'text' | 'template' | 'document' | 'image';
  templateName?: string;
}

type ActiveView = 'dashboard' | 'compose' | 'messages' | 'templates' | 'contacts' | 'settings' | 'conversation';

// ─── Establishment Master — Mobile Phone Numbers ──────────────────────────────
// Employee mobile phone numbers sourced from Establishment Master data.
// Each employee's WhatsApp number is their registered mobile phone number
// as stored in the Establishment Master / Employee Master records.

const ESTABLISHMENT_EMPLOYEE_PHONES: Record<string, string> = {
  EMP001: '+91 98765 43201', // Sarah Jenkins — from Employee Master
  EMP002: '+91 98765 43202', // Michael Chen — from Employee Master
  EMP003: '+91 98765 43203', // Elena Rodriguez — from Employee Master
  EMP004: '+91 98765 43204', // David Kim — from Employee Master
  EMP005: '+91 98765 43205', // Lisa Thompson — from Employee Master
  EMP006: '+91 98765 43206', // Anita Desai — from Employee Master
  EMP007: '+91 98765 43207', // Rajiv Sharma — from Employee Master
  EMP008: '+91 98765 43208', // Vikram Rao — from Employee Master
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<NotificationCategory, {
  label: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  description: string;
}> = {
  payslip: {
    label: 'Payslip',
    icon: DollarSign,
    color: 'bg-green-100',
    iconColor: 'text-green-600',
    accentBg: 'bg-green-50',
    accentText: 'text-green-700',
    accentBorder: 'border-green-200',
    description: 'Monthly payslip notifications with download link',
  },
  leave: {
    label: 'Leave',
    icon: CalendarDays,
    color: 'bg-blue-100',
    iconColor: 'text-blue-600',
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-700',
    accentBorder: 'border-blue-200',
    description: 'Leave approval, rejection, and balance notifications',
  },
  attendance: {
    label: 'Attendance',
    icon: Clock,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-700',
    accentBorder: 'border-violet-200',
    description: 'Attendance alerts, late arrival, and LOP notifications',
  },
  loan: {
    label: 'Loan',
    icon: HandCoins,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-700',
    accentBorder: 'border-amber-200',
    description: 'Loan approval, EMI reminders, and disbursement alerts',
  },
  deduction: {
    label: 'Deduction',
    icon: MinusCircle,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    accentBg: 'bg-rose-50',
    accentText: 'text-rose-700',
    accentBorder: 'border-rose-200',
    description: 'Deduction approval requests and confirmation',
  },
  announcement: {
    label: 'Announcement',
    icon: Bell,
    color: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    accentBg: 'bg-indigo-50',
    accentText: 'text-indigo-700',
    accentBorder: 'border-indigo-200',
    description: 'Company-wide announcements and policy updates',
  },
  reminder: {
    label: 'Reminder',
    icon: AlertCircle,
    color: 'bg-orange-100',
    iconColor: 'text-orange-600',
    accentBg: 'bg-orange-50',
    accentText: 'text-orange-700',
    accentBorder: 'border-orange-200',
    description: 'Task reminders, deadlines, and follow-up alerts',
  },
  approval: {
    label: 'Approval',
    icon: CheckCircle2,
    color: 'bg-teal-100',
    iconColor: 'text-teal-600',
    accentBg: 'bg-teal-50',
    accentText: 'text-teal-700',
    accentBorder: 'border-teal-200',
    description: 'Approval requests requiring employee acknowledgement',
  },
};

const STATUS_CONFIG: Record<DeliveryStatus, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}> = {
  queued: { label: 'Queued', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200' },
  sending: { label: 'Sending', icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  sent: { label: 'Sent', icon: Check, color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200' },
  delivered: { label: 'Delivered', icon: CheckCheck, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  read: { label: 'Read', icon: CheckCheck, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  failed: { label: 'Failed', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' },
  blocked: { label: 'Blocked', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

// WhatsApp contacts built from Establishment Master mobile phone numbers
// Contacts come from employees with WhatsApp numbers; none until configured.
const SEED_CONTACTS: WhatsAppContact[] = [];

const SEED_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'TPL001',
    name: 'payslip_ready',
    category: 'payslip',
    language: 'en',
    status: 'approved',
    body: 'Dear {{employee_name}},\n\nYour salary slip for *{{pay_period}}* is now available.\n\n💰 *Net Pay:* {{net_pay}}\n📅 *Payment Date:* {{payment_date}}\n\nPlease log in to the Employee Self-Service Portal to view and download your payslip.\n\nRegards,\nHR & Payroll Team\n_Nexus Technologies Pvt. Ltd._',
    variables: ['employee_name', 'pay_period', 'net_pay', 'payment_date'],
    headerType: 'text',
    headerContent: '💰 Payslip Ready',
    footer: 'Nexus Technologies Pvt. Ltd.',
    buttons: [{ type: 'url', text: 'View Payslip', url: 'https://portal.nexus.com/payslip' }],
    usageCount: 154,
    lastUsed: '2025-07-01',
  },
  {
    id: 'TPL002',
    name: 'leave_approved',
    category: 'leave',
    language: 'en',
    status: 'approved',
    body: 'Dear {{employee_name}},\n\nYour leave request has been *✅ Approved*.\n\n📋 *Leave Type:* {{leave_type}}\n📅 *From:* {{from_date}}\n📅 *To:* {{to_date}}\n⏱️ *Duration:* {{days}} day(s)\n\nApproved by: {{approved_by}}\n\nEnjoy your time off!\n\nRegards,\nHR Team',
    variables: ['employee_name', 'leave_type', 'from_date', 'to_date', 'days', 'approved_by'],
    headerType: 'text',
    headerContent: '✅ Leave Approved',
    footer: 'Nexus Technologies Pvt. Ltd.',
    usageCount: 89,
    lastUsed: '2025-07-07',
  },
  {
    id: 'TPL003',
    name: 'leave_rejected',
    category: 'leave',
    language: 'en',
    status: 'approved',
    body: 'Dear {{employee_name}},\n\nYour leave request has been *❌ Rejected*.\n\n📋 *Leave Type:* {{leave_type}}\n📅 *Requested Dates:* {{from_date}} – {{to_date}}\n\n*Reason:* {{rejection_reason}}\n\nFor queries, please contact your manager or HR.\n\nRegards,\nHR Team',
    variables: ['employee_name', 'leave_type', 'from_date', 'to_date', 'rejection_reason'],
    headerType: 'text',
    headerContent: '❌ Leave Rejected',
    footer: 'Nexus Technologies Pvt. Ltd.',
    usageCount: 23,
    lastUsed: '2025-07-05',
  },
  {
    id: 'TPL004',
    name: 'attendance_late',
    category: 'attendance',
    language: 'en',
    status: 'approved',
    body: 'Dear {{employee_name}},\n\nThis is to inform you that your attendance for *{{date}}* has been marked as *⚠️ Late Arrival*.\n\n🕐 *Check-in Time:* {{check_in_time}}\n🕐 *Expected Time:* {{expected_time}}\n⏱️ *Late by:* {{late_by}} minutes\n\nRepeated late arrivals may result in disciplinary action. Please ensure punctuality.\n\nRegards,\nHR Team',
    variables: ['employee_name', 'date', 'check_in_time', 'expected_time', 'late_by'],
    headerType: 'text',
    headerContent: '⚠️ Late Arrival Alert',
    footer: 'Nexus Technologies Pvt. Ltd.',
    usageCount: 45,
    lastUsed: '2025-07-07',
  },
  {
    id: 'TPL005',
    name: 'loan_approved',
    category: 'loan',
    language: 'en',
    status: 'approved',
    body: 'Dear {{employee_name}},\n\nYour loan application has been *✅ Approved*!\n\n💰 *Loan Type:* {{loan_type}}\n💵 *Amount:* {{loan_amount}}\n📅 *Disbursement Date:* {{disbursement_date}}\n📆 *Monthly EMI:* {{emi_amount}}\n⏱️ *Tenure:* {{tenure}} months\n\nThe amount will be credited to your registered bank account.\n\nRegards,\nHR & Finance Team',
    variables: ['employee_name', 'loan_type', 'loan_amount', 'disbursement_date', 'emi_amount', 'tenure'],
    headerType: 'text',
    headerContent: '✅ Loan Approved',
    footer: 'Nexus Technologies Pvt. Ltd.',
    usageCount: 12,
    lastUsed: '2025-07-03',
  },
  {
    id: 'TPL006',
    name: 'deduction_approval_request',
    category: 'deduction',
    language: 'en',
    status: 'approved',
    body: 'Dear {{employee_name}},\n\nA deduction has been raised for your approval:\n\n📋 *Category:* {{deduction_category}}\n📝 *Description:* {{description}}\n💰 *Amount:* {{amount}}\n📅 *Payroll Period:* {{payroll_period}}\n🔖 *Reference:* {{reference_no}}\n\nPlease log in to the Self-Service Portal to *Approve* or *Reject* this deduction.\n\n⚠️ _This deduction will be applied to your payroll only after your approval._\n\nRegards,\nHR Team',
    variables: ['employee_name', 'deduction_category', 'description', 'amount', 'payroll_period', 'reference_no'],
    headerType: 'text',
    headerContent: '⚠️ Deduction Approval Required',
    footer: 'Nexus Technologies Pvt. Ltd.',
    buttons: [
      { type: 'url', text: 'Review & Respond', url: 'https://portal.nexus.com/approvals' },
    ],
    usageCount: 34,
    lastUsed: '2025-07-07',
  },
  {
    id: 'TPL007',
    name: 'emi_reminder',
    category: 'loan',
    language: 'en',
    status: 'approved',
    body: 'Dear {{employee_name}},\n\nThis is a reminder that your loan EMI is due for deduction:\n\n💰 *Loan Type:* {{loan_type}}\n📆 *EMI Amount:* {{emi_amount}}\n📅 *Deduction Date:* {{deduction_date}}\n🔢 *EMI No.:* {{emi_number}} of {{total_emis}}\n💵 *Outstanding Balance:* {{outstanding_balance}}\n\nThe EMI will be automatically deducted from your salary.\n\nRegards,\nFinance Team',
    variables: ['employee_name', 'loan_type', 'emi_amount', 'deduction_date', 'emi_number', 'total_emis', 'outstanding_balance'],
    headerType: 'text',
    headerContent: '📆 EMI Reminder',
    footer: 'Nexus Technologies Pvt. Ltd.',
    usageCount: 67,
    lastUsed: '2025-07-01',
  },
  {
    id: 'TPL008',
    name: 'company_announcement',
    category: 'announcement',
    language: 'en',
    status: 'approved',
    body: '📢 *{{announcement_title}}*\n\nDear Team,\n\n{{announcement_body}}\n\n📅 *Effective Date:* {{effective_date}}\n\nFor queries, please contact HR.\n\nRegards,\nManagement\n_Nexus Technologies Pvt. Ltd._',
    variables: ['announcement_title', 'announcement_body', 'effective_date'],
    headerType: 'text',
    headerContent: '📢 Company Announcement',
    footer: 'Nexus Technologies Pvt. Ltd.',
    usageCount: 8,
    lastUsed: '2025-07-05',
  },
];

function generateDeliveries(contacts: WhatsAppContact[], status?: DeliveryStatus): MessageDelivery[] {
  return contacts.filter(c => c.isOptedIn).map(c => {
    const baseStatus: DeliveryStatus = c.isBlocked ? 'blocked' : (status ?? (Math.random() > 0.1 ? 'read' : 'failed'));
    const now = new Date();
    const sentAt = formatDateTime(new Date(now.getTime() - Math.random() * 3600000));
    const deliveredAt = baseStatus !== 'failed' && baseStatus !== 'blocked' ? formatDateTime(new Date(now.getTime() - Math.random() * 1800000)) : undefined;
    const readAt = baseStatus === 'read' ? formatDateTime(new Date(now.getTime() - Math.random() * 900000)) : undefined;
    return {
      contactId: c.id,
      contactName: c.name,
      phone: c.phone, // Uses mobile phone from Establishment Master
      avatar: c.avatar,
      status: baseStatus,
      sentAt,
      deliveredAt,
      readAt,
      errorMessage: baseStatus === 'failed' ? 'Message delivery failed — phone unreachable' : baseStatus === 'blocked' ? 'Employee has opted out of WhatsApp notifications' : undefined,
      retryCount: baseStatus === 'failed' ? Math.floor(Math.random() * 3) : 0,
    };
  });
}

// Sent broadcasts/messages load from the DB; empty until any are sent.
const SEED_MESSAGES: WhatsAppMessage[] = [];

// Conversations load from the DB; empty until messages are exchanged.
const SEED_CONVERSATIONS: Record<string, ConversationMessage[]> = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDeliveryStats(deliveries: MessageDelivery[]) {
  return {
    total: deliveries.length,
    sent: deliveries.filter(d => ['sent', 'delivered', 'read'].includes(d.status)).length,
    delivered: deliveries.filter(d => ['delivered', 'read'].includes(d.status)).length,
    read: deliveries.filter(d => d.status === 'read').length,
    failed: deliveries.filter(d => d.status === 'failed').length,
    blocked: deliveries.filter(d => d.status === 'blocked').length,
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

// ─── Delivery Status Badge ────────────────────────────────────────────────────

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const DeliveryStatusBadge = ({ status, showLabel = true, size = 'md' }: DeliveryStatusBadgeProps) => {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 10 : 12;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.bg} ${config.color} ${config.border}`}>
      <Icon size={iconSize} className={status === 'sending' ? 'animate-spin' : status === 'read' ? 'text-green-600' : status === 'delivered' ? 'text-blue-600' : ''} />
      {showLabel && config.label}
    </span>
  );
};

// ─── WhatsApp Message Bubble ──────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ConversationMessage;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isOutbound = message.direction === 'outbound';
  const statusConfig = STATUS_CONFIG[message.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] ${isOutbound ? 'order-2' : 'order-1'}`}>
        {message.templateName && (
          <div className={`text-[10px] font-bold mb-1 flex items-center gap-1 ${isOutbound ? 'text-right justify-end' : 'text-left'} text-muted-foreground`}>
            <Zap size={9} /> Template: {message.templateName}
          </div>
        )}
        <div className={`rounded-2xl px-4 py-3 shadow-sm ${
          isOutbound
            ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-sm'
            : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
        }`}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body}</p>
          <div className={`flex items-center gap-1 mt-1.5 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-gray-400">{message.timestamp.split(' ')[1]}</span>
            {isOutbound && (
              <StatusIcon
                size={12}
                className={
                  message.status === 'read' ? 'text-blue-500' :
                  message.status === 'delivered' ? 'text-gray-400' :
                  'text-gray-300'
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Conversation View ────────────────────────────────────────────────────────

interface ConversationViewProps {
  contact: WhatsAppContact;
  messages: ConversationMessage[];
  onBack: () => void;
}

const ConversationView = ({ contact, messages, onBack }: ConversationViewProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const readCount = messages.filter(m => m.direction === 'outbound' && m.status === 'read').length;
  const deliveredCount = messages.filter(m => m.direction === 'outbound' && m.status === 'delivered').length;

  return (
    <div className="flex flex-col h-full bg-[#efeae2]">
      {/* Chat Header */}
      <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm shrink-0">
          {contact.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{contact.name}</p>
          {/* Phone number from Establishment Master */}
          <p className="text-[11px] text-green-200 flex items-center gap-1">
            <Phone size={10} /> {contact.phone}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-green-200">
          <span className="flex items-center gap-1"><CheckCheck size={12} className="text-blue-300" /> {readCount} read</span>
          <span className="flex items-center gap-1"><CheckCheck size={12} /> {deliveredCount} delivered</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle size={32} className="text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No messages yet</p>
          </div>
        ) : (
          messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#f0f0f0] px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center gap-2 shadow-sm">
          <Smile size={20} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Type a message"
            className="flex-1 outline-none text-sm bg-transparent"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          />
          <Paperclip size={18} className="text-gray-400 shrink-0" />
        </div>
        <button
          className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-all bg-[#075e54] text-white"
          onClick={() => {
            if (newMessage.trim()) {
              toast.info('Outbound messaging from HR portal is for template messages only. Use Compose to send notifications.');
              setNewMessage('');
            }
          }}
        >
          {newMessage.trim() ? <Send size={18} /> : <Mic size={18} />}
        </button>
      </div>
    </div>
  );
};

// ─── Compose Message Modal ────────────────────────────────────────────────────

interface ComposeModalProps {
  templates: WhatsAppTemplate[];
  contacts: WhatsAppContact[];
  onSend: (message: Omit<WhatsAppMessage, 'id' | 'createdAt' | 'deliveries'>) => void;
  onClose: () => void;
}

const ComposeModal = ({ templates, contacts, onSend, onClose }: ComposeModalProps) => {
  const [step, setStep] = useState<'template' | 'recipients' | 'preview' | 'sending' | 'done'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [scheduleAt, setScheduleAt] = useState('');
  const [sendProgress, setSendProgress] = useState(0);
  const [contactSearch, setContactSearch] = useState('');

  const filteredTemplates = templates.filter(t =>
    selectedCategory === 'all' || t.category === selectedCategory
  );

  // Only opted-in, non-blocked employees with valid mobile numbers from Establishment Master
  const filteredContacts = contacts.filter(c =>
    c.isOptedIn && !c.isBlocked &&
    (c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
     c.department.toLowerCase().includes(contactSearch.toLowerCase()) ||
     c.phone.includes(contactSearch))
  );

  const toggleContact = (id: string) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const previewBody = selectedTemplate ? selectedTemplate.body.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `[${key}]`) : '';

  const handleSend = () => {
    if (!selectedTemplate) return;
    setStep('sending');
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setSendProgress(100);
        setTimeout(() => {
          setStep('done');
          onSend({
            category: selectedTemplate.category,
            title: selectedTemplate.headerContent ?? selectedTemplate.name,
            body: previewBody,
            templateId: selectedTemplate.id,
            sentAt: new Date().toLocaleString('en-IN'),
            status: 'sent',
            recipientCount: selectedContacts.length,
            createdBy: 'Admin',
            variables,
          });
        }, 500);
      }
      setSendProgress(Math.min(progress, 100));
    }, 200);
  };

  const steps = [
    { key: 'template', label: 'Template', num: 1 },
    { key: 'recipients', label: 'Recipients', num: 2 },
    { key: 'preview', label: 'Preview', num: 3 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-[#075e54] to-[#128c7e]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Compose WhatsApp Notification</h2>
              <p className="text-xs text-green-200">Send template-based notifications to employees via their registered mobile numbers</p>
            </div>
          </div>
          {step !== 'sending' && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Step Indicator */}
        {!['sending', 'done'].includes(step) && (
          <div className="flex items-center gap-0 px-6 pt-4 pb-0">
            {steps.map((s, i) => {
              const isActive = step === s.key;
              const isDone = (step === 'recipients' && s.key === 'template') || (step === 'preview' && s.key !== 'preview');
              return (
                <React.Fragment key={s.key}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isActive ? 'bg-[#075e54] text-white' : isDone ? 'bg-green-500 text-white' : 'bg-accent text-muted-foreground'}`}>
                      {isDone ? <CheckCircle2 size={14} /> : s.num}
                    </div>
                    <span className={`text-xs font-semibold ${isActive ? 'text-[#075e54]' : isDone ? 'text-green-600' : 'text-muted-foreground'}`}>{s.label}</span>
                  </div>
                  {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-border mx-3" />}
                </React.Fragment>
              );
            })}
          </div>
        )}

        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {/* Step 1: Template Selection */}
          {step === 'template' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setSelectedCategory('all')} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedCategory === 'all' ? 'bg-[#075e54] text-white border-[#075e54]' : 'bg-accent text-muted-foreground border-border hover:border-[#075e54]/40'}`}>
                  All ({templates.length})
                </button>
                {(Object.keys(CATEGORY_CONFIG) as NotificationCategory[]).map(cat => {
                  const count = templates.filter(t => t.category === cat).length;
                  if (count === 0) return null;
                  const cfg = CATEGORY_CONFIG[cat];
                  const Icon = cfg.icon;
                  return (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedCategory === cat ? `${cfg.accentBg} ${cfg.accentText} ${cfg.accentBorder} ring-1 ring-offset-1 ring-current` : `${cfg.accentBg} ${cfg.accentText} ${cfg.accentBorder} hover:opacity-80`}`}>
                      <Icon size={11} /> {cfg.label} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                {filteredTemplates.map(template => {
                  const cfg = CATEGORY_CONFIG[template.category];
                  const Icon = cfg.icon;
                  const isSelected = selectedTemplate?.id === template.id;
                  return (
                    <button key={template.id} onClick={() => { setSelectedTemplate(template); setVariables({}); }} className={`w-full flex items-start gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${isSelected ? `${cfg.accentBg} ${cfg.accentBorder} shadow-sm` : 'border-border bg-card hover:border-[#075e54]/30'}`}>
                      <div className={`p-2.5 ${cfg.color} rounded-xl shrink-0`}>
                        <Icon size={18} className={cfg.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-sm">{template.headerContent ?? template.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.accentBg} ${cfg.accentText} ${cfg.accentBorder}`}>{cfg.label}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${template.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>{template.status}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{template.body.replace(/\*|_/g, '').substring(0, 120)}...</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span>{template.variables.length} variables</span>
                          <span>Used {template.usageCount} times</span>
                          {template.lastUsed && <span>Last: {formatDate(template.lastUsed)}</span>}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 size={18} className="text-[#075e54] shrink-0 mt-1" />}
                    </button>
                  );
                })}
              </div>

              {/* Variables */}
              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div className="p-4 bg-accent/30 rounded-xl border border-border space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Fill Template Variables</p>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedTemplate.variables.map(variable => (
                      <Field key={variable} label={variable.replace(/_/g, ' ')}>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder={`Enter ${variable.replace(/_/g, ' ')}`}
                          value={variables[variable] ?? ''}
                          onChange={e => setVariables(prev => ({ ...prev, [variable]: e.target.value }))}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2: Recipients */}
          {step === 'recipients' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <Info size={16} className="text-green-600 shrink-0 mt-0.5" />
                <div className="text-xs text-green-700">
                  <p className="font-semibold mb-0.5">Mobile Numbers from Establishment Master</p>
                  <p>WhatsApp messages are sent to each employee's registered mobile phone number as stored in the Establishment Master. Only opted-in employees with valid mobile numbers are shown.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" placeholder="Search by name, department, or phone..." className="w-full pl-9 pr-4 py-2.5 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm" value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
                </div>
                <button onClick={toggleAll} className="px-4 py-2.5 border border-border rounded-xl text-xs font-semibold hover:bg-accent transition-colors text-muted-foreground whitespace-nowrap">
                  {selectedContacts.length === filteredContacts.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredContacts.map(contact => {
                  const isSelected = selectedContacts.includes(contact.id);
                  return (
                    <motion.div key={contact.id} whileHover={{ x: 2 }} onClick={() => toggleContact(contact.id)} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[#075e54] bg-green-50' : 'border-border bg-card hover:border-[#075e54]/30'}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => {}} className="rounded border-border shrink-0" />
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{contact.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{contact.name}</p>
                        <p className="text-[10px] text-muted-foreground">{contact.department}</p>
                      </div>
                      {/* Mobile phone from Establishment Master */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Phone size={10} className="text-[#075e54]" />
                          <span className="font-mono font-semibold text-[#075e54]">{contact.phone}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-green-600 justify-end mt-0.5">
                          <CheckCheck size={11} /> {contact.deliveryStats.read} read
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 px-4 py-3 bg-accent/30 rounded-xl border border-border">
                <Users size={15} className="text-primary shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{selectedContacts.length}</strong> recipient{selectedContacts.length !== 1 ? 's' : ''} selected · Messages will be sent to their Establishment Master mobile numbers
                </p>
              </div>

              <Field label="Schedule (Optional)" hint="Leave blank to send immediately">
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="datetime-local" className={`${inputCls} pl-9`} value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
                </div>
              </Field>
            </motion.div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && selectedTemplate && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                  <p className="text-2xl font-bold text-green-700">{selectedContacts.length}</p>
                  <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide">Recipients</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <p className="text-sm font-bold text-blue-700">{selectedTemplate.headerContent ?? selectedTemplate.name}</p>
                  <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Template</p>
                </div>
              </div>

              {/* Recipient phone numbers preview */}
              {selectedContacts.length > 0 && (
                <div className="p-4 bg-accent/30 rounded-xl border border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Phone size={11} className="text-[#075e54]" /> Sending to (Establishment Master Mobile Numbers)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedContacts.slice(0, 6).map(id => {
                      const contact = SEED_CONTACTS.find(c => c.id === id);
                      if (!contact) return null;
                      return (
                        <div key={id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-border rounded-lg">
                          <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[9px] shrink-0">{contact.avatar}</div>
                          <div>
                            <p className="text-[10px] font-semibold">{contact.name}</p>
                            <p className="text-[9px] text-[#075e54] font-mono">{contact.phone}</p>
                          </div>
                        </div>
                      );
                    })}
                    {selectedContacts.length > 6 && (
                      <div className="flex items-center px-2.5 py-1.5 bg-accent rounded-lg">
                        <span className="text-[10px] text-muted-foreground">+{selectedContacts.length - 6} more</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* WhatsApp Preview */}
              <div className="bg-[#efeae2] rounded-xl overflow-hidden border border-gray-200">
                <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">HR</div>
                  <div>
                    <p className="font-bold text-sm">Nexus Technologies HR</p>
                    <p className="text-[10px] text-green-200">Business Account</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%]">
                    {selectedTemplate.headerContent && (
                      <p className="font-bold text-sm text-gray-800 mb-2 pb-2 border-b border-gray-100">{selectedTemplate.headerContent}</p>
                    )}
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{previewBody}</p>
                    {selectedTemplate.footer && (
                      <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">{selectedTemplate.footer}</p>
                    )}
                    {selectedTemplate.buttons && selectedTemplate.buttons.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {selectedTemplate.buttons.map((btn, i) => (
                          <div key={i} className="flex items-center justify-center gap-2 py-2 border-t border-gray-100 text-[#075e54] text-sm font-semibold">
                            {btn.type === 'url' ? <ExternalLink size={14} /> : <MessageSquare size={14} />}
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-gray-400">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <CheckCheck size={12} className="text-gray-300" />
                    </div>
                  </div>
                </div>
              </div>

              {scheduleAt && (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <Calendar size={15} className="text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700">Scheduled for: <strong>{new Date(scheduleAt).toLocaleString('en-IN')}</strong></p>
                </div>
              )}
            </motion.div>
          )}

          {/* Sending Progress */}
          {step === 'sending' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 space-y-5">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <MessageCircle size={32} className="text-[#075e54]" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Sending Messages...</h3>
                <p className="text-sm text-muted-foreground mt-1">Dispatching to {selectedContacts.length} recipients via WhatsApp Business API</p>
                <p className="text-xs text-muted-foreground mt-0.5">Using mobile numbers from Establishment Master</p>
              </div>
              <div className="w-full bg-accent rounded-full h-3 overflow-hidden">
                <motion.div
                  className="h-full bg-[#075e54] rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${sendProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-sm font-semibold text-[#075e54]">{Math.round(sendProgress)}% complete</p>
            </motion.div>
          )}

          {/* Done */}
          {step === 'done' && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-5">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </motion.div>
              <div>
                <h3 className="text-lg font-bold text-green-800">Messages Sent!</h3>
                <p className="text-sm text-muted-foreground mt-1">WhatsApp notifications dispatched to {selectedContacts.length} employees via their Establishment Master mobile numbers.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Sent', value: selectedContacts.length, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                  { label: 'Delivered', value: Math.round(selectedContacts.length * 0.95), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Pending Read', value: Math.round(selectedContacts.length * 0.05), color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                ].map(card => (
                  <div key={card.label} className={`p-3 rounded-xl border ${card.bg} text-center`}>
                    <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                    <p className={`text-[10px] font-medium ${card.color} uppercase tracking-wide`}>{card.label}</p>
                  </div>
                ))}
              </div>
              <button onClick={onClose} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#075e54] text-white rounded-xl font-semibold text-sm hover:bg-[#064e45] transition-colors shadow-md mx-auto">
                <CheckCheck size={16} /> Done
              </button>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        {!['sending', 'done'].includes(step) && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-accent/10">
            <button
              onClick={step === 'template' ? onClose : () => setStep(step === 'recipients' ? 'template' : 'recipients')}
              className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {step === 'template' ? 'Cancel' : '← Back'}
            </button>
            <button
              onClick={() => {
                if (step === 'template') {
                  if (!selectedTemplate) { toast.error('Please select a template.'); return; }
                  setStep('recipients');
                } else if (step === 'recipients') {
                  if (selectedContacts.length === 0) { toast.error('Please select at least one recipient.'); return; }
                  setStep('preview');
                } else if (step === 'preview') {
                  handleSend();
                }
              }}
              className="flex items-center gap-2 px-6 py-2 bg-[#075e54] text-white text-sm font-medium rounded-xl hover:bg-[#064e45] transition-colors shadow-md"
            >
              {step === 'preview' ? (
                <><Send size={15} /> {scheduleAt ? 'Schedule' : 'Send Now'}</>
              ) : (
                <>Next →</>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ─── Message Detail Modal ─────────────────────────────────────────────────────

interface MessageDetailModalProps {
  message: WhatsAppMessage;
  onClose: () => void;
  onRetry: (deliveryId: string) => void;
}

const MessageDetailModal = ({ message, onClose, onRetry }: MessageDetailModalProps) => {
  const stats = getDeliveryStats(message.deliveries);
  const cfg = CATEGORY_CONFIG[message.category];
  const Icon = cfg.icon;
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');

  const filteredDeliveries = message.deliveries.filter(d =>
    statusFilter === 'all' || d.status === statusFilter
  );

  const readPct = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;
  const deliveredPct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-border ${cfg.accentBg}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 ${cfg.color} rounded-xl`}>
              <Icon size={18} className={cfg.iconColor} />
            </div>
            <div>
              <h2 className={`text-base font-bold ${cfg.accentText}`}>{message.title}</h2>
              <p className={`text-xs ${cfg.accentText} opacity-70`}>{message.sentAt} · {message.recipientCount} recipients</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/50 text-muted-foreground transition-colors"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Sent', value: stats.sent, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: Check },
              { label: 'Delivered', value: stats.delivered, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: CheckCheck },
              { label: 'Read', value: stats.read, color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCheck },
              { label: 'Failed', value: stats.failed + stats.blocked, color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
            ].map(card => {
              const CardIcon = card.icon;
              return (
                <div key={card.label} className={`p-4 rounded-xl border ${card.bg} text-center`}>
                  <div className="flex items-center justify-center mb-1">
                    <CardIcon size={16} className={card.color} />
                  </div>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className={`text-[10px] font-medium ${card.color} uppercase tracking-wide`}>{card.label}</p>
                </div>
              );
            })}
          </div>

          {/* Progress Bars */}
          <div className="space-y-3 p-4 bg-accent/30 rounded-xl border border-border">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-blue-700 flex items-center gap-1"><CheckCheck size={12} /> Delivered</span>
                <span className="text-xs font-bold text-blue-700">{deliveredPct}%</span>
              </div>
              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${deliveredPct}%` }} transition={{ duration: 0.8 }} className="h-full bg-blue-500 rounded-full" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-green-700 flex items-center gap-1"><CheckCheck size={12} /> Read</span>
                <span className="text-xs font-bold text-green-700">{readPct}%</span>
              </div>
              <div className="w-full h-2 bg-green-100 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${readPct}%` }} transition={{ duration: 0.8, delay: 0.2 }} className="h-full bg-green-500 rounded-full" />
              </div>
            </div>
          </div>

          {/* Message Body */}
          <div className="p-4 bg-[#efeae2] rounded-xl">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">Message Preview</p>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%]">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{message.body}</p>
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[10px] text-gray-400">{message.sentAt?.split(' ')[1]}</span>
                <CheckCheck size={12} className="text-green-500" />
              </div>
            </div>
          </div>

          {/* Delivery List */}
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Delivery Status per Employee</p>
              <div className="flex flex-wrap gap-1.5 ml-auto">
                {(['all', 'read', 'delivered', 'sent', 'failed', 'blocked'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${statusFilter === s ? 'bg-[#075e54] text-white border-[#075e54]' : 'bg-accent text-muted-foreground border-border hover:border-[#075e54]/40'}`}>
                    {s === 'all' ? `All (${message.deliveries.length})` : `${STATUS_CONFIG[s].label} (${message.deliveries.filter(d => d.status === s).length})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredDeliveries.map((delivery, i) => (
                <motion.div key={delivery.contactId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 px-4 py-3 bg-accent/20 rounded-xl border border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{delivery.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{delivery.contactName}</p>
                    {/* Phone from Establishment Master */}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Phone size={9} className="text-[#075e54]" />
                      <span className="font-mono">{delivery.phone}</span>
                    </p>
                    {delivery.errorMessage && <p className="text-[10px] text-red-600 mt-0.5">{delivery.errorMessage}</p>}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <DeliveryStatusBadge status={delivery.status} />
                    {delivery.readAt && <p className="text-[10px] text-green-600">Read {delivery.readAt.split(' ')[1]}</p>}
                    {delivery.deliveredAt && !delivery.readAt && <p className="text-[10px] text-blue-600">Delivered {delivery.deliveredAt.split(' ')[1]}</p>}
                  </div>
                  {(delivery.status === 'failed') && (
                    <button onClick={() => onRetry(delivery.contactId)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Retry">
                      <RotateCcw size={14} />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WhatsApp() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [messages, setMessages] = useState<WhatsAppMessage[]>(SEED_MESSAGES);
  const [contacts] = useState<WhatsAppContact[]>(SEED_CONTACTS);
  const [templates] = useState<WhatsAppTemplate[]>(SEED_TEMPLATES);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessage | null>(null);
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [conversations] = useState<Record<string, ConversationMessage[]>>(SEED_CONVERSATIONS);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [isConnected] = useState(true);

  // Stats
  const totalSent = messages.reduce((s, m) => s + m.recipientCount, 0);
  const totalDelivered = messages.reduce((s, m) => s + m.deliveries.filter(d => ['delivered', 'read'].includes(d.status)).length, 0);
  const totalRead = messages.reduce((s, m) => s + m.deliveries.filter(d => d.status === 'read').length, 0);
  const totalFailed = messages.reduce((s, m) => s + m.deliveries.filter(d => d.status === 'failed').length, 0);
  const optedInCount = contacts.filter(c => c.isOptedIn && !c.isBlocked).length;
  const readRate = totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0;
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

  const filteredMessages = useMemo(() =>
    messages.filter(m => {
      const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) || m.body.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'all' || m.category === categoryFilter;
      return matchSearch && matchCat;
    }),
    [messages, search, categoryFilter]
  );

  const filteredContacts = useMemo(() =>
    contacts.filter(c =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.department.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone.includes(contactSearch)
    ),
    [contacts, contactSearch]
  );

  const handleSendMessage = (msgData: Omit<WhatsAppMessage, 'id' | 'createdAt' | 'deliveries'>) => {
    const selectedContactObjs = contacts.filter(c => c.isOptedIn && !c.isBlocked);
    const newMsg: WhatsAppMessage = {
      ...msgData,
      id: `MSG${String(messages.length + 1).padStart(3, '0')}`,
      createdAt: formatDateTime(new Date()),
      deliveries: generateDeliveries(selectedContactObjs, 'delivered'),
    };
    setMessages(prev => [newMsg, ...prev]);
    toast.success(`WhatsApp notification sent to ${msgData.recipientCount} employees via their Establishment Master mobile numbers!`);
  };

  const handleRetry = (deliveryId: string) => {
    if (!selectedMessage) return;
    setMessages(prev => prev.map(m =>
      m.id === selectedMessage.id
        ? {
            ...m,
            deliveries: m.deliveries.map(d =>
              d.contactId === deliveryId ? { ...d, status: 'sending' as DeliveryStatus } : d
            ),
          }
        : m
    ));
    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === selectedMessage.id
          ? {
              ...m,
              deliveries: m.deliveries.map(d =>
                d.contactId === deliveryId ? { ...d, status: 'delivered' as DeliveryStatus, deliveredAt: formatDateTime(new Date()) } : d
              ),
            }
          : m
      ));
      toast.success('Message resent successfully!');
    }, 2000);
  };

  const navItems: { key: ActiveView; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'compose', label: 'Compose', icon: Edit3 },
    { key: 'messages', label: 'Messages', icon: Inbox, badge: messages.filter(m => m.status === 'sending').length || undefined },
    { key: 'contacts', label: 'Contacts', icon: Users },
    { key: 'templates', label: 'Templates', icon: Layers },
    { key: 'settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#075e54] rounded-lg">
                <MessageCircle size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-serif">WhatsApp Notifications</h1>
                <p className="text-xs text-muted-foreground">Send HR notifications via WhatsApp using employee mobile numbers from Establishment Master.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${isConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <button
                onClick={() => setShowCompose(true)}
                className="flex items-center gap-2 px-5 py-2 bg-[#075e54] text-white rounded-lg hover:bg-[#064e45] transition-colors shadow-md text-sm font-medium"
              >
                <Send size={15} /> Send Notification
              </button>
            </div>
          </div>

          {/* Sub Nav */}
          <div className="flex items-center gap-1 mt-3 overflow-x-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeView === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => { setActiveView(item.key); if (item.key === 'compose') setShowCompose(true); }}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${isActive ? 'bg-[#075e54] text-white shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                >
                  <Icon size={15} />
                  {item.label}
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <AnimatePresence mode="wait">

            {/* ── Dashboard ── */}
            {activeView === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                {/* Establishment Master Phone Info Banner */}
                <div className="flex items-start gap-3 p-4 bg-[#075e54]/5 border border-[#075e54]/20 rounded-xl">
                  <Phone size={17} className="text-[#075e54] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#075e54]">Mobile Numbers from Establishment Master</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      All WhatsApp notifications are sent to employee mobile phone numbers as registered in the <strong>Establishment Master</strong>. Ensure mobile numbers are up-to-date in the employee records for accurate delivery.
                    </p>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Sent', value: totalSent, sub: 'All time', color: 'bg-[#075e54]/10', iconColor: 'text-[#075e54]', icon: Send },
                    { label: 'Delivered', value: `${deliveryRate}%`, sub: `${totalDelivered} messages`, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: CheckCheck },
                    { label: 'Read Rate', value: `${readRate}%`, sub: `${totalRead} read`, color: 'bg-green-100', iconColor: 'text-green-600', icon: Eye },
                    { label: 'Failed', value: totalFailed, sub: 'Delivery failures', color: 'bg-red-100', iconColor: 'text-red-600', icon: AlertCircle },
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

                {/* Connection Status + Opt-in Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-[#075e54]/10 rounded-lg"><Smartphone size={18} className="text-[#075e54]" /></div>
                      <h3 className="font-bold text-sm">WhatsApp Business API</h3>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Status', value: 'Connected', color: 'text-green-600' },
                        { label: 'Business Phone', value: '+91 22 4000 1000', color: 'text-foreground' },
                        { label: 'Business Name', value: 'Nexus Technologies HR', color: 'text-foreground' },
                        { label: 'Quality Rating', value: 'High ⭐⭐⭐', color: 'text-amber-600' },
                        { label: 'Daily Limit', value: '1,000 messages', color: 'text-foreground' },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className={`font-semibold ${row.color}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-100 rounded-lg"><Users size={18} className="text-green-600" /></div>
                      <h3 className="font-bold text-sm">Employee Opt-in Status</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Opted In</span>
                        <span className="font-bold text-green-600">{optedInCount}</span>
                      </div>
                      <div className="w-full h-3 bg-accent rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${(optedInCount / contacts.length) * 100}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm font-bold text-green-700">{optedInCount}</p>
                          <p className="text-[10px] text-green-600">Opted In</p>
                        </div>
                        <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm font-bold text-gray-600">{contacts.filter(c => !c.isOptedIn).length}</p>
                          <p className="text-[10px] text-gray-500">Not Opted</p>
                        </div>
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm font-bold text-red-600">{contacts.filter(c => c.isBlocked).length}</p>
                          <p className="text-[10px] text-red-500">Blocked</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-violet-100 rounded-lg"><Activity size={18} className="text-violet-600" /></div>
                      <h3 className="font-bold text-sm">Category Breakdown</h3>
                    </div>
                    <div className="space-y-2">
                      {(Object.keys(CATEGORY_CONFIG) as NotificationCategory[]).map(cat => {
                        const count = messages.filter(m => m.category === cat).length;
                        if (count === 0) return null;
                        const cfg = CATEGORY_CONFIG[cat];
                        const Icon = cfg.icon;
                        return (
                          <div key={cat} className="flex items-center gap-2">
                            <div className={`p-1.5 ${cfg.color} rounded-lg shrink-0`}><Icon size={12} className={cfg.iconColor} /></div>
                            <span className="text-xs flex-1">{cfg.label}</span>
                            <span className="text-xs font-bold text-primary">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Recent Messages */}
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageCircle size={16} className="text-[#075e54]" />
                      <h3 className="font-bold text-sm">Recent Notifications</h3>
                    </div>
                    <button onClick={() => setActiveView('messages')} className="text-xs font-semibold text-[#075e54] hover:underline">View All →</button>
                  </div>
                  <div className="divide-y divide-border">
                    {messages.slice(0, 5).map((msg, i) => {
                      const cfg = CATEGORY_CONFIG[msg.category];
                      const Icon = cfg.icon;
                      const stats = getDeliveryStats(msg.deliveries);
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-4 px-6 py-4 hover:bg-accent/20 transition-colors cursor-pointer group" onClick={() => setSelectedMessage(msg)}>
                          <div className={`p-2.5 ${cfg.color} rounded-xl shrink-0`}><Icon size={18} className={cfg.iconColor} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{msg.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{msg.body.substring(0, 80)}...</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{msg.sentAt} · {msg.recipientCount} recipients</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-center">
                              <p className="text-sm font-bold text-green-600">{stats.read}</p>
                              <p className="text-[9px] text-muted-foreground">Read</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-blue-600">{stats.delivered}</p>
                              <p className="text-[9px] text-muted-foreground">Delivered</p>
                            </div>
                            {stats.failed > 0 && (
                              <div className="text-center">
                                <p className="text-sm font-bold text-red-600">{stats.failed}</p>
                                <p className="text-[9px] text-muted-foreground">Failed</p>
                              </div>
                            )}
                            <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Messages ── */}
            {activeView === 'messages' && (
              <motion.div key="messages" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
                {/* Filters */}
                <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input type="text" placeholder="Search messages..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)}>
                    <option value="all">All Categories</option>
                    {(Object.keys(CATEGORY_CONFIG) as NotificationCategory[]).map(cat => (
                      <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>
                    ))}
                  </select>
                  <div className="ml-auto text-xs text-muted-foreground">{filteredMessages.length} messages</div>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setCategoryFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${categoryFilter === 'all' ? 'bg-[#075e54] text-white border-[#075e54]' : 'bg-accent text-muted-foreground border-border hover:border-[#075e54]/40'}`}>
                    All ({messages.length})
                  </button>
                  {(Object.keys(CATEGORY_CONFIG) as NotificationCategory[]).map(cat => {
                    const count = messages.filter(m => m.category === cat).length;
                    if (count === 0) return null;
                    const cfg = CATEGORY_CONFIG[cat];
                    const Icon = cfg.icon;
                    return (
                      <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${categoryFilter === cat ? `${cfg.accentBg} ${cfg.accentText} ${cfg.accentBorder} ring-2 ring-offset-1 ring-current` : `${cfg.accentBg} ${cfg.accentText} ${cfg.accentBorder} hover:opacity-80`}`}>
                        <Icon size={11} /> {cfg.label} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Messages List */}
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Message</th>
                          <th className="px-4 py-3 font-semibold">Category</th>
                          <th className="px-4 py-3 font-semibold">Sent At</th>
                          <th className="px-4 py-3 font-semibold text-center">Recipients</th>
                          <th className="px-4 py-3 font-semibold text-center text-blue-700">Delivered</th>
                          <th className="px-4 py-3 font-semibold text-center text-green-700">Read</th>
                          <th className="px-4 py-3 font-semibold text-center text-red-700">Failed</th>
                          <th className="px-4 py-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredMessages.map((msg, i) => {
                          const cfg = CATEGORY_CONFIG[msg.category];
                          const Icon = cfg.icon;
                          const stats = getDeliveryStats(msg.deliveries);
                          const readPct = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;
                          return (
                            <motion.tr key={msg.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors group cursor-pointer" onClick={() => setSelectedMessage(msg)}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 ${cfg.color} rounded-lg shrink-0`}><Icon size={14} className={cfg.iconColor} /></div>
                                  <div>
                                    <p className="font-semibold text-sm">{msg.title}</p>
                                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{msg.body.substring(0, 60)}...</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.accentBg} ${cfg.accentText} ${cfg.accentBorder}`}>
                                  <Icon size={9} /> {cfg.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{msg.sentAt}</td>
                              <td className="px-4 py-3 text-center font-bold text-sm">{msg.recipientCount}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="font-bold text-sm text-blue-600">{stats.delivered}</span>
                                  <div className="w-12 h-1 bg-blue-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="font-bold text-sm text-green-600">{stats.read}</span>
                                  <div className="w-12 h-1 bg-green-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${readPct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-sm text-red-600">{stats.failed > 0 ? stats.failed : '—'}</td>
                              <td className="px-4 py-3">
                                <button onClick={e => { e.stopPropagation(); setSelectedMessage(msg); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                                  <Eye size={14} />
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })}
                        {filteredMessages.length === 0 && (
                          <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No messages found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Contacts ── */}
            {activeView === 'contacts' && (
              <motion.div key="contacts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
                {/* Establishment Master Phone Info */}
                <div className="flex items-start gap-3 p-4 bg-[#075e54]/5 border border-[#075e54]/20 rounded-xl">
                  <Phone size={17} className="text-[#075e54] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#075e54]">Mobile Numbers Sourced from Establishment Master</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Each employee's WhatsApp number is their registered mobile phone number from the Establishment Master / Employee Master records. To update a phone number, edit it in the Employee Master under Employment Details.
                    </p>
                  </div>
                </div>

                <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input type="text" placeholder="Search by name, department, or phone..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground">{filteredContacts.length} contacts · {optedInCount} opted in</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredContacts.map((contact, i) => {
                    const readRate = contact.deliveryStats.sent > 0 ? Math.round((contact.deliveryStats.read / contact.deliveryStats.sent) * 100) : 0;
                    const convMessages = conversations[contact.id] ?? [];
                    return (
                      <motion.div key={contact.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -3 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-all">
                        <div className={`h-1.5 w-full ${contact.isOptedIn && !contact.isBlocked ? 'bg-green-400' : contact.isBlocked ? 'bg-red-400' : 'bg-gray-300'}`} />
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{contact.avatar}</div>
                                {contact.unreadCount > 0 && (
                                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#075e54] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{contact.unreadCount}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-sm">{contact.name}</p>
                                <p className="text-[10px] text-muted-foreground">{contact.designation}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {contact.isOptedIn && !contact.isBlocked ? (
                                <span className="text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                  <CheckCircle2 size={8} /> Opted In
                                </span>
                              ) : contact.isBlocked ? (
                                <span className="text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                  <AlertTriangle size={8} /> Blocked
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full">
                                  Not Opted
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5 mb-4">
                            {/* Mobile phone from Establishment Master — prominently displayed */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#075e54]/5 border border-[#075e54]/20 rounded-lg">
                              <Phone size={13} className="text-[#075e54] shrink-0" />
                              <div>
                                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">WhatsApp (Establishment Master)</p>
                                <p className="text-xs font-bold text-[#075e54] font-mono">{contact.phone}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Building2 size={11} className="shrink-0" /><span>{contact.department}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin size={11} className="shrink-0" /><span className="truncate">{contact.location}</span>
                            </div>
                            {contact.lastSeen && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock size={11} className="shrink-0" /><span>Last seen {contact.lastSeen}</span>
                              </div>
                            )}
                          </div>

                          {contact.isOptedIn && !contact.isBlocked && (
                            <div className="grid grid-cols-4 gap-2 mb-4">
                              {[
                                { label: 'Sent', value: contact.deliveryStats.sent, color: 'text-gray-600' },
                                { label: 'Delivered', value: contact.deliveryStats.delivered, color: 'text-blue-600' },
                                { label: 'Read', value: contact.deliveryStats.read, color: 'text-green-600' },
                                { label: 'Failed', value: contact.deliveryStats.failed, color: 'text-red-600' },
                              ].map(stat => (
                                <div key={stat.label} className="text-center p-2 bg-accent/30 rounded-lg">
                                  <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                                  <p className="text-[9px] text-muted-foreground">{stat.label}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-3 border-t border-border">
                            {contact.isOptedIn && !contact.isBlocked && (
                              <button
                                onClick={() => { setSelectedContact(contact); setActiveView('conversation'); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#075e54] text-white hover:bg-[#064e45] transition-colors"
                              >
                                <MessageCircle size={12} /> Chat ({convMessages.length})
                              </button>
                            )}
                            <button
                              onClick={() => { setShowCompose(true); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-accent text-muted-foreground transition-colors ml-auto"
                            >
                              <Send size={12} /> Send
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Templates ── */}
            {activeView === 'templates' && (
              <motion.div key="templates" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <Info size={17} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">WhatsApp Business Templates</p>
                    <p className="text-xs text-blue-700 mt-0.5">All outbound messages must use pre-approved templates. Templates are reviewed and approved by Meta before use. Only approved templates can be sent to employees via their Establishment Master mobile numbers.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {templates.map((template, i) => {
                    const cfg = CATEGORY_CONFIG[template.category];
                    const Icon = cfg.icon;
                    return (
                      <motion.div key={template.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-all">
                        <div className={`h-1.5 w-full ${template.status === 'approved' ? 'bg-green-400' : template.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'}`} />
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 ${cfg.color} rounded-xl shrink-0`}><Icon size={18} className={cfg.iconColor} /></div>
                              <div>
                                <p className="font-bold text-sm">{template.headerContent ?? template.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{template.name}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${template.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : template.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                    {template.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.accentBg} ${cfg.accentText} ${cfg.accentBorder}`}>{cfg.label}</span>
                          </div>

                          <div className="p-3 bg-[#efeae2] rounded-xl mb-4">
                            <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4 leading-relaxed">{template.body}</p>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {template.variables.map(v => (
                              <span key={v} className="text-[10px] font-semibold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                                {`{{${v}}}`}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-3 border-t border-border">
                            <span>Used {template.usageCount} times</span>
                            {template.lastUsed && <span>Last: {formatDate(template.lastUsed)}</span>}
                            <button
                              onClick={() => setShowCompose(true)}
                              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#075e54] text-white hover:bg-[#064e45] transition-colors"
                            >
                              <Send size={11} /> Use Template
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Conversation View ── */}
            {activeView === 'conversation' && selectedContact && (
              <motion.div key="conversation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="h-[calc(100vh-200px)] rounded-xl overflow-hidden border border-border shadow-sm">
                <ConversationView
                  contact={selectedContact}
                  messages={conversations[selectedContact.id] ?? []}
                  onBack={() => { setActiveView('contacts'); setSelectedContact(null); }}
                />
              </motion.div>
            )}

            {/* ── Settings ── */}
            {activeView === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6 max-w-2xl">
                {/* Establishment Master Phone Source Info */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <h2 className="font-bold text-base mb-5 flex items-center gap-2"><Phone size={18} className="text-[#075e54]" /> Mobile Phone Number Source</h2>
                  <div className="flex items-start gap-3 p-4 bg-[#075e54]/5 border border-[#075e54]/20 rounded-xl mb-4">
                    <Info size={16} className="text-[#075e54] shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-semibold text-[#075e54] mb-1">Establishment Master Integration</p>
                      <p>WhatsApp notifications are sent to each employee's mobile phone number as registered in the <strong>Establishment Master</strong> (Configuration → Establishment Master → Work Locations → Employee Records). The phone number field in the Employee Master is used as the WhatsApp destination number.</p>
                      <p className="mt-2">To update an employee's WhatsApp number, update their mobile phone number in the Employee Master under <strong>Employment Details → Contact Information</strong>.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Current Employee Mobile Numbers (from Establishment Master)</p>
                    {SEED_CONTACTS.map(contact => (
                      <div key={contact.id} className="flex items-center gap-3 px-4 py-3 bg-accent/30 rounded-xl border border-border">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{contact.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{contact.name}</p>
                          <p className="text-[10px] text-muted-foreground">{contact.employeeCode} · {contact.department}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#075e54]/10 border border-[#075e54]/20 rounded-lg">
                            <Phone size={12} className="text-[#075e54]" />
                            <span className="text-xs font-mono font-bold text-[#075e54]">{contact.phone}</span>
                          </div>
                          {contact.isOptedIn && !contact.isBlocked ? (
                            <span className="text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">Opted In</span>
                          ) : contact.isBlocked ? (
                            <span className="text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">Blocked</span>
                          ) : (
                            <span className="text-[9px] font-bold bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full">Not Opted</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <h2 className="font-bold text-base mb-5 flex items-center gap-2"><Globe size={18} className="text-[#075e54]" /> WhatsApp Business API Configuration</h2>
                  <div className="space-y-4">
                    <Field label="Business Phone Number">
                      <input type="text" className={inputCls} value="+91 22 4000 1000" readOnly />
                    </Field>
                    <Field label="Business Account Name">
                      <input type="text" className={inputCls} value="Nexus Technologies HR" readOnly />
                    </Field>
                    <Field label="API Access Token" hint="Keep this secret. Rotate regularly.">
                      <div className="relative">
                        <input type="password" className={inputCls} value="whatsapp_api_token_hidden" readOnly />
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          <Eye size={16} />
                        </button>
                      </div>
                    </Field>
                    <Field label="Webhook URL" hint="Configure this in your Meta Business Manager">
                      <input type="text" className={inputCls} value="https://cosmic-grove-xh.meku.app/api/whatsapp/webhook" readOnly />
                    </Field>
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <h2 className="font-bold text-base mb-5 flex items-center gap-2"><Bell size={18} className="text-[#075e54]" /> Notification Triggers</h2>
                  <div className="space-y-4">
                    {(Object.entries(CATEGORY_CONFIG) as [NotificationCategory, typeof CATEGORY_CONFIG[NotificationCategory]][]).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <div key={key} className={`flex items-center justify-between p-4 rounded-xl border-2 ${cfg.accentBg} ${cfg.accentBorder}`}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 ${cfg.color} rounded-lg`}><Icon size={16} className={cfg.iconColor} /></div>
                            <div>
                              <p className={`font-bold text-sm ${cfg.accentText}`}>{cfg.label}</p>
                              <p className={`text-[10px] ${cfg.accentText} opacity-70`}>{cfg.description}</p>
                            </div>
                          </div>
                          <div className="w-10 h-5 rounded-full bg-[#075e54] relative cursor-pointer shrink-0">
                            <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <h2 className="font-bold text-base mb-5 flex items-center gap-2"><Shield size={18} className="text-[#075e54]" /> Privacy & Compliance</h2>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <CheckCircle2 size={15} className="text-green-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-green-700">All messages are sent only to employees who have explicitly opted in to WhatsApp notifications.</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700">Employees can opt out at any time by replying STOP to any message. Opted-out employees will be automatically excluded from future notifications.</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-[#075e54]/5 border border-[#075e54]/20 rounded-xl">
                      <Phone size={15} className="text-[#075e54] shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">Mobile phone numbers used for WhatsApp are sourced from the <strong>Establishment Master</strong>. Ensure all employee mobile numbers are accurate and up-to-date in the Employee Master records.</p>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">Only pre-approved WhatsApp Business templates can be sent. All templates are reviewed by Meta before activation.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Compose Modal */}
      <AnimatePresence>
        {showCompose && (
          <ComposeModal
            templates={templates}
            contacts={contacts}
            onSend={handleSendMessage}
            onClose={() => { setShowCompose(false); setActiveView('dashboard'); }}
          />
        )}
      </AnimatePresence>

      {/* Message Detail Modal */}
      <AnimatePresence>
        {selectedMessage && (
          <MessageDetailModal
            message={selectedMessage}
            onClose={() => setSelectedMessage(null)}
            onRetry={handleRetry}
          />
        )}
      </AnimatePresence>
    </div>
  );
}