import React, { useEffect, useState } from 'react';
import {
  Search, Download, ChevronLeft, ChevronRight,
  Eye, AlertCircle, Image, MapPin, User, Calendar, Trash2
} from 'lucide-react';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { useReportStore, Report, ReportStatus } from '../store/reportStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/LoadingSpinner';
import { useDebounce } from '../hooks/useDebounce';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'overflow', label: 'Overflow Bin' },
  { value: 'illegal_dumping', label: 'Illegal Dumping' },
  { value: 'damaged_bin', label: 'Damaged Bin' },
  { value: 'missed_collection', label: 'Missed Collection' },
];

const TYPE_LABELS: Record<string, string> = {
  overflow: 'Overflow Bin',
  illegal_dumping: '⚠️ Illegal Dumping',
  dumping: '⚠️ Illegal Dumping',
  damaged_bin: '🔧 Damaged Bin',
  missed_collection: '📋 Missed Collection',
};

const COLUMN_COUNT = 5;

const TYPE_META: Record<string, { icon: string; label: string; tint: string }> = {
  overflow: { icon: '🗑️', label: 'Overflow bin', tint: 'bg-amber-50' },
  illegal_dumping: { icon: '⚠️', label: 'Illegal dumping', tint: 'bg-red-50' },
  dumping: { icon: '⚠️', label: 'Illegal dumping', tint: 'bg-red-50' },
  damaged_bin: { icon: '🔧', label: 'Damaged bin', tint: 'bg-slate-100' },
  missed_collection: { icon: '📋', label: 'Missed collection', tint: 'bg-blue-50' },
};
const typeMeta = (t: string) => TYPE_META[t] ?? { icon: '📍', label: t, tint: 'bg-gray-100' };

/** Name of the crew member a report is assigned to (falls back to id / legacy field). */
const getAssigneeName = (r: Report): string | null =>
  r.assignedCrewName || r.assignedCrewId || r.assignedTo || null;

/** Parse a value into a valid Date, or null if it is missing/invalid. */
const toValidDate = (value?: string | number | Date | null): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? d : null;
};

/** "3 hours ago" - never throws on a bad date. */
const safeAgo = (value?: string | number | Date | null): string => {
  const d = toValidDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : 'date unknown';
};

/** Formatted date - never throws on a bad date. */
const safeFormat = (value: string | number | Date | null | undefined, pattern: string): string => {
  const d = toValidDate(value);
  return d ? format(d, pattern) : 'date unknown';
};

