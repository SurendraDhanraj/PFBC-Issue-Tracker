import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';

const TYPE_LABELS = { itinerant: '🚶 Itinerant', special_event: '🎪 Special Event', establishment: '🏪 Establishment' };

function LicenceDot({ expiry }) {
  if (!expiry) return <span className="licence-dot licence-none">None</span>;
  const daysLeft = Math.ceil((expiry - Date.now()) / 86400000);
  if (daysLeft < 0) return <span className="licence-dot licence-expired">Expired</span>;
  if (daysLeft <= 30) return <span className="licence-dot licence-expiring">{daysLeft}d left</span>;
  return <span className="licence-dot licence-active">Active</span>;
}

const EMPTY_FORM = { vendorName: '', ownerName: '', phone: '', email: '', address: '', districtId: '', streetId: '', vendorType: '', linkedEstablishmentId: '', eventName: '', eventStartDate: '', eventEndDate: '', operatingArea: '', notes: '' };

export default function FoodVendors() {
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const vendors = useQuery(api.food.listVendors, { token, districtId: districtFilter, status: statusFilter || undefined, vendorType: typeFilter || undefined, search: search || undefined });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const streets = useQuery(api.districts.listStreets, form.districtId ? { districtId: form.districtId } : 'skip');
  const activeEstabs = useQuery(api.food.listActiveEstablishments, { token });
  const createVendor = useMutation(api.food.createVendor);

  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  const resetWizard = () => { setShowAdd(false); setWizardStep(1); setForm(EMPTY_FORM); setError(''); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.vendorName || !form.ownerName || !form.address || !form.districtId) {
      setError('Please fill all required fields.'); return;
    }
    if (form.vendorType === 'establishment' && !form.linkedEstablishmentId) {
      setError('Please select a linked establishment.'); return;
    }
    if (form.vendorType === 'special_event' && (!form.eventName || !form.eventStartDate || !form.eventEndDate)) {
      setError('Please fill all event fields.'); return;
    }
    setLoading(true);
    try {
      const res = await createVendor({
        token, vendorName: form.vendorName, ownerName: form.ownerName,
        phone: form.phone || undefined, email: form.email || undefined,
        address: form.address, districtId: form.districtId,
        streetId: form.streetId || undefined,
        vendorType: form.vendorType,
        linkedEstablishmentId: form.linkedEstablishmentId || undefined,
        eventName: form.eventName || undefined,
        eventStartDate: form.eventStartDate ? new Date(form.eventStartDate).getTime() : undefined,
        eventEndDate: form.eventEndDate ? new Date(form.eventEndDate).getTime() : undefined,
        operatingArea: form.operatingArea || undefined,
        notes: form.notes || undefined,
      });
      if (res.success) resetWizard();
      else setError(res.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const wizardTitles = { 1: 'Register Vendor — Type', 2: 'Register Vendor — Details', 3: 'Register Vendor — Review' };

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <div className="page-title">🛒 Food Vendors</div>
          <div className="page-subtitle">Mobile and street vendor registry</div>
        </div>
        {canManageFood && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ Register Vendor</button>}
      </div>

      <div className="vendor-type-tabs">
        {[{ key: '', label: 'All' }, { key: 'itinerant', label: '🚶 Itinerant' }, { key: 'special_event', label: '🎪 Special Event' }, { key: 'establishment', label: '🏪 Establishment' }].map(t => (
          <button key={t.key} className={typeFilter === t.key ? 'active' : ''} onClick={() => setTypeFilter(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="filters-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input className="form-control search-input" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} />
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
                <th>Vendor</th><th>Owner</th><th>Reg. No.</th><th>District</th><th>Type</th><th>Licence</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v._id} onClick={() => window.location.href = `/food/vendors/${v._id}`}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.vendorName}</div>
                    {v.address && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {v.address}</div>}
                    {v.vendorType === 'establishment' && v.linkedEstablishmentName && (
                      <div style={{ fontSize: 11, color: 'var(--accent)', fontStyle: 'italic' }}>🏪 {v.linkedEstablishmentName}</div>
                    )}
                  </td>
                  <td>{v.ownerName}</td>
                  <td><span className="tag">{v.registrationNo}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{districtMap[v.districtId]?.name || '—'}</td>
                  <td><span className={`vendor-type-badge vendor-type-${v.vendorType}`}>{TYPE_LABELS[v.vendorType] || '—'}</span></td>
                  <td><LicenceDot expiry={v.licenceExpiry} /></td>
                  <td><StatusBadge status={v.status} /></td>
                  <td><Link to={`/food/vendors/${v._id}`} className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registration Wizard */}
      <Modal isOpen={showAdd} onClose={resetWizard} title={wizardTitles[wizardStep]} size="lg">
        <div className="wizard-steps">
          {[{ n: 1, label: 'Type' }, { n: 2, label: 'Details' }, { n: 3, label: 'Review' }].map(s => (
            <span key={s.n} className={`wizard-step ${wizardStep === s.n ? 'active' : ''} ${wizardStep > s.n ? 'completed' : ''}`}>
              <span className="wizard-step-num">{wizardStep > s.n ? '✓' : s.n}</span> {s.label}
            </span>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠️ {error}</div>}

        {wizardStep === 1 && (
          <>
            <div className="wizard-type-cards">
              {[
                { key: 'itinerant', emoji: '🚶', title: 'Itinerant', desc: 'Mobile vendor operating from carts, stalls, or market pitches' },
                { key: 'special_event', emoji: '🎪', title: 'Special Event', desc: 'Temporary vendor for a specific event (max 30 days)' },
                { key: 'establishment', emoji: '🏪', title: 'Establishment', desc: 'Vendor working within a registered food establishment' },
              ].map(c => (
                <div key={c.key} className={`wizard-type-card ${form.vendorType === c.key ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, vendorType: c.key }))}>
                  <div className="wizard-card-emoji">{c.emoji}</div>
                  <div className="wizard-card-title">{c.title}</div>
                  <div className="wizard-card-desc">{c.desc}</div>
                </div>
              ))}
            </div>
            <ModalFooter>
              <button type="button" className="btn btn-secondary" onClick={resetWizard}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={!form.vendorType} onClick={() => { setError(''); setWizardStep(2); }}>Next →</button>
            </ModalFooter>
          </>
        )}

        {wizardStep === 2 && (
          <form onSubmit={e => { e.preventDefault(); setError(''); setWizardStep(3); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

            {/* Type-specific fields */}
            {form.vendorType === 'itinerant' && (
              <div className="form-group">
                <label className="form-label">Operating Area / Route</label>
                <textarea className="form-control" rows={2} value={form.operatingArea} onChange={e => setForm(f => ({ ...f, operatingArea: e.target.value }))} placeholder="Describe the vendor's operating area or route..." />
              </div>
            )}
            {form.vendorType === 'special_event' && (
              <>
                <div className="form-group">
                  <label className="form-label">Event Name *</label>
                  <input className="form-control" value={form.eventName} onChange={e => setForm(f => ({ ...f, eventName: e.target.value }))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Event Start Date *</label>
                    <input className="form-control" type="date" value={form.eventStartDate} onChange={e => setForm(f => ({ ...f, eventStartDate: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Event End Date *</label>
                    <input className="form-control" type="date" value={form.eventEndDate} onChange={e => setForm(f => ({ ...f, eventEndDate: e.target.value }))} required />
                  </div>
                </div>
              </>
            )}
            {form.vendorType === 'establishment' && (
              <div className="form-group">
                <label className="form-label">Linked Establishment *</label>
                <select className="form-control" value={form.linkedEstablishmentId} onChange={e => setForm(f => ({ ...f, linkedEstablishmentId: e.target.value }))} required>
                  <option value="">Select establishment</option>
                  {(activeEstabs || []).map(e => <option key={e._id} value={e._id}>{e.establishmentName} ({e.registrationNo})</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <ModalFooter>
              <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(1)}>← Back</button>
              <button type="submit" className="btn btn-primary">Next →</button>
            </ModalFooter>
          </form>
        )}

        {wizardStep === 3 && (
          <>
            <div className="review-summary">
              <div><div className="detail-label">Vendor Type</div><div className="detail-value"><span className={`vendor-type-badge vendor-type-${form.vendorType}`}>{TYPE_LABELS[form.vendorType]}</span></div></div>
              <div><div className="detail-label">Business Name</div><div className="detail-value">{form.vendorName}</div></div>
              <div><div className="detail-label">Owner</div><div className="detail-value">{form.ownerName}</div></div>
              <div><div className="detail-label">Reg. No.</div><div className="detail-value" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Auto-generated on registration</div></div>
              <div><div className="detail-label">Phone</div><div className="detail-value">{form.phone || '—'}</div></div>
              <div><div className="detail-label">Email</div><div className="detail-value">{form.email || '—'}</div></div>
              <div><div className="detail-label">District</div><div className="detail-value">{districtMap[form.districtId]?.name || '—'}</div></div>
              <div><div className="detail-label">Address</div><div className="detail-value">{form.address}</div></div>
              {form.vendorType === 'itinerant' && form.operatingArea && (
                <div style={{ gridColumn: '1 / -1' }}><div className="detail-label">Operating Area</div><div className="detail-value">{form.operatingArea}</div></div>
              )}
              {form.vendorType === 'special_event' && (
                <>
                  <div><div className="detail-label">Event Name</div><div className="detail-value">{form.eventName}</div></div>
                  <div><div className="detail-label">Event Dates</div><div className="detail-value">{form.eventStartDate} → {form.eventEndDate}</div></div>
                </>
              )}
              {form.vendorType === 'establishment' && (
                <div style={{ gridColumn: '1 / -1' }}><div className="detail-label">Linked Establishment</div><div className="detail-value">{(activeEstabs || []).find(e => e._id === form.linkedEstablishmentId)?.establishmentName || '—'}</div></div>
              )}
              {form.notes && <div style={{ gridColumn: '1 / -1' }}><div className="detail-label">Notes</div><div className="detail-value">{form.notes}</div></div>}
            </div>
            <ModalFooter>
              <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(2)}>← Back</button>
              <button type="button" className="btn btn-primary" disabled={loading} onClick={handleCreate}>{loading ? 'Registering...' : '✅ Register Vendor'}</button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
