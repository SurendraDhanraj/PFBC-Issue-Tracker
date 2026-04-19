import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', sub: 'Overview and summary' },
  '/issues': { title: 'Issue Tracker', sub: 'Log and manage public health issues' },
  '/issues/new': { title: 'New Issue', sub: 'Log a new public health issue' },
  '/food/vendors': { title: 'Food Vendors', sub: 'Mobile and street vendor registry' },
  '/food/establishments': { title: 'Food Establishments', sub: 'Fixed premises registry' },
  '/staff': { title: 'Staff Management', sub: 'User accounts and role assignments' },
  '/leave': { title: 'Leave Tracker', sub: 'Staff leave requests and approvals' },
  '/admin': { title: 'Admin Panel', sub: 'System administration and settings' },
};

export default function Header() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const pageInfo = (() => {
    for (const [path, info] of Object.entries(PAGE_TITLES)) {
      if (location.pathname === path || (path !== '/' && location.pathname.startsWith(path))) {
        return info;
      }
    }
    return { title: 'Point Fortin Public Health', sub: '' };
  })();

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-TT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <header className="header">
      <div>
        <div className="header-title">{pageInfo.title}</div>
        {pageInfo.sub && <div className="header-subtitle">{pageInfo.sub}</div>}
      </div>
      <div className="header-actions">
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📅 {dateStr}</span>
        {location.pathname !== '/issues/new' && (
          <Link to="/issues/new" className="btn btn-primary btn-sm">
            ＋ New Issue
          </Link>
        )}
      </div>
    </header>
  );
}
