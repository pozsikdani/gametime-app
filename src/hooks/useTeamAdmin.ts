import { useTeam } from '../contexts/TeamContext';
import { useSuperAdmin } from './useSuperAdmin';

/**
 * Returns true if the current user is an admin or coach in the active team.
 */
export function useTeamAdmin(): boolean {
  const { membership } = useTeam();
  return !!membership && (membership.role === 'admin' || membership.role === 'coach');
}

/**
 * Returns true if the user is a team admin, team coach, OR super admin.
 * Drop-in replacement for the old useAdmin() hook.
 */
export function useAdmin(): boolean {
  const isTeamAdmin = useTeamAdmin();
  const isSuperAdmin = useSuperAdmin();
  return isTeamAdmin || isSuperAdmin;
}
