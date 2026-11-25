import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  RefreshCw,
  Search,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { crewApi, reportsApi, tasksApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';

type TaskRecord = {
  taskId: string;
  title: string;
  description?: string;
  status: string;
  reportIds?: string[];
  crewLeadId?: string;
  crewIds?: string[];
  crewMemberIds?: string[];
  companionAttendance?: { userId: string; name: string; present: boolean; markedAt: string }[];
  scheduledAt?: string;
  dueAt?: string;
  createdAt?: string;
  completedAt?: string;
};

type ReportRecord = {
  reportId: string;
  type?: string;
  address?: string;
  status?: string;
  submitterName?: string;
  createdAt?: string;
};

type CrewRecord = {
  crewId: string;
  name: string;
  email?: string;
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return isValid(date) ? format(date, 'MMM d, yyyy · HH:mm') : '—';
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

async function fetchAllTasks() {
  const tasks: TaskRecord[] = [];
  const seenCursors = new Set<string>();
  let lastKey: string | undefined;

  do {
    const { data } = await tasksApi.list({ limit: 500, ...(lastKey ? { lastKey } : {}) });
    tasks.push(...(data.tasks ?? []));
    const nextKey = data.nextKey as string | null | undefined;
    if (nextKey && seenCursors.has(nextKey))
      throw new Error('Task pagination returned a repeated cursor.');
    if (nextKey) seenCursors.add(nextKey);
    lastKey = nextKey ?? undefined;
  } while (lastKey);

  return tasks;
}

async function fetchAllReports() {
  const reports: ReportRecord[] = [];
  const seenCursors = new Set<string>();
  let lastKey: string | undefined;

  do {
    const { data } = await reportsApi.list({ limit: 500, ...(lastKey ? { lastKey } : {}) });
    reports.push(...(data.reports ?? []));
    const nextKey = data.nextKey as string | null | undefined;
    if (nextKey && seenCursors.has(nextKey))
      throw new Error('Report pagination returned a repeated cursor.');
    if (nextKey) seenCursors.add(nextKey);
    lastKey = nextKey ?? undefined;
  } while (lastKey);

  return reports;
}

export function TaskRecordsPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [crew, setCrew] = useState<CrewRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [taskItems, reportItems, crewResponse] = await Promise.all([
        fetchAllTasks(),
        fetchAllReports(),
        crewApi.list(),
      ]);
      setTasks(taskItems);
      setReports(reportItems);
      setCrew(crewResponse.data.crew ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load task records.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const reportsById = useMemo(
    () => new Map(reports.map((report) => [report.reportId, report])),
    [reports],
  );
  const crewById = useMemo(() => new Map(crew.map((member) => [member.crewId, member])), [crew]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...tasks]
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? b.scheduledAt ?? 0).getTime() -
          new Date(a.createdAt ?? a.scheduledAt ?? 0).getTime(),
      )
      .filter((task) => statusFilter === 'all' || task.status === statusFilter)
      .filter((task) => {
        if (!query) return true;
        const linkedReports = (task.reportIds ?? [])
          .map((id) => reportsById.get(id))
          .filter(Boolean) as ReportRecord[];
        const companionNames = [...(task.crewIds ?? task.crewMemberIds ?? [])]
          .map((id) => crewById.get(id)?.name ?? id)
          .join(' ');
        const leadName = task.crewLeadId
          ? (crewById.get(task.crewLeadId)?.name ?? task.crewLeadId)
          : '';
        return [
          task.title,
          task.description,
          task.taskId,
          leadName,
          companionNames,
          ...linkedReports.flatMap((report) => [
            report.address,
            report.submitterName,
            report.type,
            report.reportId,
          ]),
        ].some((value) => value?.toLowerCase().includes(query));
      });
  }, [tasks, reportsById, crewById, statusFilter, search]);

  const completedCount = tasks.filter((task) => task.status === 'completed').length;
  const linkedReportCount = tasks.reduce((count, task) => count + (task.reportIds?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Task Records</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review submitted reports, task timing, and the crew assigned to each cleanup.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => void loadData()}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void loadData()}>
            Try again
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Tasks"
          value={tasks.length}
        />
        <SummaryCard
          icon={<FileText className="h-5 w-5" />}
          label="Linked reports"
          value={linkedReportCount}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Completed tasks"
          value={completedCount}
        />
      </div>

      <section className="overflow-hidden border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Cleanup activity</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {rows.length} task{rows.length === 1 ? '' : 's'} shown
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reports, people, tasks"
                aria-label="Search task records"
                className="w-full border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 sm:w-64"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter task status"
              className="border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            >
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title={
              search || statusFilter !== 'all' ? 'No matching task records' : 'No task records yet'
            }
            description={
              search || statusFilter !== 'all'
                ? 'Try another search or status filter.'
                : 'Created tasks and their linked report details will appear here.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Task
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Submitted report(s)
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Crew head
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Companions
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Schedule
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((task) => {
                  const linkedReports = (task.reportIds ?? [])
                    .map((reportId) => reportsById.get(reportId))
                    .filter(Boolean) as ReportRecord[];
                  const companionIds = [
                    ...new Set(task.crewIds ?? task.crewMemberIds ?? []),
                  ].filter((id) => id !== task.crewLeadId);
                  const lead = task.crewLeadId ? crewById.get(task.crewLeadId) : undefined;
                  const attendanceById = new Map(
                    (task.companionAttendance ?? []).map((item) => [item.userId, item]),
                  );

                  return (
                    <tr key={task.taskId} className="align-top hover:bg-gray-50/60">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {task.title || 'Cleanup task'}
                        </p>
                        {task.description && (
                          <p className="mt-1 max-w-[220px] truncate text-xs text-gray-500">
                            {task.description}
                          </p>
                        )}
                        <p className="mt-1 font-mono text-[10px] text-gray-400">
                          #{task.taskId.slice(-8).toUpperCase()}
                        </p>
                      </td>
                      <td className="max-w-[360px] px-5 py-4">
                        {linkedReports.length ? (
                          <div className="space-y-3">
                            {linkedReports.map((report) => (
                              <div
                                key={report.reportId}
                                className="border-l-2 border-primary-200 pl-3"
                              >
                                <p className="truncate font-medium text-gray-800">
                                  {report.address ||
                                    report.type?.replace(/_/g, ' ') ||
                                    `Report #${report.reportId.slice(-6)}`}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-500">
                                  Submitted by{' '}
                                  <span className="font-medium text-gray-700">
                                    {report.submitterName || 'Community member'}
                                  </span>
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-400">
                                  {formatDate(report.createdAt)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No linked report</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {lead ? (
                          <CrewPerson
                            name={lead.name || lead.email || task.crewLeadId || 'Crew member'}
                            email={lead.email}
                            label="Lead"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">
                            {task.crewLeadId || 'Not assigned'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {companionIds.length ? (
                          <div className="space-y-2">
                            {companionIds.map((id) => {
                              const member = crewById.get(id);
                              const attendance = attendanceById.get(id);
                              return (
                                <div key={id}>
                                  <CrewPerson
                                    name={attendance?.name || member?.name || member?.email || id}
                                    email={member?.email}
                                  />
                                  <span
                                    className={`ml-10 mt-0.5 inline-block text-[10px] font-semibold ${attendance ? (attendance.present ? 'text-emerald-700' : 'text-red-600') : 'text-gray-400'}`}
                                  >
                                    {attendance
                                      ? attendance.present
                                        ? 'Present'
                                        : 'Absent'
                                      : task.status === 'completed'
                                        ? 'Attendance not recorded'
                                        : 'Attendance pending'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No companions recorded</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-600">
                        <p className="flex items-center gap-1.5 whitespace-nowrap">
                          <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                          {formatDate(task.scheduledAt)}
                        </p>
                        <p className="mt-2 flex items-center gap-1.5 whitespace-nowrap">
                          <Clock3 className="h-3.5 w-3.5 text-gray-400" />
                          Due {formatDate(task.dueAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={task.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center bg-primary-50 text-primary-700">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function CrewPerson({ name, email, label }: { name: string; email?: string; label?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary-50 text-[11px] font-bold text-primary-700">
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-gray-800">{name}</span>
        {label && (
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {label}
          </span>
        )}
        {email && (
          <span className="block max-w-[180px] truncate text-[10px] text-gray-400">{email}</span>
        )}
      </span>
    </div>
  );
}
