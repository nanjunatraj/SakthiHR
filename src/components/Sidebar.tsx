import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Wallet,
  FileBarChart,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  CalendarRange,
  LogIn,
  ClipboardList,
  CircleDollarSign,
  UserSquare,
  Receipt,
  Play,
  ClipboardCheck,
  Banknote,
  ScrollText,
  TrendingUp,
  Shield,
  FileText,
  UserCheck,
  BookOpen,
  Network,
  Search,
  BarChart2,
  Palette,
  DoorOpen,
  Mail
} from 'lucide-react';
import { LogOut } from 'lucide-react';
import { REPORT_GROUPS, groupDestination } from '../data/reportGroups';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path?: string;
  children?: { icon: React.ElementType; label: string; path: string }[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  {
    icon: Users,
    label: 'HRMS',
    children: [
      { icon: UserSquare, label: 'Employee Directory', path: '/employees/directory' },
      { icon: Network, label: 'Employee Hierarchy', path: '/employees/hierarchy' },
      { icon: Search, label: 'Employee Search', path: '/employees/search' },
      { icon: DoorOpen, label: 'Employee Separation', path: '/exit' },
      { icon: UserCheck, label: 'Self-Service Portal', path: '/self-service' },
      { icon: BarChart2, label: 'Polls', path: '/polls' },
    ],
  },
  {
    icon: Clock,
    label: 'Attendance',
    children: [
      { icon: CalendarRange, label: 'Period Wise Entry', path: '/attendance/period-wise' },
      { icon: LogIn, label: 'Daily Check-in/Out', path: '/attendance/daily' },
      { icon: ClipboardList, label: 'Bulk Entry', path: '/attendance/bulk' },
    ],
  },
  { icon: CalendarDays, label: 'Leave', path: '/leave' },
  { icon: CircleDollarSign, label: 'Deductions', path: '/deductions' },
  {
    icon: Wallet, label: 'Payroll',
    children: [
      { icon: ClipboardCheck, label: 'Pre-Payroll Process', path: '/payroll/pre-payroll' },
      { icon: Play, label: 'Run Payroll', path: '/payroll' },
      { icon: Banknote, label: 'Salary Payment', path: '/payroll/salary-payment' },
      { icon: TrendingUp, label: 'Salary Revision', path: '/salary-revision' },
    ],
  },
  {
    icon: FileBarChart,
    label: 'Reports',
    children: REPORT_GROUPS.filter(g => !g.hidden).map(g => ({ icon: g.icon, label: g.title, path: groupDestination(g) })),
  },
  {
    icon: SlidersHorizontal,
    label: 'Configuration',
    children: [
      { icon: SlidersHorizontal, label: 'Masters & Setup', path: '/configuration' },
      { icon: Mail, label: 'Email Communications', path: '/email-communications' },
      { icon: Palette, label: 'Software Settings', path: '/settings/software' },
    ],
  },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

// Which top-level section a given route belongs to. Drives the accordion:
// a sub-menu is open only while its section is the active (selected) one.
const SECTION_PREFIXES: { label: string; prefixes: string[] }[] = [
  { label: 'HRMS', prefixes: ['/employees', '/exit', '/self-service', '/polls'] },
  { label: 'Attendance', prefixes: ['/attendance'] },
  { label: 'Payroll', prefixes: ['/payroll', '/salary-revision'] },
  { label: 'Reports', prefixes: ['/reports'] },
  { label: 'Configuration', prefixes: ['/configuration', '/email-communications', '/settings/software'] },
];

const sectionForPath = (pathname: string): string | null =>
  SECTION_PREFIXES.find(s =>
    s.prefixes.some(p => pathname === p || pathname.startsWith(p + '/'))
  )?.label ?? null;

const Sidebar = () => {
  const location = useLocation();
  const activeSection = sectionForPath(location.pathname);
  // Single-open accordion: the open sub-menu follows the selected section.
  // Navigating into a section opens it (and closes the others); landing on a
  // top-level leaf (Dashboard, Leave, Deductions) collapses everything.
  const [openMenu, setOpenMenu] = useState<string | null>(activeSection);
  const { settings } = useTheme();
  const { user, signOut } = useAuth();

  useEffect(() => {
    setOpenMenu(activeSection);
  }, [activeSection]);

  const toggleMenu = (label: string) => {
    setOpenMenu(prev => (prev === label ? null : label));
  };

  // Apply theme colors to sidebar
  const sidebarStyle = {
    backgroundColor: settings.colors.sidebarBg,
    borderRightColor: settings.colors.borderColor,
  };

  const getNavItemStyle = (isActive: boolean) => ({
    backgroundColor: isActive ? settings.colors.sidebarActiveItem : 'transparent',
    color: isActive ? settings.colors.sidebarActiveText : settings.colors.sidebarText,
  });

  const getNavItemHoverClass = (isActive: boolean) => {
    if (isActive) return '';
    return 'hover:opacity-80';
  };

  return (
    <aside className="w-64 border-r h-screen sticky top-0 flex flex-col" style={sidebarStyle}>
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: settings.colors.sidebarActiveItem }}>
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
            <img src="/logo-mark.png" alt="SakthiHR" className="w-7 h-7 object-contain" />
          </div>
          <span style={{ color: settings.colors.sidebarActiveItem }}>SakthiHR</span>
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children) {
            const isExpanded = openMenu === item.label;
            const isActive = activeSection === item.label;
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${getNavItemHoverClass(isActive)}`}
                  style={getNavItemStyle(isActive)}
                >
                  <item.icon size={20} />
                  <span className="font-medium flex-1 text-left">{item.label}</span>
                  {isExpanded
                    ? <ChevronDown size={15} className="shrink-0" />
                    : <ChevronRight size={15} className="shrink-0" />}
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 pl-3" style={{ borderLeftColor: settings.colors.borderColor }}>
                    {item.children.map(child => (
                      <NavLink
                        key={`${child.path}-${child.label}`}
                        to={child.path}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm
                        `}
                        style={({ isActive }) => ({
                          backgroundColor: isActive ? settings.colors.sidebarActiveItem : 'transparent',
                          color: isActive ? settings.colors.sidebarActiveText : settings.colors.sidebarText,
                        })}
                      >
                        <child.icon size={16} />
                        <span className="font-medium">{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path!}
              end={item.path === '/' || item.path === '/settings'}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
              `}
              style={({ isActive }) => ({
                backgroundColor: isActive ? settings.colors.sidebarActiveItem : 'transparent',
                color: isActive ? settings.colors.sidebarActiveText : settings.colors.sidebarText,
              })}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t space-y-1" style={{ borderTopColor: settings.colors.borderColor }}>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ color: settings.colors.sidebarText }}>
          <ShieldCheck size={20} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">Admin Access</p>
            {user?.email && (
              <p className="text-xs opacity-70 truncate" title={user.email}>{user.email}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => { void signOut(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 hover:opacity-80"
          style={{ color: settings.colors.sidebarText }}
        >
          <LogOut size={20} className="shrink-0" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;