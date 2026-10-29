import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';

const EST_TYPES = ['Restaurant', 'Bakery', 'Bar/Club', 'Cafeteria', 'Supermarket', 'Rum Shop', 'Snackette', 'Chinese Restaurant', 'Fast Food', 'Catering Service', 'Other'];
const PAYMENT_METHODS = ['Cash', 'Cheque', 'Bank Transfer'];

export default function FoodEstablishmentDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const navigate = useNavigate();
  const data = useQuery(api.food.getEstablishment, { token, estabId: id });
  const linkedVendors = useQuery(api.food.getVendorsByEstablishment, { token, establishmentId: id });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const updateEstab = useMutation(api.food.updateEstablishment);
  const createApp = useMutation(api.food.createEstablishmentApplication);
  const updateApp = useMutation(api.food.updateEstablishmentApplication);
  const approveApp = useMutation(api.food.approveEstablishmentApplication);

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [appModal, setAppModal] = useState(false);
  const [appForm, setAppForm] = useState({ year: new Date().getFullYear(), fee: '', inspectionDate: '', notes: '' });
  const [approveModal, setApproveModal] = useState(false);
  const [approveAppId, setApproveAppId] = useState(null);
  const [approveForm, setApproveForm] = useState({ licenceNo: '', fee: '', paymentMethod: '', receiptNo: '', inspectionDate: '', inspectionNotes: '', expiryDate: '', notes: '' });
  const [approveError, setApproveError] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  if (!data) return <div className="loading-center"><div className="loading-spinner" /></div>;
  const { establishment: estab, applications } = data;
  if (!estab) return <div className="alert alert-error">Establishment not found.</div>;

  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  // Latest approved application
  const latestApproved = applications?.filter(a => a.status === 'approved').sort((a, b) => (b.expiryDate || 0) - (a.expiryDate || 0))[0];
  const daysLeft = latestApproved?.expiryDate ? Math.ceil((latestApproved.expiryDate - Date.now()) / 86400000) : null;

  const openEdit = () => {
    setEditForm({
      establishmentName: estab.establishmentName, ownerName: estab.ownerName,
      phone: estab.phone || '', email: estab.email || '', address: estab.address,
      status: estab.status, notes: estab.notes || '',
      establishmentType: estab.establishmentType,
      seatingCapacity: estab.seatingCapacity || '',
    });
    setEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    await updateEstab({
      token, estabId: id, ...editForm,
      seatingCapacity: editForm.seatingCapacity ? Number(editForm.seatingCapacity) : undefined,
    });
    setEditModal(false);
  };

  const handleNewApp = async (e) => {
    e.preventDefault();
    await createApp({
      token, establishmentId: id, year: Number(appForm.year),
      fee: appForm.fee ? Number(appForm.fee) : undefined,
      inspectionDate: appForm.inspectionDate ? new Date(appForm.inspectionDate).getTime() : undefined,
      notes: appForm.notes || undefined,
    });
    setAppModal(false);
    setAppForm({ year: new Date().getFullYear(), fee: '', inspectionDate: '', notes: '' });
  };

  const openApprove = (app) => {
    setApproveAppId(app._id);
    setApproveForm({
      licenceNo: '', fee: app.fee || '', paymentMethod: '', receiptNo: '',
      inspectionDate: app.inspectionDate ? new Date(app.inspectionDate).toISOString().split('T')[0] : '',
      inspectionNotes: '', expiryDate: `${app.year}-12-31`, notes: '',
    });
    setApproveError('');
    setApproveModal(true);
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    setApproveError('');
    if (!approveForm.licenceNo.trim()) { setApproveError('Licence number is required.'); return; }
    if (!approveForm.expiryDate) { setApproveError('Expiry date is required.'); return; }
    setApproveLoading(true);
    try {
      const res = await approveApp({
        token, appId: approveAppId, licenceNo: approveForm.licenceNo.trim(),
        fee: approveForm.fee ? Number(approveForm.fee) : undefined,
        paymentMethod: approveForm.paymentMethod || undefined,
        receiptNo: approveForm.receiptNo || undefined,
        expiryDate: new Date(approveForm.expiryDate).getTime(),
        inspectionDate: approveForm.inspectionDate ? new Date(approveForm.inspectionDate).getTime() : undefined,
        inspectionNotes: approveForm.inspectionNotes || undefined,
        notes: approveForm.notes || undefined,
      });
      if (res.success) setApproveModal(false);
      else setApproveError(res.error || 'Approval failed');
    } finally { setApproveLoading(false); }
  };

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
          {/* Licence Status Card */}
          <div className="licence-status-card">
            <div className="licence-info">
              <div className="licence-number">🪪 {latestApproved?.licenceNo || 'No Licence'}</div>
              <div className="licence-expiry">{latestApproved?.expiryDate ? `Expires ${new Date(latestApproved.expiryDate).toLocaleDateString('en-TT')}` : 'No active licence'}</div>
            </div>
            {latestApproved ? (
              <span className={`licence-status-text ${daysLeft < 0 ? 'licence-status-expired' : daysLeft <= 30 ? 'licence-status-expiring' : 'licence-status-active'}`}>
                {daysLeft < 0 ? 'Expired' : daysLeft <= 30 ? `Expiring in ${daysLeft} days` : `Valid — ${daysLeft} days remaining`}
              </span>
            ) : (
              <span className="licence-status-text licence-status-none">No active licence</span>
            )}
          </div>

          {/* Establishment Info Card */}
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
                { label: 'Email', value: estab.email || '—' },
                { label: 'Seating', value: estab.seatingCapacity ? `${estab.seatingCapacity} seats` : '—' },
                { label: 'District', value: districtMap[estab.districtId]?.name || '—' },
                { label: 'Address', value: estab.address },
              ].map(({ label, value }) => (
                <div key={label}><div className="detail-label">{label}</div><div className="detail-value">{value}</div></div>
              ))}
            </div>
            {estab.notes && <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-glass)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)' }}>{estab.notes}</div>}
          </div>

          {/* Applications / Licence History */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>📄 Licence History ({applications?.length || 0})</div>
            {!applications || applications.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-state-icon">📄</div>
                <div className="empty-state-title">No applications yet</div>
              </div>
            ) : (
              <div className="table-container" style={{ borderRadius: 'var(--radius-sm)' }}>
                <table>
                  <thead><tr><th>Year</th><th>Licence No.</th><th>Date</th><th>Status</th><th>Inspection</th><th>Fee</th><th>Payment</th><th>Expiry</th><th>Actions</th></tr></thead>
                  <tbody>
                    {applications.map(app => {
                      const expDays = app.expiryDate ? Math.ceil((app.expiryDate - Date.now()) / 86400000) : null;
                      return (
                        <tr key={app._id}>
                          <td style={{ fontWeight: 700 }}>{app.year}</td>
                          <td>{app.licenceNo ? <span className="tag">{app.licenceNo}</span> : '—'}</td>
                          <td>{new Date(app.applicationDate).toLocaleDateString('en-TT')}</td>
                          <td><StatusBadge status={app.status} /></td>
                          <td>{app.inspectionDate ? new Date(app.inspectionDate).toLocaleDateString('en-TT') : '—'}</td>
                          <td>{app.fee ? `$${app.fee} ${app.feePaid ? '✅' : '⏳'}` : '—'}</td>
                          <td style={{ fontSize: 12 }}>{app.paymentMethod ? app.paymentMethod.replace('_', ' ') : '—'}{app.receiptNo && <div style={{ color: 'var(--text-muted)' }}>#{app.receiptNo}</div>}</td>
                          <td style={{ color: expDays != null && expDays < 0 ? '#dc2626' : expDays != null && expDays <= 30 ? '#d97706' : 'inherit' }}>{app.expiryDate ? new Date(app.expiryDate).toLocaleDateString('en-TT') : '—'}</td>
                          <td>
                            {canManageFood && (app.status === 'submitted' || app.status === 'under_review') && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                {app.status === 'submitted' && <button className="btn btn-secondary btn-sm" onClick={() => updateApp({ token, appId: app._id, status: 'under_review' })}>Review</button>}
                                <button className="btn btn-success btn-sm" onClick={() => openApprove(app)}>Approve</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Linked Vendors Section */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700 }}>👥 Linked Vendors ({linkedVendors?.length || 0})</div>
              {canManageFood && <Link to="/food/vendors" className="btn btn-primary btn-sm">＋ Register Vendor</Link>}
            </div>
            {!linkedVendors || linkedVendors.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">No vendors linked to this establishment</div>
              </div>
            ) : (
              <div className="table-container" style={{ borderRadius: 'var(--radius-sm)' }}>
                <table>
                  <thead><tr><th>Vendor</th><th>Owner</th><th>Reg. No.</th><th>Licence</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {linkedVendors.map(v => (
                      <tr key={v._id}>
                        <td style={{ fontWeight: 600 }}>{v.vendorName}</td>
                        <td>{v.ownerName}</td>
                        <td><span className="tag">{v.registrationNo}</span></td>
                        <td>{v.currentLicenceNo ? <span className="tag">{v.currentLicenceNo}</span> : '—'}</td>
                        <td><StatusBadge status={v.status} /></td>
                        <td><Link to={`/food/vendors/${v._id}`} className="btn btn-secondary btn-sm">View →</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Quick Info Sidebar */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Info</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Registered: {new Date(estab.registrationDate).toLocaleDateString('en-TT')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Applications: {applications?.length || 0}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Approved: {applications?.filter(a => a.status === 'approved').length || 0}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Linked Vendors: {linkedVendors?.length || 0}</div>
          {latestApproved && <>
            <div className="divider" style={{ margin: '10px 0' }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Current Licence: <strong>{latestApproved.licenceNo || '—'}</strong></div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Expires: {latestApproved.expiryDate ? new Date(latestApproved.expiryDate).toLocaleDateString('en-TT') : '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Fee Paid: {latestApproved.feePaid ? '✅ Yes' : '⏳ Pending'}</div>
          </>}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Establishment" size="lg">
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Name</label><input className="form-control" value={editForm.establishmentName || ''} onChange={e => setEditForm(f => ({ ...f, establishmentName: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Owner</label><input className="form-control" value={editForm.ownerName || ''} onChange={e => setEditForm(f => ({ ...f, ownerName: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-control" value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-control" value={editForm.establishmentType || ''} onChange={e => setEditForm(f => ({ ...f, establishmentType: e.target.value }))}>
                {EST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Seating Capacity</label><input className="form-control" type="number" value={editForm.seatingCapacity || ''} onChange={e => setEditForm(f => ({ ...f, seatingCapacity: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Address</label><input className="form-control" value={editForm.address || ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              {['active', 'pending', 'suspended', 'expired', 'revoked'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={3} value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* New Application Modal */}
      <Modal isOpen={appModal} onClose={() => setAppModal(false)} title="New Yearly Application">
        <form onSubmit={handleNewApp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Year *</label><input className="form-control" type="number" value={appForm.year} onChange={e => setAppForm(f => ({ ...f, year: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Fee (TTD)</label><input className="form-control" type="number" value={appForm.fee} onChange={e => setAppForm(f => ({ ...f, fee: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Inspection Date</label><input className="form-control" type="date" value={appForm.inspectionDate} onChange={e => setAppForm(f => ({ ...f, inspectionDate: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={appForm.notes} onChange={e => setAppForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setAppModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit Application</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Approve Application Modal */}
      <Modal isOpen={approveModal} onClose={() => setApproveModal(false)} title="Approve Application & Issue Licence" size="lg">
        <form onSubmit={handleApprove} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {approveError && <div className="alert alert-error">⚠️ {approveError}</div>}
          <div className="form-row">
            <div className="form-group"><label className="form-label">Licence Number *</label><input className="form-control" value={approveForm.licenceNo} onChange={e => setApproveForm(f => ({ ...f, licenceNo: e.target.value }))} placeholder="Enter unique licence number" required /></div>
            <div className="form-group"><label className="form-label">Fee Amount (TTD)</label><input className="form-control" type="number" value={approveForm.fee} onChange={e => setApproveForm(f => ({ ...f, fee: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-control" value={approveForm.paymentMethod} onChange={e => setApproveForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <option value="">Select method</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m.toLowerCase().replace(' ', '_')}>{m}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Receipt Number</label><input className="form-control" value={approveForm.receiptNo} onChange={e => setApproveForm(f => ({ ...f, receiptNo: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Inspection Date</label><input className="form-control" type="date" value={approveForm.inspectionDate} onChange={e => setApproveForm(f => ({ ...f, inspectionDate: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Expiry Date *</label><input className="form-control" type="date" value={approveForm.expiryDate} onChange={e => setApproveForm(f => ({ ...f, expiryDate: e.target.value }))} required /></div>
          </div>
          <div className="form-group"><label className="form-label">Inspection Notes</label><textarea className="form-control" rows={2} value={approveForm.inspectionNotes} onChange={e => setApproveForm(f => ({ ...f, inspectionNotes: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={approveForm.notes} onChange={e => setApproveForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setApproveModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={approveLoading}>{approveLoading ? 'Approving...' : '✅ Approve & Issue Licence'}</button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
