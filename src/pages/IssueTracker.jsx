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
  const [priorityFilter, setPriorityFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState(undefined);
  const [catFilter, setCatFilter] = useState(undefined);
  const [sortCol, setSortCol] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  const STATUS_ORDER   = { created: 0, open: 0, in_progress: 1, closed: 2 };

  const issues = useQuery(api.issues.listIssues, {
    token,
    districtId: districtFilter,
    status: statusFilter || undefined,
    categoryId: catFilter,
  });
  const categories = useQuery(api.categories.listCategories);
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });

  const catMap = Object.fromEntries((categories || []).map(c => [c._id, c]));
  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  const filtered = (issues || []).filter(i => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) &&
        !(i.address || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (priorityFilter && i.priority !== priorityFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    switch (sortCol) {
      case 'title':    av = a.title.toLowerCase();       bv = b.title.toLowerCase();       break;
      case 'category': av = catMap[a.categoryId]?.name || ''; bv = catMap[b.categoryId]?.name || ''; break;
      case 'district': av = districtMap[a.districtId]?.name || ''; bv = districtMap[b.districtId]?.name || ''; break;
      case 'priority': av = PRIORITY_ORDER[a.priority] ?? 9; bv = PRIORITY_ORDER[b.priority] ?? 9; break;
      case 'status':   av = STATUS_ORDER[a.status] ?? 9;   bv = STATUS_ORDER[b.status] ?? 9;   break;
      case 'progress': {
        const at = a.subtasks?.length || 0; const ad = a.subtasks?.filter(s => s.completed).length || 0;
        const bt = b.subtasks?.length || 0; const bd = b.subtasks?.filter(s => s.completed).length || 0;
        av = at ? ad / at : -1; bv = bt ? bd / bt : -1; break;
      }
      default: av = a.createdAt; bv = b.createdAt;
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
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
            {sorted.length} issue{sorted.length !== 1 ? 's' : ''} found
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
          <option value="created">🔵 Created</option>
          <option value="in_progress">🟡 In Progress</option>
          <option value="closed">⚫ Closed</option>
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

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Status:</span>
        {[
          { value: 'created',     label: 'Created',     dot: '🔵' },
          { value: 'in_progress', label: 'In Progress', dot: '🟡' },
          { value: 'closed',      label: 'Closed',      dot: '⚫' },
        ].map(s => {
          const count = (issues || []).filter(i =>
            i.status === s.value || (s.value === 'created' && i.status === 'open')
          ).length;
          const active = statusFilter === s.value;
          return (
            <button key={s.value}
              onClick={() => setStatusFilter(active ? '' : s.value)}
              className={`badge badge-${s.value}`}
              style={{
                cursor: 'pointer', border: active ? '2px solid currentColor' : '2px solid transparent',
                fontSize: 12.5, padding: '4px 11px', opacity: active ? 1 : 0.75,
              }}>
              {s.dot} {count} {s.label}
            </button>
          );
        })}
      </div>

      {/* Priority chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Priority:</span>
        {[
          { value: 'urgent', label: 'Urgent', dot: '🚨', color: '#dc2626', bg: 'rgba(220,38,38,0.1)',  border: 'rgba(220,38,38,0.4)' },
          { value: 'high',   label: 'High',   dot: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.35)' },
          { value: 'medium', label: 'Medium', dot: '🟡', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.35)' },
          { value: 'low',    label: 'Low',    dot: '🟢', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.35)' },
        ].map(p => {
          const count = (issues || []).filter(i => i.priority === p.value).length;
          const active = priorityFilter === p.value;
          return (
            <button key={p.value}
              onClick={() => setPriorityFilter(active ? '' : p.value)}
              style={{
                cursor: 'pointer', fontSize: 12.5, padding: '4px 11px',
                borderRadius: 20, fontWeight: 600,
                background: p.bg, color: p.color,
                border: active ? `2px solid ${p.border}` : '2px solid transparent',
                opacity: active ? 1 : 0.75,
                transition: 'all 0.15s',
              }}>
              {p.dot} {count} {p.label}
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
                {[['title','Issue'],['category','Category'],['district','District'],['priority','Priority'],['status','Status'],['createdAt','Reported'],['progress','Progress']].map(([col,label]) => (
                  <th key={col} onClick={() => handleSort(col)}
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    {label}
                    {sortCol === col
                      ? <span style={{ marginLeft: 5, opacity: 0.7 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                      : <span style={{ marginLeft: 5, opacity: 0.2 }}>⇅</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(issue => {
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
