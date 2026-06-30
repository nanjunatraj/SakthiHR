import { useState } from 'react';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { getAdminAccess, getActiveTenant, exitAdminAccess } from '../supabase/client';

/**
 * Sticky banner shown app-wide while the platform super admin is viewing a tenant
 * via "Access as Admin". Provides the single way back to Platform Administration.
 */
export default function AdminAccessBanner() {
  const code = getAdminAccess();
  const [leaving, setLeaving] = useState(false);
  if (!code) return null;

  const name = getActiveTenant()?.name ?? code;

  const leave = async () => {
    setLeaving(true);
    await exitAdminAccess();
    // Full reload so AuthContext + the active client re-initialise on the control plane.
    window.location.href = '/';
  };

  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 bg-amber-500 text-amber-950 px-4 py-2 text-sm shadow">
      <ShieldAlert size={16} className="shrink-0" />
      <span className="font-medium">
        Admin access — you are viewing <span className="font-bold">{name}</span>
        <span className="font-mono ml-1 opacity-80">({code})</span> as its Admin.
      </span>
      <button
        onClick={() => void leave()}
        disabled={leaving}
        className="ml-auto flex items-center gap-1.5 rounded-md bg-amber-950/90 text-amber-50 px-3 py-1.5 text-xs font-semibold hover:bg-amber-950 transition disabled:opacity-60"
      >
        {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
        Return to Platform Administration
      </button>
    </div>
  );
}
