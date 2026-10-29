import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';

const EST_TYPES = ['Restaurant', 'Bakery', 'Bar/Club', 'Cafeteria', 'Supermarket', 'Rum Shop', 'Snackette', 'Chinese Restaurant', 'Fast Food', 'Catering Service', 'Other'];

function LicenceDot({ expiry }) {
  if (!expiry) return <span className="licence-dot licence-none">None</span>;
  const daysLeft = Math.ceil((expiry - Date.now()) / 86400000);
  if (daysLeft < 0) return <span className="licence-dot licence-expired">Expired</span>;
  if (daysLeft <= 30) return <span className="licence-dot licence-expiring">{daysLeft}d left</span>;
  return <span className="licence-dot licence-active">Active</span>;
}

const EMPTY_FORM = { establishmentName: '', ownerName: '', phone: '', email: '', address: '', districtId: '', streetId: '', registrationNo: '', establishmentType: '', seatingCapacity: '', notes: '' };

export default function FoodEstablishments() {
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const estabs = useQuery(api.food.listEstablishments, { token, districtId: districtFilter, status: statusFilter || undefined, search: search || undefined });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const streets = useQuery(api.districts.listStreets, form.districtId ? { districtId: form.districtId } : 'skip');
  const createEstab = useMutation(api.food.createEstablishment);

  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  const resetWizard = () => { setShowAdd(false); setWizardStep(1); setForm(EMPTY_FORM); setError(''); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.establishmentName || !form.ownerName || !form.registrationNo || !form.establishmentType || !form.districtId || !form.address) {
      setError('Please fill all required fields.'); return;
    }
    setLoading(true);
    try {
      const res = await createEstab({
        token, establishmentName: form.establishmentName, ownerName: form.ownerName,
        phone: form.phone || undefined, email: form.email || undefined,
        address: form.address, districtId: form.districtId,
        streetId: form.streetId || undefined, registrationNo: form.registrationNo,
        establishmentType: form.establishmentType,
        seatingCapacity: form.seatingCapacity ? Number(form.seatingCapacity) : undefined,
        notes: form.notes || undefined,
      });
      if (res.success) resetWizard();
      else setError(res.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const wizardTitles = { 1: 'Register Establishment — Details', 2: 'Register Establishment — Review' };

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <div className="page-title">🏪 Food Establishments</div>
          <div className="page-subtitle">Fixed premises registration registry</div>
        </div>
        {canManageFood && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ Register Establishment</button>}
      </div>

      <div className="filters-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input className="form-control search-input" placeholder="Search establishments..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 'auto', minWidth: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option><option value="pending">Pending</option>
          <option value="expired">Expired</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option>
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth: 160 }} value={districtFilter || ''} onChange={e => setDistrictFilter(e.target.value || undefined)}>
          <option value="">All Districts</option>
          {(districts || []).map(d => <option key={d._id} value={d._id}>{d.name || d.code}</option>)}
        </select>
      </div>

      {!estabs ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : estabs.length === 0 ? (
        <div className="card"><div className="empty-state">
          <div className="empty-state-icon">🏪</div>
          <div className="empty-state-title">No establishments found</div>
        </div></div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Establishment</th><th>Owner</th><th>Type</th><th>District</th><th>Reg. No.</th><th>Vendors</th><th>Licence</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {estabs.map(e => (
                <tr key={e._id} onClick={() => window.location.href = `/food/establishments/${e._id}`}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.establishmentName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {e.address}</div>
                  </td>
                  <td>{e.ownerName}</td>
                  <td><span className="tag">{e.establishmentType}</span></td>
                  <td style={{ fontSize: 13 }}>{districtMap[e.districtId]?.name || '—'}</td>
                  <td><span className="tag">{e.registrationNo}</span></td>
                  <td style={{ fontSize: 13 }}>👥 {e.linkedVendorCount || 0}</td>
                  <td><LicenceDot expiry={e.licenceExpiry} /></td>
                  <td><StatusBadge status={e.status} /></td>
                  <td><Link to={`/food/establishments/${e._id}`} className="btn btn-secondary btn-sm" onClick={ev => ev.stopPropagation()}>View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registration Wizard */}
      <Modal isOpen={showAdd} onClose={resetWizard} title={wizardTitles[wizardStep]} size="lg">
        <div className="wizard-steps">
          {[{ n: 1, label: 'Details' }, { n: 2, label: 'Review' }].map(s => (
            <span key={s.n} className={`wizard-step ${wizardStep === s.n ? 'active' : ''} ${wizardStep > s.n ? 'completed' : ''}`}>
              <span className="wizard-step-num">{wizardStep > s.n ? '✓' : s.n}</span> {s.label}
            </span>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠️ {error}</div>}

        {wizardStep === 1 && (
          <form onSubmit={e => { e.preventDefault(); if (!form.establishmentName || !form.ownerName || !form.registrationNo || !form.establishmentType || !form.districtId || !form.address) { setError('Please fill all required fields.'); return; } setError(''); setWizardStep(2); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Establishment Name *</label><input className="form-control" value={form.establishmentName} onChange={e => setForm(f => ({ ...f, establishmentName: e.target.value }))} required /></div>
              <div className="form-group"><label className="form-label">Owner Name *</label><input className="form-control" value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Registration No. *</label><input className="form-control" value={form.registrationNo} onChange={e => setForm(f => ({ ...f, registrationNo: e.target.value }))} required /></div>
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select className="form-control" value={form.establishmentType} onChange={e => setForm(f => ({ ...f, establishmentType: e.target.value }))} required>
                  <option value="">Select type</option>
                  {EST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Phone</label><input className="form-control" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Seating Capacity</label><input className="form-control" type="number" value={form.seatingCapacity} onChange={e => setForm(f => ({ ...f, seatingCapacity: e.target.value }))} placeholder="Optional" /></div>
              <div className="form-group">
                <label className="form-label">District *</label>
                <select className="form-control" value={form.districtId} onChange={e => setForm(f => ({ ...f, districtId: e.target.value, streetId: '' }))} required>
                  <option value="">Select district</option>
                  {(districts || []).map(d => <option key={d._id} value={d._id}>{d.name || d.code}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Street</label>
                <select className="form-control" value={form.streetId} onChange={e => setForm(f => ({ ...f, streetId: e.target.value }))} disabled={!form.districtId}>
                  <option value="">Select street</option>
                  {(streets || []).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Address *</label><input className="form-control" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required /></div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <ModalFooter>
              <button type="button" className="btn btn-secondary" onClick={resetWizard}>Cancel</button>
              <button type="submit" className="btn btn-primary">Next →</button>
            </ModalFooter>
          </form>
        )}

        {wizardStep === 2 && (
          <>
            <div className="review-summary">
              <div><div className="detail-label">Establishment Name</div><div className="detail-value">{form.establishmentName}</div></div>
              <div><div className="detail-label">Owner</div><div className="detail-value">{form.ownerName}</div></div>
              <div><div className="detail-label">Registration No.</div><div className="detail-value">{form.registrationNo}</div></div>
              <div><div className="detail-label">Type</div><div className="detail-value"><span className="tag">{form.establishmentType}</span></div></div>
              <div><div className="detail-label">Phone</div><div className="detail-value">{form.phone || '—'}</div></div>
              <div><div className="detail-label">Email</div><div className="detail-value">{form.email || '—'}</div></div>
              <div><div className="detail-label">Seating Capacity</div><div className="detail-value">{form.seatingCapacity || '—'}</div></div>
              <div><div className="detail-label">District</div><div className="detail-value">{districtMap[form.districtId]?.name || '—'}</div></div>
              <div style={{ gridColumn: '1 / -1' }}><div className="detail-label">Address</div><div className="detail-value">{form.address}</div></div>
              {form.notes && <div style={{ gridColumn: '1 / -1' }}><div className="detail-label">Notes</div><div className="detail-value">{form.notes}</div></div>}
            </div>
            <ModalFooter>
              <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(1)}>← Back</button>
              <button type="button" className="btn btn-primary" disabled={loading} onClick={handleCreate}>{loading ? 'Registering...' : '✅ Register Establishment'}</button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
