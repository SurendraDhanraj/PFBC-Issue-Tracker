import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon paths (broken in Vite builds)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Listens for map clicks and passes back the lat/lng */
function MapClickHandler({ onPin }) {
  useMapEvents({
    click(e) {
      onPin(e.latlng);
    },
  });
  return null;
}

export default function NewIssue() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const createIssue = useMutation(api.issues.createIssue);

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    priority: 'medium',
    districtId: '',
    streetId: '',
    address: '',
    assignedTo: '',
  });
  const [pin, setPin] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = useQuery(api.categories.listCategories);
  const districts = useQuery(api.districts.listDistricts);
  const streets = useQuery(api.districts.listStreets, form.districtId ? { districtId: form.districtId } : 'skip');
  const users = useQuery(api.users.listUsers, { token });


  const userDistricts = user?.assignedDistricts?.includes('ALL')
    ? districts || []
    : (districts || []).filter(d => user?.assignedDistricts?.includes(d.code));

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handlePin = useCallback((latlng) => {
    setPin({ lat: parseFloat(latlng.lat.toFixed(6)), lng: parseFloat(latlng.lng.toFixed(6)) });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.categoryId || !form.districtId) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await createIssue({
        token,
        title: form.title,
        description: form.description,
        categoryId: form.categoryId,
        priority: form.priority,
        districtId: form.districtId,
        streetId: form.streetId || undefined,
        address: form.address || undefined,
        assignedTo: form.assignedTo || undefined,
        lat: pin?.lat,
        lng: pin?.lng,
      });
      if (res.success) {
        navigate(`/issues/${res.id}`);
      } else {
        setError(res.error || 'Failed to create issue');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Trinidad & Tobago centre
  const defaultCenter = [10.6918, -61.2225];

  return (
    <div className="slide-up" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title">Log New Issue</div>
          <div className="page-subtitle">Report a public health issue in your district</div>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}

          <div className="form-group">
            <label className="form-label">Issue Title *</label>
            <input className="form-control" placeholder="Brief description of the issue"
              value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-control" value={form.categoryId}
                onChange={e => set('categoryId', e.target.value)} required>
                <option value="">Select category</option>
                {(categories || []).filter(c => c.active).map(c => (
                  <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority *</label>
              <select className="form-control" value={form.priority}
                onChange={e => set('priority', e.target.value)}>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
                <option value="urgent">🚨 Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Description</label>
            <textarea className="form-control" rows={4}
              placeholder="Provide additional details about the issue..."
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className="section-header">📍 Location</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Electoral District *</label>
              <select className="form-control" value={form.districtId}
                onChange={e => { set('districtId', e.target.value); set('streetId', ''); }} required>
                <option value="">Select district</option>
                {userDistricts.map(d => (
                  <option key={d._id} value={d._id}>{d.name || d.code}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Street</label>
              <select className="form-control" value={form.streetId}
                onChange={e => set('streetId', e.target.value)}
                disabled={!form.districtId}>
                <option value="">Select street</option>
                {(streets || []).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address / Landmark</label>
            <input className="form-control" placeholder="e.g. 45 Erin Road, near the market"
              value={form.address} onChange={e => set('address', e.target.value)} />
          </div>

          {/* ── Minimap ── */}
          <div className="form-group">
            <label className="form-label">
              📌 Pin Location on Map
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                (click the map to drop a pin)
              </span>
            </label>
            <div style={{
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              height: 280,
              position: 'relative',
            }}>
              <MapContainer
                center={defaultCenter}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onPin={handlePin} />
                {pin && <Marker position={[pin.lat, pin.lng]} />}
              </MapContainer>
            </div>

            {/* Coordinates display */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
              padding: '8px 12px',
              background: pin ? 'var(--blue-50)' : 'var(--surface-hover)',
              border: `1px solid ${pin ? 'var(--blue-100)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: 12.5,
            }}>
              {pin ? (
                <>
                  <span style={{ color: 'var(--blue-600)', fontWeight: 700 }}>📍 Pinned</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    Lat: <strong>{pin.lat}</strong>
                  </span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    Long: <strong>{pin.lng}</strong>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }}
                    onClick={() => setPin(null)}
                  >✕ Clear</button>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No location pinned — click the map to set coordinates</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assign To (Optional)</label>
            <select className="form-control" value={form.assignedTo}
              onChange={e => set('assignedTo', e.target.value)}>
              <option value="">Unassigned</option>
              {(users || []).filter(u => u.active && u._id !== user?._id).map(u => (
                <option key={u._id} value={u._id}>{u.name} — {u.role}</option>
              ))}
            </select>
          </div>

          <div className="modal-footer" style={{ padding: 0, border: 'none', marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Logging...' : '📋 Log Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
