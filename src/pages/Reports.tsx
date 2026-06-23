import React from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { REPORT_GROUPS, groupDestination } from '../data/reportGroups';


export default function Reports() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileBarChart size={22} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-serif">Reports</h1>
              <p className="text-xs text-muted-foreground">Employee, payroll, payslip generation, YTD, and statutory compliance reports.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {REPORT_GROUPS.filter(g => !g.hidden).map((group, i) => {
              const Icon = group.icon;
              return (
                <motion.button
                  key={group.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(groupDestination(group))}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all p-6 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${group.color} rounded-xl`}>
                      <Icon size={24} className={group.iconColor} />
                    </div>
                    <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                  </div>
                  <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors">{group.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{group.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-semibold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
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