import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import Modal, { ModalFooter } from '../components/Modal';

const ALL_ROLES = [
  'Medical Officer of Health', 'Public Health Inspector III', 'Public Health Inspector II',
  'Public Health Inspector I', 'Sanitation Foreman III', 'Sanitation Foreman II',
  'Sanitation Foreman I', 'Litter Warden', 'Clerical', 'Viewer',
];

export default function StaffProfile() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { isAdmin } = useRoleCheck();
  const navigate = useNavigate();
  const staffUser = useQuery(api.users.getUser, { userId: id, token });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const leaveRequests = useQuery(api.leave.listLeaveRequests, { token, userId: id });
  const updateUser = useMutation(api.users.updateUser);
  const deleteUser = useMutation(api.users.deleteUser);

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');

  if (!staffUser) return <div className="loading-center"><div className="loading-spinner" /></div>;

  const openEdit = () => {
    setEditForm({ name: staffUser.name, role: staffUser.role, phone: staffUser.phone || '', active: staffUser.active, assignedDistricts: staffUser.assignedDistricts || ['ALL'], password: '' });
    setEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setError('');
    const upd = { ...editForm };
    if (!upd.password) delete upd.password;
    const res = await updateUser({ token, userId: id, ...upd });
    if (res.success) { setEditModal(false); }
    else setError(res.error || 'Failed');
  };

  const handleDeactivate = async () => {
    if (!confirm(`Deactivate ${staffUser.name}?`)) return;
    await deleteUser({ token, userId: id });
    navigate('/staff');
  };

  const toggleDistrict = (code) => {
    if (code === 'ALL') { setEditForm(f => ({ ...f, assignedDistricts: ['ALL'] })); return; }
    setEditForm(f => {
      const cur = (f.assignedDistricts || []).filter(d => d !== 'ALL');
      return { ...f, assignedDistricts: cur.includes(code) ? cur.filter(d => d !== code) : [...cur, code] };
    });
  };

  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));
  const leaveByType = (leaveRequests || []).reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  return (
    <div className="slide-up">
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/staff')}>← Back</button>
        <div style={{ flex: 1 }} />
        {isAdmin && id !== user?._id && <>
          <button className="btn btn-secondary btn-sm" onClick={openEdit}>✏️ Edit</button>
          {staffUser.active && <button className="btn btn-danger btn-sm" onClick={handleDeactivate}>🚫 Deactivate</button>}
        </>}
      </div>

      <div className="detail-grid">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div className="user-avatar" style={{ width: 64, height: 64, fontSize: 22 }}>
                {staffUser.initials || staffUser.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{staffUser.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{staffUser.email}</div>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge ${staffUser.active ? 'badge-active' : 'badge-suspended'}`}>
                    {staffUser.active ? '✅ Active' : '🚫 Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <div className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div>
                <div className="detail-label">Role</div>
                <div className="detail-value" style={{ fontWeight: 600 }}>{staffUser.role}</div>
              </div>
              <div>
                <div className="detail-label">Phone</div>
                <div className="detail-value">{staffUser.phone || '—'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="detail-label">Assigned Districts</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {staffUser.assignedDistricts?.includes('ALL') ? (
                    <span className="tag">🌐 All Districts</span>
                  ) : (staffUser.assignedDistricts || []).map(code => {
                    const d = (districts || []).find(d => d.code === code);
                    return <span key={code} className="tag">{d?.name || code}</span>;
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>📅 Recent Leave Requests</div>
            {!leaveRequests || leaveRequests.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No leave requests</div>
            ) : (
              <div className="table-container" style={{ borderRadius: 'var(--radius-sm)' }}>
                <table>
                  <thead><tr><th>Period</th><th>Days</th><th>Status</th></tr></thead>
                  <tbody>
                    {leaveRequests.slice(0, 10).map(r => (
                      <tr key={r._id}>
                        <td style={{ fontSize: 13 }}>{r.startDate} → {r.endDate}</td>
                        <td>{r.days}d</td>
                        <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ height: 'fit-content' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>📊 Leave Summary</div>
          {['approved', 'pending', 'rejected', 'cancelled'].map(s => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{s}</span>
              <span style={{ fontWeight: 600 }}>{leaveByType[s] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Staff Member" size="lg">
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-control" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-control" value={editForm.role || ''} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
              {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">New Password (leave blank to keep current)</label>
            <input className="form-control" type="password" value={editForm.password || ''} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Assigned Districts</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, background: 'var(--surface-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <label className="checkbox-group" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={(editForm.assignedDistricts || []).includes('ALL')} onChange={() => toggleDistrict('ALL')} />
                🌐 All Districts
              </label>
              {!(editForm.assignedDistricts || []).includes('ALL') && (districts || []).map(d => (
                <label key={d._id} className="checkbox-group" style={{ fontSize: 13 }}>
                  <input type="checkbox" checked={(editForm.assignedDistricts || []).includes(d.code)} onChange={() => toggleDistrict(d.code)} />
                  {d.name || d.code}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="checkbox-group">
              <input type="checkbox" checked={editForm.active !== false} onChange={e => setEditForm(f => ({ ...f, active: e.target.checked }))} />
              <span style={{ fontSize: 13 }}>Account Active</span>
            </label>
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
