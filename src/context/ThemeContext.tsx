import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface ThemeColors {
  sidebarBg: string;
  sidebarText: string;
  sidebarActiveItem: string;
  sidebarActiveText: string;
  sidebarHoverBg: string;
  primaryBtn: string;
  primaryBtnText: string;
  secondaryBtn: string;
  secondaryBtnText: string;
  headerBg: string;
  headerText: string;
  pageBg: string;
  cardBg: string;
  accentColor: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

export interface PrintSettings {
  colorMode: 'color' | 'bw';
  includeHeaderFooter: boolean;
  paperSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  fontSize: 'small' | 'medium' | 'large';
  showLogo: boolean;
  showPageNumbers: boolean;
  showWatermark: boolean;
  watermarkText: string;
}

export interface SoftwareSettings {
  theme: 'light' | 'dark' | 'custom';
  presetName: string;
  colors: ThemeColors;
  print: PrintSettings;
  fontFamily: string;
  borderRadius: 'none' | 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
  animationsEnabled: boolean;
  sidebarCollapsed: boolean;
}

const DEFAULT_COLORS: ThemeColors = {
  sidebarBg: '#ffffff',
  sidebarText: '#6b7280',
  sidebarActiveItem: '#3b82f6',
  sidebarActiveText: '#ffffff',
  sidebarHoverBg: '#f3f4f6',
  primaryBtn: '#3b82f6',
  primaryBtnText: '#ffffff',
  secondaryBtn: '#f3f4f6',
  secondaryBtnText: '#374151',
  headerBg: '#ffffff',
  headerText: '#111827',
  pageBg: '#f8fafc',
  cardBg: '#ffffff',
  accentColor: '#eff6ff',
  borderColor: '#e5e7eb',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
};

const DEFAULT_PRINT: PrintSettings = {
  colorMode: 'color',
  includeHeaderFooter: true,
  paperSize: 'A4',
  orientation: 'portrait',
  fontSize: 'medium',
  showLogo: true,
  showPageNumbers: true,
  showWatermark: false,
  watermarkText: 'CONFIDENTIAL',
};

const DEFAULT_SETTINGS: SoftwareSettings = {
  theme: 'light',
  presetName: 'Default Blue',
  colors: DEFAULT_COLORS,
  print: DEFAULT_PRINT,
  fontFamily: 'Inter',
  borderRadius: 'large',
  density: 'comfortable',
  animationsEnabled: true,
  sidebarCollapsed: false,
};

export const COLOR_PRESETS: { name: string; colors: ThemeColors }[] = [
  {
    name: 'Default Blue',
    colors: DEFAULT_COLORS,
  },
  {
    name: 'Forest Green',
    colors: {
      ...DEFAULT_COLORS,
      sidebarBg: '#064e3b',
      sidebarText: '#a7f3d0',
      sidebarActiveItem: '#10b981',
      sidebarActiveText: '#ffffff',
      sidebarHoverBg: '#065f46',
      primaryBtn: '#10b981',
      primaryBtnText: '#ffffff',
      accentColor: '#ecfdf5',
    },
  },
  {
    name: 'Royal Purple',
    colors: {
      ...DEFAULT_COLORS,
      sidebarBg: '#4c1d95',
      sidebarText: '#ddd6fe',
      sidebarActiveItem: '#8b5cf6',
      sidebarActiveText: '#ffffff',
      sidebarHoverBg: '#5b21b6',
      primaryBtn: '#8b5cf6',
      primaryBtnText: '#ffffff',
      accentColor: '#f5f3ff',
    },
  },
  {
    name: 'Crimson Red',
    colors: {
      ...DEFAULT_COLORS,
      sidebarBg: '#7f1d1d',
      sidebarText: '#fecaca',
      sidebarActiveItem: '#ef4444',
      sidebarActiveText: '#ffffff',
      sidebarHoverBg: '#991b1b',
      primaryBtn: '#ef4444',
      primaryBtnText: '#ffffff',
      accentColor: '#fef2f2',
    },
  },
  {
    name: 'Ocean Teal',
    colors: {
      ...DEFAULT_COLORS,
      sidebarBg: '#134e4a',
      sidebarText: '#99f6e4',
      sidebarActiveItem: '#14b8a6',
      sidebarActiveText: '#ffffff',
      sidebarHoverBg: '#115e59',
      primaryBtn: '#14b8a6',
      primaryBtnText: '#ffffff',
      accentColor: '#f0fdfa',
    },
  },
  {
    name: 'Midnight Dark',
    colors: {
      ...DEFAULT_COLORS,
      sidebarBg: '#0f172a',
      sidebarText: '#94a3b8',
      sidebarActiveItem: '#6366f1',
      sidebarActiveText: '#ffffff',
      sidebarHoverBg: '#1e293b',
      primaryBtn: '#6366f1',
      primaryBtnText: '#ffffff',
      pageBg: '#f1f5f9',
      accentColor: '#eef2ff',
    },
  },
  {
    name: 'Warm Amber',
    colors: {
      ...DEFAULT_COLORS,
      sidebarBg: '#78350f',
      sidebarText: '#fde68a',
      sidebarActiveItem: '#f59e0b',
      sidebarActiveText: '#ffffff',
      sidebarHoverBg: '#92400e',
      primaryBtn: '#f59e0b',
      primaryBtnText: '#ffffff',
      accentColor: '#fffbeb',
    },
  },
  {
    name: 'Slate Gray',
    colors: {
      ...DEFAULT_COLORS,
      sidebarBg: '#1e293b',
      sidebarText: '#94a3b8',
      sidebarActiveItem: '#475569',
      sidebarActiveText: '#ffffff',
      sidebarHoverBg: '#334155',
      primaryBtn: '#475569',
      primaryBtnText: '#ffffff',
      accentColor: '#f8fafc',
    },
  },
];

const STORAGE_KEY = 'hrms_software_settings';

interface ThemeContextValue {
  settings: SoftwareSettings;
  updateColors: (colors: Partial<ThemeColors>) => void;
  updatePrint: (print: Partial<PrintSettings>) => void;
  updateSettings: (settings: Partial<SoftwareSettings>) => void;
  applyPreset: (presetName: string) => void;
  resetToDefault: () => void;
  getCSSVariables: () => Record<string, string>;
}

const ThemeContext = createContext<ThemeContextValue>({
  settings: DEFAULT_SETTINGS,
  updateColors: () => {},
  updatePrint: () => {},
  updateSettings: () => {},
  applyPreset: () => {},
  resetToDefault: () => {},
  getCSSVariables: () => ({}),
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SoftwareSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          colors: { ...DEFAULT_COLORS, ...parsed.colors },
          print: { ...DEFAULT_PRINT, ...parsed.print },
        };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
    applyThemeToDOM(settings);
  }, [settings]);

  const applyThemeToDOM = (s: SoftwareSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--theme-sidebar-bg', s.colors.sidebarBg);
    root.style.setProperty('--theme-sidebar-text', s.colors.sidebarText);
    root.style.setProperty('--theme-sidebar-active', s.colors.sidebarActiveItem);
    root.style.setProperty('--theme-sidebar-active-text', s.colors.sidebarActiveText);
    root.style.setProperty('--theme-sidebar-hover', s.colors.sidebarHoverBg);
    root.style.setProperty('--theme-primary-btn', s.colors.primaryBtn);
    root.style.setProperty('--theme-primary-btn-text', s.colors.primaryBtnText);
    root.style.setProperty('--theme-page-bg', s.colors.pageBg);
    root.style.setProperty('--theme-card-bg', s.colors.cardBg);
    root.style.setProperty('--theme-border', s.colors.borderColor);
    root.style.setProperty('--theme-text-primary', s.colors.textPrimary);
    root.style.setProperty('--theme-text-secondary', s.colors.textSecondary);
    root.style.setProperty('--theme-accent', s.colors.accentColor);
  };

  const updateColors = useCallback((colors: Partial<ThemeColors>) => {
    setSettings(prev => ({
      ...prev,
      colors: { ...prev.colors, ...colors },
      theme: 'custom',
      presetName: 'Custom',
    }));
  }, []);

  const updatePrint = useCallback((print: Partial<PrintSettings>) => {
    setSettings(prev => ({ ...prev, print: { ...prev.print, ...print } }));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<SoftwareSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const applyPreset = useCallback((presetName: string) => {
    const preset = COLOR_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setSettings(prev => ({
        ...prev,
        colors: preset.colors,
        presetName,
        theme: presetName === 'Default Blue' ? 'light' : 'custom',
      }));
    }
  }, []);

  const resetToDefault = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const getCSSVariables = useCallback(() => ({
    '--theme-sidebar-bg': settings.colors.sidebarBg,
    '--theme-sidebar-text': settings.colors.sidebarText,
    '--theme-sidebar-active': settings.colors.sidebarActiveItem,
    '--theme-primary-btn': settings.colors.primaryBtn,
  }), [settings]);

  return (
    <ThemeContext.Provider value={{ settings, updateColors, updatePrint, updateSettings, applyPreset, resetToDefault, getCSSVariables }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}