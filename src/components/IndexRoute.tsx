import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Home from '../pages/Home';

// Landing route: platform super-admins go to the admin console; everyone else
// gets the org dashboard.
export default function IndexRoute() {
  const { loading, isSuperAdmin } = useAuth();
  if (loading) return null; // ProtectedRoute renders the loading spinner
  return isSuperAdmin ? <Navigate to="/admin" replace /> : <Home />;
}
