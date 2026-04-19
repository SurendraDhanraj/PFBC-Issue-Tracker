import { useState } from 'react';
import { useQuery } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge, { PriorityBadge } from '../components/StatusBadge';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function IssueTracker() {
  const { token, user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState(undefined);
  const [catFilter, setCatFilter] = useState(undefined);

  const issues = useQuery(api.issues.listIssues, {
    token,
    districtId: districtFilter,
    status: statusFilter || undefined,
    categoryId: catFilter,
  });
  const categories = useQuery(api.categories.listCategories);
  const districts = useQuery(api.districts.listDistricts);

  const catMap = Object.fromEntries((categories || []).map(c => [c._id, c]));
  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  const filtered = (issues || []).filter(i => {
    if (!search) return true;
    return i.title.toLowerCase().includes(search.toLowerCase()) ||
      (i.address || '').toLowerCase().includes(search.toLowerCase());
  });

  const userDistricts = user?.assignedDistricts?.includes('ALL')
    ? districts || []
    : (districts || []).filter(d => user?.assignedDistricts?.includes(d.code));

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <div className="page-title">Issue Tracker</div>
          <div className="page-subtitle">
            {filtered.length} issue{filtered.length !== 1 ? 's' : ''} found
          </div>
        </div>
        <Link to="/issues/new" className="btn btn-primary">
          ＋ Log New Issue
        </Link>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="form-control search-input"
            placeholder="Search issues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-control" style={{ width: 'auto', minWidth: 140 }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="critical">Critical</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth: 160 }}
          value={districtFilter || ''} onChange={e => setDistrictFilter(e.target.value || undefined)}>
          <option value="">All Districts</option>
          {userDistricts.map(d => <option key={d._id} value={d._id}>{d.name || d.code}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth: 160 }}
          value={catFilter || ''} onChange={e => setCatFilter(e.target.value || undefined)}>
          <option value="">All Categories</option>
          {(categories || []).map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {/* Status summary chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['open', 'in_progress', 'critical', 'pending', 'resolved'].map(s => {
          const count = (issues || []).filter(i => i.status === s).length;
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`badge badge-${s}`}
              style={{ cursor: 'pointer', border: 'none', fontSize: 12.5, padding: '4px 11px' }}>
              {count} {s.replace('_', ' ')}
            </button>
          );
        })}
      </div>

      {/* Issue List */}
      {!issues ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No issues found</div>
            <div className="empty-state-text">Try adjusting your filters or log a new issue.</div>
            <Link to="/issues/new" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>Log Issue</Link>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Category</th>
                <th>District</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Reported</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(issue => {
                const cat = catMap[issue.categoryId];
                const district = districtMap[issue.districtId];
                const done = issue.subtasks?.filter(s => s.completed).length || 0;
                const total = issue.subtasks?.length || 0;
                return (
                  <tr key={issue._id} onClick={() => window.location.href = `/issues/${issue._id}`}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{issue.title}</div>
                      {issue.address && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {issue.address}</div>}
                    </td>
                    <td>
                      {cat ? (
                        <span className="tag">{cat.icon} {cat.name}</span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {district?.name || district?.code || '—'}
                    </td>
                    <td><PriorityBadge priority={issue.priority} /></td>
                    <td><StatusBadge status={issue.status} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(issue.createdAt)}</td>
                    <td>
                      {total > 0 ? (
                        <div style={{ minWidth: 80 }}>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(done/total)*100}%` }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{done}/{total}</div>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
