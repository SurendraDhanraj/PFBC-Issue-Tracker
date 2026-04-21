import { useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge, { PriorityBadge } from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';
import { MapContainer, TileLayer, CircleMarker, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapClickHandler({ onPin }) {
  useMapEvents({ click(e) { onPin(e.latlng); } });
  return null;
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString('en-TT', { day: 'numeric', month: 'short' });
}

/** Resize an image File to at most maxDim×maxDim, returning a new File */
function resizeImage(file, maxDim = 400, quality = 0.85) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) { resolve(file); return; }
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })),
        'image/jpeg', quality
      );
    };
    img.src = url;
  });
}

export default function IssueDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { canManageSubtasks, canCloseIssues, isAdmin } = useRoleCheck();
  const navigate = useNavigate();

  const issue = useQuery(api.issues.getIssue, { token, issueId: id });
  const categories = useQuery(api.categories.listCategories);
  const districts = useQuery(api.districts.listDistricts, { activeOnly: true });
  const streets = useQuery(api.districts.listStreets, issue?.districtId ? { districtId: issue.districtId } : 'skip');
  const users = useQuery(api.users.listUsers, { token });
  const roles = useQuery(api.roles.listRoles);

  const updateIssue = useMutation(api.issues.updateIssue);
  const addNote = useMutation(api.issues.addNote);
  const addSubtask = useMutation(api.issues.addSubtask);
  const toggleSubtask = useMutation(api.issues.toggleSubtask);
  const updateSubtask = useMutation(api.issues.updateSubtask);
  const deleteSubtask = useMutation(api.issues.deleteSubtask);
  const genUploadUrl = useMutation(api.issues.generateUploadUrl);

  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const fileRef = useRef();

  const [subtaskModal, setSubtaskModal] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssignee, setSubtaskAssignee] = useState('');
  const [editSubtaskModal, setEditSubtaskModal] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [editSubtaskTitle, setEditSubtaskTitle] = useState('');
  const [editSubtaskAssignee, setEditSubtaskAssignee] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});

  const catMap = Object.fromEntries((categories || []).map(c => [c._id, c]));
  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));
  const roleColorMap = Object.fromEntries((roles || []).map(r => [r.name, r.color]));

  if (!issue) return <div className="loading-center"><div className="loading-spinner" /></div>;

  const cat = catMap[issue.categoryId];
  const district = districtMap[issue.districtId];
  const assignedUser = (users || []).find(u => u._id === issue.assignedTo);
  const reporter = (users || []).find(u => u._id === issue.reportedBy);

  const handleStatusChange = async (status) => {
    await updateIssue({ token, issueId: id, status });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await resizeImage(file);
    setPendingFile(processed);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleAddNote = async () => {
    if (!noteText.trim() && !pendingFile) return;
    setNoteLoading(true);
    try {
      let storageId, mediaType, mediaName;
      if (pendingFile) {
        setUploading(true);
        const uploadUrl = await genUploadUrl({ token });
        const res = await fetch(uploadUrl, { method: 'POST', body: pendingFile, headers: { 'Content-Type': pendingFile.type } });
        const { storageId: sid } = await res.json();
        storageId = sid;
        mediaType = pendingFile.type;
        mediaName = pendingFile.name;
        setUploading(false);
      }
      await addNote({ token, issueId: id, text: noteText, storageId, mediaType, mediaName });
      setNoteText('');
      setPendingFile(null);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    await addSubtask({ token, issueId: id, title: subtaskTitle, assignedTo: subtaskAssignee || undefined });
    setSubtaskTitle('');
    setSubtaskAssignee('');
    setSubtaskModal(false);
  };

  const openEditSubtask = (sub) => {
    setEditingSubtask(sub);
    setEditSubtaskTitle(sub.title);
    setEditSubtaskAssignee(sub.assignedTo || '');
    setEditSubtaskModal(true);
  };

  const handleEditSubtaskSave = async () => {
    if (!editSubtaskTitle.trim() || !editingSubtask) return;
    await updateSubtask({
      token, issueId: id,
      subtaskId: editingSubtask.id,
      title: editSubtaskTitle,
      assignedTo: editSubtaskAssignee || undefined,
    });
    setEditSubtaskModal(false);
    setEditingSubtask(null);
  };

  const handleDeleteSubtask = async (sub) => {
    if (!window.confirm(`Delete subtask "${sub.title}"?`)) return;
    await deleteSubtask({ token, issueId: id, subtaskId: sub.id });
  };

  const handleEditSave = async () => {
    await updateIssue({
      token,
      issueId: id,
      title: editForm.title,
      description: editForm.description,
      status: editForm.status,
      priority: editForm.priority,
      categoryId: editForm.categoryId || undefined,
      assignedTo: editForm.assignedTo || undefined,
      address: editForm.address || undefined,
      lat: editForm.lat ?? undefined,
      lng: editForm.lng ?? undefined,
    });
    setEditModal(false);
  };

  const openEdit = () => {
    setEditForm({
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      categoryId: issue.categoryId || '',
      districtId: issue.districtId || '',
      streetId: issue.streetId || '',
      assignedTo: issue.assignedTo || '',
      address: issue.address || '',
      lat: issue.lat ?? null,
      lng: issue.lng ?? null,
    });
    setEditModal(true);
  };

  const statusOptions = [
    { value: 'created',     label: '🔵 Created' },
    { value: 'in_progress', label: '🟡 In Progress' },
    ...(canCloseIssues ? [{ value: 'closed', label: '⚫ Closed' }] : []),
  ];

  const completedSubtasks = (issue.subtasks || []).filter(s => s.completed).length;
  const totalSubtasks = (issue.subtasks || []).length;

  return (
    <div className="slide-up">
      {/* Back + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/issues')}>← Back</button>
        <div style={{ flex: 1 }} />
        <select className="form-control" style={{ width: 'auto', minWidth: 160 }}
          value={issue.status} onChange={e => handleStatusChange(e.target.value)}>
          {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={openEdit}>✏️ Edit</button>
      </div>

      {/* Title row */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          {cat && <span className="tag">{cat.icon} {cat.name}</span>}
          <StatusBadge status={issue.status} size="lg" />
          <PriorityBadge priority={issue.priority} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>{issue.title}</h1>
        {issue.description && (
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
            {issue.description}
          </p>
        )}
      </div>

      <div className="detail-grid">
        {/* Main column */}
        <div>
          {/* Subtasks */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 700 }}>
                ✅ Subtasks
                {totalSubtasks > 0 && (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                )}
              </div>
              {canManageSubtasks && (
                <button className="btn btn-secondary btn-sm" onClick={() => setSubtaskModal(true)}>＋ Add</button>
              )}
            </div>
            {totalSubtasks > 0 && (
              <div className="progress-bar" style={{ marginBottom: 12 }}>
                <div className="progress-fill" style={{ width: `${(completedSubtasks/totalSubtasks)*100}%` }} />
              </div>
            )}
            {(issue.subtasks || []).length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                No subtasks yet{canManageSubtasks ? '. Add one to track progress.' : '.'}
              </div>
            ) : (
              (issue.subtasks || []).map(sub => (
                <div key={sub.id} className="subtask-item">
                  <div
                    className={`subtask-check ${sub.completed ? 'done' : ''}`}
                    onClick={() => toggleSubtask({ token, issueId: id, subtaskId: sub.id })}
                  >
                    {sub.completed && <span style={{ color: 'white', fontSize: 11 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className={`subtask-title ${sub.completed ? 'done' : ''}`}>{sub.title}</div>
                    {sub.assignedName && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>👤 {sub.assignedName}</div>
                    )}
                  </div>
                  {sub.completed && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>
                      {timeAgo(sub.completedAt)}
                    </span>
                  )}
                  {canManageSubtasks && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 7px', fontSize: 13 }}
                        title="Edit subtask"
                        onClick={() => openEditSubtask(sub)}
                      >✏️</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 7px', fontSize: 13, color: 'var(--status-critical)' }}
                        title="Delete subtask"
                        onClick={() => handleDeleteSubtask(sub)}
                      >🗑️</button>
                    </div>
                  )}
                </div>
              ))
            )}

          </div>

          {/* Notes / Activity */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14 }}>💬 Notes & Activity</div>

            {/* Add note */}
            <div style={{ marginBottom: 16 }}>
              <textarea className="form-control" rows={3}
                placeholder="Add a note, update, or observation..."
                value={noteText} onChange={e => setNoteText(e.target.value)} />
              {pendingFile && (
                <div className="alert alert-info" style={{ marginTop: 8 }}>
                  📎 {pendingFile.name} ({(pendingFile.size / 1024).toFixed(0)} KB)
                  <button className="btn btn-ghost btn-sm" onClick={() => setPendingFile(null)} style={{ marginLeft: 'auto' }}>✕</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="file" ref={fileRef} onChange={handleFileSelect} accept="image/*,video/*,.pdf,.doc,.docx" />
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  📎 Attach File
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleAddNote}
                  disabled={noteLoading || (!noteText.trim() && !pendingFile)}>
                  {noteLoading ? (uploading ? 'Uploading...' : 'Adding...') : 'Add Note'}
                </button>
              </div>
            </div>

            {/* Notes list */}
            <div className="note-list">
              {(issue.notes || []).length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
                  No notes yet. Add the first update above.
                </div>
              ) : (
                [...(issue.notes || [])].reverse().map((note, i) => (
                  <NoteItem key={i} note={note} token={token} roleColorMap={roleColorMap} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar column */}
        <div>
          {/* Issue Details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>📋 Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="detail-label">District</div>
                <div className="detail-value">{district?.name || district?.code || '—'}</div>
              </div>
              {issue.address && (
                <div>
                  <div className="detail-label">Address</div>
                  <div className="detail-value">📍 {issue.address}</div>
                </div>
              )}
              <div>
                <div className="detail-label">Reported By</div>
                <div className="detail-value">{reporter?.name || 'Unknown'}</div>
              </div>
              <div>
                <div className="detail-label">Assigned To</div>
                <div className="detail-value">{assignedUser?.name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</div>
              </div>
              <div>
                <div className="detail-label">Created</div>
                <div className="detail-value">{new Date(issue.createdAt).toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div>
                <div className="detail-label">Last Updated</div>
                <div className="detail-value">{timeAgo(issue.updatedAt)}</div>
              </div>
              {issue.notes?.length > 0 && (
                <div>
                  <div className="detail-label">Notes</div>
                  <div className="detail-value">{issue.notes.length}</div>
                </div>
              )}
              {issue.lat != null && issue.lng != null && (
                <div>
                  <div className="detail-label">GIS Coordinates</div>
                  <div className="detail-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {issue.lat}, {issue.lng}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Minimap — only if coords are set */}
          {issue.lat != null && issue.lng != null && (
            <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px 8px', fontWeight: 700, fontSize: 13 }}>📍 Pinned Location</div>
              <div style={{ height: 180, position: 'relative' }}>
                <MapContainer
                  center={[issue.lat, issue.lng]}
                  zoom={16}
                  style={{ height: '100%', width: '100%' }}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  zoomControl={false}
                  touchZoom={false}
                  keyboard={false}
                  attributionControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <CircleMarker
                    center={[issue.lat, issue.lng]}
                    radius={9}
                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.85, weight: 2 }}
                  />
                </MapContainer>
              </div>
              <div style={{ padding: '6px 14px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                  {issue.lat}, {issue.lng}
                </span>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${issue.lat}&mlon=${issue.lng}&zoom=17`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: 'var(--blue-600)', textDecoration: 'none' }}
                >↗ Open map</a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subtask Modal */}
      <Modal isOpen={subtaskModal} onClose={() => setSubtaskModal(false)} title="Add Subtask">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Subtask Title *</label>
            <input className="form-control" placeholder="What needs to be done?"
              value={subtaskTitle} onChange={e => setSubtaskTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Assign To (Optional)</label>
            <select className="form-control" value={subtaskAssignee}
              onChange={e => setSubtaskAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {(users || []).filter(u => u.active).map(u => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <ModalFooter>
          <button className="btn btn-secondary" onClick={() => setSubtaskModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddSubtask}>Add Subtask</button>
        </ModalFooter>
      </Modal>

      {/* Edit Subtask Modal */}
      <Modal isOpen={editSubtaskModal} onClose={() => setEditSubtaskModal(false)} title="Edit Subtask">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Subtask Title *</label>
            <input className="form-control" placeholder="What needs to be done?"
              value={editSubtaskTitle} onChange={e => setEditSubtaskTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Assign To (Optional)</label>
            <select className="form-control" value={editSubtaskAssignee}
              onChange={e => setEditSubtaskAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {(users || []).filter(u => u.active).map(u => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <ModalFooter>
          <button className="btn btn-secondary" onClick={() => setEditSubtaskModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEditSubtaskSave}
            disabled={!editSubtaskTitle.trim()}>Save Changes</button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Issue" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-control" value={editForm.title || ''}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={3} value={editForm.description || ''}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Status + Priority */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status
                {!canCloseIssues && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>(🔒 Closing requires PHI III or MOH)</span>}
              </label>
              <select className="form-control" value={editForm.status || ''}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-control" value={editForm.priority || ''}
                onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
                <option value="urgent">🚨 Urgent</option>
              </select>
            </div>
          </div>

          {/* Category + Assign */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={editForm.categoryId || ''}
                onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value }))}>
                <option value="">Select category</option>
                {(categories || []).filter(c => c.active).map(c => (
                  <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assign To</label>
              <select className="form-control" value={editForm.assignedTo || ''}
                onChange={e => setEditForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">Unassigned</option>
                {(users || []).filter(u => u.active).map(u => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div className="form-group">
            <label className="form-label">Address / Landmark</label>
            <input className="form-control" value={editForm.address || ''}
              onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
              placeholder="e.g. 45 Erin Road, near the market" />
          </div>

          {/* Location map */}
          <div className="form-group">
            <label className="form-label">
              📍 Pin Location
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>
                Click the map to move the pin
              </span>
            </label>
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', height: 240 }}>
              <MapContainer
                key={editModal ? 'open' : 'closed'}
                center={[
                  editForm.lat ?? 10.6918,
                  editForm.lng ?? -61.2225,
                ]}
                zoom={editForm.lat != null ? 15 : 10}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onPin={(latlng) => setEditForm(f => ({
                  ...f,
                  lat: parseFloat(latlng.lat.toFixed(6)),
                  lng: parseFloat(latlng.lng.toFixed(6)),
                }))} />
                {editForm.lat != null && editForm.lng != null && (
                  <Marker position={[editForm.lat, editForm.lng]} />
                )}
              </MapContainer>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 6,
              padding: '7px 12px',
              background: editForm.lat != null ? '#eff6ff' : 'var(--surface-hover)',
              border: `1px solid ${editForm.lat != null ? '#bfdbfe' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)', fontSize: 12.5,
            }}>
              {editForm.lat != null ? (
                <>
                  <span style={{ color: '#2563eb', fontWeight: 700 }}>📍 Pinned</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    Lat: <strong>{editForm.lat}</strong>
                  </span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    Long: <strong>{editForm.lng}</strong>
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm"
                    style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px' }}
                    onClick={() => setEditForm(f => ({ ...f, lat: null, lng: null }))}
                  >✕ Clear pin</button>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No pin set — click the map to add one</span>
              )}
            </div>
          </div>
        </div>

        <ModalFooter>
          <button className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEditSave}>Save Changes</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function NoteItem({ note, token, roleColorMap = {} }) {
  const fileUrl = useQuery(
    api.issues.getFileUrl,
    note.storageId ? { storageId: note.storageId } : 'skip'
  );
  const resolvedUrl = fileUrl || note.mediaUrl || null;
  const isImage = note.mediaType?.startsWith('image/') || note.mediaType === 'image';
  const isVideo = note.mediaType?.startsWith('video/') || note.mediaType === 'video';
  const isDoc   = note.mediaType === 'application/pdf' || note.mediaType?.includes('document') || note.mediaType?.includes('word') || note.mediaType === 'document';

  const roleColor = note.authorRole ? (roleColorMap[note.authorRole] || null) : null;
  const avatarStyle = roleColor
    ? { background: roleColor }
    : {};

  return (
    <div className="note-item">
      <div className="note-header">
        <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 10, ...avatarStyle }}>
          {note.authorName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
        </div>
        <span className="note-author" style={roleColor ? { color: roleColor } : {}}>{note.authorName}</span>
        {note.authorRole && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px',
            borderRadius: 10, background: roleColor ? `${roleColor}18` : 'var(--surface-hover)',
            color: roleColor || 'var(--text-muted)',
            border: `1px solid ${roleColor ? `${roleColor}35` : 'var(--border)'}`,
          }}>{note.authorRole}</span>
        )}
        <span className="note-time" style={{ marginLeft: 'auto' }}>{new Date(note.timestamp).toLocaleDateString('en-TT', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        })}</span>
      </div>
      {note.text && <div className="note-text">{note.text}</div>}

      {resolvedUrl && isImage && (
        <ImageThumbnail url={resolvedUrl} name={note.mediaName} />
      )}
      {resolvedUrl && isVideo && (
        <video src={resolvedUrl} controls style={{ width: '100%', borderRadius: 8, marginTop: 10 }} />
      )}
      {resolvedUrl && (isDoc || (!isImage && !isVideo && note.mediaName)) && (
        <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10,
          padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 13,
          textDecoration: 'none', transition: 'background 0.15s',
        }}>
          📄 {note.mediaName || 'View Document'}
        </a>
      )}
    </div>
  );
}

