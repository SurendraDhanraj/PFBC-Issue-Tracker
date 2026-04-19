import { useState } from 'react';
import { useQuery } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge, { PriorityBadge } from '../components/StatusBadge';

function StatCard({ icon, value, label, color, bg }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div>
        <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-TT', { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const [districtFilter, setDistrictFilter] = useState(undefined);
  const districts = useQuery(api.districts.listDistricts);
  const stats = useQuery(api.issues.getDashboardStats, { token, districtId: districtFilter });
  const categories = useQuery(api.categories.listCategories);

  const catMap = Object.fromEntries((categories || []).map(c => [c._id, c]));

  const userDistricts = user?.assignedDistricts?.includes('ALL')
    ? districts || []
    : (districts || []).filter(d => user?.assignedDistricts?.includes(d.code));

  return (
    <div className="slide-up">
      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(6,182,212,0.1))',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>
            👋 Welcome back, {user?.name?.split(' ')[0]}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {user?.role} · {new Date().toLocaleDateString('en-TT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {userDistricts.length > 0 && (
            <select
              className="form-control"
              style={{ minWidth: 180, width: 'auto' }}
              value={districtFilter || ''}
              onChange={e => setDistrictFilter(e.target.value || undefined)}
            >
              <option value="">All Districts</option>
              {userDistricts.map(d => (
                <option key={d._id} value={d._id}>{d.name || d.code}</option>
              ))}
            </select>
          )}
          <Link to="/issues/new" className="btn btn-primary">
            ＋ Log Issue
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon="📋" value={stats?.open} label="Open Issues" color="var(--blue-400)" bg="rgba(59,130,246,0.15)" />
        <StatCard icon="⚡" value={stats?.inProgress} label="In Progress" color="var(--cyan-400)" bg="rgba(6,182,212,0.15)" />
        <StatCard icon="🚨" value={stats?.critical} label="Critical" color="#ef4444" bg="rgba(239,68,68,0.15)" />
        <StatCard icon="✅" value={stats?.resolved} label="Resolved" color="#10b981" bg="rgba(16,185,129,0.15)" />
      </div>

      {/* Recent Issues */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Recent Issues</div>
          <Link to="/issues" className="btn btn-secondary btn-sm">View All →</Link>
        </div>

        {!stats?.recent ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : stats.recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No issues yet</div>
            <div className="empty-state-text">
              <Link to="/issues/new" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Log First Issue</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.recent.map(issue => {
              const cat = catMap[issue.categoryId];
              return (
                <Link key={issue._id} to={`/issues/${issue._id}`} className="issue-card">
                  <div className="issue-card-header">
                    <div>
                      <div className="issue-card-title">{issue.title}</div>
                      <div className="issue-card-meta" style={{ marginTop: 5 }}>
                        {cat && (
                          <span className="issue-card-meta-item">
                            <span>{cat.icon}</span>
                            <span>{cat.name}</span>
                          </span>
                        )}
                        <span className="issue-card-meta-item">📍 {issue.address || 'No address'}</span>
                        <span className="issue-card-meta-item">🕐 {timeAgo(issue.createdAt)}</span>
                        {issue.subtasks?.length > 0 && (
                          <span className="issue-card-meta-item">
                            ✅ {issue.subtasks.filter(s => s.completed).length}/{issue.subtasks.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <PriorityBadge priority={issue.priority} />
                      <StatusBadge status={issue.status} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid-3" style={{ marginTop: 20 }}>
        {[
          { icon: '🛒', title: 'Food Vendors', sub: 'Street & mobile vendor registry', path: '/food/vendors', color: '#8b5cf6' },
          { icon: '🏪', title: 'Establishments', sub: 'Fixed premises registry', path: '/food/establishments', color: '#06b6d4' },
          { icon: '📅', title: 'Leave Tracker', sub: 'Submit and manage leave requests', path: '/leave', color: '#f59e0b' },
        ].map(item => (
          <Link key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{item.sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
