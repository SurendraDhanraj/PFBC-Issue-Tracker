import { useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useAuth, useRoleCheck } from '../context/AuthContext';
import StatusBadge, { PriorityBadge } from '../components/StatusBadge';
import Modal, { ModalFooter } from '../components/Modal';

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

export default function IssueDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { canManageSubtasks, canCloseIssues, isAdmin } = useRoleCheck();
  const navigate = useNavigate();

  const issue = useQuery(api.issues.getIssue, { token, issueId: id });
  const categories = useQuery(api.categories.listCategories);
  const districts = useQuery(api.districts.listDistricts);
  const streets = useQuery(api.districts.listStreets, issue?.districtId ? { districtId: issue.districtId } : 'skip');
  const users = useQuery(api.users.listUsers, { token });

  const updateIssue = useMutation(api.issues.updateIssue);
  const addNote = useMutation(api.issues.addNote);
  const addSubtask = useMutation(api.issues.addSubtask);
  const toggleSubtask = useMutation(api.issues.toggleSubtask);
  const genUploadUrl = useMutation(api.issues.generateUploadUrl);

  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const fileRef = useRef();

  const [subtaskModal, setSubtaskModal] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssignee, setSubtaskAssignee] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});

  const catMap = Object.fromEntries((categories || []).map(c => [c._id, c]));
  const districtMap = Object.fromEntries((districts || []).map(d => [d._id, d]));

  if (!issue) return <div className="loading-center"><div className="loading-spinner" /></div>;

  const cat = catMap[issue.categoryId];
  const district = districtMap[issue.districtId];
  const assignedUser = (users || []).find(u => u._id === issue.assignedTo);
  const reporter = (users || []).find(u => u._id === issue.reportedBy);

  const handleStatusChange = async (status) => {
    await updateIssue({ token, issueId: id, status });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
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

  const handleEditSave = async () => {
    await updateIssue({ token, issueId: id, ...editForm });
    setEditModal(false);
  };

  const openEdit = () => {
    setEditForm({
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      assignedTo: issue.assignedTo || '',
      address: issue.address || '',
    });
    setEditModal(true);
  };

  const statusOptions = ['open', 'in_progress', 'pending', 'critical', 'resolved'];
  if (canCloseIssues) statusOptions.push('closed');

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
          {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
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
                  {sub.completed && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {timeAgo(sub.completedAt)}
                  </span>}
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
                  <NoteItem key={i} note={note} token={token} />
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
            </div>
          </div>
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

      {/* Edit Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Issue" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-control" value={editForm.title || ''}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={3} value={editForm.description || ''}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" value={editForm.status || ''}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-control" value={editForm.priority || ''}
                onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="form-row">
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
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-control" value={editForm.address || ''}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
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

function NoteItem({ note, token }) {
  const fileUrl = useQuery(
    api.issues.getFileUrl,
    note.storageId ? { storageId: note.storageId } : 'skip'
  );
  // Support both Convex storage (storageId) and static demo images (mediaUrl)
  const resolvedUrl = fileUrl || note.mediaUrl || null;
  const isImage = note.mediaType?.startsWith('image/');
  const isVideo = note.mediaType?.startsWith('video/');
  const isDoc   = note.mediaType === 'application/pdf' || note.mediaType?.includes('document') || note.mediaType?.includes('word');

  return (
    <div className="note-item">
      <div className="note-header">
        <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
          {note.authorName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
        </div>
        <span className="note-author">{note.authorName}</span>
        <span className="note-time">{new Date(note.timestamp).toLocaleDateString('en-TT', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        })}</span>
      </div>
      {note.text && <div className="note-text">{note.text}</div>}

      {/* Image attachment */}
      {resolvedUrl && isImage && (
        <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}
          onClick={() => window.open(resolvedUrl, '_blank')}>
          <img src={resolvedUrl} alt={note.mediaName || 'Attachment'}
            style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
          {note.mediaName && (
            <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)' }}>
              🖼️ {note.mediaName} · Click to open full size
            </div>
          )}
        </div>
      )}

      {/* Video attachment */}
      {resolvedUrl && isVideo && (
        <video src={resolvedUrl} controls style={{ width: '100%', borderRadius: 8, marginTop: 10 }} />
      )}

      {/* Document / PDF attachment */}
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
