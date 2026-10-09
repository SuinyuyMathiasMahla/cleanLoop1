import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, Lock, RefreshCw, Users, ClipboardCheck,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { crewApi, tasksApi } from '../services/api';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/LoadingSpinner';

type CrewMember = {
  crewId: string;
  name: string;
  email: string;
  status: string;
};

type TaskRecord = {
  taskId: string;
  title: string;
  status: string;
  crewIds?: string[];
  crewMemberIds?: string[];
  crewLeadId?: string;
  reportIds?: string[];
  createdAt?: string;
  scheduledAt?: string;
  completedAt?: string;
  updatedAt?: string;
  dueAt?: string;
};

type CrewStats = {
  member: CrewMember;
  assigned: number;
  completed: number;
  reportsResolved: number;
  onTime: number;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthKey(new Date(year, monthNumber - 1 + delta, 1));
}

function dateForTask(task: TaskRecord, field: 'createdAt' | 'completedAt') {
  const value = field === 'completedAt' ? task.completedAt ?? task.updatedAt : task.createdAt ?? task.scheduledAt;
  const date = value ? new Date(value) : null;
  return date && isValid(date) ? date : null;
}

function isInMonth(date: Date | null, selectedMonth: string) {
  return !!date && monthKey(date) === selectedMonth;
}

function releaseDateFor(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 28);
}

