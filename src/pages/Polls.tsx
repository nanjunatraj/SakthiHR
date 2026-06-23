import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, Plus, Search, X, Save, CheckCircle2, AlertCircle,
  Clock, Users, Calendar, ChevronDown, ChevronUp, Trash2,
  Pencil, Eye, Send, Filter, RefreshCw, Bell, MessageSquare,
  TrendingUp, Award, Hash, Info, Lock, Unlock, BarChart3,
  CheckSquare, Circle, AlignLeft, ChevronRight, Zap,
  PieChart, Activity, Star, ThumbsUp, ThumbsDown, Minus
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { toast } from 'react-toastify';

// ─── Types ────────────────────────────────────────────────────────────────────

type PollStatus = 'Draft' | 'Active' | 'Closed' | 'Scheduled';
type PollType = 'single' | 'multiple' | 'rating' | 'text';
type RecipientScope = 'all' | 'department' | 'location' | 'individual';

interface PollOption {
  id: string;
  text: string;
  votes: number;
  voters: string[];
}

interface PollResponse {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  avatar: string;
  selectedOptions: string[];
  textResponse?: string;
  ratingValue?: number;
  respondedAt: string;
}

interface Poll {
  id: string;
  title: string;
  description: string;
  type: PollType;
  status: PollStatus;
  options: PollOption[];
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  recipientScope: RecipientScope;
  recipientDepartments: string[];
  recipientLocations: string[];
  recipientEmployees: string[];
  totalRecipients: number;
  responses: PollResponse[];
  isAnonymous: boolean;
  allowMultiple: boolean;
  maxRating: number;
  createdBy: string;
  createdAt: string;
  notificationSent: boolean;
  notificationSentAt?: string;
  tags: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENTS = ['All', 'Engineering', 'Marketing', 'Design', 'Sales', 'Human Resources', 'Finance', 'Operations'];
const LOCATIONS = ['All', 'Head Office – Mumbai', 'Regional Office – Delhi', 'Branch Office – Bangalore'];

const POLL_TYPE_CONFIG: Record<PollType, { label: string; icon: React.ElementType; description: string; color: string; iconColor: string }> = {
  single: { label: 'Single Choice', icon: Circle, description: 'Employees select one option', color: 'bg-blue-100', iconColor: 'text-blue-600' },
  multiple: { label: 'Multiple Choice', icon: CheckSquare, description: 'Employees select multiple options', color: 'bg-violet-100', iconColor: 'text-violet-600' },
  rating: { label: 'Rating Scale', icon: Star, description: 'Employees rate on a scale', color: 'bg-amber-100', iconColor: 'text-amber-600' },
  text: { label: 'Open Text', icon: AlignLeft, description: 'Employees provide text responses', color: 'bg-emerald-100', iconColor: 'text-emerald-600' },
};

const STATUS_STYLES: Record<PollStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Draft: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: Pencil },
  Active: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: Activity },
  Closed: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: Lock },
  Scheduled: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

function todayFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[now.getMonth()]}/${now.getFullYear()}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}


// Polls load from the polls/poll_options/poll_votes tables (empty until created).
const SEED_POLLS: Poll[] = [];

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

// ─── Poll Results Chart ───────────────────────────────────────────────────────

interface PollResultsProps {
  poll: Poll;
}

