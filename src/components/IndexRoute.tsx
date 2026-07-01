import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isPlatformSuperAdmin } from '../lib/establishments';
import { getAdminAccess } from '../supabase/client';
import { getWorkspace, setWorkspace, type Workspace } from '../lib/workspace';
import WorkspaceChooser from './WorkspaceChooser';
import Home from '../pages/Home';

// Landing route. Decides where a signed-in user lands:
//  - platform super-admin → the establishments console;
//  - a staff member who is also an employee → a workspace chooser (Self-Service
//    or Admin), remembered for the session;
//  - everyone else → their establishment's HR dashboard.
export default function IndexRoute() {
  const { loading, user, staffRoleLoading, isEmployeeLinked } = useAuth();
  const [isPlatform, setIsPlatform] = useState<boolean | null>(null);
  const [choice, setChoice] = useState<Workspace | null>(getWorkspace());

  // While the super admin is "accessing a tenant as Admin", show that tenant's HR
  // dashboard instead of bouncing back to the platform console.
  const impersonating = getAdminAccess() !== null;

  useEffect(() => {
    if (loading || !user || impersonating) return;
    let active = true;
    void isPlatformSuperAdmin().then((ok) => { if (active) setIsPlatform(ok); });
    return () => { active = false; };
  }, [loading, user, impersonating]);

  if (impersonating) return <Home />;
  if (loading || staffRoleLoading || (user && isPlatform === null)) return null; // ProtectedRoute shows the spinner
  if (isPlatform) return <Navigate to="/admin" replace />;

  // Dual-access staff (also an employee) pick a workspace once per session.
  if (isEmployeeLinked && !choice) {
    return <WorkspaceChooser onChooseAdmin={() => { setWorkspace('admin'); setChoice('admin'); }} />;
  }
  return <Home />;
}