function csvValue(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const initialsOf = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

const rateOf = (row: CrewStats) => (row.completed ? Math.round((row.onTime / row.completed) * 100) : 0);
const rateColor = (rate: number) => (rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400');

const RANK_STYLES = [
  'bg-amber-100 text-amber-700',
  'bg-slate-200 text-slate-600',
  'bg-orange-100 text-orange-700',
];

export function CrewStatisticsPage() {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [crewResponse, taskResponse] = await Promise.all([
        crewApi.list(),
        tasksApi.list({ limit: 500 }),
      ]);
      setCrew(crewResponse.data.crew ?? []);
      setTasks(taskResponse.data.tasks ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load crew work statistics.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const rows = useMemo<CrewStats[]>(() => crew.map((member) => {
    const assigned = tasks.filter((task) => {
      const assignees = new Set([...(task.crewIds ?? []), ...(task.crewMemberIds ?? []), task.crewLeadId].filter(Boolean));
      return assignees.has(member.crewId) && isInMonth(dateForTask(task, 'createdAt'), selectedMonth);
    });
    const completed = tasks.filter((task) => {
      const assignees = new Set([...(task.crewIds ?? []), ...(task.crewMemberIds ?? []), task.crewLeadId].filter(Boolean));
      return task.status === 'completed' && assignees.has(member.crewId) && isInMonth(dateForTask(task, 'completedAt'), selectedMonth);
    });
    const onTime = completed.filter((task) => {
      const completedAt = dateForTask(task, 'completedAt');
      const dueAt = task.dueAt ? new Date(task.dueAt) : null;
      return !!completedAt && !!dueAt && isValid(dueAt) && completedAt.getTime() <= dueAt.getTime();
    });
    return {
      member,
      assigned: assigned.length,
      completed: completed.length,
      reportsResolved: completed.reduce((sum, task) => sum + (task.reportIds?.length ?? 0), 0),
      onTime: onTime.length,
    };
  }).sort((a, b) => b.completed - a.completed || a.member.name.localeCompare(b.member.name)), [crew, tasks, selectedMonth]);

  const completedTotal = rows.reduce((sum, row) => sum + row.completed, 0);
  const reportTotal = rows.reduce((sum, row) => sum + row.reportsResolved, 0);
  const onTimeTotal = rows.reduce((sum, row) => sum + row.onTime, 0);
  const onTimeRate = completedTotal ? Math.round(onTimeTotal / completedTotal * 100) : 0;
  const maxCompleted = Math.max(1, ...rows.map((row) => row.completed));
  const releaseDate = releaseDateFor(selectedMonth);
  const isDownloadAvailable = new Date() >= releaseDate;
  const currentMonth = monthKey(new Date());
  const monthLabel = format(new Date(`${selectedMonth}-01T00:00:00`), 'MMMM yyyy');

  function downloadCsv() {
    if (!isDownloadAvailable) return;
    const headings = ['Crew Member', 'Email', 'Month', 'Tasks Assigned', 'Tasks Completed', 'Reports Resolved', 'Completed On Time', 'On-Time Rate'];
    const data = rows.map((row) => [
      row.member.name,
      row.member.email,
      selectedMonth,
      row.assigned,
      row.completed,
      row.reportsResolved,
      row.onTime,
      `${rateOf(row)}%`,
    ]);
    const csv = [headings, ...data].map((line) => line.map(csvValue).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cleanloop-crew-work-${selectedMonth}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const kpis = [
    { label: 'Completed tasks', value: completedTotal, icon: ClipboardCheck, tint: 'bg-emerald-100 text-emerald-700' },
    { label: 'Reports resolved', value: reportTotal, icon: CheckCircle2, tint: 'bg-blue-100 text-blue-700' },
    { label: 'On-time completion', value: `${onTimeRate}%`, icon: Clock3, tint: 'bg-amber-100 text-amber-700' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Crew work statistics</h1>
          <p className="mt-1 text-sm text-gray-500">Monthly completed work by crew member.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              className="p-2.5 text-gray-500 transition-colors hover:text-gray-900"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              aria-label="Statistics month"
              type="month"
              value={selectedMonth}
              onChange={(event) => event.target.value && setSelectedMonth(event.target.value)}
              className="border-x border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              disabled={selectedMonth >= currentMonth}
              className="p-2.5 text-gray-500 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void loadData()} isLoading={isLoading} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={downloadCsv} disabled={!isDownloadAvailable || rows.length === 0} leftIcon={<Download className="h-4 w-4" />}>
            Download CSV
          </Button>
        </div>
      </div>

      {!isDownloadAvailable && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 shrink-0" />
          The {monthLabel} report can be downloaded from {format(releaseDate, 'MMMM d, yyyy')}.
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
            </div>
            <p className="mt-3 text-4xl font-bold tracking-tight tabular-nums text-gray-900">
              {isLoading ? '-' : value}
            </p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">{monthLabel}</h2>
          </div>
          <span className="text-xs text-gray-400">Ranked by completed tasks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="w-14 px-5 py-3 font-semibold">#</th>
                <th className="px-5 py-3 font-semibold">Crew member</th>
                <th className="px-5 py-3 font-semibold">Assigned</th>
                <th className="px-5 py-3 font-semibold">Completed</th>
                <th className="px-5 py-3 font-semibold">Reports resolved</th>
                <th className="px-5 py-3 font-semibold">On time</th>
                <th className="px-5 py-3 font-semibold">On-time rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7}><TableSkeleton rows={5} cols={7} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="No crew work recorded" description="Completed tasks for this month will appear here." /></td></tr>
              ) : rows.map((row, index) => {
                const rate = rateOf(row);
                const ranked = row.completed > 0 && index < 3;
                return (
                  <tr key={row.member.crewId} className="transition-colors hover:bg-gray-50/70">
                    <td className="px-5 py-3.5">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums ${ranked ? RANK_STYLES[index] : 'text-gray-400'}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700 ring-1 ring-primary-100">
                          {initialsOf(row.member.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{row.member.name}</p>
                          <p className="truncate text-xs text-gray-500">{row.member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-700">{row.assigned}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="w-6 font-semibold tabular-nums text-gray-900">{row.completed}</span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${(row.completed / maxCompleted) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-700">{row.reportsResolved}</td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-700">{row.onTime}</td>
                    <td className="px-5 py-3.5">
                      {row.completed > 0 ? (
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${rateColor(rate)}`} style={{ width: `${rate}%` }} />
                          </div>
                          <span className="w-10 text-xs font-medium tabular-nums text-gray-700">{rate}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No tasks yet</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
