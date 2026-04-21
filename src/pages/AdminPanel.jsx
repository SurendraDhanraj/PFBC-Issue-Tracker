import { useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import Modal, { ModalFooter } from '../components/Modal';
import { useBranding } from '../context/BrandingContext';

// ── Permission Matrix constants ─────────────────────────────────────────────
const MODULES = [
  { key: 'dashboard',          label: '🏠 Dashboard' },
  { key: 'issues',             label: '📋 Issue Tracker' },
  { key: 'foodVendors',        label: '🛒 Food Vendors' },
  { key: 'foodEstablishments', label: '🏪 Establishments' },
  { key: 'staffManagement',    label: '👥 Staff Management' },
  { key: 'leaveTracker',       label: '📅 Leave Tracker' },
  { key: 'adminPanel',         label: '⚙️ Admin Panel' },
];
const LEVELS = [
  { key: 'none',  label: '🚫 None',  color: '#475569', desc: 'No access, hidden from nav' },
  { key: 'view',  label: '👁 View',  color: '#06b6d4', desc: 'Read-only access' },
  { key: 'write', label: '✏️ Write', color: '#3b82f6', desc: 'Create and edit records' },
  { key: 'admin', label: '⚡ Admin', color: '#ef4444', desc: 'Full control including approvals' },
];
const DEFAULT_PERMISSIONS = {
  dashboard: 'view', issues: 'view', foodVendors: 'none',
  foodEstablishments: 'none', staffManagement: 'none', leaveTracker: 'view', adminPanel: 'none',
};

// ============ CSV Parser for POINT FORTIN.csv ============
// Headers: SYSTEM_ID,CONSEC_NO,NAME,BUILDING,APT,ADDRESS,POLLING DIVISION,
//          PARLIAMENTARY ELECTORAL DISTRICT,MUNICIPAL ELECTORAL DISTRICT,
//          REGISTRATION AREA,CORPORATION,SECURITY CODE
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim().replace(/\r$/, '')).filter(l => l);
  if (lines.length < 2) throw new Error('CSV is empty or invalid');
  
  const headers = parseCsvLine(lines[0]).map(h => h.trim().replace(/"/g, '').toUpperCase());

  // Find column indices (flexible matching)
  const addressIdx = headers.findIndex(h => h === 'ADDRESS');
  const pollingDivIdx = headers.findIndex(h => h === 'POLLING DIVISION' || h === 'PD');
  const municipalDistIdx = headers.findIndex(h => h.includes('MUNICIPAL ELECTORAL'));
  const parliDistIdx = headers.findIndex(h => h.includes('PARLIAMENTARY ELECTORAL'));
  const corpIdx = headers.findIndex(h => h === 'CORPORATION' || h.includes('CORP'));

  // We use MUNICIPAL ELECTORAL DISTRICT as the primary district name
  // fall back to PARLIAMENTARY ELECTORAL DISTRICT
  const distNameIdx = municipalDistIdx !== -1 ? municipalDistIdx : parliDistIdx;

  if (addressIdx === -1) throw new Error(`Could not find ADDRESS column. Found: ${headers.join(', ')}`);
  if (distNameIdx === -1) throw new Error(`Could not find Electoral District column. Found: ${headers.join(', ')}`);

  const districtData = {};
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCsvLine(lines[i]);
    
    const distName = (cols[distNameIdx] || '').trim().replace(/"/g, '').replace(/\s+/g, ' ');
    const pollDiv = pollingDivIdx >= 0 ? (cols[pollingDivIdx] || '').trim().replace(/"/g, '') : '';
    const address = (cols[addressIdx] || '').trim().replace(/"/g, '');
    const corp = corpIdx >= 0 ? (cols[corpIdx] || '').trim().replace(/"/g, '') : 'Point Fortin Borough Corporation';

    if (!distName || distName.length < 2) continue;

    const key = distName.toUpperCase();
    if (!districtData[key]) {
      districtData[key] = {
        districtName: distName,
        pollingDivision: pollDiv,
        corporation: corp,
        streets: new Set(),
      };
    }

    // Extract a clean street name from the address field
    // Address format is typically like "LA RESOURCE TRACE", "ERIN ROAD", "LP62 ERIN ROAD"
    // Strip leading lot/plot numbers: LP62, 30, 332, etc.
    if (address && address.length > 2) {
      const cleaned = address
        .replace(/^(LP\d+|L\.P\.\d+|\d+[A-Z]?)\s*/i, '') // strip lot prefix
        .replace(/^[,\s]+/, '')
        .trim();
      if (cleaned && cleaned.length > 2 && cleaned.length < 80) {
        districtData[key].streets.add(cleaned);
      }
    }
  }

  return Object.values(districtData).map(d => ({
    districtName: d.districtName,
    pollingDivision: d.pollingDivision,
    corporation: d.corporation,
    streets: [...d.streets].filter(s => s.length > 2 && s.length < 80),
  }));
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

export default function AdminPanel() {
  const { token } = useAuth();
  const { isAdmin } = useRoleCheck();
  const navigate = useNavigate();
  const [tab, setTab] = useState('categories');

  const categories = useQuery(api.categories.listCategories);
  const leaveTypes = useQuery(api.leave.listLeaveTypes);
  const districts = useQuery(api.districts.listDistricts);
  const roles = useQuery(api.roles.listRoles);

  const createCat = useMutation(api.categories.createCategory);
  const updateCat = useMutation(api.categories.updateCategory);
  const createLeaveType = useMutation(api.leave.createLeaveType);
  const updateLeaveType = useMutation(api.leave.updateLeaveType);
  const uploadDistrictsCSV = useMutation(api.districts.uploadDistrictsFromCSV);
  const addDistrict = useMutation(api.districts.addDistrict);
  const toggleDistrictActive = useMutation(api.districts.toggleDistrictActive);
  const createRole = useMutation(api.roles.createRole);
  const updateRole = useMutation(api.roles.updateRole);
  const seedRoles = useMutation(api.roles.seedDefaultRoles);
  const deleteIssue    = useMutation(api.issues.deleteIssue);
  const deleteAllIssues = useMutation(api.issues.deleteAllIssues);
  const allIssues = useQuery(
    tab === 'issues' ? api.issues.listIssues : 'skip',
    tab === 'issues' ? { token } : 'skip'
  );
  const [issueSearch, setIssueSearch] = useState('');
  const [issueDeleteMsg, setIssueDeleteMsg] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteIssue = async (issueId) => {
    setConfirmDeleteId(issueId);
  };

  const doDeleteIssue = async (issueId) => {
    setConfirmDeleteId(null);
    const res = await deleteIssue({ token, issueId });
    if (!res.success) setIssueDeleteMsg(`⚠️ ${res.error}`);
    else setIssueDeleteMsg('✅ Issue deleted.');
    setTimeout(() => setIssueDeleteMsg(''), 3000);
  };

  const handleDeleteAllIssues = async () => {
    setDeletingAll(true);
    const res = await deleteAllIssues({ token });
    setDeletingAll(false);
    setConfirmDeleteAll(false);
    if (!res.success) setIssueDeleteMsg(`⚠️ ${res.error}`);
    else setIssueDeleteMsg(`✅ All ${res.count} issues deleted.`);
    setTimeout(() => setIssueDeleteMsg(''), 5000);
  };

  const updateAppSettings = useMutation(api.settings.updateAppSettings);
  const genBrandingUpload = useMutation(api.settings.generateBrandingUploadUrl);
  const { appName: currentAppName, tagline: currentTagline, faviconUrl, splashUrl } = useBranding();
  const pendingResets = useQuery(api.auth.listPendingResets, { token });

  const [catModal, setCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', color: '#3b82f6', icon: '📌', description: '' });
  const [editCat, setEditCat] = useState(null);
  const [ltModal, setLtModal] = useState(false);
  const [ltForm, setLtForm] = useState({ name: '', description: '', maxDaysPerYear: '' });
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvError, setCsvError] = useState('');
  const [distModal, setDistModal] = useState(false);
  const [distForm, setDistForm] = useState({ name: '', code: '', corporation: 'Point Fortin Borough Corporation' });
  const fileRef = useRef();
  const iconRef = useRef();
  const splashRef = useRef();

  // Branding state
  const [brandForm, setBrandForm] = useState({ appName: '', tagline: '' });
  const [brandLoading, setBrandLoading] = useState('');
  const [brandMsg, setBrandMsg] = useState('');

  // Role state
  const [roleModal, setRoleModal] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', color: '#3b82f6', description: '', permissions: { ...DEFAULT_PERMISSIONS } });
  const [roleError, setRoleError] = useState('');
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  if (!isAdmin) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Access Restricted</div>
        <div className="empty-state-text">Only the Medical Officer of Health can access administrative settings.</div>
      </div>
    </div>
  );

  const handleCreateCat = async (e) => {
    e.preventDefault();
    if (editCat) { await updateCat({ token, categoryId: editCat._id, ...catForm }); setEditCat(null); }
    else { await createCat({ token, ...catForm }); }
    setCatModal(false); setCatForm({ name: '', color: '#3b82f6', icon: '📌', description: '' });
  };

  const handleCreateLT = async (e) => {
    e.preventDefault();
    await createLeaveType({ token, ...ltForm, maxDaysPerYear: ltForm.maxDaysPerYear ? Number(ltForm.maxDaysPerYear) : undefined });
    setLtModal(false); setLtForm({ name: '', description: '', maxDaysPerYear: '' });
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvLoading(true); setCsvError(''); setCsvResult(null);
    try {
      const text = await file.text();
      const data = parseCSV(text);
      const res = await uploadDistrictsCSV({ token, data });
      if (res.success) { setCsvResult(`✅ Imported ${res.districtCount} districts and ${res.streetCount} streets`); }
      else { setCsvError(res.error || 'Upload failed'); }
    } catch (err) {
      setCsvError(err.message || 'Failed to parse CSV');
    } finally { setCsvLoading(false); fileRef.current.value = ''; }
  };

  const handleAddDistrict = async (e) => {
    e.preventDefault();
    await addDistrict({ token, ...distForm });
    setDistModal(false);
    setDistForm({ name: '', code: '', corporation: 'Point Fortin Borough Corporation' });
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setRoleError('');
    if (!roleForm.name) { setRoleError('Role name is required.'); return; }
    let res;
    if (editRole) {
      res = await updateRole({ token, roleId: editRole._id, name: roleForm.name, color: roleForm.color, description: roleForm.description || undefined, permissions: roleForm.permissions });
    } else {
      res = await createRole({ token, name: roleForm.name, color: roleForm.color, description: roleForm.description || undefined });
      // If creating, also set permissions
      if (res.success && res.id) {
        await updateRole({ token, roleId: res.id, permissions: roleForm.permissions });
      }
    }
    if (res.success) {
      setRoleModal(false);
      setEditRole(null);
      setRoleForm({ name: '', color: '#3b82f6', description: '', permissions: { ...DEFAULT_PERMISSIONS } });
    } else {
      setRoleError(res.error || 'Failed');
    }
  };

  const handleSeedRoles = async () => {
    setSeedLoading(true); setSeedMsg('');
    const res = await seedRoles({ token });
    setSeedLoading(false);
    setSeedMsg(res.success ? `✅ Seeded ${res.count} default roles` : `⚠️ ${res.error}`);
  };

  const handleBrandTextSave = async () => {
    setBrandLoading('text');
    await updateAppSettings({ token, appName: brandForm.appName || undefined, tagline: brandForm.tagline || undefined });
    setBrandLoading('');
    setBrandMsg('✅ Saved');
    setTimeout(() => setBrandMsg(''), 3000);
  };

  const handleBrandUpload = async (file, field) => {
    if (!file) return;
    setBrandLoading(field);
    try {
      const uploadUrl = await genBrandingUpload({ token });
      const res = await fetch(uploadUrl, { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
      const { storageId } = await res.json();
      if (field === 'favicon') await updateAppSettings({ token, faviconStorageId: storageId });
      else await updateAppSettings({ token, splashStorageId: storageId });
      setBrandMsg(`✅ ${field === 'favicon' ? 'App icon' : 'Splash image'} updated`);
      setTimeout(() => setBrandMsg(''), 3000);
    } finally {
      setBrandLoading('');
    }
  };

  const openEditRole = (role) => {
    setEditRole(role);
    setRoleForm({
      name: role.name,
      color: role.color,
      description: role.description || '',
      permissions: { ...DEFAULT_PERMISSIONS, ...(role.permissions || {}) },
    });
    setRoleError('');
    setRoleModal(true);
  };

  const TABS = [
    { key: 'branding',    label: '🎨 Branding' },
    { key: 'categories',  label: '📂 Categories' },
    { key: 'leave',       label: '📅 Leave Types' },
    { key: 'districts',   label: '🗺️ Districts' },
    { key: 'roles',       label: '👤 Roles' },
    { key: 'issues',      label: '📋 Issues' },
  ];

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Admin Panel</div>
          <div className="page-subtitle">System configuration and settings</div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <div key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
        ))}
      </div>

      {/* BRANDING */}
      {tab === 'branding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
          {brandMsg && <div className="alert alert-success">{brandMsg}</div>}

          {/* App Name & Tagline */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>📝 App Identity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">App Name</label>
                <input className="form-control"
                  placeholder={currentAppName}
                  value={brandForm.appName}
                  onChange={e => setBrandForm(f => ({ ...f, appName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tagline <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(shown on splash screen)</span></label>
                <input className="form-control"
                  placeholder={currentTagline}
                  value={brandForm.tagline}
                  onChange={e => setBrandForm(f => ({ ...f, tagline: e.target.value }))} />
              </div>
              <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}
                onClick={handleBrandTextSave} disabled={brandLoading === 'text'}>
                {brandLoading === 'text' ? '⏳ Saving...' : '💾 Save Text'}
              </button>
            </div>
          </div>

          {/* App Icon / Favicon */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>🖼️ App Icon <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>(browser tab favicon + loading screen)</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 14, overflow: 'hidden',
                border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'white', flexShrink: 0,
              }}>
                {faviconUrl
                  ? <img src={faviconUrl} alt="icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 30 }}>🏥</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Recommended: square image, at least 256×256px. PNG or SVG preferred.
                </div>
                <input ref={iconRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => handleBrandUpload(e.target.files?.[0], 'favicon')} />
                <button className="btn btn-secondary" onClick={() => iconRef.current?.click()}
                  disabled={brandLoading === 'favicon'}>
                  {brandLoading === 'favicon' ? '⏳ Uploading...' : '📤 Upload Icon'}
                </button>
              </div>
            </div>
          </div>

          {/* Splash / Loading Image */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>✨ Splash / Loading Image <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>(shown while app loads)</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                width: 96, height: 96, borderRadius: 16, overflow: 'hidden',
                border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'white', flexShrink: 0,
              }}>
                {splashUrl
                  ? <img src={splashUrl} alt="splash" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 38 }}>🏥</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Shown centered on a light background while the app is initialising. Logos work best.
                </div>
                <input ref={splashRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => handleBrandUpload(e.target.files?.[0], 'splash')} />
                <button className="btn btn-secondary" onClick={() => splashRef.current?.click()}
                  disabled={brandLoading === 'splash'}>
                  {brandLoading === 'splash' ? '⏳ Uploading...' : '📤 Upload Splash Image'}
                </button>
              </div>
            </div>
          </div>

          {/* Reset Requests */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🔑 Pending Password Resets</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
              Share the 6-digit code with the user by phone or in person. Codes expire after 2 hours.
            </div>
            {(!pendingResets || pendingResets.length === 0) ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                No pending reset requests.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingResets.map(r => (
                  <div key={r._id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-glass)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Expires {new Date(r.expiresAt).toLocaleTimeString('en-TT', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 22, fontWeight: 900,
                      letterSpacing: 6, color: 'var(--blue-600)',
                      background: '#eff6ff', padding: '6px 14px',
                      borderRadius: 8, border: '1px solid #bfdbfe',
                    }}>{r.code}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CATEGORIES */}
      {tab === 'categories' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => { setEditCat(null); setCatForm({ name: '', color: '#3b82f6', icon: '📌', description: '' }); setCatModal(true); }}>
              ＋ Add Category
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Category</th><th>Icon</th><th>Color</th><th>Description</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {(categories || []).map(c => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ fontSize: 20 }}>{c.icon}</td>
                    <td><div style={{ width: 24, height: 24, background: c.color, borderRadius: 4 }} /></td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{c.description}</td>
                    <td>
                      <label className="checkbox-group">
                        <input type="checkbox" checked={c.active} onChange={e => updateCat({ token, categoryId: c._id, active: e.target.checked })} />
                      </label>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        setEditCat(c);
                        setCatForm({ name: c.name, color: c.color, icon: c.icon, description: c.description });
                        setCatModal(true);
                      }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEAVE TYPES */}
      {tab === 'leave' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setLtModal(true)}>＋ Add Leave Type</button>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Leave Type</th><th>Description</th><th>Max Days/Year</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {(leaveTypes || []).map(lt => (
                  <tr key={lt._id}>
                    <td style={{ fontWeight: 600 }}>{lt.name}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lt.description || '—'}</td>
                    <td>{lt.maxDaysPerYear || '—'}</td>
                    <td>
                      <label className="checkbox-group">
                        <input type="checkbox" checked={lt.active} onChange={e => updateLeaveType({ token, leaveTypeId: lt._id, active: e.target.checked })} />
                      </label>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        setLtForm({ name: lt.name, description: lt.description || '', maxDaysPerYear: lt.maxDaysPerYear?.toString() || '' });
                        setLtModal(true);
                      }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DISTRICTS */}
      {tab === 'districts' && (
        <div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={csvLoading}>
              {csvLoading ? '⏳ Importing...' : '📂 Import from CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
            <button className="btn btn-primary" onClick={() => setDistModal(true)}>＋ Add District</button>
          </div>

          {csvResult && <div className="alert alert-success" style={{ marginBottom: 12 }}>{csvResult}</div>}
          {csvError && (
            <div className="alert alert-error" style={{ marginBottom: 12 }}>
              ⚠️ {csvError}
              <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-muted)' }}>
                Expected columns: Electoral District, Polling Division (or PD), Address/Street, Corporation
              </div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>📋 CSV Import Instructions:</strong><br />
              Upload the "POINT FORTIN.csv" file. The file must contain columns for:<br />
              <code style={{ background: 'var(--surface-glass)', padding: '2px 6px', borderRadius: 4 }}>Electoral District</code>,{' '}
              <code style={{ background: 'var(--surface-glass)', padding: '2px 6px', borderRadius: 4 }}>Polling Division</code>,{' '}
              <code style={{ background: 'var(--surface-glass)', padding: '2px 6px', borderRadius: 4 }}>Address</code>.
              Streets are automatically extracted from addresses.
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead><tr><th>District Name</th><th>Code / PD</th><th>Corporation</th><th style={{ textAlign: 'center' }}>Active</th></tr></thead>
              <tbody>
                {(districts || []).length === 0 ? (
                  <tr><td colSpan={4}>
                    <div className="empty-state" style={{ padding: 24 }}>
                      <div className="empty-state-icon">🗺️</div>
                      <div className="empty-state-title">No districts loaded</div>
                      <div className="empty-state-text">Import from CSV or add manually.</div>
                    </div>
                  </td></tr>
                ) : (districts || []).map(d => {
                  const isActive = d.active !== false; // treat missing as true
                  return (
                    <tr key={d._id} style={{ opacity: isActive ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 600 }}>{d.name || '—'}</td>
                      <td><span className="tag">{d.code}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{d.corporation || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <label className="checkbox-group" title={isActive ? 'Click to deactivate' : 'Click to activate'}
                          style={{ justifyContent: 'center' }}>
                          <input type="checkbox" checked={isActive}
                            onChange={e => toggleDistrictActive({ token, districtId: d._id, active: e.target.checked })} />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ROLES */}
      {tab === 'roles' && (
        <div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 16 }}>
            {(!roles || roles.length === 0) && (
              <button className="btn btn-secondary" onClick={handleSeedRoles} disabled={seedLoading}>
                {seedLoading ? '⏳ Seeding...' : '🌱 Seed Defaults'}
              </button>
            )}
            <button className="btn btn-primary" onClick={() => { setEditRole(null); setRoleForm({ name: '', color: '#3b82f6', description: '' }); setRoleError(''); setRoleModal(true); }}>
              ＋ Add Role
            </button>
          </div>

          {seedMsg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{seedMsg}</div>}

          <div className="table-container">
            <table>
              <thead><tr><th>Role Name</th><th>Color</th><th>Description</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {(roles || []).length === 0 ? (
                  <tr><td colSpan={5}>
                    <div className="empty-state" style={{ padding: 24 }}>
                      <div className="empty-state-icon">👤</div>
                      <div className="empty-state-title">No roles defined</div>
                      <div className="empty-state-text">Click "Seed Defaults" to load the standard role set, or add roles manually.</div>
                    </div>
                  </td></tr>
                ) : (roles || []).map(r => (
                  <tr key={r._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 24, background: r.color, borderRadius: 4 }} />
                        <code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.color}</code>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.description || '—'}</td>
                    <td>
                      <label className="checkbox-group">
                        <input type="checkbox" checked={r.active}
                          onChange={e => updateRole({ token, roleId: r._id, active: e.target.checked })} />
                      </label>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditRole(r)}>✏️ Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Modal */}
      <Modal isOpen={catModal} onClose={() => setCatModal(false)} title={editCat ? 'Edit Category' : 'Add Category'}>
        <form onSubmit={handleCreateCat} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-control" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Icon (emoji)</label>
              <input className="form-control" value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 42, height: 36, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }} />
              <input className="form-control" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} style={{ flex: 1 }} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={2} value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setCatModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editCat ? 'Update' : 'Add Category'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Leave Type Modal */}
      <Modal isOpen={ltModal} onClose={() => setLtModal(false)} title="Add Leave Type">
        <form onSubmit={handleCreateLT} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-control" value={ltForm.name} onChange={e => setLtForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-control" value={ltForm.description} onChange={e => setLtForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Max Days Per Year</label>
            <input className="form-control" type="number" value={ltForm.maxDaysPerYear} onChange={e => setLtForm(f => ({ ...f, maxDaysPerYear: e.target.value }))} placeholder="e.g. 14" />
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setLtModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Leave Type</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Add District Modal */}
      <Modal isOpen={distModal} onClose={() => setDistModal(false)} title="Add District">
        <form onSubmit={handleAddDistrict} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">District Name *</label>
            <input className="form-control" value={distForm.name} onChange={e => setDistForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Code / Polling Division *</label>
            <input className="form-control" value={distForm.code} onChange={e => setDistForm(f => ({ ...f, code: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Corporation</label>
            <input className="form-control" value={distForm.corporation} onChange={e => setDistForm(f => ({ ...f, corporation: e.target.value }))} />
          </div>
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setDistModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add District</button>
          </ModalFooter>
        </form>
      </Modal>
      {/* Role Modal */}
      <Modal isOpen={roleModal} onClose={() => { setRoleModal(false); setEditRole(null); }} title={editRole ? `Edit Role — ${editRole.name}` : 'Add Role'} size="lg">
        <form onSubmit={handleRoleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {roleError && <div className="alert alert-error">⚠️ {roleError}</div>}

          {/* Name, color, description */}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Role Identity</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Role Name *</label>
              <input className="form-control" value={roleForm.name}
                onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} required
                placeholder="e.g. Senior Inspector" />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={roleForm.color}
                  onChange={e => setRoleForm(f => ({ ...f, color: e.target.value }))}
                  style={{ width: 42, height: 36, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }} />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['#ef4444','#f59e0b','#3b82f6','#06b6d4','#8b5cf6','#6366f1','#10b981','#64748b','#94a3b8','#475569'].map(c => (
                    <div key={c} onClick={() => setRoleForm(f => ({ ...f, color: c }))}
                      style={{ width: 20, height: 20, borderRadius: 3, background: c, cursor: 'pointer',
                        outline: roleForm.color === c ? `2px solid white` : 'none',
                        boxShadow: roleForm.color === c ? `0 0 0 3px ${c}` : 'none' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-control" value={roleForm.description}
              onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this role" />
          </div>

          {/* Permission Matrix */}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: -4 }}>Access Permissions</div>
          <div style={{ background: 'var(--surface-glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(4, 1fr)', background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>MODULE</div>
              {LEVELS.map(l => (
                <div key={l.key} style={{ fontSize: 11, color: l.color, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>{l.label}</div>
              ))}
            </div>
            {/* Rows */}
            {MODULES.map((mod, idx) => {
              const current = (roleForm.permissions || {})[mod.key] || 'none';
              return (
                <div key={mod.key} style={{
                  display: 'grid', gridTemplateColumns: '160px repeat(4, 1fr)',
                  padding: '10px 12px', alignItems: 'center',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  borderBottom: idx < MODULES.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{mod.label}</div>
                  {LEVELS.map(lvl => {
                    const isSelected = current === lvl.key;
                    return (
                      <div key={lvl.key} style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          type="button"
                          title={lvl.desc}
                          onClick={() => setRoleForm(f => ({ ...f, permissions: { ...f.permissions, [mod.key]: lvl.key } }))}
                          style={{
                            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                            background: isSelected ? lvl.color : 'var(--surface)',
                            border: isSelected ? `2px solid ${lvl.color}` : '2px solid var(--border)',
                            boxShadow: isSelected ? `0 0 8px ${lvl.color}60` : 'none',
                            transition: 'all 0.15s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14,
                          }}
                        >
                          {isSelected ? '●' : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {LEVELS.map(l => (
              <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
                <strong style={{ color: l.color }}>{l.label}</strong> — {l.desc}
              </div>
            ))}
          </div>

          {editRole && (
            <div className="alert" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: 13 }}>
              ⚠️ Renaming this role will automatically update all staff members assigned to it. Permission changes take effect at next login.
            </div>
          )}
          <ModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => { setRoleModal(false); setEditRole(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editRole ? '💾 Save Changes' : '＋ Create Role'}</button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ISSUES TAB */}
      {tab === 'issues' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {issueDeleteMsg && <div className="alert alert-success">{issueDeleteMsg}</div>}

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="form-control" style={{ flex: 1, minWidth: 200 }}
              placeholder="Search issues by title…"
              value={issueSearch} onChange={e => setIssueSearch(e.target.value)} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {(allIssues || []).length} total
            </div>
            <button className="btn" onClick={() => setConfirmDeleteAll(true)}
              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              🗑️ Delete All Issues
            </button>
          </div>

          {/* Inline delete-all confirmation */}
          {confirmDeleteAll && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.35)',
              borderRadius: 'var(--radius)', padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                ⚠️ This will permanently delete ALL {(allIssues || []).length} issues, including all notes and subtasks. This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeleteAll(false)} disabled={deletingAll}>
                  Cancel
                </button>
                <button className="btn btn-sm" onClick={handleDeleteAllIssues} disabled={deletingAll}
                  style={{ background: '#ef4444', color: 'white', border: 'none', fontWeight: 700 }}>
                  {deletingAll ? '⏳ Deleting...' : '🗑️ Yes, Delete All'}
                </button>
              </div>
            </div>
          )}

          {/* Inline single-issue delete confirmation */}
          {confirmDeleteId && (() => {
            const issue = (allIssues || []).find(i => i._id === confirmDeleteId);
            return (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.35)',
                borderRadius: 'var(--radius)', padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                  ⚠️ Delete "{issue?.title}"? This cannot be undone.
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  <button className="btn btn-sm" onClick={() => doDeleteIssue(confirmDeleteId)}
                    style={{ background: '#ef4444', color: 'white', border: 'none', fontWeight: 700 }}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })()}

          {!allIssues ? (
            <div className="loading-center"><div className="loading-spinner" /></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Created</th>
                    <th>Notes</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(allIssues || [])
                    .filter(i => !issueSearch || i.title.toLowerCase().includes(issueSearch.toLowerCase()))
                    .map(issue => (
                      <tr key={issue._id}>
                        <td style={{ fontWeight: 600, maxWidth: 260 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {issue.title}
                          </div>
                          {issue.address && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>📍 {issue.address}</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${issue.status}`} style={{ fontSize: 12 }}>
                            {issue.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {issue.priority === 'urgent' ? '🚨' : issue.priority === 'high' ? '🔴' : issue.priority === 'medium' ? '🟡' : '🟢'}
                            {' '}{issue.priority}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(issue.createdAt).toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)'}}>
                          {(issue.notes || []).length}
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteIssue(issue._id)}
                            style={{
                              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                              border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6,
                              padding: '4px 10px', cursor: 'pointer', fontSize: 13,
                            }}
                            title="Delete issue">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
