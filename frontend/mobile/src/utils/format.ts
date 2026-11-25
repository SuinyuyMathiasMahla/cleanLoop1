export function timeAgo(dateString?: string): string {
  if (!dateString) return '';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export function initialsOf(name?: string, fallback = '?'): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function firstName(name?: string, fallback = 'there'): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || fallback;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const REPORT_TYPE_LABEL: Record<string, string> = {
  overflow_bin: 'Overflowing bin',
  overflow: 'Overflowing bin',
  bin_overflow: 'Overflowing bin',
  illegal_dumping: 'Illegal dumping',
  dumping: 'Illegal dumping',
  missed_collection: 'Missed collection',
  hazardous_waste: 'Hazardous waste',
  damaged_bin: 'Damaged bin',
  other: 'Other issue',
};

export function reportTypeLabel(type?: string): string {
  if (!type) return 'Waste report';
  return REPORT_TYPE_LABEL[type] ?? type.replace(/_/g, ' ');
}
