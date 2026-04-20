import { useState } from 'react';
import { useQuery } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge, { PriorityBadge } from '../components/StatusBadge';

function StatCard({ icon, value, label, color, bg, onClick, active }) {
  return (
    <div className="stat-card" onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        outline: active ? `2px solid ${color}` : '2px solid transparent',
        boxShadow: active ? `0 0 0 4px ${color}22` : undefined,
        transition: 'outline 0.15s, box-shadow 0.15s',
        transform: active ? 'translateY(-1px)' : undefined,
      }}>
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

function BarChart({ data, onBarClick, activeBar }) {
  const [hovered, setHovered] = useState(null);
  if (!data || data.length === 0) return null;

  const BAR_AREA_H = 130;
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: BAR_AREA_H, padding: '0 2px' }}>
        {data.map((d, i) => {
          const barH = d.count > 0 ? Math.max(Math.round((d.count / max) * BAR_AREA_H), 6) : 2;
          const isHov = hovered === i;
          const isActive = activeBar === i;
          return (
            <div key={i}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-end',
                height: '100%', cursor: d.count > 0 ? 'pointer' : 'default',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => d.count > 0 && onBarClick && onBarClick(i, d)}>
              <div style={{
                fontSize: 11, fontWeight: 700, marginBottom: 4, lineHeight: 1,
                color: isActive ? '#67e8f9' : isHov ? '#60a5fa' : d.count > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                transition: 'color 0.15s',
              }}>
                {d.count > 0 ? d.count : '–'}
              </div>
              <div style={{
                width: '100%', height: barH, flexShrink: 0,
                borderRadius: '4px 4px 0 0',
                background: isActive
                  ? 'linear-gradient(180deg, #67e8f9, #0891b2)'
                  : isHov ? 'linear-gradient(180deg, #93c5fd, #2563eb)'
                  : 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
                outline: isActive ? '2px solid #67e8f9' : 'none',
                boxShadow: isActive ? '0 0 14px rgba(103,232,249,0.55)' : isHov ? '0 0 10px rgba(59,130,246,0.5)' : 'none',
                opacity: isActive || isHov ? 1 : 0.75,
                transition: 'all 0.2s',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '6px 2px 0', borderTop: '1px solid var(--border)' }}>
        {data.map((d, i) => (
          <div key={i}
            onClick={() => d.count > 0 && onBarClick && onBarClick(i, d)}
            style={{
              flex: 1, textAlign: 'center', lineHeight: 1.2,
              color: activeBar === i ? '#67e8f9' : hovered === i ? '#60a5fa' : 'var(--text-muted)',
              cursor: d.count > 0 ? 'pointer' : 'default',
              transition: 'color 0.15s',
            }}>
            <div style={{ fontSize: 10.5, fontWeight: (activeBar === i || hovered === i) ? 700 : 400 }}>{d.label}</div>
            <div style={{ fontSize: 9.5, opacity: 0.7, marginTop: 1 }}>
              {(i === 0 || data[i - 1].year !== d.year) ? d.year : ''}
            </div>
          </div>
        ))}
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
  const [activeFilter, setActiveFilter]     = useState(null); // { type: 'status'|'priority', value }
  const districts  = useQuery(api.districts.listDistricts);
  const stats      = useQuery(api.issues.getDashboardStats, { token, districtId: districtFilter });
  const categories = useQuery(api.categories.listCategories);

  const catMap = Object.fromEntries((categories || []).map(c => [c._id, c]));

  const [activeBar, setActiveBar] = useState(null);

  const handleClearFilter = () => { setActiveFilter(null); setActiveBar(null); };

  const handleCardFilter = (type, value) => {
    setActiveBar(null);
    setActiveFilter(f => f?.type === type && f?.value === value ? null : { type, value });
  };

  const handleBarClick = (i, d) => {
    if (activeBar === i) {
      setActiveBar(null);
      setActiveFilter(null);
    } else {
      setActiveBar(i);
      setActiveFilter({ type: 'month', value: { year: d.year, month: d.month, label: `${d.label} ${d.year}` } });
    }
  };

  const visibleRecent = (stats?.recent || []).filter(issue => {
    if (!activeFilter) return true;
    if (activeFilter.type === 'status') {
      if (activeFilter.value === 'created') return issue.status === 'created' || issue.status === 'open';
      if (activeFilter.value === 'closed')  return issue.status === 'closed'  || issue.status === 'resolved';
      return issue.status === activeFilter.value;
    }
    if (activeFilter.type === 'priority') return issue.priority === activeFilter.value;
    if (activeFilter.type === 'month') {
      const cd = new Date(issue.createdAt);
      return cd.getFullYear() === activeFilter.value.year && cd.getMonth() === activeFilter.value.month;
    }
    return true;
  });


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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
            <select className="form-control" style={{ minWidth: 180, width: 'auto' }}
              value={districtFilter || ''} onChange={e => setDistrictFilter(e.target.value || undefined)}>
              <option value="">All Districts</option>
              {userDistricts.map(d => (
                <option key={d._id} value={d._id}>{d.name || d.code}</option>
              ))}
            </select>
          )}
          <Link to="/issues/new" className="btn btn-primary">＋ Log Issue</Link>
        </div>
      </div>

      {/* Status Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <StatCard icon="🗂️" value={stats?.total}      label="Total Issues" color="var(--text-primary)" bg="rgba(148,163,184,0.15)" onClick={handleClearFilter} active={!activeFilter} />
        <StatCard icon="📋" value={stats?.created}    label="Created"      color="var(--blue-400)"     bg="rgba(59,130,246,0.15)"  onClick={() => handleCardFilter('status','created')}    active={activeFilter?.type==='status'&&activeFilter?.value==='created'} />
        <StatCard icon="⚡" value={stats?.inProgress} label="In Progress"  color="var(--cyan-400)"     bg="rgba(6,182,212,0.15)"   onClick={() => handleCardFilter('status','in_progress')} active={activeFilter?.type==='status'&&activeFilter?.value==='in_progress'} />
        <StatCard icon="✅" value={stats?.closed}     label="Closed"       color="#10b981"              bg="rgba(16,185,129,0.15)"  onClick={() => handleCardFilter('status','closed')}     active={activeFilter?.type==='status'&&activeFilter?.value==='closed'} />
      </div>

      {/* Priority Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon="🚨" value={stats?.urgent} label="Urgent" color="#dc2626" bg="rgba(220,38,38,0.12)"  onClick={() => handleCardFilter('priority','urgent')} active={activeFilter?.type==='priority'&&activeFilter?.value==='urgent'} />
        <StatCard icon="🔴" value={stats?.high}   label="High"   color="#ef4444" bg="rgba(239,68,68,0.12)"  onClick={() => handleCardFilter('priority','high')}   active={activeFilter?.type==='priority'&&activeFilter?.value==='high'} />
        <StatCard icon="🟡" value={stats?.medium} label="Medium" color="#f59e0b" bg="rgba(245,158,11,0.12)" onClick={() => handleCardFilter('priority','medium')} active={activeFilter?.type==='priority'&&activeFilter?.value==='medium'} />
        <StatCard icon="🟢" value={stats?.low}    label="Low"    color="#10b981" bg="rgba(16,185,129,0.12)" onClick={() => handleCardFilter('priority','low')}    active={activeFilter?.type==='priority'&&activeFilter?.value==='low'} />
      </div>

      {/* Bar Chart — full width */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>📈 Issues Logged — Last 12 Months</div>
          {stats?.monthly && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {stats.monthly.reduce((s, m) => s + m.count, 0)} total logged
            </div>
          )}
        </div>
        {!stats ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : (
          <BarChart data={stats.monthly} onBarClick={handleBarClick} activeBar={activeBar} />
        )}
      </div>

      {/* Recent Issues — full width */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Recent Issues</div>
            {activeFilter && (
              <span style={{
                fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
                background: 'rgba(59,130,246,0.12)', color: 'var(--blue-400)',
                border: '1px solid rgba(59,130,246,0.25)',
              }}>
              {activeFilter.type === 'month'
                  ? activeFilter.value.label
                  : activeFilter.type === 'status'
                  ? activeFilter.value.replace('_', ' ')
                  : activeFilter.value}
                <button onClick={handleClearFilter}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: 5, padding: 0, fontSize: 13, lineHeight: 1 }}>
                  ✕
                </button>
              </span>
            )}
          </div>
          <Link to="/issues" className="btn btn-secondary btn-sm">View All →</Link>
        </div>

        {!stats?.recent ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : visibleRecent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">{activeFilter ? 'No matching issues' : 'No issues yet'}</div>
            <div className="empty-state-text">
              {activeFilter
                ? <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={handleClearFilter}>Clear filter</button>
                : <Link to="/issues/new" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Log First Issue</Link>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleRecent.map(issue => {
              const cat = catMap[issue.categoryId];
              return (
                <Link key={issue._id} to={`/issues/${issue._id}`} className="issue-card">
                  <div className="issue-card-header">
                    <div>
                      <div className="issue-card-title">{issue.title}</div>
                      <div className="issue-card-meta" style={{ marginTop: 5 }}>
                        {cat && (
                          <span className="issue-card-meta-item">
                            <span>{cat.icon}</span><span>{cat.name}</span>
                          </span>
                        )}
                        <span className="issue-card-meta-item">🕐 {timeAgo(issue.createdAt)}</span>
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
      <div className="grid-3">
        {[
          { icon: '🛒', title: 'Food Vendors',    sub: 'Street & mobile vendor registry',    path: '/food/vendors' },
          { icon: '🏪', title: 'Establishments',  sub: 'Fixed premises registry',            path: '/food/establishments' },
          { icon: '📅', title: 'Leave Tracker',   sub: 'Submit and manage leave requests',   path: '/leave' },
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
