import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, AlertCircle, UserPlus } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { useTaskStore, Task, TaskStatus, CreateTaskInput } from '../store/taskStore';
import { useReportStore } from '../store/reportStore';
import { useCrewStore } from '../store/crewStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { Input, Textarea, Select } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/LoadingSpinner';

interface TaskFormData {
  title: string;
  description: string;
  reportIds: string[];
  crewLeadId: string;
  crewMemberIds: string[];
  scheduledAt: string;
  dueAt: string;
  notes: string;
}

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  reportIds: [],
  crewLeadId: '',
  crewMemberIds: [],
  scheduledAt: '',
  dueAt: '',
  notes: '',
};

type TaskFormErrors = Partial<Omit<TaskFormData, 'crewMemberIds'>> & { crewMemberIds?: string };

const TASK_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const COLUMN_COUNT = 6;

const toValidDate = (value?: string | number | Date | null): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? d : null;
};

/** Formatted date that never throws on a missing or invalid value. */
const safeFormat = (value: string | number | Date | null | undefined, pattern: string) => {
  const d = toValidDate(value);
  return d ? format(d, pattern) : '-';
};

const isOverdue = (task: { status: string; dueAt?: string }) => {
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  const due = toValidDate(task.dueAt);
  return !!due && due.getTime() < Date.now();
};