function ImageThumbnail({ url, name }) {
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      {/* Thumbnail */}
      <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => setLightbox(true)}
          title="Click to view full size"
          style={{
            width: 80, height: 80, flexShrink: 0,
            borderRadius: 8, overflow: 'hidden',
            border: '1.5px solid var(--border)',
            cursor: 'zoom-in',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.22)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'; }}
        >
          <img src={url} alt={name || 'Attachment'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        {name && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 160, wordBreak: 'break-all', lineHeight: 1.5 }}>
            🖼️ {name}<br />
            <span
              style={{ color: 'var(--blue-600)', cursor: 'pointer', textDecoration: 'underline', fontSize: 10 }}
              onClick={() => setLightbox(true)}
            >View full size</span>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <img
              src={url}
              alt={name || 'Attachment'}
              style={{
                maxWidth: '90vw', maxHeight: '90vh',
                objectFit: 'contain', borderRadius: 10,
                boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
                display: 'block',
              }}
            />
            <button
              onClick={() => setLightbox(false)}
              style={{
                position: 'absolute', top: -14, right: -14,
                width: 32, height: 32, borderRadius: '50%',
                background: 'white', border: 'none', cursor: 'pointer',
                fontSize: 16, fontWeight: 700, color: '#111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >✕</button>
            {name && (
              <div style={{ marginTop: 10, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                {name}
              </div>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', marginTop: 6, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 11, textDecoration: 'underline' }}
            >Open original ↗</a>
          </div>
        </div>
      )}
    </>
  );
}
