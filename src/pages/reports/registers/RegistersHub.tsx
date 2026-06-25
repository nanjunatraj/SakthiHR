import React from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, ChevronRight, ChevronLeft,
  Clock, DollarSign, CalendarDays, TrendingUp, MinusCircle,
  Building2, MapPin, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../components/Sidebar';

const REGISTERS = [
  {
    key: 'attendance',
    title: 'Attendance Register',
    description: 'Daily attendance record of all employees including present, absent, late, half-day, leave, and holiday entries as per the Factories Act / Shops & Establishments Act.',
    icon: Clock,
    color: 'bg-blue-100',
    iconColor: 'text-blue-600',
    path: '/reports/registers/attendance',
    tags: ['Form No. 25', 'Daily Attendance', 'Muster Roll', 'Factories Act'],
  },
  {
    key: 'wage',
    title: 'Wage Register',
    description: 'Monthly wage register showing gross earnings, deductions, and net pay for each employee. Compliant with the Payment of Wages Act and Minimum Wages Act.',
    icon: DollarSign,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    path: '/reports/registers/wage',
    tags: ['Form No. 11', 'Wage Sheet', 'Payment of Wages Act', 'Monthly'],
  },
  {
    key: 'leave',
    title: 'Leave Register',
    description: 'Comprehensive leave register tracking leave applications, approvals, balances, and encashments for all employees across all leave types.',
    icon: CalendarDays,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    path: '/reports/registers/leave',
    tags: ['Form No. 14', 'Leave Card', 'Factories Act', 'Leave Balance'],
  },
  {
    key: 'overtime',
    title: 'Overtime Register',
    description: 'Register of overtime hours worked by employees, overtime wages paid, and compliance with the Factories Act overtime limits and double-rate provisions.',
    icon: TrendingUp,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    path: '/reports/registers/overtime',
    tags: ['Form No. 26', 'OT Hours', 'Factories Act', 'Double Rate'],
  },
  {
    key: 'fines-deductions',
    title: 'Fines & Deductions Register',
    description: 'Register of all fines imposed and deductions made from employee wages including damages, canteen charges, society contributions, and other deductions.',
    icon: MinusCircle,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    path: '/reports/registers/fines-deductions',
    tags: ['Form No. 2', 'Fines Register', 'Payment of Wages Act', 'Deductions'],
  },
];

const GROUPING_OPTIONS = [
  { icon: Building2, label: 'Establishment Wise', description: 'Group all register data by establishment / company entity' },
  { icon: MapPin, label: 'Work Location Wise', description: 'Group by work location — Head Office, Regional Office, Branch' },
  { icon: Users, label: 'HR Masters Wise', description: 'Group by Department, Designation, Grade, or Employee Type' },
];

export default function RegistersHub() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/reports')}
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="p-2 bg-indigo-100 rounded-lg">
              <BookOpen size={22} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Registers</h1>
              <p className="text-xs text-muted-foreground">
                Statutory registers required under the Factories Act, Payment of Wages Act, and Shops & Establishments Act.
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <BookOpen size={17} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">Statutory Registers — Grouping Support</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                These registers are mandatory under various labour laws. Each register supports grouping by <strong>Establishment</strong>, <strong>Work Location</strong>, or <strong>HR Masters</strong> (Department, Designation, Grade). Select a register to view, filter, group, print, or export as PDF.
              </p>
            </div>
          </div>

          {/* Grouping Options Info */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">Available Grouping Options (in each register)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {GROUPING_OPTIONS.map((opt, i) => {
                const Icon = opt.icon;
                return (
                  <div key={i} className="flex items-start gap-3 p-4 bg-accent/30 rounded-xl border border-border">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Icon size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {REGISTERS.map((reg, i) => {
              const Icon = reg.icon;
              return (
                <motion.button
                  key={reg.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(reg.path)}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all p-6 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${reg.color} rounded-xl`}>
                      <Icon size={24} className={reg.iconColor} />
                    </div>
                    <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                  </div>
                  <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors">{reg.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{reg.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {reg.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-semibold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pt-3 border-t border-border">
                    <Building2 size={11} className="text-muted-foreground" />
                    <MapPin size={11} className="text-muted-foreground" />
                    <Users size={11} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground ml-1">Grouping supported</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}