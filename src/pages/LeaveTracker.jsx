import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';

export default function LeaveTracker() {
  const { token, user } = useAuth();
  const { canApproveLeave, isAdmin } = useRoleCheck();
  const [tab, setTab] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const leaveRequests = useQuery(api.leave.listLeaveRequests, { token, status: tab === 'all' ? undefined : tab });
  const leaveTypes = useQuery(api.leave.listLeaveTypes);
  const users = useQuery(api.users.listUsers, { token });
  const createLeave = useMutation(api.leave.createLeaveRequest);
  const approveLeave = useMutation(api.leave.approveLeave);
  const cancelLeave = useMutation(api.leave.cancelLeave);

  const userMap = Object.fromEntries((users || []).map(u => [u._id, u]));
  const typeMap = Object.fromEntries((leaveTypes || []).map(t => [t._id, t]));

  const calcDays = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start); const e = new Date(end);
    const diff = (e - s) / (1000 * 60 * 60 * 24);
    return Math.max(1, Math.ceil(diff) + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.leaveTypeId || !form.startDate || !form.endDate) { setError('Please fill all required fields.'); return; }
    setLoading(true);
    try {
      const days = calcDays(form.startDate, form.endDate);
      const res = await createLeave({ token, leaveTypeId: form.leaveTypeId, startDate: form.startDate, endDate: form.endDate, days, reason: form.reason || undefined });
      if (res.success) { setShowNew(false); setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' }); }
      else setError(res.error || 'Failed');
    } finally { setLoading(false); }
  };

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <div className="page-title">📅 Leave Tracker</div>
          <div className="page-subtitle">Staff leave requests and approvals</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>＋ Request Leave</button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {['pending', 'approved', 'rejected', 'cancelled'].map(s => {
          const count = (leaveRequests || []).filter(r => r.status === s).length;
          const colors = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', cancelled: '#6b7280' };
          return (
            <div key={s} className="stat-card">
              <div className="stat-icon" style={{ background: `${colors[s]}20` }}>
                <span style={{ fontSize: 18 }}>{s === 'pending' ? '⏳' : s === 'approved' ? '✅' : s === 'rejected' ? '❌' : '🚫'}</span>
              </div>
              <div>
                <div className="stat-value" style={{ color: colors[s] }}>{count}</div>
                <div className="stat-label" style={{ textTransform: 'capitalize' }}>{s}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <div key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
        ))}
      </div>

      {!leaveRequests ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : leaveRequests.length === 0 ? (
        <div className="card"><div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-title">No leave requests</div>
          <div className="empty-state-text">Submit a leave request to get started.</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowNew(true)}>Request Leave</button>
        </div></div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Staff</th><th>Leave Type</th><th>Period</th><th>Days</th><th>Status</th><th>Reason</th><th>Actions</th></tr></thead>
            <tbody>
              {leaveRequests.map(r => {
                const staff = userMap[r.userId];
                const type = typeMap[r.leaveTypeId];
                const isOwn = r.userId === user?._id;
                return (
                  <tr key={r._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                          {staff?.initials || '??'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{staff?.name || 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{staff?.role?.split(' ').slice(-1)[0]}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="tag">{type?.name || '—'}</span></td>
                    <td style={{ fontSize: 13 }}>{r.startDate} → {r.endDate}</td>
                    <td style={{ fontWeight: 700 }}>{r.days}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 180, wordBreak: 'break-word' }}>{r.reason || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canApproveLeave && r.status === 'pending' && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => approveLeave({ token, requestId: r._id, action: 'approved' })}>✅</button>
                            <button className="btn btn-danger btn-sm" onClick={() => approveLeave({ token, requestId: r._id, action: 'rejected' })}>❌</button>
                          </>
                        )}
                        {isOwn && r.status === 'pending' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => cancelLeave({ token, requestId: r._id })}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Request Leave">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-group">
            <label className="form-label">Leave Type *</label>
            <select className="form-control" value={form.leaveTypeId} onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))} required>
              <option value="">Select leave type</option>
              {(leaveTypes || []).filter(t => t.active).map(t => (
                <option key={t._id} value={t._id}>{t.name}{t.maxDaysPerYear ? ` (max ${t.maxDaysPerYear}d/yr)` : ''}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input className="form-control" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input className="form-control" type="date" value={form.endDate} min={form.startDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
            </div>
          </div>
          {form.startDate && form.endDate && (
            <div className="alert alert-info">
              📊 Duration: <strong>{calcDays(form.startDate, form.endDate)} day{calcDays(form.startDate, form.endDate) !== 1 ? 's' : ''}</strong>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Reason</label>
            <textarea className="form-control" rows={3} placeholder="Reason for leave request (optional)"
              value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Submitting...' : '📅 Submit Request'}</button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
