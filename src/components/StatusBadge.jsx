export const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
  critical: 'Critical',
  active: 'Active',
  expired: 'Expired',
  suspended: 'Suspended',
  revoked: 'Revoked',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const STATUS_DOTS = {
  open: '🔵',
  in_progress: '🔵',
  pending: '🟡',
  resolved: '🟢',
  closed: '⚪',
  critical: '🔴',
  active: '🟢',
  expired: '⚪',
  suspended: '🔴',
  revoked: '🔴',
  submitted: '🔵',
  under_review: '🔵',
  approved: '🟢',
  rejected: '🔴',
  cancelled: '⚪',
};

export default function StatusBadge({ status, size = 'sm' }) {
  const cls = `badge badge-${status}`;
  return (
    <span className={cls} style={size === 'lg' ? { fontSize: 13, padding: '5px 13px' } : {}}>
      {STATUS_DOTS[status] || '⚪'} {STATUS_LABELS[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const colors = {
    low: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
    medium: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    high: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    urgent: { bg: 'rgba(220,38,38,0.15)', color: '#dc2626', border: 'rgba(220,38,38,0.4)' },
  };
  const c = colors[priority] || colors.medium;
  return (
    <span className="badge" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      <span className={`priority-dot priority-${priority}`} />
      {priority?.charAt(0).toUpperCase() + priority?.slice(1)}
    </span>
  );
}