export function ReportsPage() {
  const {
    reports, total, isLoading, filters,
    fetchReports, updateStatus, deleteReport, setFilters, setSelectedReport, selectedReport
  } = useReportStore();

  const [search, setSearch] = useState('');
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined, page: 1 });
  }, [debouncedSearch]);

  useEffect(() => {
    fetchReports();
  }, [filters]);

  useEffect(() => {
    if (selectedReport) {
      setViewReport(selectedReport);
      setSelectedReport(null);
    }
  }, [selectedReport]);

  // If the API doesn't return a total, fall back to the number of rows loaded
  const displayTotal = total || reports.length;
  const totalPages = Math.ceil(displayTotal / filters.limit);

  const handleStatusChange = async (reportId: string, status: ReportStatus) => {
    setStatusUpdating(reportId);
    setStatusError(null);
    try {
      await updateStatus(reportId, status);
    } catch {
      setStatusError('Failed to update status');
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleDeleteReport = async (report: Report) => {
    const confirmed = window.confirm('Delete this report and its uploaded image? This cannot be undone.');
    if (!confirmed) return;
    setDeletingReportId(report.reportId);
    setStatusError(null);
    try {
      await deleteReport(report.reportId);
      if (viewReport?.reportId === report.reportId) setViewReport(null);
    } catch {
      setStatusError('Failed to delete the report and its uploaded image. Please try again.');
    } finally {
      setDeletingReportId(null);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Type', 'Address', 'Status', 'Submitted', 'Assigned To'].join(','),
      ...reports.map((r) =>
        [r.type, `"${r.address}"`, r.status, r.createdAt, `"${getAssigneeName(r) || ''}"`].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleanloop-reports-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">{displayTotal} total reports</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Download className="w-4 h-4" />}
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((o) => {
            const active = (filters.status || '') === o.value;
            return (
              <button
                key={o.value || 'all'}
                type="button"
                onClick={() => setFilters({ status: o.value || undefined, page: 1 })}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {o.value ? o.label : 'All'}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by address, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="w-44">
            <Select
              options={TYPE_OPTIONS}
              value={filters.type || ''}
              onChange={(e) => setFilters({ type: e.target.value || undefined, page: 1 })}
              placeholder="Type"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="rounded-lg border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters({ dateFrom: e.target.value || undefined, page: 1 })}
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              className="rounded-lg border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.dateTo || ''}
              onChange={(e) => setFilters({ dateTo: e.target.value || undefined, page: 1 })}
            />
          </div>
          {(filters.status || filters.type || filters.search || filters.dateFrom) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setFilters({ status: undefined, type: undefined, search: undefined, dateFrom: undefined, dateTo: undefined, page: 1 });
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {statusError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          {statusError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Address</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Submitted</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={COLUMN_COUNT}>
                    <TableSkeleton rows={8} cols={COLUMN_COUNT} />
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_COUNT}>
                    <EmptyState title="No reports found" description="Try adjusting your filters." />
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.reportId} className="table-row-hover hover:bg-gray-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-base ${typeMeta(report.type).tint}`}>
                          {typeMeta(report.type).icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{typeMeta(report.type).label}</p>
                          <p className="text-xs text-gray-400 tabular-nums">#{(report.reportId || '').slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 max-w-[240px]">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">{report.address}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                      {safeAgo(report.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewReport(report)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <select
                          value={report.status}
                          disabled={statusUpdating === report.reportId}
                          onChange={(e) => handleStatusChange(report.reportId, e.target.value as ReportStatus)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white disabled:opacity-60"
                        >
                          <option value="pending">Pending</option>
                          <option value="assigned">Assigned</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <button
                          onClick={() => handleDeleteReport(report)}
                          disabled={deletingReportId === report.reportId}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete report and uploaded image"
                          aria-label="Delete report and uploaded image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page {filters.page} of {totalPages} · {displayTotal} results
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ page: filters.page - 1 })}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters({ page: filters.page + 1 })}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      {viewReport && (
        <Modal
          isOpen={!!viewReport}
          onClose={() => setViewReport(null)}
          title={`Report #${(viewReport.reportId || '').slice(-8).toUpperCase()}`}
          size="lg"
        >
          <div className="space-y-5">
            {/* Status + type row */}
            <div className="flex items-center gap-3">
              <StatusBadge status={viewReport.status} size="md" />
              <span className="text-sm text-gray-600">{TYPE_LABELS[viewReport.type] || viewReport.type}</span>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={<MapPin className="w-4 h-4" />} label="Address" value={viewReport.address} />
              <InfoItem icon={<User className="w-4 h-4" />} label="Submitted by" value={viewReport.submittedBy} />
              <InfoItem
                icon={<Calendar className="w-4 h-4" />}
                label="Submitted"
                value={safeFormat(viewReport.createdAt, 'PPp')}
              />
              {getAssigneeName(viewReport) && (
                <InfoItem
                  icon={<User className="w-4 h-4" />}
                  label="Assigned to"
                  value={getAssigneeName(viewReport)!}
                />
              )}
              {viewReport.ward && (
                <InfoItem icon={<MapPin className="w-4 h-4" />} label="Ward" value={viewReport.ward} />
              )}
            </div>

            {/* Description */}
            {viewReport.description && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{viewReport.description}</p>
              </div>
            )}

            {/* Photo */}
            {viewReport.photoUrl && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Image className="w-3.5 h-3.5" /> Photo
                </p>
                <img
                  src={viewReport.photoUrl}
                  alt="Report photo"
                  className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Status update */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Update Status</p>
              <div className="flex items-center gap-3">
                <select
                  value={viewReport.status}
                  onChange={(e) => {
                    handleStatusChange(viewReport.reportId, e.target.value as ReportStatus);
                    setViewReport({ ...viewReport, status: e.target.value as ReportStatus });
                  }}
                  className="rounded-lg border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-sm text-gray-800">{value || '—'}</p>
    </div>
  );
}
