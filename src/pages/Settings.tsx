import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon, Bell, Shield, Palette, Globe, Mail,
  Save, CheckCircle2, User, Lock, Eye, EyeOff, Smartphone,
  Database, AlertCircle, Brush, Printer, Monitor, Sparkles,
  ArrowRight
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { toast } from 'react-toastify';
import { useCurrency } from '../context/CurrencyContext';
import { useNavigate } from 'react-router-dom';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'system' | 'software';

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none";

interface FieldProps { label: string; required?: boolean; children: React.ReactNode; hint?: string; }
const Field = ({ label, required, children, hint }: FieldProps) => (
  <div>
    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

interface ToggleProps { value: boolean; onChange: (v: boolean) => void; label: string; description?: string; }
const Toggle = ({ value, onChange, label, description }: ToggleProps) => (
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

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const { currencyCode, setCurrency, currencies } = useCurrency();

  const [profile, setProfile] = useState({
    name: 'Admin User', email: 'admin@sakthihr.com', phone: '+91 98765 43210',
    designation: 'HR Administrator', department: 'Human Resources', timezone: 'Asia/Kolkata',
    language: 'English', dateFormat: 'DD/MM/YYYY',
  });

  const [notifications, setNotifications] = useState({
    emailLeaveApproval: true, emailPayrollProcessed: true, emailNewEmployee: false,
    emailLoanApproval: true, pushLeaveApproval: true, pushPayrollProcessed: false,
    pushNewEmployee: true, pushLoanApproval: false, weeklyDigest: true, monthlyReport: true,
  });

  const [security, setSecurity] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
    twoFactorEnabled: false, sessionTimeout: '30', loginNotifications: true,
  });

  const [system, setSystem] = useState({
    companyName: 'SakthiHR', fiscalYearStart: 'April',
    workingDaysPerWeek: '5', payrollCycle: 'Monthly',
    autoBackup: true, maintenanceMode: false, debugMode: false,
  });

  const handleSave = () => { toast.success('Settings saved successfully!'); };

  const tabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'system', label: 'System', icon: SettingsIcon },
    { key: 'software', label: 'Software Settings', icon: Palette },
  ];

  const selectedCurrency = currencies.find(c => c.code === currencyCode) ?? currencies[0];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg"><SettingsIcon size={22} className="text-gray-600" /></div>
              <div>
                <h1 className="text-xl font-bold">Settings</h1>
                <p className="text-xs text-muted-foreground">Manage your account, notifications, and system preferences.</p>
              </div>
            </div>
            <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
              <Save size={15} /> Save Changes
            </button>
          </div>
        </div>

        <div className="px-8 py-6 flex gap-6">
          {/* Sidebar Nav */}
          <div className="w-52 shrink-0">
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      if (tab.key === 'software') {
                        navigate('/settings/software');
                      } else {
                        setActiveTab(tab.key);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-b border-border last:border-0 ${isActive ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                  >
                    <Icon size={16} />
                    {tab.label}
                    {tab.key === 'software' ? (
                      <ArrowRight size={14} className="ml-auto" />
                    ) : isActive ? (
                      <ArrowRight size={14} className="ml-auto" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">A</div>
                      <div>
                        <h2 className="font-bold text-lg">{profile.name}</h2>
                        <p className="text-sm text-muted-foreground">{profile.designation} · {profile.department}</p>
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field label="Full Name" required>
                        <input type="text" className={inputCls} value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
                      </Field>
                      <Field label="Email Address" required>
                        <input type="email" className={inputCls} value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                      </Field>
                      <Field label="Phone Number">
                        <input type="tel" className={inputCls} value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                      </Field>
                      <Field label="Designation">
                        <input type="text" className={inputCls} value={profile.designation} onChange={e => setProfile(p => ({ ...p, designation: e.target.value }))} />
                      </Field>
                      <Field label="Timezone">
                        <select className={selectCls} value={profile.timezone} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}>
                          <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                          <option value="America/New_York">America/New_York (EST)</option>
                          <option value="Europe/London">Europe/London (GMT)</option>
                          <option value="Asia/Dubai">Asia/Dubai (GST +4)</option>
                        </select>
                      </Field>
                      <Field label="Date Format">
                        <select className={selectCls} value={profile.dateFormat} onChange={e => setProfile(p => ({ ...p, dateFormat: e.target.value }))}>
                          <option>DD/MM/YYYY</option>
                          <option>MM/DD/YYYY</option>
                          <option>YYYY-MM-DD</option>
                        </select>
                      </Field>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'notifications' && (
                <motion.div key="notifications" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <h2 className="font-bold mb-5 flex items-center gap-2"><Mail size={18} className="text-primary" /> Email Notifications</h2>
                    <div className="space-y-4">
                      <Toggle value={notifications.emailLeaveApproval} onChange={v => setNotifications(n => ({ ...n, emailLeaveApproval: v }))} label="Leave Approval Requests" description="Get notified when employees submit leave requests" />
                      <Toggle value={notifications.emailPayrollProcessed} onChange={v => setNotifications(n => ({ ...n, emailPayrollProcessed: v }))} label="Payroll Processed" description="Notification when monthly payroll is finalized" />
                      <Toggle value={notifications.emailNewEmployee} onChange={v => setNotifications(n => ({ ...n, emailNewEmployee: v }))} label="New Employee Onboarded" description="Alert when a new employee joins the system" />
                      <Toggle value={notifications.emailLoanApproval} onChange={v => setNotifications(n => ({ ...n, emailLoanApproval: v }))} label="Loan Approval Requests" description="Get notified when employees apply for loans" />
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <h2 className="font-bold mb-5 flex items-center gap-2"><Smartphone size={18} className="text-primary" /> Push Notifications</h2>
                    <div className="space-y-4">
                      <Toggle value={notifications.pushLeaveApproval} onChange={v => setNotifications(n => ({ ...n, pushLeaveApproval: v }))} label="Leave Requests" description="Real-time push for leave approval requests" />
                      <Toggle value={notifications.pushNewEmployee} onChange={v => setNotifications(n => ({ ...n, pushNewEmployee: v }))} label="New Employee" description="Push notification for new employee additions" />
                      <Toggle value={notifications.weeklyDigest} onChange={v => setNotifications(n => ({ ...n, weeklyDigest: v }))} label="Weekly Digest" description="Summary of the week's HR activities every Monday" />
                      <Toggle value={notifications.monthlyReport} onChange={v => setNotifications(n => ({ ...n, monthlyReport: v }))} label="Monthly Report" description="Automated monthly HR analytics report" />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <h2 className="font-bold mb-5 flex items-center gap-2"><Lock size={18} className="text-primary" /> Change Password</h2>
                    <div className="space-y-4 max-w-md">
                      <Field label="Current Password" required>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} className={`${inputCls} pr-10`} placeholder="Enter current password" value={security.currentPassword} onChange={e => setSecurity(s => ({ ...s, currentPassword: e.target.value }))} />
                          <button onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </Field>
                      <Field label="New Password" required hint="Minimum 8 characters with uppercase, number, and symbol">
                        <input type="password" className={inputCls} placeholder="Enter new password" value={security.newPassword} onChange={e => setSecurity(s => ({ ...s, newPassword: e.target.value }))} />
                      </Field>
                      <Field label="Confirm New Password" required>
                        <input type="password" className={inputCls} placeholder="Confirm new password" value={security.confirmPassword} onChange={e => setSecurity(s => ({ ...s, confirmPassword: e.target.value }))} />
                      </Field>
                      {security.newPassword && security.confirmPassword && security.newPassword !== security.confirmPassword && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                          <AlertCircle size={12} /> Passwords do not match.
                        </div>
                      )}
                      <button onClick={() => { if (security.newPassword === security.confirmPassword) { toast.success('Password updated successfully!'); setSecurity(s => ({ ...s, currentPassword: '', newPassword: '', confirmPassword: '' })); } else { toast.error('Passwords do not match.'); } }} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                        Update Password
                      </button>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <h2 className="font-bold mb-5 flex items-center gap-2"><Shield size={18} className="text-primary" /> Security Settings</h2>
                    <div className="space-y-4">
                      <Toggle value={security.twoFactorEnabled} onChange={v => setSecurity(s => ({ ...s, twoFactorEnabled: v }))} label="Two-Factor Authentication" description="Add an extra layer of security to your account" />
                      <Toggle value={security.loginNotifications} onChange={v => setSecurity(s => ({ ...s, loginNotifications: v }))} label="Login Notifications" description="Get notified of new login attempts" />
                      <Field label="Session Timeout (minutes)" hint="Automatically log out after inactivity">
                        <select className={`${selectCls} max-w-xs`} value={security.sessionTimeout} onChange={e => setSecurity(s => ({ ...s, sessionTimeout: e.target.value }))}>
                          <option value="15">15 minutes</option>
                          <option value="30">30 minutes</option>
                          <option value="60">1 hour</option>
                          <option value="120">2 hours</option>
                          <option value="0">Never</option>
                        </select>
                      </Field>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'system' && (
                <motion.div key="system" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <h2 className="font-bold mb-5 flex items-center gap-2"><Globe size={18} className="text-primary" /> System Configuration</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="md:col-span-2">
                        <Field label="Company Name">
                          <input type="text" className={inputCls} value={system.companyName} onChange={e => setSystem(s => ({ ...s, companyName: e.target.value }))} />
                        </Field>
                      </div>
                      <Field label="Fiscal Year Start">
                        <select className={selectCls} value={system.fiscalYearStart} onChange={e => setSystem(s => ({ ...s, fiscalYearStart: e.target.value }))}>
                          {['January', 'April', 'July', 'October'].map(m => <option key={m}>{m}</option>)}
                        </select>
                      </Field>
                      <Field label="Payroll Cycle">
                        <select className={selectCls} value={system.payrollCycle} onChange={e => setSystem(s => ({ ...s, payrollCycle: e.target.value }))}>
                          <option>Monthly</option><option>Bi-Weekly</option><option>Weekly</option>
                        </select>
                      </Field>
                      <Field label="Working Days Per Week">
                        <select className={selectCls} value={system.workingDaysPerWeek} onChange={e => setSystem(s => ({ ...s, workingDaysPerWeek: e.target.value }))}>
                          <option value="5">5 Days (Mon–Fri)</option>
                          <option value="6">6 Days (Mon–Sat)</option>
                        </select>
                      </Field>
                      <Field label="Base Currency" hint="This currency will be used across all payroll transactions.">
                        <select className={selectCls} value={currencyCode} onChange={e => { setCurrency(e.target.value); toast.success(`Currency updated to ${currencies.find(c => c.code === e.target.value)?.name ?? e.target.value}`); }}>
                          {currencies.map(c => (
                            <option key={c.code} value={c.code}>{c.symbol} — {c.code} · {c.name}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <h2 className="font-bold mb-5 flex items-center gap-2"><Database size={18} className="text-primary" /> System Preferences</h2>
                    <div className="space-y-4">
                      <Toggle value={system.autoBackup} onChange={v => setSystem(s => ({ ...s, autoBackup: v }))} label="Automatic Backup" description="Daily automated backup of all HR data" />
                      <Toggle value={system.maintenanceMode} onChange={v => setSystem(s => ({ ...s, maintenanceMode: v }))} label="Maintenance Mode" description="Restrict access to admin only during maintenance" />
                      <Toggle value={system.debugMode} onChange={v => setSystem(s => ({ ...s, debugMode: v }))} label="Debug Mode" description="Enable detailed error logging for troubleshooting" />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'software' && (
                <motion.div key="software" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-8 text-center">
                    <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Palette size={32} className="text-violet-600" />
                    </div>
                    <h2 className="text-xl font-bold text-violet-900 mb-2">Software Settings</h2>
                    <p className="text-sm text-violet-700 mb-6 max-w-md mx-auto">
                      Customize the look and feel of the HRMS portal including menu colors, button colors, page themes, and print settings (Color vs Black & White).
                    </p>
                    <button
                      onClick={() => navigate('/settings/software')}
                      className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors shadow-md mx-auto"
                    >
                      <Sparkles size={16} /> Open Software Settings
                      <ArrowRight size={16} />
                    </button>
                    <div className="mt-6 grid grid-cols-3 gap-3 max-w-sm mx-auto">
                      {[
                        { icon: Brush, label: 'Color Themes', desc: '8 presets' },
                        { icon: Printer, label: 'Print Mode', desc: 'Color / B&W' },
                        { icon: Monitor, label: 'Layout', desc: 'Density & fonts' },
                      ].map(item => {
                        const Icon = item.icon;
                        return (
                          <div key={item.label} className="p-3 bg-white rounded-xl border border-violet-200 text-center">
                            <Icon size={18} className="text-violet-600 mx-auto mb-1" />
                            <p className="text-xs font-bold text-violet-800">{item.label}</p>
                            <p className="text-[10px] text-violet-600">{item.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}