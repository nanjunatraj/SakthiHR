import React, { useState } from 'react';
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
  MessageCircle,
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
    label: 'Employees',
    children: [
      { icon: UserSquare, label: 'Employee Directory', path: '/employees/directory' },
      { icon: Network, label: 'Employee Hierarchy', path: '/employees/hierarchy' },
      { icon: Search, label: 'Employee Search', path: '/employees/search' },
    ],
  },
  {
    icon: Wallet, label: 'Payroll', path: '/payroll',
    children: [
      { icon: ClipboardCheck, label: 'Pre-Payroll Process', path: '/payroll/pre-payroll' },
      { icon: Play, label: 'Run Payroll', path: '/payroll' },
      { icon: Banknote, label: 'Salary Payment', path: '/payroll/salary-payment' },
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
  { icon: TrendingUp, label: 'Salary Revision', path: '/salary-revision' },
  { icon: DoorOpen, label: 'Employee Separation', path: '/exit' },
  { icon: Mail, label: 'Email Communications', path: '/email-communications' },
  {
    icon: FileBarChart,
    label: 'Reports',
    children: REPORT_GROUPS.filter(g => !g.hidden).map(g => ({ icon: g.icon, label: g.title, path: groupDestination(g) })),
  },
  { icon: UserCheck, label: 'Self-Service Portal', path: '/self-service' },
  { icon: MessageCircle, label: 'WhatsApp', path: '/whatsapp' },
  { icon: BarChart2, label: 'Polls', path: '/polls' },
  { icon: SlidersHorizontal, label: 'Configuration', path: '/configuration' },
  {
    icon: Settings,
    label: 'Settings',
    children: [
      { icon: Settings, label: 'General Settings', path: '/settings' },
      { icon: Palette, label: 'Software Settings', path: '/settings/software' },
    ],
  },
];

const Sidebar = () => {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Employees', 'Attendance', 'Reports']);
  const { settings } = useTheme();
  const { user, signOut } = useAuth();

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const isEmployeesPath = location.pathname.startsWith('/employees');
  const isAttendancePath = location.pathname.startsWith('/attendance');
  const isReportsPath = location.pathname.startsWith('/reports');
  const isSettingsPath = location.pathname.startsWith('/settings');

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
        <h1 className="text-2xl font-serif font-bold flex items-center gap-2" style={{ color: settings.colors.sidebarActiveItem }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: settings.colors.sidebarActiveItem }}>
            <span className="text-sm" style={{ color: settings.colors.sidebarActiveText }}>S</span>
          </div>
          <span style={{ color: settings.colors.sidebarActiveItem }}>SakthiHR</span>
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children) {
            const isExpanded = expandedMenus.includes(item.label);
            const isActive =
              item.label === 'Employees' ? isEmployeesPath :
              item.label === 'Attendance' ? isAttendancePath :
              item.label === 'Reports' ? isReportsPath :
              item.label === 'Settings' ? isSettingsPath :
              false;
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
              end={item.path === '/'}
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