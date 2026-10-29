import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';
import {
  TYPE_LABELS, PAYMENT_METHODS, LICENCE_STATE, fmtDay, fmtMoment, toDateInput, todayInput,
  dayToMs, oneYearOn, addDays, daysLeftText, generateVendorBadge,
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

export default function FoodVendorDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const navigate = useNavigate();

  const data = useQuery(api.vendors.getVendor, { token, vendorId: id });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const establishments = useQuery(api.food.listActiveEstablishments, { token });

  const updateVendor = useMutation(api.vendors.updateVendor);
  const startApplication = useMutation(api.vendors.startApplication);
  const recordInspection = useMutation(api.vendors.recordInspection);
  const issueLicence = useMutation(api.vendors.issueLicence);
  const rejectApplication = useMutation(api.vendors.rejectApplication);

  // which dialog is open: edit | apply | inspect | issue | reject | null
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [editForm, setEditForm] = useState({});
  const [applyForm, setApplyForm] = useState({ fee: '', notes: '' });
  const [inspectForm, setInspectForm] = useState({ inspectionDate: todayInput(), inspectionNotes: '' });
  const [issueForm, setIssueForm] = useState({});
  const [expiryEdited, setExpiryEdited] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (data === undefined) return <div className="loading-center"><div className="loading-spinner" /></div>;
  if (data === null) {
    return (
      <div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/food/vendors')}>← Back</button>
        <div className="alert alert-error" style={{ marginTop: 14 }}>Vendor not found.</div>
      </div>
    );
  }

  const {
    vendor, applications, currentLicence, licenceState, daysLeft,
    openApplication, renewalOpensAt, canApply, linkedEstablishment,
  } = data;
  const districtName = (districts || []).find((d) => d._id === vendor.districtId)?.name;
  const isRenewal = applications.some((a) => a.status === 'approved');
  const needsInspection = vendor.vendorType === 'itinerant';
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
      vendorName: vendor.vendorName || '', vendorSurname: vendor.vendorSurname || vendor.ownerName || '',
      phone: vendor.phone || '', email: vendor.email || '', address: vendor.address || '',
      districtId: vendor.districtId || '', status: vendor.status || 'pending',
      operatingArea: vendor.operatingArea || '', eventName: vendor.eventName || '',
      eventStartDate: toDateInput(vendor.eventStartDate), eventEndDate: toDateInput(vendor.eventEndDate),
      linkedEstablishmentId: vendor.linkedEstablishmentId || '', notes: vendor.notes || '',
    });
    setError(''); setDialog('edit');
  };

  const openApply = () => { setApplyForm({ fee: '', notes: '' }); setError(''); setDialog('apply'); };

  const openInspect = () => {
    setInspectForm({
      inspectionDate: openApplication?.inspectionDate ? toDateInput(openApplication.inspectionDate) : todayInput(),
      inspectionNotes: openApplication?.inspectionNotes || '',
    });
    setError(''); setDialog('inspect');
  };

  const openIssue = () => {
    const issueDate = todayInput();
    let expiry = oneYearOn(issueDate);
    if (vendor.vendorType === 'special_event' && vendor.eventEndDate) expiry = toDateInput(vendor.eventEndDate);
    setIssueForm({
      licenceNo: '', issueDate, expiryDate: expiry, fee: openApplication?.fee ?? '',
      paymentDate: issueDate, paymentMethod: '', receiptNo: '', notes: '',
    });
    setExpiryEdited(false);
    setError(''); setDialog('issue');
  };

  const openReject = () => { setRejectReason(''); setError(''); setDialog('reject'); };

  // ---------- submit handlers ----------
  const submitEdit = (e) => {
    e.preventDefault();
    const f = editForm;
    run(() => updateVendor({
      token, vendorId: id,
      vendorName: f.vendorName, vendorSurname: f.vendorSurname,
      phone: f.phone, email: f.email, address: f.address,
      districtId: f.districtId || undefined,
      status: f.status,
      operatingArea: vendor.vendorType === 'itinerant' ? f.operatingArea : undefined,
      eventName: vendor.vendorType === 'special_event' ? f.eventName : undefined,
      eventStartDate: vendor.vendorType === 'special_event' ? dayToMs(f.eventStartDate) : undefined,
      eventEndDate: vendor.vendorType === 'special_event' ? dayToMs(f.eventEndDate) : undefined,
      linkedEstablishmentId: vendor.vendorType === 'establishment' ? f.linkedEstablishmentId || undefined : undefined,
      notes: f.notes,
    }));
  };

  const submitApply = (e) => {
    e.preventDefault();
    run(() => startApplication({
      token, vendorId: id,
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
      issueDate: dayToMs(f.issueDate), expiryDate: dayToMs(f.expiryDate),
      fee: Number(f.fee), paymentDate: dayToMs(f.paymentDate), paymentMethod: f.paymentMethod,
      receiptNo: f.receiptNo || undefined, notes: f.notes || undefined,
    }));
  };

  const submitReject = (e) => {
    e.preventDefault();
    run(() => rejectApplication({ token, appId: openApplication._id, reason: rejectReason }));
  };

  const setIssue = (patch) => setIssueForm((f) => ({ ...f, ...patch }));
  const setEdit = (patch) => setEditForm((f) => ({ ...f, ...patch }));

  const canPrintBadge = currentLicence && (licenceState === 'valid' || licenceState === 'expiring');

  return (
    <div className="slide-up">
      {/* Action bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/food/vendors')}>← Back</button>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-secondary btn-sm"
          disabled={!canPrintBadge}
          title={canPrintBadge ? 'Print ID badge (5.5 x 8.5 in PDF)' : 'A badge can be printed once the vendor holds a valid licence'}
          onClick={() => generateVendorBadge({ vendor, licence: currentLicence, districtName })}
        >
          🪪 Print Badge
        </button>
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
          <div className="licence-number">🪪 {currentLicence?.licenceNo || 'No licence'}</div>
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
                  : needsInspection ? 'Inspection required before the licence can be issued' : 'Inspection not yet recorded'}
              </div>
              {canManageFood && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={openInspect}>
                    🔍 {openApplication.inspectionDate ? 'Update inspection' : 'Record inspection'}
                  </button>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={openIssue}
                    disabled={needsInspection && !openApplication.inspectionDate}
                    title={needsInspection && !openApplication.inspectionDate ? 'Record the inspection first' : ''}
                  >
                    ✅ Issue licence
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={openReject}>Reject</button>
                </div>
              )}
            </div>
          )}

          {/* Vendor details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 40 }}>🛒</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{[vendor.vendorName, vendor.vendorSurname || vendor.ownerName].filter(Boolean).join(' ')}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="tag">{vendor.registrationNo}</span>
                  <span className={`vendor-type-badge vendor-type-${vendor.vendorType}`}>{TYPE_LABELS[vendor.vendorType]}</span>
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}><StatusBadge status={vendor.displayStatus} size="lg" /></div>
            </div>
            <div className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <Field label="First name">{vendor.vendorName}</Field>
              <Field label="Surname">{vendor.vendorSurname || vendor.ownerName}</Field>
              <Field label="Phone">{vendor.phone}</Field>
              <Field label="Email">{vendor.email}</Field>
              <Field label="District">{districtName}</Field>
              <Field label="Address">{vendor.address}</Field>
              <Field label="Registered">{fmtMoment(vendor.registrationDate)}</Field>
              {vendor.vendorType === 'itinerant' && <Field label="Operating area">{vendor.operatingArea}</Field>}
              {vendor.vendorType === 'special_event' && (
                <>
                  <Field label="Event">{vendor.eventName}</Field>
                  <Field label="Event dates">{`${fmtDay(vendor.eventStartDate)} → ${fmtDay(vendor.eventEndDate)}`}</Field>
                </>
              )}
              {vendor.vendorType === 'establishment' && (
                <Field label="Works within">
                  {linkedEstablishment ? (
                    <Link to={`/food/establishments/${vendor.linkedEstablishmentId}`} style={{ color: 'var(--blue-500)', textDecoration: 'none', fontWeight: 600 }}>
                      🏪 {linkedEstablishment.establishmentName}
                    </Link>
                  ) : null}
                </Field>
              )}
            </div>
            {vendor.notes && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-glass)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)' }}>
                {vendor.notes}
              </div>
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
                    <tr>
                      <th>Opened</th><th>Licence no.</th><th>Period</th><th>Status</th><th>Inspection</th><th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((a) => (
                      <tr key={a._id}>
                        <td>{fmtMoment(a.applicationDate)}</td>
                        <td>{a.licenceNo ? <span className="tag">{a.licenceNo}</span> : '—'}</td>
                        <td style={{ fontSize: 12 }}>
                          {a.status === 'approved' ? `${fmtDay(a.approvedAt)} → ${fmtDay(a.expiryDate)}` : '—'}
                        </td>
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
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Applications: {applications.length}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            Licences issued: {applications.filter((a) => a.status === 'approved').length}
          </div>
          {currentLicence && (
            <>
              <div className="divider" style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Current licence: <strong>{currentLicence.licenceNo}</strong></div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Expires: {fmtDay(currentLicence.expiryDate)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Issued by: {currentLicence.approvedByName || '—'}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Edit vendor ---- */}
      <Modal isOpen={dialog === 'edit'} onClose={close} title="Edit Vendor" size="lg">
        <form onSubmit={submitEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-row">
            <div className="form-group"><label className="form-label">First name</label>
              <input className="form-control" value={editForm.vendorName || ''} onChange={(e) => setEdit({ vendorName: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Vendor surname</label>
              <input className="form-control" value={editForm.vendorSurname || ''} onChange={(e) => setEdit({ vendorSurname: e.target.value })} required /></div>
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
                {[...new Set([...EDITABLE_STATUSES, vendor.status])].filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
          <div className="form-group"><label className="form-label">Address</label>
            <input className="form-control" value={editForm.address || ''} onChange={(e) => setEdit({ address: e.target.value })} required /></div>

          {vendor.vendorType === 'itinerant' && (
            <div className="form-group"><label className="form-label">Operating area</label>
              <textarea className="form-control" rows={2} value={editForm.operatingArea || ''} onChange={(e) => setEdit({ operatingArea: e.target.value })} /></div>
          )}
          {vendor.vendorType === 'special_event' && (
            <>
              <div className="form-group"><label className="form-label">Event name</label>
                <input className="form-control" value={editForm.eventName || ''} onChange={(e) => setEdit({ eventName: e.target.value })} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Event start</label>
                  <input className="form-control" type="date" value={editForm.eventStartDate || ''} onChange={(e) => setEdit({ eventStartDate: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Event end</label>
                  <input className="form-control" type="date" value={editForm.eventEndDate || ''} onChange={(e) => setEdit({ eventEndDate: e.target.value })} /></div>
              </div>
            </>
          )}
          {vendor.vendorType === 'establishment' && (
            <div className="form-group"><label className="form-label">Works within establishment</label>
              <select className="form-control" value={editForm.linkedEstablishmentId || ''} onChange={(e) => setEdit({ linkedEstablishmentId: e.target.value })}>
                <option value="">Select establishment</option>
                {(establishments || []).map((x) => <option key={x._id} value={x._id}>{x.establishmentName} ({x.registrationNo})</option>)}
              </select></div>
          )}
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
            {isRenewal
              ? 'This opens a renewal that is kept in the vendor\'s licence history.'
              : 'This opens a licence application for the vendor.'}
            {needsInspection && ' Itinerant vendors must be inspected before the licence is issued.'}
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

      {/* ---- Issue licence ---- */}
      <Modal isOpen={dialog === 'issue'} onClose={close} title="Issue Licence" size="lg">
        <form onSubmit={submitIssue} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-group">
            <label className="form-label">Licence number * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(entered manually, must be unique)</span></label>
            <input className="form-control" value={issueForm.licenceNo || ''} onChange={(e) => setIssue({ licenceNo: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Issue date *</label>
              <input
                className="form-control" type="date" value={issueForm.issueDate || ''}
                onChange={(e) => {
                  const issueDate = e.target.value;
                  setIssue({
                    issueDate,
                    ...(!expiryEdited && vendor.vendorType !== 'special_event' ? { expiryDate: oneYearOn(issueDate) } : {}),
                  });
                }}
                required
              /></div>
            <div className="form-group">
              <label className="form-label">
                Expiry date * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                  ({vendor.vendorType === 'special_event' ? 'max 30 days' : 'one year'})
                </span>
              </label>
              <input
                className="form-control" type="date" value={issueForm.expiryDate || ''}
                min={issueForm.issueDate ? addDays(issueForm.issueDate, 1) : undefined}
                onChange={(e) => { setExpiryEdited(true); setIssue({ expiryDate: e.target.value }); }}
                required
              /></div>
          </div>
          <div className="divider" />
          <div style={{ fontWeight: 600, fontSize: 13 }}>Payment (recorded manually)</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Fee paid (TTD) *</label>
              <input className="form-control" type="number" min="0" step="0.01" value={issueForm.fee ?? ''} onChange={(e) => setIssue({ fee: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Payment date *</label>
              <input className="form-control" type="date" value={issueForm.paymentDate || ''} onChange={(e) => setIssue({ paymentDate: e.target.value })} required /></div>
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
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-control" rows={2} value={issueForm.notes || ''} onChange={(e) => setIssue({ notes: e.target.value })} /></div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={busy}>{busy ? 'Issuing…' : '✅ Issue licence'}</button>
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
    </div>
  );
}
