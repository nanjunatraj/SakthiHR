import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isPlatformSuperAdmin } from '../lib/establishments';
import { getAdminAccess } from '../supabase/client';
import Home from '../pages/Home';

// Landing route: the platform super-admin goes to the establishments console;
// everyone else gets their establishment's HR dashboard.
export default function IndexRoute() {
  const { loading, user } = useAuth();
  const [isPlatform, setIsPlatform] = useState<boolean | null>(null);

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
  if (loading || (user && isPlatform === null)) return null; // ProtectedRoute shows the spinner
  return isPlatform ? <Navigate to="/admin" replace /> : <Home />;
}
