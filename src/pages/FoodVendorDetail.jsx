import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';

export default function FoodVendorDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const navigate = useNavigate();
  const data = useQuery(api.food.getVendor, { token, vendorId: id });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const updateVendor = useMutation(api.food.updateVendor);
  const createApp = useMutation(api.food.createVendorApplication);
  const updateApp = useMutation(api.food.updateVendorApplication);

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [appModal, setAppModal] = useState(false);
  const [appForm, setAppForm] = useState({ year: new Date().getFullYear(), fee: '', notes: '' });

  if (!data) return <div className="loading-center"><div className="loading-spinner" /></div>;
  const { vendor, applications } = data;
  if (!vendor) return <div className="alert alert-error">Vendor not found.</div>;

  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  const openEdit = () => { setEditForm({ vendorName: vendor.vendorName, ownerName: vendor.ownerName, phone: vendor.phone || '', email: vendor.email || '', address: vendor.address, status: vendor.status, notes: vendor.notes || '' }); setEditModal(true); };
  const handleEdit = async (e) => { e.preventDefault(); await updateVendor({ token, vendorId: id, ...editForm }); setEditModal(false); };
  const handleNewApp = async (e) => { e.preventDefault(); await createApp({ token, vendorId: id, year: Number(appForm.year), fee: appForm.fee ? Number(appForm.fee) : undefined, notes: appForm.notes || undefined }); setAppModal(false); };

  return (
    <div className="slide-up">
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/food/vendors')}>← Back</button>
        <div style={{ flex: 1 }} />
        {canManageFood && <>
          <button className="btn btn-secondary btn-sm" onClick={openEdit}>✏️ Edit</button>
          <button className="btn btn-primary btn-sm" onClick={() => setAppModal(true)}>＋ New Application</button>
        </>}
      </div>

      <div className="detail-grid">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 40 }}>🛒</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{vendor.vendorName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Reg. {vendor.registrationNo}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}><StatusBadge status={vendor.status} size="lg" /></div>
            </div>
            <div className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Owner', value: vendor.ownerName },
                { label: 'Type', value: vendor.vendorType || '—' },
                { label: 'Phone', value: vendor.phone || '—' },
                { label: 'Email', value: vendor.email || '—' },
                { label: 'District', value: districtMap[vendor.districtId]?.name || '—' },
                { label: 'Address', value: vendor.address },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="detail-label">{label}</div>
                  <div className="detail-value">{value}</div>
                </div>
              ))}
            </div>
            {vendor.notes && <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-glass)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)' }}>{vendor.notes}</div>}
          </div>

          {/* Applications */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>📄 Yearly Applications ({applications?.length || 0})</div>
            {!applications || applications.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-state-icon">📄</div>
                <div className="empty-state-title">No applications yet</div>
              </div>
            ) : (
              <div className="table-container" style={{ borderRadius: 'var(--radius-sm)' }}>
                <table>
                  <thead><tr><th>Year</th><th>Date</th><th>Status</th><th>Fee</th><th>Actions</th></tr></thead>
                  <tbody>
                    {[...applications].sort((a, b) => b.year - a.year).map(app => (
                      <tr key={app._id}>
                        <td style={{ fontWeight: 700 }}>{app.year}</td>
                        <td>{new Date(app.applicationDate).toLocaleDateString('en-TT')}</td>
                        <td><StatusBadge status={app.status} /></td>
                        <td>{app.fee ? `$${app.fee} ${app.feePaid ? '✅' : '⏳'}` : '—'}</td>
                        <td>
                          {app.status === 'submitted' && canManageFood && (
                            <button className="btn btn-success btn-sm" onClick={() => updateApp({ token, appId: app._id, status: 'approved', feePaid: true, expiryDate: new Date(`${app.year + 1}-01-01`).getTime() })}>
                              ✅ Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="card" style={{ height: 'fit-content' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Quick Info</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Registered: {new Date(vendor.registrationDate).toLocaleDateString('en-TT')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Total Applications: {applications?.length || 0}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            Active: {applications?.filter(a => a.status === 'approved').length || 0}
          </div>
        </div>
      </div>

      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Vendor">
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[['Vendor Name', 'vendorName'], ['Owner Name', 'ownerName'], ['Phone', 'phone'], ['Email', 'email'], ['Address', 'address']].map(([label, key]) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input className="form-control" value={editForm[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={editForm.status || 'pending'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              {['active', 'pending', 'suspended', 'expired', 'revoked'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows={3} value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal isOpen={appModal} onClose={() => setAppModal(false)} title="New Yearly Application">
        <form onSubmit={handleNewApp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Year *</label>
              <input className="form-control" type="number" value={appForm.year} onChange={e => setAppForm(f => ({ ...f, year: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Fee (TTD)</label>
              <input className="form-control" type="number" value={appForm.fee} onChange={e => setAppForm(f => ({ ...f, fee: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows={2} value={appForm.notes} onChange={e => setAppForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setAppModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit Application</button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