export function TasksPage() {
  const { tasks, total, isLoading, error, fetchTasks, createTask, updateTask, deleteTask, clearError } = useTaskStore();
  const { reports, fetchReports } = useReportStore();
  const { crew, fetchCrew } = useCrewStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<TaskFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingCrewTask, setEditingCrewTask] = useState<Task | null>(null);
  const [selectedCompanionIds, setSelectedCompanionIds] = useState<string[]>([]);
  const [crewEditError, setCrewEditError] = useState<string | null>(null);
  const [savingCrew, setSavingCrew] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchReports();
    fetchCrew();
  }, []);

  const pendingReports = reports.filter((r) => r.status === 'pending');
  const activeCrew = crew.filter((c) => c.status === 'active');

  // Look up crew members by their Cognito user id (all crew, not just active,
  // so tasks led by an inactive member still show an email).
  const crewById = useMemo(() => new Map(crew.map((c) => [c.crewId, c])), [crew]);

  // Display the lead's name where available, with email and ID fallbacks.
  const getLeadLabel = (task: Task) =>
    task.crewLeadName ||
    crewById.get(task.crewLeadId)?.name ||
    (task as Task & { crewLeadEmail?: string }).crewLeadEmail ||
    crewById.get(task.crewLeadId)?.email ||
    task.crewLeadId;

  const getCompanionIds = (task: Task) => task.crewIds ?? task.crewMemberIds ?? [];

  const openCrewEditor = (task: Task) => {
    setEditingCrewTask(task);
    setSelectedCompanionIds(getCompanionIds(task).filter((id) => id !== task.crewLeadId));
    setCrewEditError(null);
  };

  const closeCrewEditor = () => {
    setEditingCrewTask(null);
    setSelectedCompanionIds([]);
    setCrewEditError(null);
  };

  const toggleCompanion = (id: string) => {
    setSelectedCompanionIds((selected) => {
      if (selected.includes(id)) return selected.filter((item) => item !== id);
      if (selected.length >= 3) return selected;
      return [...selected, id];
    });
    setCrewEditError(null);
  };

  const saveCompanions = async () => {
    if (!editingCrewTask) return;
    if (selectedCompanionIds.length < 1 || selectedCompanionIds.length > 3) {
      setCrewEditError('Select between 1 and 3 companions.');
      return;
    }

    setSavingCrew(true);
    setCrewEditError(null);
    try {
      await updateTask(editingCrewTask.taskId, { crewIds: selectedCompanionIds });
      closeCrewEditor();
    } catch (err) {
      setCrewEditError(err instanceof Error ? err.message : 'Failed to update the task crew.');
    } finally {
      setSavingCrew(false);
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSubmitError(null);
  };

  const validate = () => {
    const errs: TaskFormErrors = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.crewLeadId) errs.crewLeadId = 'Crew lead is required';
    if (form.crewMemberIds.length < 1) errs.crewMemberIds = 'Select at least 1 companion';
    if (form.crewMemberIds.length > 3) errs.crewMemberIds = 'Select no more than 3 companions';
    if (!form.scheduledAt) errs.scheduledAt = 'Scheduled date is required';
    if (!form.dueAt) errs.dueAt = 'Due date is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input: CreateTaskInput = {
        title: form.title,
        description: form.description || undefined,
        reportIds: form.reportIds,
        crewLeadId: form.crewLeadId,
        crewMemberIds: form.crewMemberIds,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        dueAt: new Date(form.dueAt).toISOString(),
        notes: form.notes || undefined,
      };
      await createTask(input);
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await updateTask(taskId, { status });
    } catch {
      // error handled in store
    }
  };

  const toggleReportId = (id: string) => {
    setForm((f) => ({
      ...f,
      reportIds: f.reportIds.includes(id) ? f.reportIds.filter((r) => r !== id) : [...f.reportIds, id],
    }));
  };

  const toggleCrewMember = (id: string) => {
    setForm((f) => ({
      ...f,
      crewMemberIds: f.crewMemberIds.includes(id)
        ? f.crewMemberIds.filter((c) => c !== id)
        : f.crewMemberIds.length < 3
          ? [...f.crewMemberIds, id]
          : f.crewMemberIds,
    }));
  };

  const summary = [
    { label: 'Scheduled', value: tasks.filter((t) => t.status === 'scheduled').length, tone: 'text-blue-600' },
    { label: 'In progress', value: tasks.filter((t) => t.status === 'in_progress').length, tone: 'text-orange-600' },
    { label: 'Completed', value: tasks.filter((t) => t.status === 'completed').length, tone: 'text-emerald-600' },
    { label: 'Overdue', value: tasks.filter((t) => isOverdue(t as any)).length, tone: 'text-red-600' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">{total} tasks total</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => { clearError(); setShowCreateModal(true); }}
        >
          Create Task
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{item.label}</p>
            <p className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${item.tone}`}>
              {isLoading ? '-' : item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tasks table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Title</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Crew Head</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Scheduled</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Due</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={COLUMN_COUNT}><TableSkeleton rows={6} cols={COLUMN_COUNT} /></td></tr>
              ) : tasks.length === 0 ? (
                <tr><td colSpan={COLUMN_COUNT}>
                  <EmptyState
                    title="No tasks yet"
                    description="Create tasks to assign crew to pending reports."
                    action={
                      <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}
                        onClick={() => setShowCreateModal(true)}>
                        Create Task
                      </Button>
                    }
                  />
                </td></tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.taskId} className="table-row-hover hover:bg-gray-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{task.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700" title={task.crewLeadId}>
                      <div className="flex items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <div className="h-7 w-7 shrink-0 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center text-[11px] font-bold">
                            {(getLeadLabel(task) || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate max-w-[180px]">{getLeadLabel(task)}</span>
                            <span className="block text-[10px] font-medium uppercase tracking-wide text-gray-400">Crew head</span>
                          </div>
                        </div>
                        {task.status !== 'completed' && task.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => openCrewEditor(task)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary-200 px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            aria-label={`Add companions to ${task.title}`}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Add companions
                          </button>
                        )}
                      </div>
                      {getCompanionIds(task).length > 0 && (
                        <p className="mt-1 pl-9 text-[11px] text-gray-500">
                          With {getCompanionIds(task).map((id) => crewById.get(id)?.name ?? id).join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                      {safeFormat(task.scheduledAt, 'MMM d, HH:mm')}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                      <span className={isOverdue(task as any) ? 'font-medium text-red-600' : 'text-gray-500'}>
                        {safeFormat(task.dueAt, 'MMM d, HH:mm')}
                      </span>
                      {isOverdue(task as any) && (
                        <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.taskId, e.target.value as TaskStatus)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        >
                          {TASK_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => deleteTask(task.taskId)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete task"
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
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeModal}
        title="Create Task"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" isLoading={submitting} onClick={handleSubmit}>
              Create Task
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {submitError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4" /> {submitError}
            </div>
          )}

          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Collect overflow bins in Ward 7"
            error={formErrors.title as string}
            required
          />

          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Additional details about this task..."
            rows={3}
          />

          {/* Report IDs */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Linked Reports ({form.reportIds.length} selected)
            </label>
            <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto p-2 space-y-1">
              {pendingReports.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No pending reports</p>
              ) : (
                pendingReports.map((r) => (
                  <label key={r.reportId} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.reportIds.includes(r.reportId)}
                      onChange={() => toggleReportId(r.reportId)}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 truncate">
                      #{r.reportId.slice(-6).toUpperCase()} · {r.address}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Crew Lead */}
          <Select
            label="Crew Lead"
            value={form.crewLeadId}
            onChange={(e) => setForm((f) => ({
              ...f,
              crewLeadId: e.target.value,
              crewMemberIds: f.crewMemberIds.filter((id) => id !== e.target.value),
            }))}
            options={activeCrew.map((c) => ({ value: c.crewId, label: c.name }))}
            placeholder="Select crew lead..."
            error={formErrors.crewLeadId as string}
            required
          />

          {/* Additional crew members */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Companions ({form.crewMemberIds.length}/3 selected · at least 1 required)
            </label>
            <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto p-2 space-y-1">
              {activeCrew.filter((c) => c.crewId !== form.crewLeadId).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No other crew members</p>
              ) : (
                activeCrew
                  .filter((c) => c.crewId !== form.crewLeadId)
                  .map((c) => (
                    <label key={c.crewId} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.crewMemberIds.includes(c.crewId)}
                        onChange={() => toggleCrewMember(c.crewId)}
                        disabled={!form.crewMemberIds.includes(c.crewId) && form.crewMemberIds.length >= 3}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{c.name} · {c.email}</span>
                    </label>
                  ))
              )}
            </div>
            {formErrors.crewMemberIds && (
              <p className="mt-1 text-xs text-red-600">{formErrors.crewMemberIds}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Scheduled Date & Time"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              error={formErrors.scheduledAt as string}
              required
            />
            <Input
              label="Due Date & Time"
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
              error={formErrors.dueAt as string}
              required
            />
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Any special instructions for the crew..."
            rows={2}
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!editingCrewTask}
        onClose={closeCrewEditor}
        title="Add task companions"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeCrewEditor}>Cancel</Button>
            <Button variant="primary" isLoading={savingCrew} onClick={saveCompanions}>
              Save crew
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm text-primary-900">
            <p className="font-semibold">Crew head: {editingCrewTask ? getLeadLabel(editingCrewTask) : ''}</p>
            <p className="mt-1 text-primary-700">Choose 1–3 companions. Automatic assignment keeps its selected crew head.</p>
          </div>
          {crewEditError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" /> {crewEditError}
            </div>
          )}
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto p-2 space-y-1">
            {activeCrew.filter((member) => member.crewId !== editingCrewTask?.crewLeadId).length === 0 ? (
              <p className="py-3 text-center text-sm text-gray-500">No other active crew members are available.</p>
            ) : (
              activeCrew
                .filter((member) => member.crewId !== editingCrewTask?.crewLeadId)
                .map((member) => (
                  <label key={member.crewId} className="flex items-center gap-3 rounded px-2 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCompanionIds.includes(member.crewId)}
                      onChange={() => toggleCompanion(member.crewId)}
                      disabled={!selectedCompanionIds.includes(member.crewId) && selectedCompanionIds.length >= 3}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-800">{member.name}</span>
                      <span className="block truncate text-xs text-gray-500">{member.email}</span>
                    </span>
                  </label>
                ))
            )}
          </div>
          <p className="text-xs text-gray-500">{selectedCompanionIds.length} of 3 companions selected. At least 1 is required.</p>
        </div>
      </Modal>
    </div>
  );
}
