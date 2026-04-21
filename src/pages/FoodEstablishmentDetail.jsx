// Mirrors FoodVendorDetail but for Establishments
import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';

export default function FoodEstablishmentDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const navigate = useNavigate();
  const data = useQuery(api.food.getEstablishment, { token, estabId: id });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const updateEstab = useMutation(api.food.updateEstablishment);
  const createApp = useMutation(api.food.createEstablishmentApplication);
  const updateApp = useMutation(api.food.updateEstablishmentApplication);

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [appModal, setAppModal] = useState(false);
  const [appForm, setAppForm] = useState({ year: new Date().getFullYear(), fee: '', inspectionDate: '', notes: '' });

  if (!data) return <div className="loading-center"><div className="loading-spinner" /></div>;
  const { establishment: estab, applications } = data;
  if (!estab) return <div className="alert alert-error">Establishment not found.</div>;

  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  const openEdit = () => { setEditForm({ establishmentName: estab.establishmentName, ownerName: estab.ownerName, phone: estab.phone || '', email: estab.email || '', address: estab.address, status: estab.status, notes: estab.notes || '', establishmentType: estab.establishmentType }); setEditModal(true); };
  const handleEdit = async (e) => { e.preventDefault(); await updateEstab({ token, estabId: id, ...editForm }); setEditModal(false); };
  const handleNewApp = async (e) => { e.preventDefault(); await createApp({ token, establishmentId: id, year: Number(appForm.year), fee: appForm.fee ? Number(appForm.fee) : undefined, inspectionDate: appForm.inspectionDate ? new Date(appForm.inspectionDate).getTime() : undefined, notes: appForm.notes || undefined }); setAppModal(false); };

  return (
    <div className="slide-up">
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/food/establishments')}>← Back</button>
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
              <div style={{ fontSize: 40 }}>🏪</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{estab.establishmentName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{estab.establishmentType} · Reg. {estab.registrationNo}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}><StatusBadge status={estab.status} size="lg" /></div>
            </div>
            <div className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Owner', value: estab.ownerName },
                { label: 'Type', value: estab.establishmentType },
                { label: 'Phone', value: estab.phone || '—' },
                { label: 'Seating', value: estab.seatingCapacity ? `${estab.seatingCapacity} seats` : '—' },
                { label: 'District', value: districtMap[estab.districtId]?.name || '—' },
                { label: 'Address', value: estab.address },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="detail-label">{label}</div>
                  <div className="detail-value">{value}</div>
                </div>
              ))}
            </div>
          </div>

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
                  <thead><tr><th>Year</th><th>Date</th><th>Status</th><th>Inspection</th><th>Fee</th><th>Actions</th></tr></thead>
                  <tbody>
                    {[...applications].sort((a, b) => b.year - a.year).map(app => (
                      <tr key={app._id}>
                        <td style={{ fontWeight: 700 }}>{app.year}</td>
                        <td>{new Date(app.applicationDate).toLocaleDateString('en-TT')}</td>
                        <td><StatusBadge status={app.status} /></td>
                        <td>{app.inspectionDate ? new Date(app.inspectionDate).toLocaleDateString('en-TT') : '—'}</td>
                        <td>{app.fee ? `$${app.fee} ${app.feePaid ? '✅' : '⏳'}` : '—'}</td>
                        <td>
                          {app.status === 'submitted' && canManageFood && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => updateApp({ token, appId: app._id, status: 'under_review' })}>Review</button>
                              <button className="btn btn-success btn-sm" onClick={() => updateApp({ token, appId: app._id, status: 'approved', feePaid: true })}>Approve</button>
                            </div>
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
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Info</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Registered: {new Date(estab.registrationDate).toLocaleDateString('en-TT')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Applications: {applications?.length || 0}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Active: {applications?.filter(a => a.status === 'approved').length || 0}</div>
        </div>
      </div>

      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Establishment">
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[['Name', 'establishmentName'], ['Owner', 'ownerName'], ['Phone', 'phone'], ['Address', 'address']].map(([label, key]) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input className="form-control" value={editForm[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
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
              <input className="form-control" type="number" value={appForm.fee} onChange={e => setAppForm(f => ({ ...f, fee: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Inspection Date</label>
            <input className="form-control" type="date" value={appForm.inspectionDate} onChange={e => setAppForm(f => ({ ...f, inspectionDate: e.target.value }))} />
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
