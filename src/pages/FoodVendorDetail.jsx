import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';

const TYPE_LABELS = { itinerant: '🚶 Itinerant', special_event: '🎪 Special Event', establishment: '🏪 Establishment' };
const PAYMENT_METHODS = ['Cash', 'Cheque', 'Bank Transfer'];

export default function FoodVendorDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const navigate = useNavigate();
  const data = useQuery(api.food.getVendor, { token, vendorId: id });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const activeEstabs = useQuery(api.food.listActiveEstablishments, { token });
  const updateVendor = useMutation(api.food.updateVendor);
  const createApp = useMutation(api.food.createVendorApplication);
  const updateApp = useMutation(api.food.updateVendorApplication);
  const approveApp = useMutation(api.food.approveVendorApplication);

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
  const { vendor, applications, linkedEstablishment } = data;
  if (!vendor) return <div className="alert alert-error">Vendor not found.</div>;

  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  // Latest approved application
  const latestApproved = applications?.filter(a => a.status === 'approved').sort((a, b) => (b.expiryDate || 0) - (a.expiryDate || 0))[0];
  const daysLeft = latestApproved?.expiryDate ? Math.ceil((latestApproved.expiryDate - Date.now()) / 86400000) : null;

  const openEdit = () => {
    setEditForm({
      vendorName: vendor.vendorName, ownerName: vendor.ownerName,
      phone: vendor.phone || '', email: vendor.email || '',
      address: vendor.address, status: vendor.status, notes: vendor.notes || '',
      vendorType: vendor.vendorType, linkedEstablishmentId: vendor.linkedEstablishmentId || '',
      operatingArea: vendor.operatingArea || '',
      eventName: vendor.eventName || '', eventStartDate: vendor.eventStartDate ? new Date(vendor.eventStartDate).toISOString().split('T')[0] : '',
      eventEndDate: vendor.eventEndDate ? new Date(vendor.eventEndDate).toISOString().split('T')[0] : '',
    });
    setEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const updates = { ...editForm };
    if (updates.eventStartDate) updates.eventStartDate = new Date(updates.eventStartDate).getTime();
    else delete updates.eventStartDate;
    if (updates.eventEndDate) updates.eventEndDate = new Date(updates.eventEndDate).getTime();
    else delete updates.eventEndDate;
    if (!updates.linkedEstablishmentId) delete updates.linkedEstablishmentId;
    await updateVendor({ token, vendorId: id, ...updates });
    setEditModal(false);
  };

  const handleNewApp = async (e) => {
    e.preventDefault();
    await createApp({ token, vendorId: id, year: Number(appForm.year), fee: appForm.fee ? Number(appForm.fee) : undefined, inspectionDate: appForm.inspectionDate ? new Date(appForm.inspectionDate).getTime() : undefined, notes: appForm.notes || undefined });
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

  const generateBadgePDF = () => {
    // 5.5 x 8.5 inch page (half letter / statement size)
    const doc = new jsPDF({ unit: 'in', format: [5.5, 8.5] });
    const w = 5.5;
    const cx = w / 2;

    // === BACKGROUND ===
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, 5.5, 8.5, 'F');

    // === HEADER BAR ===
    doc.setFillColor(30, 64, 175); // blue-800
    doc.rect(0, 0, 5.5, 1.3, 'F');

    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('POINT FORTIN BOROUGH CORPORATION', cx, 0.4, { align: 'center' });
    doc.setFontSize(16);
    doc.text('FOOD VENDOR LICENCE', cx, 0.75, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Public Health Department', cx, 1.05, { align: 'center' });

    // === VENDOR TYPE STRIPE ===
    const typeColors = { itinerant: [124, 58, 237], special_event: [217, 119, 6], establishment: [5, 150, 105] };
    const typeLabels = { itinerant: 'ITINERANT VENDOR', special_event: 'SPECIAL EVENT VENDOR', establishment: 'ESTABLISHMENT VENDOR' };
    const tc = typeColors[vendor.vendorType] || [100, 100, 100];
    doc.setFillColor(tc[0], tc[1], tc[2]);
    doc.rect(0, 1.3, 5.5, 0.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(typeLabels[vendor.vendorType] || 'FOOD VENDOR', cx, 1.57, { align: 'center' });

    // === PHOTO PLACEHOLDER ===
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(235, 235, 240);
    doc.roundedRect(cx - 0.65, 1.95, 1.3, 1.6, 0.1, 0.1, 'FD');
    doc.setFontSize(32);
    doc.setTextColor(180, 180, 190);
    doc.text('\u{1F464}', cx, 2.95, { align: 'center' });
    doc.setFontSize(7);
    doc.text('PHOTO', cx, 3.35, { align: 'center' });

    // === REGISTRATION NUMBER (prominent) ===
    doc.setFillColor(30, 64, 175);
    doc.roundedRect(0.5, 3.75, 4.5, 0.45, 0.08, 0.08, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(vendor.registrationNo, cx, 4.05, { align: 'center' });

    // === DETAILS SECTION ===
    doc.setTextColor(60, 60, 70);
    let y = 4.55;
    const labelX = 0.6;
    const valueX = 2.3;
    const lineH = 0.36;

    const addRow = (label, value) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 130);
      doc.text(label, labelX, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 50);
      doc.text(value || '—', valueX, y);
      // Underline
      doc.setDrawColor(220, 220, 225);
      doc.line(labelX, y + 0.06, 4.9, y + 0.06);
      y += lineH;
    };

    addRow('VENDOR NAME', vendor.vendorName);
    addRow('OWNER', vendor.ownerName);
    addRow('DISTRICT', districtMap[vendor.districtId]?.name || '—');
    addRow('ADDRESS', vendor.address);
    if (vendor.phone) addRow('PHONE', vendor.phone);
    if (latestApproved?.licenceNo) addRow('LICENCE NO.', latestApproved.licenceNo);

    // === VALIDITY PERIOD ===
    if (latestApproved?.expiryDate) {
      y += 0.15;
      doc.setFillColor(240, 253, 244); // light green bg
      doc.roundedRect(0.5, y - 0.12, 4.5, 0.55, 0.08, 0.08, 'F');
      doc.setDrawColor(16, 185, 129);
      doc.roundedRect(0.5, y - 0.12, 4.5, 0.55, 0.08, 0.08, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(5, 150, 105);
      const issued = latestApproved.paymentDate ? new Date(latestApproved.paymentDate).toLocaleDateString('en-TT') : 'N/A';
      const expires = new Date(latestApproved.expiryDate).toLocaleDateString('en-TT');
      doc.text(`VALID: ${issued}  —  ${expires}`, cx, y + 0.15, { align: 'center' });
    }

    // === FOOTER ===
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 7.9, 5.5, 0.6, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(200, 210, 240);
    doc.text('This badge must be displayed at all times while vending.', cx, 8.15, { align: 'center' });
    doc.text('Issued by the Point Fortin Borough Corporation — Public Health Dept.', cx, 8.32, { align: 'center' });

    // === BORDER ===
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.04);
    doc.rect(0.15, 0.15, 5.2, 8.2);

    doc.save(`Badge_${vendor.registrationNo}.pdf`);
  };

  return (
    <div className="slide-up">
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/food/vendors')}>← Back</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm" onClick={generateBadgePDF} title="Generate printable ID badge">🪪 Print Badge</button>
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

          {/* Vendor Info Card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 40 }}>🛒</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{vendor.vendorName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Reg. {vendor.registrationNo}
                  <span className={`vendor-type-badge vendor-type-${vendor.vendorType}`}>{TYPE_LABELS[vendor.vendorType]}</span>
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}><StatusBadge status={vendor.status} size="lg" /></div>
            </div>
            <div className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Owner', value: vendor.ownerName },
                { label: 'Phone', value: vendor.phone || '—' },
                { label: 'Email', value: vendor.email || '—' },
                { label: 'District', value: districtMap[vendor.districtId]?.name || '—' },
                { label: 'Address', value: vendor.address },
              ].map(({ label, value }) => (
                <div key={label}><div className="detail-label">{label}</div><div className="detail-value">{value}</div></div>
              ))}
            </div>

            {/* Type-specific info */}
            <div className="divider" style={{ margin: '14px 0' }} />
            {vendor.vendorType === 'itinerant' && (
              <div><div className="detail-label">Operating Area</div><div className="detail-value">{vendor.operatingArea || '—'}</div></div>
            )}
            {vendor.vendorType === 'special_event' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><div className="detail-label">Event Name</div><div className="detail-value">{vendor.eventName || '—'}</div></div>
                <div><div className="detail-label">Event Dates</div><div className="detail-value">
                  {vendor.eventStartDate ? new Date(vendor.eventStartDate).toLocaleDateString('en-TT') : '—'} → {vendor.eventEndDate ? new Date(vendor.eventEndDate).toLocaleDateString('en-TT') : '—'}
                </div></div>
              </div>
            )}
            {vendor.vendorType === 'establishment' && (
              <div><div className="detail-label">Linked Establishment</div><div className="detail-value">
                {linkedEstablishment ? <Link to={`/food/establishments/${vendor.linkedEstablishmentId}`} style={{ color: 'var(--blue-500)', textDecoration: 'none', fontWeight: 600 }}>🏪 {linkedEstablishment.establishmentName}</Link> : '—'}
              </div></div>
            )}

            {vendor.notes && <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-glass)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)' }}>{vendor.notes}</div>}
          </div>

          {/* Applications */}
          <div className="card">
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
        </div>

        {/* Quick Info Sidebar */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Quick Info</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Registered: {new Date(vendor.registrationDate).toLocaleDateString('en-TT')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Total Applications: {applications?.length || 0}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Approved: {applications?.filter(a => a.status === 'approved').length || 0}</div>
          {latestApproved && <>
            <div className="divider" style={{ margin: '10px 0' }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Current Licence: <strong>{latestApproved.licenceNo || '—'}</strong></div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Expires: {latestApproved.expiryDate ? new Date(latestApproved.expiryDate).toLocaleDateString('en-TT') : '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Fee Paid: {latestApproved.feePaid ? '✅ Yes' : '⏳ Pending'}</div>
          </>}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Vendor" size="lg">
        <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Vendor Name</label><input className="form-control" value={editForm.vendorName || ''} onChange={e => setEditForm(f => ({ ...f, vendorName: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Owner Name</label><input className="form-control" value={editForm.ownerName || ''} onChange={e => setEditForm(f => ({ ...f, ownerName: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-control" value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Address</label><input className="form-control" value={editForm.address || ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vendor Type</label>
              <select className="form-control" value={editForm.vendorType || ''} onChange={e => setEditForm(f => ({ ...f, vendorType: e.target.value }))}>
                <option value="itinerant">🚶 Itinerant</option>
                <option value="special_event">🎪 Special Event</option>
                <option value="establishment">🏪 Establishment</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" value={editForm.status || 'pending'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                {['active', 'pending', 'suspended', 'expired', 'revoked'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {editForm.vendorType === 'itinerant' && (
            <div className="form-group"><label className="form-label">Operating Area</label><textarea className="form-control" rows={2} value={editForm.operatingArea || ''} onChange={e => setEditForm(f => ({ ...f, operatingArea: e.target.value }))} /></div>
          )}
          {editForm.vendorType === 'special_event' && (
            <>
              <div className="form-group"><label className="form-label">Event Name</label><input className="form-control" value={editForm.eventName || ''} onChange={e => setEditForm(f => ({ ...f, eventName: e.target.value }))} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Event Start</label><input className="form-control" type="date" value={editForm.eventStartDate || ''} onChange={e => setEditForm(f => ({ ...f, eventStartDate: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Event End</label><input className="form-control" type="date" value={editForm.eventEndDate || ''} onChange={e => setEditForm(f => ({ ...f, eventEndDate: e.target.value }))} /></div>
              </div>
            </>
          )}
          {editForm.vendorType === 'establishment' && (
            <div className="form-group">
              <label className="form-label">Linked Establishment</label>
              <select className="form-control" value={editForm.linkedEstablishmentId || ''} onChange={e => setEditForm(f => ({ ...f, linkedEstablishmentId: e.target.value }))}>
                <option value="">Select establishment</option>
                {(activeEstabs || []).map(e => <option key={e._id} value={e._id}>{e.establishmentName} ({e.registrationNo})</option>)}
              </select>
            </div>
          )}
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
            <div className="form-group"><label className="form-label">Fee (TTD)</label><input className="form-control" type="number" value={appForm.fee} onChange={e => setAppForm(f => ({ ...f, fee: e.target.value }))} placeholder="0.00" /></div>
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
