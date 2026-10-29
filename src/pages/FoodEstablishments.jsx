import { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';
import { ESTABLISHMENT_TYPES, LICENCE_STATE, fmtDay, daysLeftText } from '../utils/vendors';

const EMPTY_FORM = {
  establishmentName: '', establishmentType: '', ownerName: '', phone: '', email: '',
  districtId: '', address: '', seatingCapacity: '', notes: '',
};

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

export default function FoodEstablishments() {
  const { token } = useAuth();
  const { canManageFood } = useRoleCheck();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [licenceFilter, setLicenceFilter] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const establishments = useQuery(api.establishments.listEstablishments, { token });
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const createEstablishment = useMutation(api.establishments.createEstablishment);

  const districtMap = useMemo(
    () => Object.fromEntries((districts || []).map((d) => [d._id, d])),
    [districts]
  );

  const counts = useMemo(() => {
    const c = { '': 0, expiring: 0, expired: 0, none: 0, open_application: 0 };
    (establishments || []).forEach((e) => {
      c['']++;
      if (e.licenceState === 'expiring') c.expiring++;
      if (e.licenceState === 'expired') c.expired++;
      if (e.licenceState === 'none') c.none++;
      if (e.hasOpenApplication) c.open_application++;
    });
    return c;
  }, [establishments]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (establishments || []).filter((e) => {
      if (s && !`${e.establishmentName} ${e.ownerName || ''} ${e.registrationNo} ${e.currentLicenceNo || ''}`.toLowerCase().includes(s)) return false;
      if (statusFilter && e.displayStatus !== statusFilter) return false;
      if (typeFilter && e.establishmentType !== typeFilter) return false;
      if (districtFilter && e.districtId !== districtFilter) return false;
      if (licenceFilter === 'open_application') return e.hasOpenApplication;
      if (licenceFilter && e.licenceState !== licenceFilter) return false;
      return true;
    });
  }, [establishments, search, statusFilter, typeFilter, districtFilter, licenceFilter]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const closeForm = () => { setShowAdd(false); setForm(EMPTY_FORM); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await createEstablishment({
        token,
        establishmentName: form.establishmentName,
        establishmentType: form.establishmentType,
        ownerName: form.ownerName,
        phone: form.phone || undefined,
        email: form.email || undefined,
        districtId: form.districtId,
        address: form.address,
        seatingCapacity: form.seatingCapacity !== '' ? Number(form.seatingCapacity) : undefined,
        notes: form.notes || undefined,
      });
      if (res.success) {
        closeForm();
        navigate(`/food/establishments/${res.id}`);
      } else {
        setError(res.error || 'Registration failed.');
      }
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <div className="page-title">🏪 Food Establishments</div>
          <div className="page-subtitle">Registration, annual licences and the vendors who work in each establishment</div>
        </div>
        {canManageFood && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ Register Establishment</button>
        )}
      </div>

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
        <select className="form-control" style={{ width: 'auto', minWidth: 160 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {ESTABLISHMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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

      {!establishments ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🏪</div>
            <div className="empty-state-title">{establishments.length === 0 ? 'No establishments registered yet' : 'No establishments match these filters'}</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Establishment</th>
                <th>Reg. No.</th>
                <th>Type</th>
                <th>District</th>
                <th>Vendors</th>
                <th>Licence</th>
                <th>Expires</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/food/establishments/${e._id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.establishmentName || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.ownerName || '—'}</div>
                  </td>
                  <td><span className="tag">{e.registrationNo || '—'}</span></td>
                  <td style={{ fontSize: 13 }}>{e.establishmentType || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{districtMap[e.districtId]?.name || '—'}</td>
                  <td style={{ fontSize: 13 }}>{e.vendorCount}</td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.currentLicenceNo || '—'}</div>
                    <LicenceChip state={e.licenceState} daysLeft={e.daysLeft} />
                    {e.hasOpenApplication && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>application open</div>}
                  </td>
                  <td style={{ fontSize: 13 }} title={daysLeftText(e.licenceState, e.daysLeft)}>{fmtDay(e.licenceExpiry)}</td>
                  <td><StatusBadge status={e.displayStatus} /></td>
                  <td>
                    <Link to={`/food/establishments/${e._id}`} className="btn btn-secondary btn-sm" onClick={(ev) => ev.stopPropagation()}>View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showAdd} onClose={closeForm} title="Register Food Establishment" size="lg">
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Establishment name *</label>
              <input className="form-control" value={form.establishmentName} onChange={(e) => set({ establishmentName: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-control" value={form.establishmentType} onChange={(e) => set({ establishmentType: e.target.value })} required>
                <option value="">Select type</option>
                {ESTABLISHMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Owner name *</label>
              <input className="form-control" value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Seating capacity</label>
              <input className="form-control" type="number" min="0" value={form.seatingCapacity} onChange={(e) => set({ seatingCapacity: e.target.value })} />
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
          <div className="form-group">
            <label className="form-label">District *</label>
            <select className="form-control" value={form.districtId} onChange={(e) => set({ districtId: e.target.value })} required>
              <option value="">Select district</option>
              {(districts || []).map((d) => <option key={d._id} value={d._id}>{d.name || d.code}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Address *</label>
            <input className="form-control" value={form.address} onChange={(e) => set({ address: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>
          <div className="alert alert-info">
            A registration number (FE-{new Date().getFullYear()}-NNNN) is generated when you register, and the first licence application is opened. Record the inspection and payment from the establishment's page. Vendors who work here are assigned from there too.
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Registering…' : '✅ Register Establishment'}</button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
