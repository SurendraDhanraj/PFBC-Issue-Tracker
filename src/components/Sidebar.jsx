import { NavLink, useLocation } from 'react-router-dom';
import { useAuth, usePermissions } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { path: '/', icon: '🏠', label: 'Dashboard', exact: true, perm: 'dashboard' },
      { path: '/issues', icon: '📋', label: 'Issue Tracker', perm: 'issues' },
    ],
  },
  {
    label: 'Registry',
    items: [
      { path: '/food/vendors', icon: '🛒', label: 'Food Vendors', perm: 'foodVendors' },
      { path: '/food/establishments', icon: '🏪', label: 'Establishments', perm: 'foodEstablishments' },
    ],
  },
  {
    label: 'HR',
    items: [
      { path: '/staff', icon: '👥', label: 'Staff Management', perm: 'staffManagement' },
      { path: '/leave', icon: '📅', label: 'Leave Tracker', perm: 'leaveTracker' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/admin', icon: '⚙️', label: 'Admin Panel', perm: 'adminPanel' },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();
  const { appName, faviconUrl, logoIcon } = useBranding();

  if (!user) return null;

  const initials = user.initials || user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PH';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          {faviconUrl
            ? <img src={faviconUrl} alt="logo" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }} />
            : logoIcon}
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">{appName}</span>
          <span className="sidebar-logo-sub">Public Health</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => can(item.perm, 'view'));
          if (!visibleItems.length) return null;
          return (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {visibleItems.map(item => {
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path) && item.path !== '/';
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role}</div>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
          onClick={logout}
        >
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
}
