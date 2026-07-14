type Status =
  | 'published' | 'draft' | 'archived'
  | 'pending' | 'success' | 'failed' | 'refunded'
  | 'confirmed' | 'cancelled' | 'completed'
  | 'active' | 'suspended' | 'trial';

const MAP: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
  published:  { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Published' },
  active:     { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Active' },
  success:    { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Success' },
  confirmed:  { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Confirmed' },
  completed:  { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
  pending:    { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Pending' },
  trial:      { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Trial' },
  draft:      { bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400',    label: 'Draft' },
  archived:   { bg: 'bg-gray-100',    text: 'text-gray-500',    dot: 'bg-gray-400',    label: 'Archived' },
  failed:     { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500',     label: 'Failed' },
  cancelled:  { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500',     label: 'Cancelled' },
  suspended:  { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500',     label: 'Suspended' },
  refunded:   { bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-500',  label: 'Refunded' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status as Status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