const PollResults = ({ poll }: PollResultsProps) => {
  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
  const responseCount = poll.responses.length;
  const responseRate = poll.totalRecipients > 0 ? Math.round((responseCount / poll.totalRecipients) * 100) : 0;

  if (poll.type === 'text') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-center p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex-1">
            <p className="text-xl font-bold text-emerald-700">{responseCount}</p>
            <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Responses</p>
          </div>
          <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-xl flex-1">
            <p className="text-xl font-bold text-blue-700">{responseRate}%</p>
            <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Response Rate</p>
          </div>
        </div>
        {poll.responses.map((resp, i) => (
          <div key={resp.employeeId} className="p-4 bg-accent/30 rounded-xl border border-border">
            {!poll.isAnonymous && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">{resp.avatar}</div>
                <p className="text-xs font-semibold">{resp.employeeName}</p>
                <span className="text-[10px] text-muted-foreground">{resp.respondedAt}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground italic">"{resp.textResponse}"</p>
          </div>
        ))}
      </div>
    );
  }

  if (poll.type === 'rating') {
    const avgRating = poll.responses.length > 0
      ? (poll.responses.reduce((s, r) => s + (r.ratingValue ?? 0), 0) / poll.responses.length).toFixed(1)
      : '0.0';
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-2xl font-bold text-amber-700">{avgRating}</p>
            <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Avg Rating</p>
          </div>
          <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-xl font-bold text-blue-700">{responseCount}</p>
            <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Responses</p>
          </div>
          <div className="text-center p-3 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-xl font-bold text-green-700">{responseRate}%</p>
            <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide">Response Rate</p>
          </div>
        </div>
        {poll.options.map(option => {
          const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const stars = parseInt(option.text.split(' ')[0]);
          return (
            <div key={option.id} className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 w-20 shrink-0">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} size={12} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <div className="flex-1 h-3 bg-accent rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.1 }} className="h-full bg-amber-400 rounded-full" />
              </div>
              <span className="text-xs font-bold w-12 text-right">{option.votes} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <p className="text-xl font-bold text-primary">{totalVotes}</p>
          <p className="text-[10px] font-medium text-primary/70 uppercase tracking-wide">Total Votes</p>
        </div>
        <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-xl font-bold text-blue-700">{responseCount}</p>
          <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Respondents</p>
        </div>
        <div className="text-center p-3 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-xl font-bold text-green-700">{responseRate}%</p>
          <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide">Response Rate</p>
        </div>
      </div>
      {poll.options.map((option, i) => {
        const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
        const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
        const bgColors = ['bg-blue-50', 'bg-violet-50', 'bg-emerald-50', 'bg-amber-50', 'bg-rose-50', 'bg-cyan-50'];
        const textColors = ['text-blue-700', 'text-violet-700', 'text-emerald-700', 'text-amber-700', 'text-rose-700', 'text-cyan-700'];
        const borderColors = ['border-blue-200', 'border-violet-200', 'border-emerald-200', 'border-amber-200', 'border-rose-200', 'border-cyan-200'];
        const color = colors[i % colors.length];
        const bg = bgColors[i % bgColors.length];
        const tc = textColors[i % textColors.length];
        const bc = borderColors[i % borderColors.length];
        return (
          <div key={option.id} className={`p-3 rounded-xl border ${bg} ${bc}`}>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm font-semibold ${tc}`}>{option.text}</p>
              <span className={`text-xs font-bold ${tc}`}>{option.votes} votes ({pct}%)</span>
            </div>
            <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.1 }} className={`h-full ${color} rounded-full`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Poll Card ────────────────────────────────────────────────────────────────

interface PollCardProps {
  poll: Poll;
  onView: (p: Poll) => void;
  onEdit: (p: Poll) => void;
  onDelete: (id: string) => void;
  onSendNotification: (p: Poll) => void;
  onClose: (id: string) => void;
}

const PollCard = ({ poll, onView, onEdit, onDelete, onSendNotification, onClose }: PollCardProps) => {
  const statusStyle = STATUS_STYLES[poll.status];
  const StatusIcon = statusStyle.icon;
  const typeConfig = POLL_TYPE_CONFIG[poll.type];
  const TypeIcon = typeConfig.icon;
  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
  const responseRate = poll.totalRecipients > 0 ? Math.round((poll.responses.length / poll.totalRecipients) * 100) : 0;
  const pendingCount = poll.totalRecipients - poll.responses.length;

  const now = new Date();
  const endDateTime = new Date(`${poll.endDate}T${poll.endTime}`);
  const daysLeft = Math.max(0, Math.ceil((endDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -3 }}
      className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className={`h-1.5 w-full ${poll.status === 'Active' ? 'bg-green-400' : poll.status === 'Scheduled' ? 'bg-amber-400' : poll.status === 'Closed' ? 'bg-red-400' : 'bg-gray-300'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
              <StatusIcon size={9} />
              {poll.status}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeConfig.color} ${typeConfig.iconColor} border-current/20`}>
              <TypeIcon size={9} />
              {typeConfig.label}
            </span>
            {poll.isAnonymous && (
              <span className="text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded-full">Anonymous</span>
            )}
          </div>
        </div>

        <h3 className="font-bold text-sm mb-1 line-clamp-2">{poll.title}</h3>
        <p className="text-[11px] text-muted-foreground mb-4 line-clamp-2">{poll.description}</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2.5 bg-accent/40 rounded-lg">
            <p className="text-sm font-bold text-primary">{poll.responses.length}</p>
            <p className="text-[10px] text-muted-foreground">Responded</p>
          </div>
          <div className="text-center p-2.5 bg-accent/40 rounded-lg">
            <p className="text-sm font-bold text-amber-600">{pendingCount}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-2.5 bg-accent/40 rounded-lg">
            <p className={`text-sm font-bold ${responseRate >= 70 ? 'text-green-600' : responseRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{responseRate}%</p>
            <p className="text-[10px] text-muted-foreground">Rate</p>
          </div>
        </div>

        {/* Response Rate Bar */}
        <div className="mb-4">
          <div className="w-full h-2 bg-accent rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${responseRate >= 70 ? 'bg-green-500' : responseRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${responseRate}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-4 flex-wrap">
          <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(poll.startDate)} – {formatDate(poll.endDate)}</span>
          {poll.status === 'Active' && daysLeft > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-semibold"><Clock size={10} /> {daysLeft}d left</span>
          )}
          <span className="flex items-center gap-1"><Users size={10} /> {poll.totalRecipients} recipients</span>
        </div>

        {poll.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {poll.tags.map(tag => (
              <span key={tag} className="text-[10px] font-semibold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">#{tag}</span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 pt-3 border-t border-border flex-wrap">
          <button onClick={() => onView(poll)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors">
            <Eye size={12} /> View
          </button>
          {poll.status !== 'Closed' && (
            <button onClick={() => onEdit(poll)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <Pencil size={12} /> Edit
            </button>
          )}
          {poll.status === 'Active' && !poll.notificationSent && (
            <button onClick={() => onSendNotification(poll)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-green-50 text-green-600 border border-green-200 transition-colors">
              <Bell size={12} /> Notify
            </button>
          )}
          {poll.status === 'Active' && (
            <button onClick={() => onClose(poll.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-red-50 text-red-600 transition-colors ml-auto">
              <Lock size={12} /> Close
            </button>
          )}
          {poll.status !== 'Active' && (
            <button onClick={() => onDelete(poll.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto">
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Poll Detail Modal ────────────────────────────────────────────────────────

interface PollDetailModalProps {
  poll: Poll;
  onClose: () => void;
  onSendNotification: (p: Poll) => void;
}

const PollDetailModal = ({ poll, onClose, onSendNotification }: PollDetailModalProps) => {
  const [activeTab, setActiveTab] = useState<'results' | 'responses' | 'details'>('results');
  const statusStyle = STATUS_STYLES[poll.status];
  const StatusIcon = statusStyle.icon;
  const typeConfig = POLL_TYPE_CONFIG[poll.type];
  const TypeIcon = typeConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-indigo-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <BarChart2 size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">{poll.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                  <StatusIcon size={9} /> {poll.status}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeConfig.color} ${typeConfig.iconColor} border-current/20`}>
                  <TypeIcon size={9} /> {typeConfig.label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-0.5 px-6 pt-3 border-b border-border bg-accent/10 shrink-0">
          {[
            { key: 'results', label: 'Results', icon: BarChart3 },
            { key: 'responses', label: `Responses (${poll.responses.length})`, icon: MessageSquare },
            { key: 'details', label: 'Details', icon: Info },
          ].map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key as any;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all rounded-t-lg border-b-2 whitespace-nowrap ${isActive ? 'text-primary border-primary bg-primary/5' : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50'}`}>
                <TabIcon size={13} /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {activeTab === 'results' && <PollResults poll={poll} />}

          {activeTab === 'responses' && (
            <div className="space-y-3">
              {poll.responses.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground">No responses yet</p>
                </div>
              ) : (
                poll.responses.map((resp, i) => (
                  <motion.div key={resp.employeeId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-start gap-3 p-4 bg-accent/30 rounded-xl border border-border">
                    {!poll.isAnonymous ? (
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{resp.avatar}</div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                        <Users size={16} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {!poll.isAnonymous ? (
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-sm">{resp.employeeName}</p>
                          <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{resp.employeeCode}</span>
                          <span className="text-[10px] text-muted-foreground">{resp.department}</span>
                        </div>
                      ) : (
                        <p className="font-bold text-sm text-muted-foreground mb-1">Anonymous Response</p>
                      )}
                      {resp.textResponse && <p className="text-sm text-muted-foreground italic">"{resp.textResponse}"</p>}
                      {resp.ratingValue && (
                        <div className="flex items-center gap-1">
                          {Array.from({ length: resp.ratingValue }).map((_, i) => (
                            <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">{resp.ratingValue}/5</span>
                        </div>
                      )}
                      {resp.selectedOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {resp.selectedOptions.map(optId => {
                            const opt = poll.options.find(o => o.id === optId);
                            return opt ? (
                              <span key={optId} className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                                {opt.text}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">{resp.respondedAt}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Created By', value: poll.createdBy },
                  { label: 'Created On', value: poll.createdAt },
                  { label: 'Start Date', value: `${formatDate(poll.startDate)} ${poll.startTime}` },
                  { label: 'End Date', value: `${formatDate(poll.endDate)} ${poll.endTime}` },
                  { label: 'Total Recipients', value: `${poll.totalRecipients} employees` },
                  { label: 'Recipient Scope', value: poll.recipientScope === 'all' ? 'All Employees' : poll.recipientScope === 'department' ? `Departments: ${poll.recipientDepartments.join(', ')}` : poll.recipientScope },
                  { label: 'Anonymous', value: poll.isAnonymous ? 'Yes' : 'No' },
                  { label: 'Notification Sent', value: poll.notificationSent ? `Yes — ${poll.notificationSentAt}` : 'Not yet sent' },
                ].map(row => (
                  <div key={row.label} className="p-3 bg-accent/30 rounded-xl border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{row.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{row.value}</p>
                  </div>
                ))}
              </div>
              {poll.status === 'Active' && !poll.notificationSent && (
                <button onClick={() => { onSendNotification(poll); onClose(); }} className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-md">
                  <Bell size={16} /> Send Notification to Employees
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Create/Edit Poll Modal ───────────────────────────────────────────────────

interface PollFormData {
  title: string;
  description: string;
  type: PollType;
  options: { id: string; text: string }[];
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  recipientScope: RecipientScope;
  recipientDepartments: string[];
  isAnonymous: boolean;
  allowMultiple: boolean;
  maxRating: number;
  tags: string;
}

interface PollFormModalProps {
  editingPoll: Poll | null;
  onSave: (data: PollFormData) => void;
  onClose: () => void;
}

const PollFormModal = ({ editingPoll, onSave, onClose }: PollFormModalProps) => {
  const [form, setForm] = useState<PollFormData>({
    title: editingPoll?.title ?? '',
    description: editingPoll?.description ?? '',
    type: editingPoll?.type ?? 'single',
    options: editingPoll?.options.map(o => ({ id: o.id, text: o.text })) ?? [
      { id: 'O1', text: '' },
      { id: 'O2', text: '' },
    ],
    startDate: editingPoll?.startDate ?? new Date().toISOString().split('T')[0],
    startTime: editingPoll?.startTime ?? '09:00',
    endDate: editingPoll?.endDate ?? '',
    endTime: editingPoll?.endTime ?? '18:00',
    recipientScope: editingPoll?.recipientScope ?? 'all',
    recipientDepartments: editingPoll?.recipientDepartments ?? [],
    isAnonymous: editingPoll?.isAnonymous ?? false,
    allowMultiple: editingPoll?.allowMultiple ?? false,
    maxRating: editingPoll?.maxRating ?? 5,
    tags: editingPoll?.tags.join(', ') ?? '',
  });

  const addOption = () => {
    setForm(f => ({ ...f, options: [...f.options, { id: `O${f.options.length + 1}-${Date.now()}`, text: '' }] }));
  };

  const removeOption = (id: string) => {
    if (form.options.length <= 2) { return; }
    setForm(f => ({ ...f, options: f.options.filter(o => o.id !== id) }));
  };

  const updateOption = (id: string, text: string) => {
    setForm(f => ({ ...f, options: f.options.map(o => o.id === id ? { ...o, text } : o) }));
  };

  const toggleDept = (dept: string) => {
    setForm(f => ({
      ...f,
      recipientDepartments: f.recipientDepartments.includes(dept)
        ? f.recipientDepartments.filter(d => d !== dept)
        : [...f.recipientDepartments, dept],
    }));
  };

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('Poll title is required.'); return; }
    if (!form.endDate) { toast.error('End date is required.'); return; }
    if (form.type !== 'text' && form.type !== 'rating' && form.options.some(o => !o.text.trim())) {
      toast.error('All options must have text.'); return;
    }
    onSave(form);
  };

  const showOptions = form.type === 'single' || form.type === 'multiple';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
          <h2 className="text-lg font-bold">{editingPoll ? 'Edit Poll' : 'Create New Poll'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <Field label="Poll Title" required>
            <input type="text" className={inputCls} placeholder="e.g. Work From Home Preference — August 2025" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Field>

          <Field label="Description">
            <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Brief description of the poll purpose" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>

          <Field label="Poll Type" required>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(POLL_TYPE_CONFIG) as [PollType, typeof POLL_TYPE_CONFIG[PollType]][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const isSelected = form.type === key;
                return (
                  <button key={key} onClick={() => setForm(f => ({ ...f, type: key }))} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${isSelected ? `${cfg.color} border-current/30 shadow-sm` : 'border-border bg-card hover:border-primary/30'}`}>
                    <div className={`p-2 ${cfg.color} rounded-lg shrink-0`}><Icon size={16} className={cfg.iconColor} /></div>
                    <div>
                      <p className={`font-bold text-xs ${isSelected ? cfg.iconColor : 'text-foreground'}`}>{cfg.label}</p>
                      <p className="text-[10px] text-muted-foreground">{cfg.description}</p>
                    </div>
                    {isSelected && <CheckCircle2 size={14} className={`${cfg.iconColor} ml-auto shrink-0`} />}
                  </button>
                );
              })}
            </div>
          </Field>

          {showOptions && (
            <div>
              <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Options <span className="text-destructive">*</span></label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                    <input type="text" className={`${inputCls} flex-1`} placeholder={`Option ${i + 1}`} value={opt.text} onChange={e => updateOption(opt.id, e.target.value)} />
                    {form.options.length > 2 && (
                      <button onClick={() => removeOption(opt.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addOption} className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-border rounded-xl text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all w-full justify-center">
                  <Plus size={14} /> Add Option
                </button>
              </div>
            </div>
          )}

          {form.type === 'rating' && (
            <Field label="Maximum Rating" hint="Scale from 1 to this value">
              <select className={selectCls} value={form.maxRating} onChange={e => setForm(f => ({ ...f, maxRating: parseInt(e.target.value) }))}>
                <option value={3}>3 Stars</option>
                <option value={5}>5 Stars</option>
                <option value={10}>10 Points</option>
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start Date" required>
                <input type="date" className={inputCls} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </Field>
              <Field label="Start Time">
                <input type="time" className={inputCls} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="End Date" required>
                <input type="date" className={inputCls} value={form.endDate} min={form.startDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </Field>
              <Field label="End Time">
                <input type="time" className={inputCls} value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </Field>
            </div>
          </div>

          <Field label="Recipients">
            <select className={selectCls} value={form.recipientScope} onChange={e => setForm(f => ({ ...f, recipientScope: e.target.value as RecipientScope }))}>
              <option value="all">All Employees</option>
              <option value="department">Specific Departments</option>
              <option value="location">Specific Locations</option>
            </select>
          </Field>

          {form.recipientScope === 'department' && (
            <div>
              <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Select Departments</label>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENTS.filter(d => d !== 'All').map(dept => {
                  const isSelected = form.recipientDepartments.includes(dept);
                  return (
                    <button key={dept} onClick={() => toggleDept(dept)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-accent text-muted-foreground border-border hover:border-primary/40'}`}>
                      {isSelected && <CheckCircle2 size={10} className="inline mr-1" />}
                      {dept}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3 p-4 bg-accent/30 rounded-xl border border-border">
            <ToggleSwitch value={form.isAnonymous} onChange={v => setForm(f => ({ ...f, isAnonymous: v }))} label="Anonymous Poll" description="Employee identities will not be shown in responses" />
            {form.type === 'multiple' && (
              <ToggleSwitch value={form.allowMultiple} onChange={v => setForm(f => ({ ...f, allowMultiple: v }))} label="Allow Multiple Selections" description="Employees can select more than one option" />
            )}
          </div>

          <Field label="Tags" hint="Comma-separated tags for easy filtering">
            <input type="text" className={inputCls} placeholder="e.g. WFH, Policy, Q3" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
          </Field>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
            <Save size={15} /> {editingPoll ? 'Save Changes' : 'Create Poll'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Polls() {
  const [polls, setPolls] = useState<Poll[]>(SEED_POLLS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PollStatus | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<PollType | 'All'>('All');
  const [viewingPoll, setViewingPoll] = useState<Poll | null>(null);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeView, setActiveView] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(() =>
    polls.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      const matchType = typeFilter === 'All' || p.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    }),
    [polls, search, statusFilter, typeFilter]
  );

  const activeCount = polls.filter(p => p.status === 'Active').length;
  const totalResponses = polls.reduce((s, p) => s + p.responses.length, 0);
  const avgResponseRate = polls.length > 0
    ? Math.round(polls.reduce((s, p) => s + (p.totalRecipients > 0 ? (p.responses.length / p.totalRecipients) * 100 : 0), 0) / polls.length)
    : 0;
  const pendingNotifications = polls.filter(p => p.status === 'Active' && !p.notificationSent).length;

  const handleSavePoll = (data: PollFormData) => {
    const now = new Date();
    const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
    const status: PollStatus = startDateTime > now ? 'Scheduled' : 'Active';

    if (editingPoll) {
      setPolls(prev => prev.map(p =>
        p.id === editingPoll.id
          ? {
              ...p,
              title: data.title,
              description: data.description,
              type: data.type,
              options: data.options.map(o => ({ ...o, votes: p.options.find(po => po.id === o.id)?.votes ?? 0, voters: p.options.find(po => po.id === o.id)?.voters ?? [] })),
              startDate: data.startDate,
              startTime: data.startTime,
              endDate: data.endDate,
              endTime: data.endTime,
              recipientScope: data.recipientScope,
              recipientDepartments: data.recipientDepartments,
              isAnonymous: data.isAnonymous,
              allowMultiple: data.allowMultiple,
              maxRating: data.maxRating,
              tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
            }
          : p
      ));
      toast.success('Poll updated successfully.');
    } else {
      const newPoll: Poll = {
        id: `POLL${String(polls.length + 1).padStart(3, '0')}`,
        title: data.title,
        description: data.description,
        type: data.type,
        status,
        options: data.options.map(o => ({ ...o, votes: 0, voters: [] })),
        startDate: data.startDate,
        startTime: data.startTime,
        endDate: data.endDate,
        endTime: data.endTime,
        recipientScope: data.recipientScope,
        recipientDepartments: data.recipientDepartments,
        recipientLocations: [],
        recipientEmployees: [],
        totalRecipients: data.recipientScope === 'all' ? 154 : data.recipientDepartments.length * 20,
        responses: [],
        isAnonymous: data.isAnonymous,
        allowMultiple: data.allowMultiple,
        maxRating: data.maxRating,
        createdBy: 'Admin',
        createdAt: todayFormatted(),
        notificationSent: false,
        tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      setPolls(prev => [newPoll, ...prev]);
      toast.success(`Poll "${data.title}" created successfully!`);
    }
    setShowCreateModal(false);
    setEditingPoll(null);
  };

  const handleDelete = (id: string) => {
    setPolls(prev => prev.filter(p => p.id !== id));
    toast.info('Poll deleted.');
  };

  const handleClose = (id: string) => {
    setPolls(prev => prev.map(p => p.id === id ? { ...p, status: 'Closed' } : p));
    toast.success('Poll closed successfully.');
  };

  const handleSendNotification = (poll: Poll) => {
    const now = new Date();
    const notifTime = `${todayFormatted()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    setPolls(prev => prev.map(p => p.id === poll.id ? { ...p, notificationSent: true, notificationSentAt: notifTime } : p));
    toast.success(`Notification sent to ${poll.totalRecipients} employees for poll "${poll.title}".`);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart2 size={22} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-serif">Poll Management</h1>
                <p className="text-xs text-muted-foreground">Create polls with date & time limits, send to employees, and track responses.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {pendingNotifications > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <Bell size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">{pendingNotifications} poll{pendingNotifications !== 1 ? 's' : ''} need notification</span>
                </div>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"
              >
                <Plus size={16} /> Create Poll
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Polls', value: polls.length, sub: `${activeCount} active`, color: 'bg-primary/10', iconColor: 'text-primary', icon: BarChart2 },
              { label: 'Active Polls', value: activeCount, sub: 'Currently running', color: 'bg-green-100', iconColor: 'text-green-600', icon: Activity },
              { label: 'Total Responses', value: totalResponses, sub: 'Across all polls', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: MessageSquare },
              { label: 'Avg Response Rate', value: `${avgResponseRate}%`, sub: 'All polls', color: 'bg-violet-100', iconColor: 'text-violet-600', icon: TrendingUp },
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

          {/* Filters */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search polls..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="All">All Status</option>
              {(['Active', 'Scheduled', 'Closed', 'Draft'] as PollStatus[]).map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
              <option value="All">All Types</option>
              {(Object.entries(POLL_TYPE_CONFIG) as [PollType, any][]).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <div className="ml-auto text-xs text-muted-foreground">{filtered.length} polls</div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['All', 'Active', 'Scheduled', 'Closed', 'Draft'] as const).map(s => {
              const count = s === 'All' ? polls.length : polls.filter(p => p.status === s).length;
              const isActive = statusFilter === s;
              const style = s !== 'All' ? STATUS_STYLES[s] : null;
              return (
                <button key={s} onClick={() => setStatusFilter(s)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isActive ? 'bg-primary text-primary-foreground border-primary' : style ? `${style.bg} ${style.text} ${style.border} hover:opacity-80` : 'bg-accent text-muted-foreground border-border hover:border-primary/40'}`}>
                  {s} ({count})
                </button>
              );
            })}
          </div>

          {/* Polls Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map(poll => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  onView={setViewingPoll}
                  onEdit={p => { setEditingPoll(p); setShowCreateModal(true); }}
                  onDelete={handleDelete}
                  onSendNotification={handleSendNotification}
                  onClose={handleClose}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BarChart2 size={28} className="text-primary" />
              </div>
              <p className="font-semibold text-muted-foreground">No polls found</p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">Create your first poll to gather employee feedback</p>
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto">
                <Plus size={15} /> Create Poll
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {viewingPoll && (
          <PollDetailModal
            poll={viewingPoll}
            onClose={() => setViewingPoll(null)}
            onSendNotification={handleSendNotification}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal && (
          <PollFormModal
            editingPoll={editingPoll}
            onSave={handleSavePoll}
            onClose={() => { setShowCreateModal(false); setEditingPoll(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}