import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  UserSquare, Network, Search, ChevronRight,
  Users, CheckCircle2, AlertCircle, Building2
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useHierarchyEmployees, facetsOf } from '../data/employeeHierarchyData';

const MODULES = [
  {
    key: 'directory',
    title: 'Employee Directory',
    description: 'Complete listing of all employees with department, designation, location, reporting manager, and hierarchy completion status.',
    icon: UserSquare,
    color: 'bg-blue-100',
    iconColor: 'text-blue-600',
    path: '/employees/directory',
    tags: ['All Employees', 'Department-wise', 'Status', 'Export'],
  },
  {
    key: 'hierarchy',
    title: 'Employee Hierarchy',
    description: 'Auto-generated organisation chart based on reporting manager assignments in Employee Master. Shows incomplete hierarchy separately.',
    icon: Network,
    color: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    path: '/employees/hierarchy',
    tags: ['Org Chart', 'Reporting Structure', 'Tree View', 'Auto-Generated'],
  },
  {
    key: 'search',
    title: 'Employee Search',
    description: 'Advanced search across all employees by name, code, designation, skills, department, location, and hierarchy status.',
    icon: Search,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    path: '/employees/search',
    tags: ['Full-text Search', 'Advanced Filters', 'Skills', 'Quick Browse'],
  },
];

export default function Employees() {
  const navigate = useNavigate();

  const employees = useHierarchyEmployees();
  const DEPARTMENTS = facetsOf(employees).departments;
  const totalEmployees = employees.length;
  const activeCount = employees.filter(e => e.status === 'Active').length;
  const hierarchyComplete = employees.filter(e => e.hierarchyComplete).length;
  const incompleteCount = totalEmployees - hierarchyComplete;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Employees</h1>
              <p className="text-xs text-muted-foreground">Employee Directory, Hierarchy Chart, and Advanced Search.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Employees', value: totalEmployees, sub: `${activeCount} active`, color: 'bg-blue-100', iconColor: 'text-blue-600', icon: Users },
              { label: 'Departments', value: DEPARTMENTS.length, sub: 'Active departments', color: 'bg-violet-100', iconColor: 'text-violet-600', icon: Building2 },
              { label: 'Hierarchy Complete', value: hierarchyComplete, sub: 'Manager assigned', color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Hierarchy Incomplete', value: incompleteCount, sub: 'No manager assigned', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: AlertCircle },
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

          {/* Module Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <motion.button
                  key={mod.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(mod.path)}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all p-6 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${mod.color} rounded-xl`}>
                      <Icon size={24} className={mod.iconColor} />
                    </div>
                    <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                  </div>
                  <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors">{mod.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{mod.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mod.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-semibold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Hierarchy Status Banner */}
          {incompleteCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-4 p-5 bg-amber-50 border border-amber-200 rounded-xl"
            >
              <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
                <AlertCircle size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-amber-800">Hierarchy Completion Status</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  <strong>{incompleteCount}</strong> employee{incompleteCount !== 1 ? 's' : ''} do not have a reporting manager assigned.
                  The Employee Hierarchy chart will show these employees separately in the "Hierarchy Incomplete" section.
                  To complete the hierarchy, assign reporting managers in <strong>Employee Master → Employment Details</strong>.
                </p>
              </div>
              <button
                onClick={() => navigate('/employees/hierarchy')}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors shadow-sm shrink-0"
              >
                View Hierarchy <ChevronRight size={14} />
              </button>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}