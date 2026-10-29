import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';
import {
  ESTABLISHMENT_TYPES, TYPE_LABELS, PAYMENT_METHODS, LICENCE_STATE, fmtDay, fmtMoment,
  todayInput, dayToMs, daysLeftText,
} from '../utils/vendors';

const EDITABLE_STATUSES = ['active', 'pending', 'suspended', 'revoked'];

function Field({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || '—'}</div>
    </div>
  );
}

function Avatar({ url, w = 36, h = 45 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(w / 2) }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
    </div>
  );
}

const fullName = (v) => [v.vendorName, v.vendorSurname || v.ownerName].filter(Boolean).join(' ') || '—';

export default function FoodEstablishmentDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const navigate = useNavigate();

  const data = useQuery(api.establishments.getEstablishment, { token, establishmentId: id });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });

  const updateEstablishment = useMutation(api.establishments.updateEstablishment);
  const startApplication = useMutation(api.establishments.startApplication);
  const recordInspection = useMutation(api.establishments.recordInspection);
  const issueLicence = useMutation(api.establishments.issueLicence);
  const updateLicenceNumber = useMutation(api.establishments.updateLicenceNumber);
  const rejectApplication = useMutation(api.establishments.rejectApplication);
  const assignVendor = useMutation(api.establishments.assignVendor);
  const unassignVendor = useMutation(api.establishments.unassignVendor);

  // which dialog is open: edit | apply | inspect | issue | licenceNo | reject | assign | unassign | null
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [editForm, setEditForm] = useState({});
  const [applyForm, setApplyForm] = useState({ fee: '', notes: '' });
  const [inspectForm, setInspectForm] = useState({ inspectionDate: todayInput(), inspectionNotes: '' });
  const [issueForm, setIssueForm] = useState({});
  const [licenceNoValue, setLicenceNoValue] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [assignForm, setAssignForm] = useState({ vendorId: '', startDate: todayInput(), note: '', search: '' });
  const [unassignTarget, setUnassignTarget] = useState(null);
  const [unassignForm, setUnassignForm] = useState({ endDate: todayInput(), note: '' });

  // Vendors who could be assigned (loaded only while the assign dialog is open)
  const unassigned = useQuery(api.establishments.listUnassignedVendors, dialog === 'assign' ? { token } : 'skip');
  // The validity period the server will set for a payment on the chosen date
  const validityPreview = useQuery(
    api.establishments.previewValidity,
    dialog === 'issue' && issueForm.paymentDate
      ? { token, establishmentId: id, paymentDate: dayToMs(issueForm.paymentDate) }
      : 'skip'
  );

  if (data === undefined) return <div className="loading-center"><div className="loading-spinner" /></div>;
  if (data === null) {
    return (
      <div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/food/establishments')}>← Back</button>
        <div className="alert alert-error" style={{ marginTop: 14 }}>Establishment not found.</div>
      </div>
    );
  }

  const {
    establishment: estab, applications, currentLicence, licenceState, daysLeft,
    openApplication, renewalOpensAt, canApply, vendors, assignments,
  } = data;
  const districtName = (districts || []).find((d) => d._id === estab.districtId)?.name;
  const isRenewal = applications.some((a) => a.status === 'approved');
  const licenceUi = LICENCE_STATE[licenceState] || LICENCE_STATE.none;

  const close = () => { setDialog(null); setError(''); setBusy(false); };

  /** Run a mutation, show its error, close the dialog on success. */
  const run = async (fn) => {
    setError('');
    setBusy(true);
    try {
      const res = await fn();
      if (res && res.success === false) { setError(res.error || 'Something went wrong.'); return; }
      close();
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  // ---------- dialog openers ----------
  const openEdit = () => {
    setEditForm({
      establishmentName: estab.establishmentName || '', establishmentType: estab.establishmentType || '',
      ownerName: estab.ownerName || '', phone: estab.phone || '', email: estab.email || '',
      districtId: estab.districtId || '', address: estab.address || '',
      seatingCapacity: estab.seatingCapacity ?? '', status: estab.status || 'pending', notes: estab.notes || '',
    });
    setError(''); setDialog('edit');
  };
  const openApply = () => { setApplyForm({ fee: '', notes: '' }); setError(''); setDialog('apply'); };
  const openInspect = () => {
    setInspectForm({
      inspectionDate: openApplication?.inspectionDate ? new Date(openApplication.inspectionDate).toISOString().split('T')[0] : todayInput(),
      inspectionNotes: openApplication?.inspectionNotes || '',
    });
    setError(''); setDialog('inspect');
  };
  const openIssue = () => {
    setIssueForm({
      // Prefilled from the previous licence — change it if a new number was issued with this payment.
      licenceNo: currentLicence?.licenceNo || '',
      fee: openApplication?.fee ?? '',
      paymentDate: todayInput(), paymentMethod: '', receiptNo: '', notes: '',
    });
    setError(''); setDialog('issue');
  };
  const openLicenceNo = () => { setLicenceNoValue(currentLicence?.licenceNo || ''); setError(''); setDialog('licenceNo'); };
  const openReject = () => { setRejectReason(''); setError(''); setDialog('reject'); };
  const openAssign = () => { setAssignForm({ vendorId: '', startDate: todayInput(), note: '', search: '' }); setError(''); setDialog('assign'); };
  const openUnassign = (vendor) => { setUnassignTarget(vendor); setUnassignForm({ endDate: todayInput(), note: '' }); setError(''); setDialog('unassign'); };

  // ---------- submit handlers ----------
  const submitEdit = (e) => {
    e.preventDefault();
    const f = editForm;
    run(() => updateEstablishment({
      token, establishmentId: id,
      establishmentName: f.establishmentName, establishmentType: f.establishmentType,
      ownerName: f.ownerName, phone: f.phone, email: f.email, address: f.address,
      districtId: f.districtId || undefined,
      seatingCapacity: f.seatingCapacity !== '' ? Number(f.seatingCapacity) : undefined,
      status: f.status, notes: f.notes,
    }));
  };
  const submitApply = (e) => {
    e.preventDefault();
    run(() => startApplication({
      token, establishmentId: id,
      fee: applyForm.fee !== '' ? Number(applyForm.fee) : undefined,
      notes: applyForm.notes || undefined,
    }));
  };
  const submitInspect = (e) => {
    e.preventDefault();
    run(() => recordInspection({
      token, appId: openApplication._id,
      inspectionDate: dayToMs(inspectForm.inspectionDate),
      inspectionNotes: inspectForm.inspectionNotes || undefined,
    }));
  };
  const submitIssue = (e) => {
    e.preventDefault();
    const f = issueForm;
    if (!f.licenceNo.trim()) { setError('Enter the licence number.'); return; }
    if (f.fee === '' || Number(f.fee) < 0) { setError('Enter the fee that was paid.'); return; }
    if (!f.paymentMethod) { setError('Select how the fee was paid.'); return; }
    run(() => issueLicence({
      token, appId: openApplication._id,
      licenceNo: f.licenceNo.trim(),
      fee: Number(f.fee), paymentDate: dayToMs(f.paymentDate), paymentMethod: f.paymentMethod,
      receiptNo: f.receiptNo || undefined, notes: f.notes || undefined,
    }));
  };
  const submitLicenceNo = (e) => {
    e.preventDefault();
    run(() => updateLicenceNumber({ token, appId: currentLicence._id, licenceNo: licenceNoValue }));
  };
  const submitReject = (e) => {
    e.preventDefault();
    run(() => rejectApplication({ token, appId: openApplication._id, reason: rejectReason }));
  };
  const submitAssign = (e) => {
    e.preventDefault();
    if (!assignForm.vendorId) { setError('Choose a vendor to assign.'); return; }
    run(() => assignVendor({
      token, vendorId: assignForm.vendorId, establishmentId: id,
      startDate: dayToMs(assignForm.startDate), note: assignForm.note || undefined,
    }));
  };
  const submitUnassign = (e) => {
    e.preventDefault();
    run(() => unassignVendor({
      token, vendorId: unassignTarget._id,
      endDate: dayToMs(unassignForm.endDate), note: unassignForm.note || undefined,
    }));
  };

  const setIssue = (patch) => setIssueForm((f) => ({ ...f, ...patch }));
  const setEdit = (patch) => setEditForm((f) => ({ ...f, ...patch }));

  const assignSearch = assignForm.search.trim().toLowerCase();
  const candidates = (unassigned || []).filter((x) =>
    !assignSearch || `${x.vendorName} ${x.vendorSurname || ''} ${x.registrationNo}`.toLowerCase().includes(assignSearch)
  );
  const canAssign = canManageFood && estab.displayStatus !== 'suspended' && estab.displayStatus !== 'revoked';

  return (
    <div className="slide-up">
      {/* Action bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/food/establishments')}>← Back</button>
        <div style={{ flex: 1 }} />
        {canManageFood && <button className="btn btn-secondary btn-sm" onClick={openEdit}>✏️ Edit</button>}
        {canManageFood && canApply && (
          <button className="btn btn-primary btn-sm" onClick={openApply}>
            {isRenewal ? '🔄 Renew Licence' : '＋ Apply for Licence'}
          </button>
        )}
      </div>

      {/* Licence status */}
      <div className="licence-status-card">
        <div className="licence-info">
          <div className="licence-number">
            🪪 {currentLicence?.licenceNo || 'No licence'}
            {canManageFood && currentLicence && (
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8, padding: '0 6px', fontSize: 11 }} onClick={openLicenceNo} title="Correct the licence number">✏️</button>
            )}
          </div>
          <div className="licence-expiry">
            {currentLicence
              ? `${fmtDay(currentLicence.approvedAt)} → ${fmtDay(currentLicence.expiryDate)}`
              : 'No licence has been issued yet'}
          </div>
        </div>
        <span className={`licence-status-text licence-status-${licenceState === 'valid' ? 'active' : licenceState}`}>
          {licenceUi.text} · {daysLeftText(licenceState, daysLeft)}
        </span>
      </div>

      {licenceState === 'valid' && renewalOpensAt && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-6px 0 14px' }}>
          Renewal opens {fmtDay(renewalOpensAt)} (30 days before expiry).
        </div>
      )}
      {canManageFood && !openApplication && canApply && (licenceState === 'expiring' || licenceState === 'expired') && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          ⏰ {licenceState === 'expired' ? 'This licence has expired.' : 'This licence is due for renewal.'}{' '}
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={openApply}>Start renewal</button>
        </div>
      )}

      <div className="detail-grid">
        <div>
          {/* Open application */}
          {openApplication && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--blue-500, #3b82f6)' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {isRenewal ? '🔄 Renewal in progress' : '📄 Licence application in progress'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Opened {fmtMoment(openApplication.applicationDate)}
                {' · '}
                {openApplication.inspectionDate
                  ? `Inspected ${fmtDay(openApplication.inspectionDate)}`
                  : 'Inspection required before the licence can be issued'}
              </div>
              {canManageFood && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={openInspect}>
                    🔍 {openApplication.inspectionDate ? 'Update inspection' : 'Record inspection'}
                  </button>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={openIssue}
                    disabled={!openApplication.inspectionDate}
                    title={!openApplication.inspectionDate ? 'Record the inspection first' : ''}
                  >
                    ✅ Record payment &amp; {isRenewal ? 'renew' : 'issue licence'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={openReject}>Reject</button>
                </div>
              )}
            </div>
          )}

          {/* Establishment details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 40 }}>🏪</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{estab.establishmentName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="tag">{estab.registrationNo}</span>
                  <span>{estab.establishmentType}</span>
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}><StatusBadge status={estab.displayStatus} size="lg" /></div>
            </div>
            <div className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <Field label="Owner">{estab.ownerName}</Field>
              <Field label="Phone">{estab.phone}</Field>
              <Field label="Email">{estab.email}</Field>
              <Field label="District">{districtName}</Field>
              <Field label="Address">{estab.address}</Field>
              <Field label="Seating capacity">{estab.seatingCapacity != null ? String(estab.seatingCapacity) : ''}</Field>
              <Field label="Registered">{fmtMoment(estab.registrationDate)}</Field>
            </div>
            {estab.notes && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-glass)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)' }}>
                {estab.notes}
              </div>
            )}
          </div>

          {/* Vendors working here */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
              <div style={{ fontWeight: 700 }}>🛒 Vendors working here ({vendors.length})</div>
              <div style={{ flex: 1 }} />
              {canAssign && <button className="btn btn-primary btn-sm" onClick={openAssign}>＋ Assign vendor</button>}
            </div>
            {vendors.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-title">No vendors assigned</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Registered vendors who work in this establishment are assigned here.</div>
              </div>
            ) : (
              <div className="table-container" style={{ borderRadius: 'var(--radius-sm)' }}>
                <table>
                  <thead>
                    <tr><th>Vendor</th><th>Reg. No.</th><th>Licence</th><th>Working here since</th><th /></tr>
                  </thead>
                  <tbody>
                    {vendors.map((x) => {
                      const s = LICENCE_STATE[x.licenceState] || LICENCE_STATE.none;
                      return (
                        <tr key={x._id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar url={x.photoUrl} />
                              <Link to={`/food/vendors/${x._id}`} style={{ fontWeight: 600, color: 'var(--blue-500)', textDecoration: 'none' }}>{fullName(x)}</Link>
                            </div>
                          </td>
                          <td><span className="tag">{x.registrationNo}</span></td>
                          <td>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{x.currentLicenceNo || '—'}</div>
                            <span className={`licence-dot ${s.cls}`}>{x.licenceState === 'expiring' ? `${x.daysLeft}d left` : s.text}</span>
                          </td>
                          <td style={{ fontSize: 13 }}>{fmtDay(x.assignedSince)}</td>
                          <td>
                            {canManageFood && (
                              <button className="btn btn-secondary btn-sm" onClick={() => openUnassign(x)}>Unassign</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {assignments.some((a) => a.endDate) && (
              <>
                <div className="divider" style={{ margin: '16px 0 10px' }} />
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Previous vendors</div>
                <div className="table-container" style={{ borderRadius: 'var(--radius-sm)' }}>
                  <table>
                    <thead><tr><th>Vendor</th><th>From</th><th>To</th><th>Note</th></tr></thead>
                    <tbody>
                      {assignments.filter((a) => a.endDate).map((a) => (
                        <tr key={a._id}>
                          <td>
                            <Link to={`/food/vendors/${a.vendorId}`} style={{ color: 'var(--blue-500)', textDecoration: 'none', fontWeight: 600 }}>{a.vendorName}</Link>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.vendorRegNo}</div>
                          </td>
                          <td style={{ fontSize: 13 }}>{fmtDay(a.startDate)}</td>
                          <td style={{ fontSize: 13 }}>{fmtDay(a.endDate)}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Licence history */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>📄 Licence &amp; renewal history ({applications.length})</div>
            {applications.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-state-title">No applications yet</div>
              </div>
            ) : (
              <div className="table-container" style={{ borderRadius: 'var(--radius-sm)' }}>
                <table>
                  <thead>
                    <tr><th>Opened</th><th>Licence no.</th><th>Period</th><th>Status</th><th>Inspection</th><th>Payment</th></tr>
                  </thead>
                  <tbody>
                    {applications.map((a) => (
                      <tr key={a._id}>
                        <td>{fmtMoment(a.applicationDate)}</td>
                        <td>{a.licenceNo ? <span className="tag">{a.licenceNo}</span> : '—'}</td>
                        <td style={{ fontSize: 12 }}>{a.status === 'approved' ? `${fmtDay(a.approvedAt)} → ${fmtDay(a.expiryDate)}` : '—'}</td>
                        <td>
                          <StatusBadge status={a.status} />
                          {a.status === 'rejected' && a.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.notes}</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {a.inspectionDate ? fmtDay(a.inspectionDate) : '—'}
                          {a.inspectedByName && <div style={{ color: 'var(--text-muted)' }}>{a.inspectedByName}</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {a.feePaid ? (
                            <>
                              ${a.fee} ✅
                              <div style={{ color: 'var(--text-muted)' }}>
                                {(a.paymentMethod || '').replace('_', ' ')}{a.receiptNo ? ` · #${a.receiptNo}` : ''}
                              </div>
                              <div style={{ color: 'var(--text-muted)' }}>{fmtDay(a.paymentDate)}</div>
                            </>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Summary</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Vendors working here: {vendors.length}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Applications: {applications.length}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            Licences issued: {applications.filter((a) => a.status === 'approved').length}
          </div>
          {currentLicence && (
            <>
              <div className="divider" style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Current licence: <strong>{currentLicence.licenceNo}</strong></div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Expires: {fmtDay(currentLicence.expiryDate)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Issued by: {currentLicence.approvedByName || '—'}</div>
            </>
          )}
        </div>
      </div>

      {/* ---- Edit ---- */}
      <Modal isOpen={dialog === 'edit'} onClose={close} title="Edit Establishment" size="lg">
        <form onSubmit={submitEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-row">
            <div className="form-group"><label className="form-label">Establishment name</label>
              <input className="form-control" value={editForm.establishmentName || ''} onChange={(e) => setEdit({ establishmentName: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-control" value={editForm.establishmentType || ''} onChange={(e) => setEdit({ establishmentType: e.target.value })} required>
                {[...new Set([...ESTABLISHMENT_TYPES, estab.establishmentType])].filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Owner name</label>
              <input className="form-control" value={editForm.ownerName || ''} onChange={(e) => setEdit({ ownerName: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Seating capacity</label>
              <input className="form-control" type="number" min="0" value={editForm.seatingCapacity ?? ''} onChange={(e) => setEdit({ seatingCapacity: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Phone</label>
              <input className="form-control" value={editForm.phone || ''} onChange={(e) => setEdit({ phone: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Email</label>
              <input className="form-control" value={editForm.email || ''} onChange={(e) => setEdit({ email: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">District</label>
              <select className="form-control" value={editForm.districtId || ''} onChange={(e) => setEdit({ districtId: e.target.value })}>
                {(districts || []).map((d) => <option key={d._id} value={d._id}>{d.name || d.code}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-control" value={editForm.status || 'pending'} onChange={(e) => setEdit({ status: e.target.value })}>
                {[...new Set([...EDITABLE_STATUSES, estab.status])].filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
          <div className="form-group"><label className="form-label">Address</label>
            <input className="form-control" value={editForm.address || ''} onChange={(e) => setEdit({ address: e.target.value })} required /></div>
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-control" rows={3} value={editForm.notes || ''} onChange={(e) => setEdit({ notes: e.target.value })} /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ---- Apply / renew ---- */}
      <Modal isOpen={dialog === 'apply'} onClose={close} title={isRenewal ? 'Renew Licence' : 'Apply for Licence'}>
        <form onSubmit={submitApply} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {isRenewal ? "This opens a renewal that is kept in the establishment's licence history." : 'This opens a licence application for the establishment.'}
            {' '}The establishment must be inspected before the licence is issued.
          </div>
          <div className="form-group"><label className="form-label">Expected fee (TTD, optional)</label>
            <input className="form-control" type="number" min="0" step="0.01" value={applyForm.fee} onChange={(e) => setApplyForm((f) => ({ ...f, fee: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-control" rows={2} value={applyForm.notes} onChange={(e) => setApplyForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Opening…' : 'Open application'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ---- Inspection ---- */}
      <Modal isOpen={dialog === 'inspect'} onClose={close} title="Record Inspection">
        <form onSubmit={submitInspect} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-group"><label className="form-label">Inspection date *</label>
            <input className="form-control" type="date" value={inspectForm.inspectionDate} onChange={(e) => setInspectForm((f) => ({ ...f, inspectionDate: e.target.value }))} required /></div>
          <div className="form-group"><label className="form-label">Findings</label>
            <textarea className="form-control" rows={3} value={inspectForm.inspectionNotes} onChange={(e) => setInspectForm((f) => ({ ...f, inspectionNotes: e.target.value }))} /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save inspection'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ---- Record payment & issue / renew licence ---- */}
      <Modal isOpen={dialog === 'issue'} onClose={close} title={isRenewal ? 'Record Payment & Renew Licence' : 'Record Payment & Issue Licence'} size="lg">
        <form onSubmit={submitIssue} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-group">
            <label className="form-label">
              Licence number * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(entered manually — change it if a new number was issued with this payment)</span>
            </label>
            <input className="form-control" value={issueForm.licenceNo || ''} onChange={(e) => setIssue({ licenceNo: e.target.value })} required />
            {currentLicence && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Previous licence: {currentLicence.licenceNo}</div>}
          </div>

          <div style={{ fontWeight: 600, fontSize: 13 }}>Payment (recorded manually)</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Fee paid (TTD) *</label>
              <input className="form-control" type="number" min="0" step="0.01" value={issueForm.fee ?? ''} onChange={(e) => setIssue({ fee: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Payment date *</label>
              <input className="form-control" type="date" max={todayInput()} value={issueForm.paymentDate || ''} onChange={(e) => setIssue({ paymentDate: e.target.value })} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Payment method *</label>
              <select className="form-control" value={issueForm.paymentMethod || ''} onChange={(e) => setIssue({ paymentMethod: e.target.value })} required>
                <option value="">Select method</option>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Receipt number</label>
              <input className="form-control" value={issueForm.receiptNo || ''} onChange={(e) => setIssue({ receiptNo: e.target.value })} /></div>
          </div>

          {/* Validity is calculated by the server from the payment — it is not typed in */}
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-glass)' }}>
            <div className="detail-label">Validity period (set automatically)</div>
            {validityPreview === undefined ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Calculating…</div>
            ) : validityPreview === null ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</div>
            ) : validityPreview.error ? (
              <div style={{ fontSize: 13, color: '#dc2626' }}>⚠️ {validityPreview.error}</div>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtDay(validityPreview.start)} → {fmtDay(validityPreview.end)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {validityPreview.basis === 'continues_previous' && `Continues from the previous licence, which expires ${fmtDay(validityPreview.previousExpiry)} — no paid time is lost.`}
                  {validityPreview.basis === 'payment_date' && (isRenewal
                    ? 'The previous licence has lapsed, so the new year starts on the payment date.'
                    : 'One year from the payment date.')}
                </div>
              </>
            )}
          </div>

          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-control" rows={2} value={issueForm.notes || ''} onChange={(e) => setIssue({ notes: e.target.value })} /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={busy || !!validityPreview?.error}>
              {busy ? 'Saving…' : isRenewal ? '✅ Record payment & renew' : '✅ Record payment & issue licence'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ---- Correct licence number ---- */}
      <Modal isOpen={dialog === 'licenceNo'} onClose={close} title="Update Licence Number">
        <form onSubmit={submitLicenceNo} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Corrects the number on the current licence. The validity period and payment record are unchanged.
          </div>
          <div className="form-group"><label className="form-label">Licence number *</label>
            <input className="form-control" value={licenceNoValue} onChange={(e) => setLicenceNoValue(e.target.value)} required /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ---- Reject ---- */}
      <Modal isOpen={dialog === 'reject'} onClose={close} title="Reject Application">
        <form onSubmit={submitReject} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-group"><label className="form-label">Reason *</label>
            <textarea className="form-control" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Rejecting…' : 'Reject application'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ---- Assign a vendor ---- */}
      <Modal isOpen={dialog === 'assign'} onClose={close} title={`Assign Vendor to ${estab.establishmentName}`} size="lg">
        <form onSubmit={submitAssign} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Choose a registered vendor who works here. They become a "Within Establishment" vendor
            (any itinerant route or event details are cleared). A vendor works at one establishment at a time.
          </div>
          <input
            className="form-control" placeholder="Search by name or registration number"
            value={assignForm.search} onChange={(e) => setAssignForm((f) => ({ ...f, search: e.target.value }))}
          />
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border, #e2e8f0)', borderRadius: 'var(--radius-sm)' }}>
            {unassigned === undefined ? (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Loading vendors…</div>
            ) : candidates.length === 0 ? (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                {unassigned.length === 0
                  ? 'Every registered vendor already works in an establishment. Register the vendor first, or unassign them from their current one.'
                  : 'No vendors match that search.'}
              </div>
            ) : candidates.map((x) => (
              <label
                key={x._id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border, #e2e8f0)', background: assignForm.vendorId === x._id ? 'var(--blue-50, #eff6ff)' : 'transparent' }}
              >
                <input type="radio" name="assign-vendor" checked={assignForm.vendorId === x._id} onChange={() => setAssignForm((f) => ({ ...f, vendorId: x._id }))} />
                <Avatar url={x.photoUrl} w={32} h={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{fullName(x)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{x.registrationNo} · {TYPE_LABELS[x.vendorType] || x.vendorType}</div>
                </div>
                <StatusBadge status={x.status || 'pending'} />
              </label>
            ))}
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Working here from *</label>
              <input className="form-control" type="date" max={todayInput()} value={assignForm.startDate} onChange={(e) => setAssignForm((f) => ({ ...f, startDate: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Note</label>
              <input className="form-control" value={assignForm.note} onChange={(e) => setAssignForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. kitchen, counter" /></div>
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !assignForm.vendorId}>{busy ? 'Assigning…' : 'Assign vendor'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ---- Unassign a vendor ---- */}
      <Modal isOpen={dialog === 'unassign'} onClose={close} title="Unassign Vendor">
        <form onSubmit={submitUnassign} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div style={{ fontSize: 13 }}>
            {unassignTarget ? fullName(unassignTarget) : ''} stops working at <strong>{estab.establishmentName}</strong>.
            The assignment is kept in the history.
          </div>
          <div className="form-group"><label className="form-label">Last day working here *</label>
            <input className="form-control" type="date" max={todayInput()} value={unassignForm.endDate} onChange={(e) => setUnassignForm((f) => ({ ...f, endDate: e.target.value }))} required /></div>
          <div className="form-group"><label className="form-label">Note</label>
            <input className="form-control" value={unassignForm.note} onChange={(e) => setUnassignForm((f) => ({ ...f, note: e.target.value }))} /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Unassign'}</button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
