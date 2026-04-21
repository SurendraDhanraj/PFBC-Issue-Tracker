import { NavLink, useLocation } from 'react-router-dom';
import { useAuth, usePermissions } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/',                  icon: '🏠', label: 'Home',    perm: 'dashboard',          exact: true },
  { path: '/issues',            icon: '📋', label: 'Issues',  perm: 'issues' },
  { path: '/food/vendors',      icon: '🛒', label: 'Vendors', perm: 'foodVendors' },
  { path: '/staff',             icon: '👥', label: 'Staff',   perm: 'staffManagement' },
  { path: '/admin',             icon: '⚙️', label: 'Admin',   perm: 'adminPanel' },
];

export default function BottomNav() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();

  if (!user) return null;

  const visible = NAV_ITEMS.filter(item => can(item.perm, 'view'));

  return (
    <nav className="bottom-nav">
      {visible.map(item => {
        const isActive = item.exact
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={`bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
