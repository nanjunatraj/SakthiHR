import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Printer, Monitor, Save, RefreshCw, CheckCircle2,
  ChevronLeft, Eye, Sliders, Type, Layout,
  Zap, ZapOff, AlignLeft, FileText, Droplets, Square, Circle,
  RotateCcw, Download, Info, AlertCircle, Check, ChevronRight,
  Sparkles, Brush, Layers, Settings2, Star, Sidebar
} from 'lucide-react';
import SidebarComponent from '../components/Sidebar';
import { toast } from 'react-toastify';
import { useTheme, COLOR_PRESETS, type ThemeColors, type PrintSettings } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

type SettingsTab = 'appearance' | 'colors' | 'print' | 'layout' | 'preview';

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

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  description?: string;
}

const ColorPicker = ({ label, value, onChange, description }: ColorPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hexInput, setHexInput] = useState(value);

  const handleHexChange = (hex: string) => {
    setHexInput(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  const handleColorChange = (color: string) => {
    setHexInput(color);
    onChange(color);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl border border-border hover:border-primary/30 transition-colors">
      <button
        onClick={() => inputRef.current?.click()}
        className="w-10 h-10 rounded-xl border-2 border-white shadow-md shrink-0 transition-transform hover:scale-105 cursor-pointer"
        style={{ backgroundColor: value }}
        title="Click to pick color"
      />
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={e => handleColorChange(e.target.value)}
        className="hidden"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
      </div>
      <input
        type="text"
        value={hexInput}
        onChange={e => handleHexChange(e.target.value)}
        onBlur={() => setHexInput(value)}
        className="w-24 px-2 py-1.5 bg-white border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-xs font-mono text-center transition-all"
        placeholder="#000000"
        maxLength={7}
      />
    </div>
  );
};

interface PresetCardProps {
  preset: { name: string; colors: ThemeColors };
  isActive: boolean;
  onApply: () => void;
}

const PresetCard = ({ preset, isActive, onApply }: PresetCardProps) => (
  <motion.button
    whileHover={{ y: -2 }}
    onClick={onApply}
    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${isActive ? 'border-primary shadow-md bg-primary/5' : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'}`}
  >
    {isActive && (
      <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
        <Check size={11} className="text-white" />
      </div>
    )}
    <div className="w-full h-12 rounded-lg overflow-hidden flex">
      <div className="w-1/3 h-full" style={{ backgroundColor: preset.colors.sidebarBg }} />
      <div className="flex-1 h-full flex flex-col">
        <div className="flex-1" style={{ backgroundColor: preset.colors.pageBg }} />
        <div className="h-3" style={{ backgroundColor: preset.colors.primaryBtn }} />
      </div>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-full border border-white/50 shadow-sm" style={{ backgroundColor: preset.colors.sidebarBg }} />
      <div className="w-3 h-3 rounded-full border border-white/50 shadow-sm" style={{ backgroundColor: preset.colors.primaryBtn }} />
      <div className="w-3 h-3 rounded-full border border-white/50 shadow-sm" style={{ backgroundColor: preset.colors.sidebarActiveItem }} />
    </div>
    <p className={`text-xs font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>{preset.name}</p>
  </motion.button>
);

interface PrintPreviewProps {
  print: PrintSettings;
}

const PrintPreview = ({ print }: PrintPreviewProps) => {
  const isColor = print.colorMode === 'color';
  const isLandscape = print.orientation === 'landscape';

  return (
    <div
      className={`relative bg-white border-2 border-gray-200 shadow-lg overflow-hidden mx-auto ${isLandscape ? 'w-full max-w-lg' : 'w-64'}`}
      style={{ aspectRatio: isLandscape ? '1.414' : '0.707' }}
    >
      <div className="absolute inset-0 p-3 flex flex-col text-[6px]" style={{ filter: isColor ? 'none' : 'grayscale(100%)' }}>
        {print.includeHeaderFooter && (
          <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2">
            {print.showLogo && (
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold" style={{ fontSize: '5px' }}>S</span>
                </div>
                <span className="font-bold text-gray-800" style={{ fontSize: '6px' }}>SakthiHR</span>
              </div>
            )}
            <div className="text-right text-gray-500" style={{ fontSize: '5px' }}>
              <div>Nexus Technologies Pvt. Ltd.</div>
              <div>Generated: {new Date().toLocaleDateString('en-IN')}</div>
            </div>
          </div>
        )}
        <div className="flex-1 space-y-1.5">
          <div className="h-2 rounded" style={{ backgroundColor: isColor ? '#3b82f6' : '#374151', width: '60%' }} />
          <div className="space-y-1">
            {[100, 85, 90, 75, 95].map((w, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="h-1 rounded" style={{ backgroundColor: isColor ? '#e5e7eb' : '#d1d5db', width: `${w}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {[
              { color: isColor ? '#dcfce7' : '#f3f4f6', border: isColor ? '#86efac' : '#d1d5db' },
              { color: isColor ? '#dbeafe' : '#f3f4f6', border: isColor ? '#93c5fd' : '#d1d5db' },
              { color: isColor ? '#fef3c7' : '#f3f4f6', border: isColor ? '#fcd34d' : '#d1d5db' },
            ].map((card, i) => (
              <div key={i} className="h-4 rounded border" style={{ backgroundColor: card.color, borderColor: card.border }} />
            ))}
          </div>
          <div className="space-y-0.5 mt-1">
            {[80, 65, 70, 55].map((w, i) => (
              <div key={i} className="h-0.5 rounded" style={{ backgroundColor: isColor ? '#e5e7eb' : '#d1d5db', width: `${w}%` }} />
            ))}
          </div>
        </div>
        {print.showWatermark && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transform: 'rotate(-30deg)' }}>
            <span className="font-bold text-gray-200 opacity-50" style={{ fontSize: '10px' }}>{print.watermarkText}</span>
          </div>
        )}
        {print.includeHeaderFooter && (
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 mt-1">
            <span className="text-gray-400" style={{ fontSize: '5px' }}>Confidential — For internal use only</span>
            {print.showPageNumbers && (
              <span className="text-gray-400" style={{ fontSize: '5px' }}>Page 1 of 1</span>
            )}
          </div>
        )}
      </div>
      {!isColor && (
        <div className="absolute top-1 right-1 bg-gray-800 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">B&W</div>
      )}
    </div>
  );
};

