import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import Modal, { ModalFooter } from '../components/Modal';

const EMPTY_FORM = { name: '', email: '', password: '', role: '', phone: '', assignedDistricts: ['ALL'] };

export default function StaffManagement() {
  const { token } = useAuth();
  const { isAdmin } = useRoleCheck();
  const [search, setSearch] = useState('');

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState(null); // user object being edited
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);

  const users = useQuery(api.users.listUsers, { token });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const rolesData = useQuery(api.roles.listRoles);
  const createUser = useMutation(api.users.createUser);
  const updateUser = useMutation(api.users.updateUser);

  // Build lookup maps from DB roles
  const activeRoles = (rolesData || []).filter(r => r.active);
  const roleColorMap = Object.fromEntries((rolesData || []).map(r => [r.name, r.color]));
  const getRoleColor = (roleName) => roleColorMap[roleName] || '#64748b';
  // Default new-user role to first active role
  const defaultRole = activeRoles[0]?.name || '';

  const filtered = (users || []).filter(u => {
    if (!search) return true;
    return u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase());
  });

  /* ---- Create ---- */
  const handleCreate = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!form.name || !form.email || !form.password) { setAddError('Name, email and password required.'); return; }
    setAddLoading(true);
    try {
      const payload = { token, ...form, role: form.role || defaultRole };
      const res = await createUser(payload);
      if (res.success) { setShowAdd(false); setForm({ ...EMPTY_FORM, role: defaultRole }); }
      else setAddError(res.error || 'Failed');
    } finally { setAddLoading(false); }
  };

  /* ---- Open Edit ---- */
  const openEdit = (u) => {
    setEditTarget(u);
    setEditForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      active: u.active,
      assignedDistricts: u.assignedDistricts || ['ALL'],
      newPassword: '',
    });
    setEditError('');
    setShowResetPw(false);
  };

  /* ---- Save Edit ---- */
  const handleEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    if (!editForm.name || !editForm.email) { setEditError('Name and email are required.'); return; }
    setEditLoading(true);
    try {
      const payload = {
        token,
        userId: editTarget._id,
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || undefined,
        role: editForm.role,
        active: editForm.active,
        assignedDistricts: editForm.assignedDistricts,
      };
      if (showResetPw && editForm.newPassword) {
        if (editForm.newPassword.length < 6) { setEditError('Password must be at least 6 characters.'); setEditLoading(false); return; }
        payload.password = editForm.newPassword;
      }
      const res = await updateUser(payload);
      if (res.success) { setEditTarget(null); }
      else setEditError(res.error || 'Update failed');
    } finally { setEditLoading(false); }
  };

  /* ---- District toggles (shared logic) ---- */
  const toggleDistrictFor = (setter, _current, code) => {
    if (code === 'ALL') {
      // Toggle ALL mode on/off
      setter(f => {
        const isAll = f.assignedDistricts.includes('ALL');
        return { ...f, assignedDistricts: isAll ? [] : ['ALL'] };
      });
      return;
    }
    setter(f => {
      const cur = f.assignedDistricts.filter(d => d !== 'ALL');
      if (cur.includes(code)) return { ...f, assignedDistricts: cur.filter(d => d !== code) };
      return { ...f, assignedDistricts: [...cur, code] };
    });
  };

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <div className="page-title">👥 Staff Management</div>
          <div className="page-subtitle">{filtered.length} staff member{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ Add Staff</button>}
      </div>

      <div className="filters-bar">
        <div className="search-input-wrap" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input className="form-control search-input" placeholder="Search by name, email, or role..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

              {/* Role summary */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(
          (users || []).reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {})
        ).map(([role, count]) => {
          const color = getRoleColor(role);
          return (
            <div key={role} className="badge" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
              {count}× {role.split(' ').slice(-1)[0]}
            </div>
          );
        })}
      </div>

      {!users ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Staff Member</th><th>Role</th><th>Districts</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="user-avatar" style={{ background: `linear-gradient(135deg, ${getRoleColor(u.role)}, #0a1628)` }}>
                        {u.initials || u.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                        {u.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📞 {u.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: `${getRoleColor(u.role)}20`, color: getRoleColor(u.role), border: `1px solid ${getRoleColor(u.role)}40`, fontSize: 11.5 }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {u.assignedDistricts?.includes('ALL') ? (
                      <span className="tag">🌐 All Districts</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>{u.assignedDistricts?.length || 0} districts</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-active' : 'badge-suspended'}`}>
                      {u.active ? '✅ Active' : '🚫 Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/staff/${u._id}`} className="btn btn-secondary btn-sm">View →</Link>
                      {isAdmin && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>✏️ Edit</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Staff Modal ── */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Staff Member" size="lg">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {addError && <div className="alert alert-error">⚠️ {addError}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Temporary Password *</label>
              <input className="form-control" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select className="form-control" value={form.role || defaultRole} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {activeRoles.map(r => <option key={r._id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Assigned Districts</label>
            <DistrictPicker
              districts={districts}
              selected={form.assignedDistricts}
              onToggle={(code) => toggleDistrictFor(setForm, form, code)}
            />
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={addLoading}>{addLoading ? 'Creating...' : '✅ Create Account'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ── Edit Staff Modal ── */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit Staff — ${editTarget?.name}`} size="lg">
        {editTarget && (
          <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {editError && <div className="alert alert-error">⚠️ {editError}</div>}

            {/* Identity */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: -6 }}>Identity</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-control" value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input className="form-control" type="email" value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label className="form-label">Phone</label>
              <input className="form-control" type="tel" value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
            </div>

            {/* Role & Status */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: -6 }}>Role & Status</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-control" value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  {activeRoles.map(r => <option key={r._id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Account Status</label>
                <select className="form-control" value={editForm.active ? 'active' : 'inactive'}
                  onChange={e => setEditForm(f => ({ ...f, active: e.target.value === 'active' }))}>
                  <option value="active">✅ Active</option>
                  <option value="inactive">🚫 Inactive</option>
                </select>
              </div>
            </div>

            {/* Districts */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: -6 }}>Assigned Districts</div>
            <div className="form-group">
              <DistrictPicker
                districts={districts}
                selected={editForm.assignedDistricts || ['ALL']}
                onToggle={(code) => toggleDistrictFor(setEditForm, editForm, code)}
              />
            </div>

            {/* Password Reset */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: -6 }}>Credentials</div>
            <div>
              <label className="checkbox-group" style={{ fontSize: 13, marginBottom: 8 }}>
                <input type="checkbox" checked={showResetPw} onChange={e => setShowResetPw(e.target.checked)} />
                Reset password for this staff member
              </label>
              {showResetPw && (
                <div className="form-group" style={{ maxWidth: 280, marginTop: 8 }}>
                  <label className="form-label">New Password (min 6 chars)</label>
                  <input className="form-control" type="password" value={editForm.newPassword}
                    onChange={e => setEditForm(f => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Enter new password" minLength={6} />
                </div>
              )}
            </div>

            <ModalFooter>
              <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={editLoading}>
                {editLoading ? 'Saving...' : '💾 Save Changes'}
              </button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </div>
  );
}


/* ─── District Picker ──────────────────────────────────────────────────────── */
function DistrictPicker({ districts, selected = ['ALL'], onToggle }) {
  const isAll = selected.includes('ALL');
  const allDistricts = districts || [];

  // Group by corporation
  const groups = allDistricts.reduce((acc, d) => {
    const corp = d.corporation || 'Other';
    if (!acc[corp]) acc[corp] = [];
    acc[corp].push(d);
    return acc;
  }, {});

  const selectedCount = isAll ? allDistricts.length : selected.length;
  const totalCount = allDistricts.length;

  const handleSelectAll = () => {
    // Toggle every district individually to select all (not ALL token)
    allDistricts.forEach(d => {
      if (!selected.includes(d.code)) onToggle(d.code);
    });
  };

  const handleClearAll = () => {
    // Toggle back to ALL (clear selection → reset to ALL)
    onToggle('ALL');
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* ALL DISTRICTS toggle */}
          <button
            type="button"
            onClick={() => onToggle('ALL')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: isAll ? 'var(--primary)' : 'var(--surface-glass)',
              color: isAll ? '#fff' : 'var(--text-muted)',
              border: isAll ? '1px solid var(--primary)' : '1px solid var(--border)',
              boxShadow: isAll ? '0 0 12px var(--primary-glow)' : 'none',
            }}
          >
            🌐 All Districts
          </button>

          {/* Short-cut buttons (only when not in ALL mode) */}
          {!isAll && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={handleSelectAll}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--surface-glass)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Select All
              </button>
              <button type="button" onClick={handleClearAll}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--surface-glass)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Count badge */}
        <div style={{
          fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 12,
          background: isAll ? 'rgba(37,99,235,0.15)' : 'rgba(16,185,129,0.15)',
          color: isAll ? 'var(--primary)' : '#10b981',
          border: `1px solid ${isAll ? 'rgba(37,99,235,0.3)' : 'rgba(16,185,129,0.3)'}`,
        }}>
          {isAll ? `All ${totalCount}` : `${selectedCount} / ${totalCount}`} districts
        </div>
      </div>

      {/* District chips — only shown when not ALL */}
      {!isAll && (
        <div style={{ padding: 14, background: 'var(--surface-glass)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.entries(groups).map(([corp, dists]) => (
            <div key={corp}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                color: 'var(--text-muted)', marginBottom: 8,
              }}>
                {corp}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {dists.map(d => {
                  const isSelected = selected.includes(d.code);
                  return (
                    <button
                      key={d._id}
                      type="button"
                      onClick={() => onToggle(d.code)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: isSelected ? 'rgba(37,99,235,0.15)' : 'var(--surface)',
                        color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                        border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                        boxShadow: isSelected ? '0 0 8px rgba(37,99,235,0.2)' : 'none',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      {isSelected && <span style={{ fontSize: 10 }}>✓</span>}
                      {d.name || d.code}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {allDistricts.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>
              No districts loaded — add them in Admin Panel → Districts
            </div>
          )}
        </div>
      )}

      {/* ALL mode — just a friendly message */}
      {isAll && (
        <div style={{
          padding: '12px 14px', background: 'rgba(37,99,235,0.05)',
          fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>✅</span>
          This staff member can access all {totalCount} districts. Toggle "All Districts" off to select specific ones.
        </div>
      )}
    </div>
  );
}
