import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';

export default function FoodVendors() {
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ vendorName: '', ownerName: '', phone: '', email: '', address: '', districtId: '', streetId: '', registrationNo: '', vendorType: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const vendors = useQuery(api.food.listVendors, { token, districtId: districtFilter, status: statusFilter || undefined, search: search || undefined });
  const districts = useQuery(api.districts.listDistricts);
  const streets = useQuery(api.districts.listStreets, form.districtId ? { districtId: form.districtId } : 'skip');
  const createVendor = useMutation(api.food.createVendor);

  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.vendorName || !form.ownerName || !form.address || !form.districtId || !form.registrationNo) {
      setError('Please fill all required fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await createVendor({ token, ...form, streetId: form.streetId || undefined });
      if (res.success) { setShowAdd(false); setForm({ vendorName: '', ownerName: '', phone: '', email: '', address: '', districtId: '', streetId: '', registrationNo: '', vendorType: '', notes: '' }); }
      else setError(res.error || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <div className="page-title">🛒 Food Vendors</div>
          <div className="page-subtitle">Mobile and street vendor registry</div>
        </div>
        {canManageFood && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ Register Vendor</button>}
      </div>

      <div className="filters-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input className="form-control search-input" placeholder="Search vendors..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 'auto', minWidth: 130 }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth: 160 }}
          value={districtFilter || ''} onChange={e => setDistrictFilter(e.target.value || undefined)}>
          <option value="">All Districts</option>
          {(districts || []).map(d => <option key={d._id} value={d._id}>{d.name || d.code}</option>)}
        </select>
      </div>

      {!vendors ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : vendors.length === 0 ? (
        <div className="card"><div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          <div className="empty-state-title">No vendors found</div>
        </div></div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Owner</th>
                <th>Reg. No.</th>
                <th>District</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v._id} onClick={() => window.location.href = `/food/vendors/${v._id}`}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.vendorName}</div>
                    {v.address && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {v.address}</div>}
                  </td>
                  <td>{v.ownerName}</td>
                  <td><span className="tag">{v.registrationNo}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{districtMap[v.districtId]?.name || '—'}</td>
                  <td style={{ fontSize: 13 }}>{v.vendorType || '—'}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td><Link to={`/food/vendors/${v._id}`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Register Food Vendor" size="lg">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vendor/Business Name *</label>
              <input className="form-control" value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Owner Name *</label>
              <input className="form-control" value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Registration No. *</label>
              <input className="form-control" value={form.registrationNo} onChange={e => setForm(f => ({ ...f, registrationNo: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Vendor Type</label>
              <select className="form-control" value={form.vendorType} onChange={e => setForm(f => ({ ...f, vendorType: e.target.value }))}>
                <option value="">Select type</option>
                <option value="Street Stall">Street Stall</option>
                <option value="Mobile Cart">Mobile Cart</option>
                <option value="Market Vendor">Market Vendor</option>
                <option value="Catering">Catering</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">District *</label>
              <select className="form-control" value={form.districtId} onChange={e => setForm(f => ({ ...f, districtId: e.target.value, streetId: '' }))} required>
                <option value="">Select district</option>
                {(districts || []).map(d => <option key={d._id} value={d._id}>{d.name || d.code}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Street</label>
              <select className="form-control" value={form.streetId} onChange={e => setForm(f => ({ ...f, streetId: e.target.value }))} disabled={!form.districtId}>
                <option value="">Select street</option>
                {(streets || []).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address *</label>
            <input className="form-control" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required />
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Registering...' : '✅ Register Vendor'}</button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
