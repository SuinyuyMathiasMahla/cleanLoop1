import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Clock, TrendingUp, CheckCircle, RefreshCw, ArrowRight, Users, MapPin,
} from 'lucide-react';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { useReportStore } from '../store/reportStore';
import { ReportMap, MapLegend } from '../components/map/ReportMap';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageLoader } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';
import { tasksApi, crewApi } from '../services/api';
import clsx from 'clsx';

const TYPE_ICONS: Record<string, string> = {
  overflow: '🗑️',
  illegal_dumping: '⚠️',
  dumping: '⚠️',
  damaged_bin: '🔧',
  missed_collection: '📋',
};

const STATUS_META = [
  { key: 'pending', label: 'Pending', color: 'bg-amber-400' },
  { key: 'assigned', label: 'Assigned', color: 'bg-blue-500' },
  { key: 'in_progress', label: 'In progress', color: 'bg-orange-500' },
  { key: 'resolved', label: 'Resolved', color: 'bg-emerald-500' },
] as const;

/** Parse a value into a valid Date, or return null if it is missing/invalid. */
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

/** Short id like "A1B2C3" - never throws if the id is missing. */
const shortId = (id?: string) => (id ? id.slice(-6).toUpperCase() : '------');

const initialsOf = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

const rateColor = (rate: number) =>
  rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400';

