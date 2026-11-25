import React from 'react';
import {
  AlertTriangle,
  ClipboardList,
  MapPin,
  Trash2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  overflow: Trash2,
  illegal_dumping: AlertTriangle,
  dumping: AlertTriangle,
  damaged_bin: Wrench,
  missed_collection: ClipboardList,
};

interface Props {
  type: string;
  className?: string;
}

/** Icon for a report type; the project uses icons, never emoji, in UI text. */
export function ReportTypeIcon({ type, className = 'w-4 h-4 text-gray-600' }: Props) {
  const Icon = ICONS[type] ?? MapPin;
  return <Icon className={className} aria-hidden="true" />;
}
