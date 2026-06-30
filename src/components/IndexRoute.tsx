import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isPlatformSuperAdmin } from '../lib/establishments';
import Home from '../pages/Home';

// Landing route: the platform super-admin goes to the establishments console;
// everyone else gets their establishment's HR dashboard.
export default function IndexRoute() {
  const { loading, user } = useAuth();
  const [isPlatform, setIsPlatform] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    void isPlatformSuperAdmin().then((ok) => { if (active) setIsPlatform(ok); });
    return () => { active = false; };
  }, [loading, user]);

  if (loading || (user && isPlatform === null)) return null; // ProtectedRoute shows the spinner
  return isPlatform ? <Navigate to="/admin" replace /> : <Home />;
}