interface PortalPreviewProps {
  colors: ThemeColors;
}

const PortalPreview = ({ colors }: PortalPreviewProps) => (
  <div className="rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg" style={{ backgroundColor: colors.pageBg }}>
    <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: colors.headerBg, borderBottom: `1px solid ${colors.borderColor}` }}>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: colors.primaryBtn }}>
          <span className="text-white font-bold text-[8px]">S</span>
        </div>
        <span className="font-bold text-xs" style={{ color: colors.headerText }}>SakthiHR</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: colors.accentColor, border: `1px solid ${colors.borderColor}` }} />
        <div className="w-12 h-2 rounded" style={{ backgroundColor: colors.accentColor }} />
      </div>
    </div>
    <div className="flex" style={{ minHeight: '120px' }}>
      <div className="w-28 p-2 space-y-1" style={{ backgroundColor: colors.sidebarBg }}>
        {['Dashboard', 'Employees', 'Payroll', 'Reports', 'Settings'].map((item, i) => (
          <div
            key={item}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] font-medium"
            style={{
              backgroundColor: i === 0 ? colors.sidebarActiveItem : 'transparent',
              color: i === 0 ? colors.sidebarActiveText : colors.sidebarText,
            }}
          >
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: i === 0 ? colors.sidebarActiveText : colors.sidebarText, opacity: 0.6 }} />
            {item}
          </div>
        ))}
      </div>
      <div className="flex-1 p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[{ label: 'Employees', value: '154' }, { label: 'Payroll', value: '₹2.4L' }, { label: 'Leaves', value: '8' }].map(card => (
            <div key={card.label} className="p-2 rounded-lg" style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.borderColor}` }}>
              <p className="text-[8px] font-bold" style={{ color: colors.textPrimary }}>{card.value}</p>
              <p className="text-[7px]" style={{ color: colors.textSecondary }}>{card.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-lg text-[8px] font-bold" style={{ backgroundColor: colors.primaryBtn, color: colors.primaryBtnText }}>
            Add Employee
          </div>
          <div className="px-3 py-1 rounded-lg text-[8px] font-medium" style={{ backgroundColor: colors.secondaryBtn, color: colors.secondaryBtnText, border: `1px solid ${colors.borderColor}` }}>
            Export
          </div>
        </div>
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.borderColor}` }}>
          <div className="px-2 py-1" style={{ backgroundColor: colors.accentColor }}>
            <div className="grid grid-cols-3 gap-2">
              {['Name', 'Dept', 'Status'].map(h => (
                <span key={h} className="text-[7px] font-bold uppercase" style={{ color: colors.textSecondary }}>{h}</span>
              ))}
            </div>
          </div>
          {[['Sarah Jenkins', 'Engineering', 'Active'], ['Michael Chen', 'Marketing', 'Active']].map((row, i) => (
            <div key={i} className="px-2 py-1" style={{ backgroundColor: i % 2 === 0 ? colors.cardBg : colors.accentColor, borderTop: `1px solid ${colors.borderColor}` }}>
              <div className="grid grid-cols-3 gap-2">
                {row.map((cell, j) => (
                  <span key={j} className="text-[7px]" style={{ color: j === 2 ? colors.primaryBtn : colors.textPrimary, fontWeight: j === 0 ? 600 : 400 }}>{cell}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
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

export default function SoftwareSettings() {
  const navigate = useNavigate();
  const { settings, updateColors, updatePrint, updateSettings, applyPreset, resetToDefault } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    updateColors({ [key]: value });
    setHasUnsavedChanges(true);
  };

  const handlePrintChange = (key: keyof PrintSettings, value: any) => {
    updatePrint({ [key]: value });
    setHasUnsavedChanges(true);
  };

  const handleSettingsChange = (key: string, value: any) => {
    updateSettings({ [key]: value } as any);
    setHasUnsavedChanges(true);
  };

  const handleApplyPreset = (presetName: string) => {
    applyPreset(presetName);
    setHasUnsavedChanges(true);
    toast.success(`Theme preset "${presetName}" applied!`);
  };

  const handleSave = () => {
    setSavedIndicator(true);
    setHasUnsavedChanges(false);
    setTimeout(() => setSavedIndicator(false), 2000);
    toast.success('Software settings saved successfully!');
  };

  const handleReset = () => {
    resetToDefault();
    setHasUnsavedChanges(false);
    toast.info('Settings reset to default.');
  };

  const handleExportSettings = () => {
    const json = JSON.stringify(settings, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sakthihr_settings.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Settings exported as JSON.');
  };

  const tabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'colors', label: 'Color Settings', icon: Droplets },
    { key: 'print', label: 'Print Settings', icon: Printer },
    { key: 'layout', label: 'Layout & Display', icon: Layout },
    { key: 'preview', label: 'Live Preview', icon: Eye },
  ];

  const COLOR_SECTIONS: {
    title: string;
    description: string;
    icon: React.ElementType;
    accentBg: string;
    accentColor: string;
    fields: { key: keyof ThemeColors; label: string; description: string }[];
  }[] = [
    {
      title: 'Sidebar / Menu Colors',
      description: 'Customize the navigation sidebar appearance',
      icon: Sidebar,
      accentBg: 'bg-indigo-100',
      accentColor: 'text-indigo-600',
      fields: [
        { key: 'sidebarBg', label: 'Sidebar Background', description: 'Main background color of the sidebar' },
        { key: 'sidebarText', label: 'Sidebar Text', description: 'Default text color for menu items' },
        { key: 'sidebarActiveItem', label: 'Active Menu Item', description: 'Background of the selected/active menu item' },
        { key: 'sidebarActiveText', label: 'Active Item Text', description: 'Text color of the active menu item' },
        { key: 'sidebarHoverBg', label: 'Hover Background', description: 'Background when hovering over menu items' },
      ],
    },
    {
      title: 'Button Colors',
      description: 'Customize primary and secondary button styles',
      icon: Square,
      accentBg: 'bg-blue-100',
      accentColor: 'text-blue-600',
      fields: [
        { key: 'primaryBtn', label: 'Primary Button Background', description: 'Background color of primary action buttons' },
        { key: 'primaryBtnText', label: 'Primary Button Text', description: 'Text color on primary buttons' },
        { key: 'secondaryBtn', label: 'Secondary Button Background', description: 'Background color of secondary buttons' },
        { key: 'secondaryBtnText', label: 'Secondary Button Text', description: 'Text color on secondary buttons' },
      ],
    },
    {
      title: 'Page & Card Colors',
      description: 'Customize the main content area appearance',
      icon: Layers,
      accentBg: 'bg-emerald-100',
      accentColor: 'text-emerald-600',
      fields: [
        { key: 'pageBg', label: 'Page Background', description: 'Main background color of the application' },
        { key: 'cardBg', label: 'Card Background', description: 'Background color of cards and panels' },
        { key: 'accentColor', label: 'Accent / Highlight', description: 'Subtle accent color for highlights and hover states' },
        { key: 'borderColor', label: 'Border Color', description: 'Color of borders and dividers' },
      ],
    },
    {
      title: 'Header & Text Colors',
      description: 'Customize the top header and typography',
      icon: Type,
      accentBg: 'bg-violet-100',
      accentColor: 'text-violet-600',
      fields: [
        { key: 'headerBg', label: 'Header Background', description: 'Background color of the top navigation bar' },
        { key: 'headerText', label: 'Header Text', description: 'Text color in the header area' },
        { key: 'textPrimary', label: 'Primary Text', description: 'Main body text color' },
        { key: 'textSecondary', label: 'Secondary Text', description: 'Muted/secondary text color' },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarComponent />
      <main className="flex-1 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/settings')}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-lg">
                <Palette size={22} className="text-violet-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-serif">Software Settings</h1>
                <p className="text-xs text-muted-foreground">
                  Customize the look, feel, and print settings of the HRMS portal.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium"
                >
                  <AlertCircle size={13} /> Unsaved changes
                </motion.div>
              )}
              {savedIndicator && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium"
                >
                  <CheckCircle2 size={13} /> Saved!
                </motion.div>
              )}
              <button
                onClick={handleExportSettings}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground"
              >
                <Download size={15} /> Export
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground"
              >
                <RotateCcw size={15} /> Reset
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"
              >
                <Save size={15} /> Save Settings
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex items-center gap-0.5 mt-3 overflow-x-auto">
            {tabs.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg border-b-2 whitespace-nowrap ${
                    isActive
                      ? 'text-primary border-primary bg-primary/5'
                      : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  <TabIcon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-8 py-6">
          <AnimatePresence mode="wait">

            {/* ── Appearance Tab ── */}
            {activeTab === 'appearance' && (
              <motion.div key="appearance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                {/* Current Theme Info */}
                <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <Sparkles size={22} className="text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-base text-violet-900">
                      Current Theme: <span className="text-violet-700">{settings.presetName}</span>
                    </p>
                    <p className="text-xs text-violet-700 mt-0.5">
                      Customize colors, layout, and print settings to match your organisation's branding.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: settings.colors.sidebarBg }} />
                    <div className="w-6 h-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: settings.colors.primaryBtn }} />
                    <div className="w-6 h-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: settings.colors.sidebarActiveItem }} />
                  </div>
                </div>

                {/* Color Presets */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <SectionHeader
                    icon={Star}
                    title="Color Presets"
                    subtitle="Choose from pre-designed color themes or create your own in the Color Settings tab"
                    accentBg="bg-amber-100"
                    accentColor="text-amber-600"
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {COLOR_PRESETS.map(preset => (
                      <PresetCard
                        key={preset.name}
                        preset={preset}
                        isActive={settings.presetName === preset.name}
                        onApply={() => handleApplyPreset(preset.name)}
                      />
                    ))}
                  </div>
                </div>

                {/* Quick Color Customization */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <SectionHeader
                    icon={Brush}
                    title="Quick Customization"
                    subtitle="Adjust the most common colors quickly"
                    accentBg="bg-blue-100"
                    accentColor="text-blue-600"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorPicker
                      label="Sidebar / Menu Background"
                      value={settings.colors.sidebarBg}
                      onChange={v => handleColorChange('sidebarBg', v)}
                      description="Main navigation sidebar color"
                    />
                    <ColorPicker
                      label="Primary Button Color"
                      value={settings.colors.primaryBtn}
                      onChange={v => handleColorChange('primaryBtn', v)}
                      description="Color of primary action buttons"
                    />
                    <ColorPicker
                      label="Active Menu Item"
                      value={settings.colors.sidebarActiveItem}
                      onChange={v => handleColorChange('sidebarActiveItem', v)}
                      description="Highlighted active menu item"
                    />
                    <ColorPicker
                      label="Page Background"
                      value={settings.colors.pageBg}
                      onChange={v => handleColorChange('pageBg', v)}
                      description="Main application background"
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab('colors')}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <Droplets size={14} /> Full Color Settings
                      <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => setActiveTab('preview')}
                      className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <Eye size={14} /> Preview Changes
                    </button>
                  </div>
                </div>

                {/* Print Mode Quick Setting */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <SectionHeader
                    icon={Printer}
                    title="Print Mode"
                    subtitle="Choose whether reports print in color or black & white"
                    accentBg="bg-gray-100"
                    accentColor="text-gray-600"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { handlePrintChange('colorMode', 'color'); toast.success('Print mode set to Color.'); }}
                      className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${settings.print.colorMode === 'color' ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-card hover:border-primary/40'}`}
                    >
                      <div className="w-16 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                        <div className="h-4 bg-blue-600" />
                        <div className="p-2 space-y-1">
                          <div className="h-1.5 bg-green-400 rounded w-3/4" />
                          <div className="h-1.5 bg-amber-400 rounded w-1/2" />
                          <div className="h-1.5 bg-red-400 rounded w-2/3" />
                          <div className="grid grid-cols-3 gap-0.5 mt-1">
                            <div className="h-3 bg-blue-100 rounded" />
                            <div className="h-3 bg-green-100 rounded" />
                            <div className="h-3 bg-amber-100 rounded" />
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className={`font-bold text-sm ${settings.print.colorMode === 'color' ? 'text-primary' : 'text-foreground'}`}>Color Print</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Full color output for all reports</p>
                      </div>
                      {settings.print.colorMode === 'color' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                          <Check size={9} /> Active
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => { handlePrintChange('colorMode', 'bw'); toast.success('Print mode set to Black & White.'); }}
                      className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${settings.print.colorMode === 'bw' ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-card hover:border-primary/40'}`}
                    >
                      <div className="w-16 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ filter: 'grayscale(100%)' }}>
                        <div className="h-4 bg-gray-800" />
                        <div className="p-2 space-y-1">
                          <div className="h-1.5 bg-gray-600 rounded w-3/4" />
                          <div className="h-1.5 bg-gray-400 rounded w-1/2" />
                          <div className="h-1.5 bg-gray-500 rounded w-2/3" />
                          <div className="grid grid-cols-3 gap-0.5 mt-1">
                            <div className="h-3 bg-gray-200 rounded" />
                            <div className="h-3 bg-gray-300 rounded" />
                            <div className="h-3 bg-gray-200 rounded" />
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className={`font-bold text-sm ${settings.print.colorMode === 'bw' ? 'text-primary' : 'text-foreground'}`}>Black & White</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Grayscale output for all reports</p>
                      </div>
                      {settings.print.colorMode === 'bw' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                          <Check size={9} /> Active
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Colors Tab ── */}
            {activeTab === 'colors' && (
              <motion.div key="colors" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <Info size={17} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Full Color Customization</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Customize every color in the portal including menu background, button colors, and page colors. Click any color swatch to open the color picker, or type a hex code directly.
                    </p>
                  </div>
                </div>

                {/* Live Mini Preview */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm flex items-center gap-2"><Eye size={15} className="text-primary" /> Live Preview</h3>
                    <button onClick={() => setActiveTab('preview')} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                      Full Preview <ChevronRight size={12} />
                    </button>
                  </div>
                  <PortalPreview colors={settings.colors} />
                </div>

                {/* Color Sections */}
                {COLOR_SECTIONS.map(section => {
                  const SectionIcon = section.icon;
                  return (
                    <div key={section.title} className="bg-card rounded-xl border border-border shadow-sm p-6">
                      <SectionHeader
                        icon={SectionIcon}
                        title={section.title}
                        subtitle={section.description}
                        accentBg={section.accentBg}
                        accentColor={section.accentColor}
                      />
                      <div className="space-y-3">
                        {section.fields.map(field => (
                          <ColorPicker
                            key={field.key}
                            label={field.label}
                            value={settings.colors[field.key]}
                            onChange={v => handleColorChange(field.key, v)}
                            description={field.description}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Reset Colors */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">Reset All Colors</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Restore all colors to the default blue theme</p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/5 transition-colors"
                    >
                      <RotateCcw size={14} /> Reset to Default
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Print Settings Tab ── */}
            {activeTab === 'print' && (
              <motion.div key="print" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Settings Panel */}
                  <div className="space-y-5">
                    {/* Color Mode */}
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                      <SectionHeader
                        icon={Printer}
                        title="Print Color Mode"
                        subtitle="Choose whether reports print in color or black & white"
                        accentBg="bg-gray-100"
                        accentColor="text-gray-600"
                      />
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <button
                          onClick={() => handlePrintChange('colorMode', 'color')}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${settings.print.colorMode === 'color' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 via-green-400 to-amber-400 shrink-0" />
                          <div className="text-left">
                            <p className={`font-bold text-sm ${settings.print.colorMode === 'color' ? 'text-primary' : 'text-foreground'}`}>Color</p>
                            <p className="text-[10px] text-muted-foreground">Full color output</p>
                          </div>
                          {settings.print.colorMode === 'color' && <Check size={14} className="text-primary ml-auto shrink-0" />}
                        </button>
                        <button
                          onClick={() => handlePrintChange('colorMode', 'bw')}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${settings.print.colorMode === 'bw' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-800 via-gray-500 to-gray-300 shrink-0" />
                          <div className="text-left">
                            <p className={`font-bold text-sm ${settings.print.colorMode === 'bw' ? 'text-primary' : 'text-foreground'}`}>Black & White</p>
                            <p className="text-[10px] text-muted-foreground">Grayscale output</p>
                          </div>
                          {settings.print.colorMode === 'bw' && <Check size={14} className="text-primary ml-auto shrink-0" />}
                        </button>
                      </div>
                      <div className={`flex items-start gap-3 p-3 rounded-xl border ${settings.print.colorMode === 'color' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                        <Info size={14} className={settings.print.colorMode === 'color' ? 'text-blue-600 shrink-0 mt-0.5' : 'text-gray-500 shrink-0 mt-0.5'} />
                        <p className={`text-xs ${settings.print.colorMode === 'color' ? 'text-blue-700' : 'text-gray-600'}`}>
                          {settings.print.colorMode === 'color'
                            ? 'All reports, payslips, registers, and documents will print with full color. Recommended for professional presentations.'
                            : 'All reports will print in grayscale. Ideal for saving ink costs and for formal/legal document submissions.'}
                        </p>
                      </div>
                    </div>

                    {/* Paper Settings */}
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                      <SectionHeader
                        icon={FileText}
                        title="Paper Settings"
                        subtitle="Configure paper size and orientation for all reports"
                        accentBg="bg-indigo-100"
                        accentColor="text-indigo-600"
                      />
                      <div className="space-y-4">
                        <Field label="Paper Size">
                          <select className={selectCls} value={settings.print.paperSize} onChange={e => handlePrintChange('paperSize', e.target.value)}>
                            <option value="A4">A4 (210 × 297 mm) — Standard</option>
                            <option value="Letter">Letter (216 × 279 mm) — US Standard</option>
                            <option value="Legal">Legal (216 × 356 mm) — Legal Documents</option>
                          </select>
                        </Field>
                        <Field label="Orientation">
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { value: 'portrait', label: 'Portrait', desc: 'Vertical (default)' },
                              { value: 'landscape', label: 'Landscape', desc: 'Horizontal' },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => handlePrintChange('orientation', opt.value)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${settings.print.orientation === opt.value ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
                              >
                                <div
                                  className={`border-2 border-current rounded shrink-0 ${opt.value === 'portrait' ? 'w-5 h-7' : 'w-7 h-5'} ${settings.print.orientation === opt.value ? 'border-primary' : 'border-muted-foreground'}`}
                                />
                                <div className="text-left">
                                  <p className={`font-bold text-xs ${settings.print.orientation === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </Field>
                        <Field label="Font Size">
                          <select className={selectCls} value={settings.print.fontSize} onChange={e => handlePrintChange('fontSize', e.target.value)}>
                            <option value="small">Small (9pt) — More content per page</option>
                            <option value="medium">Medium (11pt) — Standard</option>
                            <option value="large">Large (13pt) — Better readability</option>
                          </select>
                        </Field>
                      </div>
                    </div>

                    {/* Header & Footer */}
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                      <SectionHeader
                        icon={AlignLeft}
                        title="Header, Footer & Watermark"
                        subtitle="Configure what appears on printed documents"
                        accentBg="bg-emerald-100"
                        accentColor="text-emerald-600"
                      />
                      <div className="space-y-4">
                        <ToggleSwitch
                          value={settings.print.includeHeaderFooter}
                          onChange={v => handlePrintChange('includeHeaderFooter', v)}
                          label="Include Header & Footer"
                          description="Show company name, date, and page info on all printed documents"
                        />
                        <ToggleSwitch
                          value={settings.print.showLogo}
                          onChange={v => handlePrintChange('showLogo', v)}
                          label="Show Company Logo"
                          description="Print the company logo in the header of all documents"
                        />
                        <ToggleSwitch
                          value={settings.print.showPageNumbers}
                          onChange={v => handlePrintChange('showPageNumbers', v)}
                          label="Show Page Numbers"
                          description="Display page numbers in the footer"
                        />
                        <div className="pt-3 border-t border-border">
                          <ToggleSwitch
                            value={settings.print.showWatermark}
                            onChange={v => handlePrintChange('showWatermark', v)}
                            label="Show Watermark"
                            description="Print a diagonal watermark text on all documents"
                          />
                          {settings.print.showWatermark && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 overflow-hidden"
                            >
                              <Field label="Watermark Text">
                                <input
                                  type="text"
                                  className={inputCls}
                                  placeholder="e.g. CONFIDENTIAL, DRAFT, COPY"
                                  value={settings.print.watermarkText}
                                  onChange={e => handlePrintChange('watermarkText', e.target.value)}
                                  maxLength={30}
                                />
                              </Field>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Print Preview Panel */}
                  <div className="space-y-5">
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6 sticky top-24">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Eye size={15} className="text-primary" /> Print Preview
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${settings.print.colorMode === 'color' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {settings.print.colorMode === 'color' ? '🎨 Color Mode' : '⬛ B&W Mode'}
                        </span>
                      </div>
                      <PrintPreview print={settings.print} />
                      <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                        {[
                          { label: 'Paper Size', value: settings.print.paperSize },
                          { label: 'Orientation', value: settings.print.orientation.charAt(0).toUpperCase() + settings.print.orientation.slice(1) },
                          { label: 'Color Mode', value: settings.print.colorMode === 'color' ? 'Full Color' : 'Black & White', colored: true },
                          { label: 'Font Size', value: settings.print.fontSize.charAt(0).toUpperCase() + settings.print.fontSize.slice(1) },
                          { label: 'Header & Footer', value: settings.print.includeHeaderFooter ? 'Enabled' : 'Disabled' },
                          { label: 'Watermark', value: settings.print.showWatermark ? settings.print.watermarkText : 'None' },
                        ].map(row => (
                          <div key={row.label} className="flex items-center justify-between px-3 py-2 bg-accent/30 rounded-lg">
                            <span>{row.label}</span>
                            <span className={`font-semibold ${row.colored ? (settings.print.colorMode === 'color' ? 'text-blue-600' : 'text-gray-600') : 'text-foreground'}`}>
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-start gap-2">
                          <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-700">
                            These settings apply to all reports including Payslips, Wage Register, Attendance Register, Statutory Reports, and all other printable documents.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Layout Tab ── */}
            {activeTab === 'layout' && (
              <motion.div key="layout" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6 max-w-2xl">
                {/* Font Family */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <SectionHeader
                    icon={Type}
                    title="Typography"
                    subtitle="Configure font family and text settings"
                    accentBg="bg-violet-100"
                    accentColor="text-violet-600"
                  />
                  <Field label="Font Family" hint="Applied to all text in the portal">
                    <select className={selectCls} value={settings.fontFamily} onChange={e => handleSettingsChange('fontFamily', e.target.value)}>
                      <option value="Inter">Inter — Modern & Clean (Default)</option>
                      <option value="Roboto">Roboto — Google's Material Design</option>
                      <option value="Open Sans">Open Sans — Highly Readable</option>
                      <option value="Poppins">Poppins — Geometric & Friendly</option>
                      <option value="Lato">Lato — Professional & Elegant</option>
                      <option value="Nunito">Nunito — Rounded & Approachable</option>
                    </select>
                  </Field>
                </div>

                {/* Border Radius */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <SectionHeader
                    icon={Circle}
                    title="Border Radius"
                    subtitle="Control the roundness of cards, buttons, and inputs"
                    accentBg="bg-blue-100"
                    accentColor="text-blue-600"
                  />
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { value: 'none', label: 'None' },
                      { value: 'small', label: 'Small' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'large', label: 'Large' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => handleSettingsChange('borderRadius', opt.value)}
                        className={`flex flex-col items-center gap-2 p-4 border-2 transition-all ${settings.borderRadius === opt.value ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
                        style={{ borderRadius: opt.value === 'none' ? '0' : opt.value === 'small' ? '4px' : opt.value === 'medium' ? '8px' : '16px' }}
                      >
                        <div
                          className="w-10 h-10 bg-primary/20 border-2 border-primary/40"
                          style={{ borderRadius: opt.value === 'none' ? '0' : opt.value === 'small' ? '4px' : opt.value === 'medium' ? '8px' : '16px' }}
                        />
                        <p className={`text-xs font-semibold ${settings.borderRadius === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Density */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <SectionHeader
                    icon={Sliders}
                    title="Display Density"
                    subtitle="Control the spacing and density of the interface"
                    accentBg="bg-emerald-100"
                    accentColor="text-emerald-600"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'compact', label: 'Compact', desc: 'More content, less spacing' },
                      { value: 'comfortable', label: 'Comfortable', desc: 'Balanced spacing (default)' },
                      { value: 'spacious', label: 'Spacious', desc: 'More breathing room' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => handleSettingsChange('density', opt.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${settings.density === opt.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
                      >
                        <div className="space-y-1 w-full">
                          {[1, 2, 3].map(i => (
                            <div
                              key={i}
                              className="h-1.5 bg-primary/30 rounded-full"
                              style={{ marginTop: opt.value === 'compact' ? '1px' : opt.value === 'comfortable' ? '3px' : '5px' }}
                            />
                          ))}
                        </div>
                        <p className={`text-xs font-bold ${settings.density === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground text-center">{opt.desc}</p>
                        {settings.density === opt.value && <Check size={12} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Animations */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <SectionHeader
                    icon={Zap}
                    title="Animations & Transitions"
                    subtitle="Control motion and animation effects"
                    accentBg="bg-amber-100"
                    accentColor="text-amber-600"
                  />
                  <div className="space-y-4">
                    <ToggleSwitch
                      value={settings.animationsEnabled}
                      onChange={v => handleSettingsChange('animationsEnabled', v)}
                      label="Enable Animations"
                      description="Smooth transitions, hover effects, and page animations"
                    />
                    <div className={`flex items-start gap-3 p-3 rounded-xl border ${settings.animationsEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      {settings.animationsEnabled ? (
                        <>
                          <Zap size={14} className="text-green-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-green-700">Animations are enabled. The portal will use smooth transitions and hover effects for a polished experience.</p>
                        </>
                      ) : (
                        <>
                          <ZapOff size={14} className="text-gray-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-600">Animations are disabled. The portal will use instant transitions for better performance on slower devices.</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Preview Tab ── */}
            {activeTab === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <Eye size={17} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-800">Live Preview</p>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      This preview shows how your color and layout settings will look in the actual portal. Changes are reflected in real-time as you adjust settings.
                    </p>
                  </div>
                </div>

                {/* Portal Preview */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Monitor size={15} className="text-primary" /> Portal Interface Preview
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                  </div>
                  <PortalPreview colors={settings.colors} />
                </div>

                {/* Print Preview */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Printer size={15} className="text-primary" /> Print Output Preview
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${settings.print.colorMode === 'color' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {settings.print.colorMode === 'color' ? '🎨 Color' : '⬛ B&W'}
                    </span>
                  </div>
                  <div className="flex items-center justify-center py-4">
                    <PrintPreview print={settings.print} />
                  </div>
                </div>

                {/* Current Settings Summary */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                    <Settings2 size={15} className="text-primary" /> Current Settings Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Theme Preset', value: settings.presetName },
                      { label: 'Print Mode', value: settings.print.colorMode === 'color' ? 'Full Color' : 'Black & White' },
                      { label: 'Paper Size', value: settings.print.paperSize },
                      { label: 'Orientation', value: settings.print.orientation.charAt(0).toUpperCase() + settings.print.orientation.slice(1) },
                      { label: 'Font Family', value: settings.fontFamily },
                      { label: 'Border Radius', value: settings.borderRadius.charAt(0).toUpperCase() + settings.borderRadius.slice(1) },
                      { label: 'Density', value: settings.density.charAt(0).toUpperCase() + settings.density.slice(1) },
                      { label: 'Animations', value: settings.animationsEnabled ? 'Enabled' : 'Disabled' },
                      { label: 'Watermark', value: settings.print.showWatermark ? settings.print.watermarkText : 'None' },
                    ].map(row => (
                      <div key={row.label} className="p-3 bg-accent/30 rounded-xl border border-border">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{row.label}</p>
                        <p className="text-sm font-semibold mt-0.5">{row.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Color Swatches */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Active Color Palette</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Sidebar', color: settings.colors.sidebarBg },
                        { label: 'Active', color: settings.colors.sidebarActiveItem },
                        { label: 'Primary Btn', color: settings.colors.primaryBtn },
                        { label: 'Page BG', color: settings.colors.pageBg },
                        { label: 'Card', color: settings.colors.cardBg },
                        { label: 'Accent', color: settings.colors.accentColor },
                        { label: 'Border', color: settings.colors.borderColor },
                        { label: 'Text', color: settings.colors.textPrimary },
                      ].map(swatch => (
                        <div key={swatch.label} className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-lg border-2 border-white shadow-sm" style={{ backgroundColor: swatch.color }} />
                          <span className="text-[9px] text-muted-foreground font-medium">{swatch.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border shadow-sm">
                  <div className="text-sm text-muted-foreground">
                    {hasUnsavedChanges ? (
                      <span className="flex items-center gap-2 text-amber-600 font-medium">
                        <AlertCircle size={14} /> You have unsaved changes
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-green-600 font-medium">
                        <CheckCircle2 size={14} /> All settings saved
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleReset} className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors">
                      Reset to Default
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
                      <Save size={15} /> Save All Settings
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}