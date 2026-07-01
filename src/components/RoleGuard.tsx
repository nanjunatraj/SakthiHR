import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessRoute } from '../lib/roleAccess';

/**
 * Keeps a signed-in staff member inside the sections their User Master role
 * allows: typing the URL of a forbidden section bounces them back to the
 * dashboard. Role-agnostic paths ("/", "/admin") always pass.
 */
export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { staffRole, staffRoleLoading } = useAuth();
  const location = useLocation();

  if (staffRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccessRoute(staffRole, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
