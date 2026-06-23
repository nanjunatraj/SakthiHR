import React from 'react';
    import { motion } from 'framer-motion';
    import type { LucideIcon } from 'lucide-react';

    interface StatCardProps {
      title: string;
      value: string | number;
      change?: string;
      icon: LucideIcon;
      trend?: 'up' | 'down' | 'neutral';
    }

    const StatCard = ({ title, value, change, icon: Icon, trend }: StatCardProps) => {
      return (
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-card p-6 rounded-xl border border-border shadow-sm"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-accent rounded-lg text-primary">
              <Icon size={24} />
            </div>
            {change && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                trend === 'up' ? 'bg-green-100 text-green-700' : 
                trend === 'down' ? 'bg-red-100 text-red-700' : 
                'bg-gray-100 text-gray-700'
              }`}>
                {change}
              </span>
            )}
          </div>
          <h3 className="text-muted-foreground text-sm font-medium">{title}</h3>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </motion.div>
      );
    };

    export default StatCard;