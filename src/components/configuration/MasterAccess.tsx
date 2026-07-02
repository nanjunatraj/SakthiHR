import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canEditMasters, isSuperAdminRole } from '../../lib/roleAccess';

/**
 * Master-editing permissions for the current staff role.
 *   • `canEdit`         — may create/edit/delete configuration masters (Super Admin / Admin).
 *   • `canEditIdentity` — may change the Establishment identity/Name (Super Admin only).
 * These mirror the server-side RLS; the DB is the real guarantee.
 */
export function useMasterAccess(): { canEdit: boolean; canEditIdentity: boolean; role: string | null } {
  const { staffRole } = useAuth();
  return {
    canEdit: canEditMasters(staffRole),
    canEditIdentity: isSuperAdminRole(staffRole),
    role: staffRole,
  };
}

/** Sticky "view only" notice shown on a master when the role can't edit it. */
export function ViewOnlyBanner({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
      <Lock size={15} className="shrink-0" />
      <span>{message ?? 'View only — you don’t have permission to change this master. Contact an Administrator.'}</span>
    </div>
  );
}