export function DashboardPage() {
  const { reports, isLoading, fetchReports, setSelectedReport } = useReportStore();
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [crewRecords, setCrewRecords] = useState<any[]>([]);
  const [crewLoading, setCrewLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setCrewLoading(true);
    try {
      const [, tasksResponse, crewResponse] = await Promise.all([
        fetchReports(),
        tasksApi.list({ limit: 500 }),
        crewApi.list(),
      ]);
      const tasks = tasksResponse.data.tasks ?? [];
      const crew = crewResponse.data.crew ?? [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      setCrewRecords(
        crew.map((member: any) => {
          const completed = tasks.filter((task: any) => {
            const assignees = [...(task.crewIds ?? []), task.crewLeadId].filter(Boolean);
            const doneAt = toValidDate(task.completedAt ?? task.updatedAt);
            return (
              task.status === 'completed' &&
              assignees.includes(member.crewId) &&
              doneAt !== null &&
              doneAt >= monthStart
            );
          });
          const onTime = completed.filter((task: any) => {
            const due = toValidDate(task.dueAt);
            const doneAt = toValidDate(task.completedAt ?? task.updatedAt);
            return due !== null && doneAt !== null && doneAt <= due;
          });
          return {
            ...member,
            monthlyCompleted: completed.length,
            monthlyOnTimeRate: completed.length ? Math.round((onTime.length / completed.length) * 100) : 0,
          };
        })
      );
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setCrewLoading(false);
      setLastRefreshed(new Date());
    }
  };

  // Reports with a missing/invalid date sort to the bottom instead of breaking the page
  const timeOf = (value?: string) => toValidDate(value)?.getTime() ?? 0;
  const recentReports = [...reports]
    .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt))
    .slice(0, 10);

  const total = reports.length;
  const statusCounts = STATUS_META.map((meta) => ({
    ...meta,
    count: reports.filter((r) => r.status === meta.key).length,
  }));
  const countOf = (key: string) => statusCounts.find((s) => s.key === key)?.count ?? 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const sortedCrew = [...crewRecords].sort(
    (a, b) => (b.monthlyCompleted ?? 0) - (a.monthlyCompleted ?? 0)
  );

  const statCards = [
    {
      label: 'Total reports',
      value: total,
      hint: 'All time',
      icon: FileText,
      tint: 'bg-slate-100 text-slate-600',
    },
    {
      label: 'Pending',
      value: countOf('pending'),
      hint: total ? `${pct(countOf('pending'))}% need a crew` : 'Waiting for a crew',
      icon: Clock,
      tint: 'bg-amber-100 text-amber-700',
    },
    {
      label: 'In progress',
      value: countOf('in_progress'),
      hint: `${countOf('assigned')} assigned, not started`,
      icon: TrendingUp,
      tint: 'bg-orange-100 text-orange-700',
    },
    {
      label: 'Resolved',
      value: countOf('resolved'),
      hint: total ? `${pct(countOf('resolved'))}% of all reports` : 'Cleaned up',
      icon: CheckCircle,
      tint: 'bg-emerald-100 text-emerald-700',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-gray-400">
            Updated {formatDistanceToNow(lastRefreshed)} ago
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', card.tint)}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
              </div>
              {isLoading ? (
                <>
                  <div className="skeleton h-9 w-16 rounded mt-4" />
                  <div className="skeleton h-3 w-28 rounded mt-3" />
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold tracking-tight text-gray-900 mt-3 tabular-nums">{card.value}</p>
                  <p className="text-xs text-gray-400 mt-1.5">{card.hint}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Status breakdown + crew performance */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Breakdown */}
        <section className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900">Where reports stand</h2>
          <p className="text-xs text-gray-400 mt-0.5">Share of {total} report{total === 1 ? '' : 's'} by status</p>

          <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
            {!isLoading &&
              total > 0 &&
              statusCounts.map((s) =>
                s.count > 0 ? (
                  <div
                    key={s.key}
                    className={clsx('h-full', s.color)}
                    style={{ width: `${(s.count / total) * 100}%` }}
                    title={`${s.label}: ${s.count}`}
                  />
                ) : null
              )}
          </div>

          <ul className="mt-5 space-y-3">
            {statusCounts.map((s) => (
              <li key={s.key} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2.5 text-gray-600">
                  <span className={clsx('h-2.5 w-2.5 rounded-full', s.color)} />
                  {s.label}
                </span>
                <span className="tabular-nums text-gray-900 font-semibold">
                  {isLoading ? '-' : s.count}
                  <span className="ml-2 text-xs font-normal text-gray-400">{isLoading ? '' : `${pct(s.count)}%`}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Crew performance */}
        <section className="xl:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Crew performance</h2>
            </div>
            <span className="text-xs text-gray-400">{format(new Date(), 'MMMM yyyy')}</span>
          </div>

          {crewLoading ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-1/3 rounded" />
                    <div className="skeleton h-2 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedCrew.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500 text-center">Crew monthly records will appear here.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sortedCrew.map((member) => {
                const hasWork = member.monthlyCompleted > 0;
                return (
                  <li key={member.crewId} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center text-xs font-bold">
                      {initialsOf(member.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="shrink-0 text-xs text-gray-500">
                          <span className="font-semibold text-gray-900 tabular-nums">{member.monthlyCompleted}</span> completed
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={clsx('h-full rounded-full', hasWork ? rateColor(member.monthlyOnTimeRate) : 'bg-gray-200')}
                            style={{ width: `${hasWork ? member.monthlyOnTimeRate : 0}%` }}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right text-xs text-gray-500 tabular-nums">
                          {hasWork ? `${member.monthlyOnTimeRate}% on time` : 'No tasks yet'}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Map + recent reports */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Map */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Live map</h2>
            </div>
            <Link to="/reports" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              All reports <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="relative" style={{ height: '420px' }}>
            {isLoading ? (
              <PageLoader />
            ) : (
              <>
                <ReportMap reports={reports} onViewReport={setSelectedReport} />
                <MapLegend />
              </>
            )}
          </div>
        </div>

        {/* Recent reports */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent reports</h2>
            <span className="text-xs text-gray-400">{recentReports.length} latest</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100" style={{ maxHeight: '420px' }}>
            {isLoading ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-4 rounded w-3/4" />
                      <div className="skeleton h-3 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentReports.length === 0 ? (
              <EmptyState title="No reports yet" description="Reports submitted by citizens will appear here." />
            ) : (
              recentReports.map((report) => (
                <button
                  type="button"
                  key={report.reportId}
                  className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center text-base">
                      {TYPE_ICONS[report.type] || '📍'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{report.address}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        #{shortId(report.reportId)} · {safeAgo(report.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={report.status} />
                  </div>
                </button>
              ))
            )}
          </div>
          {recentReports.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <Link to="/reports" className="text-sm text-primary-600 hover:underline flex items-center justify-center gap-1">
                View all reports <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
