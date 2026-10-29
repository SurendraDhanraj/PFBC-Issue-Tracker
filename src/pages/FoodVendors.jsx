import { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';
import {
  TYPE_LABELS, TYPE_DESCRIPTIONS, LICENCE_STATE, fmtDay, dayToMs, daysLeftText,
} from '../utils/vendors';

const EMPTY_FORM = {
  vendorType: '', vendorName: '', ownerName: '', phone: '', email: '',
  districtId: '', streetId: '', address: '', notes: '',
  operatingArea: '', eventName: '', eventStartDate: '', eventEndDate: '', linkedEstablishmentId: '',
};

const TYPE_CARDS = [
  { key: 'itinerant', emoji: '🚶' },
  { key: 'special_event', emoji: '🎪' },
  { key: 'establishment', emoji: '🏪' },
];

const LICENCE_TABS = [
  { key: '', label: 'All' },
  { key: 'expiring', label: 'Expiring (30 days)' },
  { key: 'expired', label: 'Expired' },
  { key: 'none', label: 'No licence' },
  { key: 'open_application', label: 'Open applications' },
];

function LicenceChip({ state, daysLeft }) {
  const s = LICENCE_STATE[state] || LICENCE_STATE.none;
  const text = state === 'expiring' ? `${daysLeft}d left` : s.text;
  return <span className={`licence-dot ${s.cls}`}>{text}</span>;
}

function eventDays(start, end) {
  if (!start || !end) return null;
  return (dayToMs(end) - dayToMs(start)) / 86400000;
}

export default function FoodVendors() {
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [licenceFilter, setLicenceFilter] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const vendors = useQuery(api.vendors.listVendors, { token });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const streets = useQuery(api.districts.listStreets, form.districtId ? { districtId: form.districtId } : 'skip');
  const establishments = useQuery(api.food.listActiveEstablishments, { token });
  const createVendor = useMutation(api.vendors.createVendor);

  const districtMap = useMemo(
    () => Object.fromEntries((districts || []).map((d) => [d._id, d])),
    [districts]
  );

  const counts = useMemo(() => {
    const c = { '': 0, expiring: 0, expired: 0, none: 0, open_application: 0 };
    (vendors || []).forEach((v) => {
      c['']++;
      if (v.licenceState === 'expiring') c.expiring++;
      if (v.licenceState === 'expired') c.expired++;
      if (v.licenceState === 'none') c.none++;
      if (v.hasOpenApplication) c.open_application++;
    });
    return c;
  }, [vendors]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (vendors || []).filter((v) => {
      if (s && !`${v.vendorName} ${v.ownerName} ${v.registrationNo} ${v.currentLicenceNo || ''}`.toLowerCase().includes(s)) return false;
      if (statusFilter && v.displayStatus !== statusFilter) return false;
      if (typeFilter && v.vendorType !== typeFilter) return false;
      if (districtFilter && v.districtId !== districtFilter) return false;
      if (licenceFilter === 'open_application') return v.hasOpenApplication;
      if (licenceFilter && v.licenceState !== licenceFilter) return false;
      return true;
    });
  }, [vendors, search, statusFilter, typeFilter, districtFilter, licenceFilter]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const closeWizard = () => {
    setShowAdd(false); setStep(1); setForm(EMPTY_FORM); setError('');
  };

  /** Validate step 2 before moving to the review step. */
  const goReview = (e) => {
    e.preventDefault();
    setError('');
    if (!form.vendorName.trim() || !form.ownerName.trim() || !form.districtId || !form.address.trim()) {
      setError('Vendor name, owner, district and address are required.');
      return;
    }
    if (form.vendorType === 'establishment' && !form.linkedEstablishmentId) {
      setError('Choose the establishment this vendor works within.');
      return;
    }
    if (form.vendorType === 'special_event') {
      if (!form.eventName.trim() || !form.eventStartDate || !form.eventEndDate) {
        setError('Event name, start date and end date are required.');
        return;
      }
      const days = eventDays(form.eventStartDate, form.eventEndDate);
      if (days < 0) { setError('The event cannot end before it starts.'); return; }
      if (days > 30) { setError('A special event permit cannot exceed 30 days.'); return; }
    }
    setStep(3);
  };

  const submit = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await createVendor({
        token,
        vendorType: form.vendorType,
        vendorName: form.vendorName,
        ownerName: form.ownerName,
        phone: form.phone || undefined,
        email: form.email || undefined,
        districtId: form.districtId,
        streetId: form.streetId || undefined,
        address: form.address,
        notes: form.notes || undefined,
        operatingArea: form.vendorType === 'itinerant' ? form.operatingArea || undefined : undefined,
        eventName: form.vendorType === 'special_event' ? form.eventName : undefined,
        eventStartDate: form.vendorType === 'special_event' ? dayToMs(form.eventStartDate) : undefined,
        eventEndDate: form.vendorType === 'special_event' ? dayToMs(form.eventEndDate) : undefined,
        linkedEstablishmentId: form.vendorType === 'establishment' ? form.linkedEstablishmentId : undefined,
      });
      if (res.success) {
        closeWizard();
        navigate(`/food/vendors/${res.id}`);
      } else {
        setError(res.error || 'Registration failed.');
      }
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setSaving(false);
    }
  };

  const steps = [{ n: 1, label: 'Type' }, { n: 2, label: 'Details' }, { n: 3, label: 'Review' }];
  const estabName = (establishments || []).find((x) => x._id === form.linkedEstablishmentId)?.establishmentName;

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <div className="page-title">🛒 Food Vendors</div>
          <div className="page-subtitle">Registration and annual licences for itinerant, special event and establishment vendors</div>
        </div>
        {canManageFood && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ Register Vendor</button>
        )}
      </div>

      {/* Licence focus tabs */}
      <div className="vendor-type-tabs" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {LICENCE_TABS.map((t) => (
          <button key={t.key} className={licenceFilter === t.key ? 'active' : ''} onClick={() => setLicenceFilter(t.key)}>
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      <div className="filters-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="form-control search-input"
            placeholder="Search name, owner, reg. no. or licence no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-control" style={{ width: 'auto', minWidth: 150 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {Object.keys(TYPE_LABELS).map((k) => <option key={k} value={k}>{TYPE_LABELS[k]}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth: 130 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['active', 'pending', 'expired', 'suspended', 'revoked'].map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth: 150 }} value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
          <option value="">All districts</option>
          {(districts || []).map((d) => <option key={d._id} value={d._id}>{d.name || d.code}</option>)}
        </select>
      </div>

      {!vendors ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🛒</div>
            <div className="empty-state-title">{vendors.length === 0 ? 'No vendors registered yet' : 'No vendors match these filters'}</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Reg. No.</th>
                <th>Type</th>
                <th>District</th>
                <th>Licence</th>
                <th>Expires</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/food/vendors/${v._id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.vendorName || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {v.ownerName || '—'}
                      {v.vendorType === 'establishment' && v.linkedEstablishmentName ? ` · ${v.linkedEstablishmentName}` : ''}
                      {v.vendorType === 'special_event' && v.eventName ? ` · ${v.eventName}` : ''}
                    </div>
                  </td>
                  <td><span className="tag">{v.registrationNo || '—'}</span></td>
                  <td>
                    <span className={`vendor-type-badge vendor-type-${v.vendorType}`}>{TYPE_LABELS[v.vendorType] || '—'}</span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{districtMap[v.districtId]?.name || '—'}</td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v.currentLicenceNo || '—'}</div>
                    <LicenceChip state={v.licenceState} daysLeft={v.daysLeft} />
                    {v.hasOpenApplication && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>application open</div>}
                  </td>
                  <td style={{ fontSize: 13 }} title={daysLeftText(v.licenceState, v.daysLeft)}>{fmtDay(v.licenceExpiry)}</td>
                  <td><StatusBadge status={v.displayStatus} /></td>
                  <td>
                    <Link to={`/food/vendors/${v._id}`} className="btn btn-secondary btn-sm" onClick={(e) => e.stopPropagation()}>View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registration wizard */}
      <Modal isOpen={showAdd} onClose={closeWizard} title="Register Food Vendor" size="lg">
        <div className="wizard-steps">
          {steps.map((s) => (
            <span key={s.n} className={`wizard-step ${step === s.n ? 'active' : ''} ${step > s.n ? 'completed' : ''}`}>
              <span className="wizard-step-num">{step > s.n ? '✓' : s.n}</span> {s.label}
            </span>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

        {step === 1 && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>
              What kind of vendor is being registered? A registration number is generated automatically.
            </p>
            <div className="wizard-type-cards">
              {TYPE_CARDS.map((c) => (
                <div
                  key={c.key}
                  className={`wizard-type-card ${form.vendorType === c.key ? 'selected' : ''}`}
                  onClick={() => set({ vendorType: c.key })}
                >
                  <div className="wizard-card-emoji">{c.emoji}</div>
                  <div className="wizard-card-title">{TYPE_LABELS[c.key].replace(/^\S+\s/, '')}</div>
                  <div className="wizard-card-desc">{TYPE_DESCRIPTIONS[c.key]}</div>
                </div>
              ))}
            </div>
            <ModalFooter>
              <button type="button" className="btn btn-secondary" onClick={closeWizard}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={!form.vendorType} onClick={() => { setError(''); setStep(2); }}>Next →</button>
            </ModalFooter>
          </>
        )}

        {step === 2 && (
          <form onSubmit={goReview} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Vendor / business name *</label>
                <input className="form-control" value={form.vendorName} onChange={(e) => set({ vendorName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Owner name *</label>
                <input className="form-control" value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">District *</label>
                <select className="form-control" value={form.districtId} onChange={(e) => set({ districtId: e.target.value, streetId: '' })} required>
                  <option value="">Select district</option>
                  {(districts || []).map((d) => <option key={d._id} value={d._id}>{d.name || d.code}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Street</label>
                <select className="form-control" value={form.streetId} onChange={(e) => set({ streetId: e.target.value })} disabled={!form.districtId}>
                  <option value="">Select street</option>
                  {(streets || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address *</label>
              <input className="form-control" value={form.address} onChange={(e) => set({ address: e.target.value })} required />
            </div>

            {form.vendorType === 'itinerant' && (
              <div className="form-group">
                <label className="form-label">Operating area / route</label>
                <textarea className="form-control" rows={2} value={form.operatingArea} onChange={(e) => set({ operatingArea: e.target.value })} placeholder="Where does this vendor sell?" />
              </div>
            )}

            {form.vendorType === 'special_event' && (
              <>
                <div className="form-group">
                  <label className="form-label">Event name *</label>
                  <input className="form-control" value={form.eventName} onChange={(e) => set({ eventName: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Event start *</label>
                    <input className="form-control" type="date" value={form.eventStartDate} onChange={(e) => set({ eventStartDate: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Event end * (max 30 days)</label>
                    <input className="form-control" type="date" value={form.eventEndDate} min={form.eventStartDate || undefined} onChange={(e) => set({ eventEndDate: e.target.value })} required />
                  </div>
                </div>
              </>
            )}

            {form.vendorType === 'establishment' && (
              <div className="form-group">
                <label className="form-label">Works within establishment *</label>
                <select className="form-control" value={form.linkedEstablishmentId} onChange={(e) => set({ linkedEstablishmentId: e.target.value })} required>
                  <option value="">Select establishment</option>
                  {(establishments || []).map((x) => (
                    <option key={x._id} value={x._id}>{x.establishmentName} ({x.registrationNo})</option>
                  ))}
                </select>
                {establishments && establishments.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    No registered establishments yet — register the establishment first.
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </div>
            <ModalFooter>
              <button type="button" className="btn btn-secondary" onClick={() => { setError(''); setStep(1); }}>← Back</button>
              <button type="submit" className="btn btn-primary">Review →</button>
            </ModalFooter>
          </form>
        )}

        {step === 3 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['Type', <span className={`vendor-type-badge vendor-type-${form.vendorType}`}>{TYPE_LABELS[form.vendorType]}</span>],
                ['Vendor', form.vendorName],
                ['Owner', form.ownerName],
                ['Phone / email', [form.phone, form.email].filter(Boolean).join(' · ') || '—'],
                ['District', districtMap[form.districtId]?.name || '—'],
                ['Address', form.address],
                form.vendorType === 'itinerant' && ['Operating area', form.operatingArea || '—'],
                form.vendorType === 'special_event' && ['Event', `${form.eventName} (${fmtDay(dayToMs(form.eventStartDate))} → ${fmtDay(dayToMs(form.eventEndDate))})`],
                form.vendorType === 'establishment' && ['Establishment', estabName || '—'],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label}>
                  <div className="detail-label">{label}</div>
                  <div className="detail-value">{value}</div>
                </div>
              ))}
            </div>
            <div className="alert alert-info" style={{ marginTop: 14 }}>
              A registration number (FV-{new Date().getFullYear()}-NNNN) is generated when you register, and the first licence application is opened. Issue the licence from the vendor's page once any inspection and payment are done.
            </div>
            <ModalFooter>
              <button type="button" className="btn btn-secondary" onClick={() => { setError(''); setStep(2); }}>← Back</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={submit}>
                {saving ? 'Registering…' : '✅ Register Vendor'}
              </button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
