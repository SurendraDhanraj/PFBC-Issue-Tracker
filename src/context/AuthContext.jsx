import { createContext, useContext, useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ph_token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const sessionData = useQuery(api.auth.getSession, token ? { token } : 'skip');
  const loginMutation = useMutation(api.auth.login);
  const logoutMutation = useMutation(api.auth.logout);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    if (sessionData !== undefined) {
      setUser(sessionData);
      setLoading(false);
      if (!sessionData) {
        localStorage.removeItem('ph_token');
        setToken('');
      }
    }
  }, [sessionData, token]);

  const login = async (email, password) => {
    const result = await loginMutation({ email, password });
    if (result.success) {
      localStorage.setItem('ph_token', result.token);
      setToken(result.token);
      setUser(result.user);
    }
    return result;
  };

  const logout = async () => {
    if (token) {
      try { await logoutMutation({ token }); } catch(e) {}
    }
    localStorage.removeItem('ph_token');
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// ─── Permission System ────────────────────────────────────────────────────────
const LEVEL_ORDER = { none: 0, view: 1, write: 2, admin: 3 };

// Fallback permissions based on legacy role names (for backward compat before roles are seeded)
const FALLBACK_PERMISSIONS = {
  'Medical Officer of Health':    { dashboard:'admin',  issues:'admin',  foodVendors:'admin', foodEstablishments:'admin', staffManagement:'admin', leaveTracker:'admin', adminPanel:'admin' },
  'Public Health Inspector III':  { dashboard:'view',   issues:'admin',  foodVendors:'write', foodEstablishments:'write', staffManagement:'view',  leaveTracker:'write', adminPanel:'none' },
  'Public Health Inspector II':   { dashboard:'view',   issues:'write',  foodVendors:'write', foodEstablishments:'write', staffManagement:'none',  leaveTracker:'write', adminPanel:'none' },
  'Public Health Inspector I':    { dashboard:'view',   issues:'write',  foodVendors:'view',  foodEstablishments:'view',  staffManagement:'none',  leaveTracker:'write', adminPanel:'none' },
  'Sanitation Foreman III':       { dashboard:'view',   issues:'write',  foodVendors:'write', foodEstablishments:'write', staffManagement:'none',  leaveTracker:'write', adminPanel:'none' },
  'Sanitation Foreman II':        { dashboard:'view',   issues:'write',  foodVendors:'view',  foodEstablishments:'view',  staffManagement:'none',  leaveTracker:'write', adminPanel:'none' },
  'Sanitation Foreman I':         { dashboard:'view',   issues:'write',  foodVendors:'none',  foodEstablishments:'none',  staffManagement:'none',  leaveTracker:'write', adminPanel:'none' },
  'Litter Warden':                { dashboard:'view',   issues:'write',  foodVendors:'none',  foodEstablishments:'none',  staffManagement:'none',  leaveTracker:'view',  adminPanel:'none' },
  'Clerical':                     { dashboard:'view',   issues:'view',   foodVendors:'view',  foodEstablishments:'view',  staffManagement:'none',  leaveTracker:'view',  adminPanel:'none' },
  'Viewer':                       { dashboard:'view',   issues:'view',   foodVendors:'none',  foodEstablishments:'none',  staffManagement:'none',  leaveTracker:'view',  adminPanel:'none' },
};

/**
 * Returns the user's full permission map and a `can(module, minLevel)` checker.
 * module: 'dashboard' | 'issues' | 'foodVendors' | 'foodEstablishments' | 'staffManagement' | 'leaveTracker' | 'adminPanel'
 * minLevel: 'view' | 'write' | 'admin'
 */
export function usePermissions() {
  const { user } = useAuth();
  const perms = (user?.permissions) || FALLBACK_PERMISSIONS[user?.role] || {};

  const can = (module, minLevel = 'view') => {
    const userLevel = perms[module] || 'none';
    return (LEVEL_ORDER[userLevel] || 0) >= (LEVEL_ORDER[minLevel] || 1);
  };

  const levelOf = (module) => perms[module] || 'none';

  return { permissions: perms, can, levelOf };
}

// ─── Role check (backward-compatible) ─────────────────────────────────────────
export function useRoleCheck() {
  const { user } = useAuth();
  const { can } = usePermissions();

  return {
    isAdmin:           user?.role === 'Medical Officer of Health',
    isSupervisor:      can('issues', 'admin'),
    isSenior:          can('issues', 'write'),
    canCreateIssues:   can('issues', 'write'),
    canCloseIssues:    can('issues', 'admin'),
    canManageSubtasks: can('issues', 'admin'),
    canManageUsers:    can('staffManagement', 'admin'),
    canUploadCSV:      can('adminPanel', 'admin'),
    canApproveLeave:   can('leaveTracker', 'admin'),
    canManageFood:     can('foodVendors', 'write'),
    // Legacy numeric level — used by Sidebar minLevel filter (kept for safety)
    level: user?.role === 'Medical Officer of Health' ? 10
         : can('issues', 'admin') ? 9
         : can('issues', 'write') ? 5
         : can('issues', 'view')  ? 2
         : 1,
  };
}
