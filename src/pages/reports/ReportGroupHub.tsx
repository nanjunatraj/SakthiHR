import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { getReportGroup } from '../../data/reportGroups';

/** Generic landing page for a multi-report Reports group (/reports/g/:groupKey). */
export default function ReportGroupHub() {
  const navigate = useNavigate();
  const { groupKey } = useParams<{ groupKey: string }>();
  const group = groupKey ? getReportGroup(groupKey) : undefined;
  if (!group) return <Navigate to="/reports" replace />;

  const GroupIcon = group.icon;
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="All Reports">
              <ChevronLeft size={20} />
            </button>
            <div className={`p-2 ${group.color} rounded-lg`}><GroupIcon size={22} className={group.iconColor} /></div>
            <div>
              <h1 className="text-xl font-bold">{group.title}</h1>
              <p className="text-xs text-muted-foreground">{group.description}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {group.items.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.path + i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(item.path)}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all p-6 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${group.color} rounded-xl`}><Icon size={24} className={group.iconColor} /></div>
                    <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                  </div>
                  <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors">{item.label}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </motion.button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
