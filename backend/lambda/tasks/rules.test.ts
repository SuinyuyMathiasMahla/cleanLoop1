import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as rules from './rules';

const task = { taskId: 't1', crewLeadId: 'lead', crewIds: ['c1', 'c2'], status: 'assigned' };

describe('normalizeTaskDueAt', () => {
  const scheduledAt = '2026-12-01T08:00:00.000Z';

  it('defaults to two days after the start', () => {
    assert.equal(rules.normalizeTaskDueAt(scheduledAt), '2026-12-03T08:00:00.000Z');
  });

  it('keeps a later due date', () => {
    assert.equal(
      rules.normalizeTaskDueAt(scheduledAt, '2026-12-10T08:00:00.000Z'),
      '2026-12-10T08:00:00.000Z',
    );
  });

  it('raises a due date earlier than two days to the minimum', () => {
    assert.equal(
      rules.normalizeTaskDueAt(scheduledAt, '2026-12-01T09:00:00.000Z'),
      '2026-12-03T08:00:00.000Z',
    );
  });

  it('rejects dates that are not dates', () => {
    assert.equal(rules.normalizeTaskDueAt('tomorrow'), null);
    assert.equal(rules.normalizeTaskDueAt(scheduledAt, 'soon'), null);
    assert.equal(rules.normalizeTaskDueAt(undefined), null);
  });
});

describe('crew shape', () => {
  it('accepts a lead with one to three distinct companions', () => {
    assert.equal(rules.checkCrewShape('lead', ['a']), null);
    assert.equal(rules.checkCrewShape('lead', ['a', 'b', 'c']), null);
  });

  it('needs a lead', () => {
    assert.equal(rules.checkCrewShape('', ['a']), 'A crew lead is required');
    assert.equal(rules.checkCrewShape(undefined, ['a']), 'A crew lead is required');
  });

  it('needs at least one companion and at most three', () => {
    assert.match(rules.checkCrewShape('lead', [])!, /at least 1/);
    assert.match(rules.checkCrewShape('lead', ['a', 'b', 'c', 'd'])!, /no more than 3/);
  });

  it('rejects repeated companions and a lead who is also a companion', () => {
    assert.match(rules.checkCrewShape('lead', ['a', 'a'])!, /unique/);
    assert.match(rules.checkCrewShape('lead', ['lead'])!, /cannot also be a companion/);
  });

  it('reads crewIds or its older name, and rejects anything but a list of IDs', () => {
    assert.deepEqual(rules.parseCrewIds({ crewIds: ['a'] }), ['a']);
    assert.deepEqual(rules.parseCrewIds({ crewMemberIds: ['b'] }), ['b']);
    assert.equal(rules.parseCrewIds({}), undefined);
    assert.equal(rules.parseCrewIds({ crewIds: 'a' }), null);
    assert.equal(rules.parseCrewIds({ crewIds: [1] }), null);
  });

  it('treats either spelling of the crew role as crew, unless inactive', () => {
    assert.equal(rules.isActiveCrewProfile({ role: 'CREW' }), true);
    assert.equal(rules.isActiveCrewProfile({ role: 'crew', status: 'active' }), true);
    assert.equal(rules.isActiveCrewProfile({ role: 'crew', status: 'inactive' }), false);
    assert.equal(rules.isActiveCrewProfile({ role: 'CITIZEN' }), false);
    assert.equal(rules.isActiveCrewProfile(undefined), false);
  });

  it('lists members lead first, without duplicates', () => {
    assert.deepEqual(rules.taskMemberIds({ crewLeadId: 'l', crewIds: ['a', 'l', 'a'] }), [
      'l',
      'a',
    ]);
    assert.deepEqual(rules.companionIds({ crewLeadId: 'l', crewIds: ['a', 'l'] }), ['a']);
  });

  it('reports which members an edit adds, keeps and removes', () => {
    assert.deepEqual(
      rules.crewChanges(
        { crewLeadId: 'l', crewIds: ['a', 'b'] },
        { crewLeadId: 'l', crewIds: ['b', 'c'] },
      ),
      { added: ['c'], kept: ['l', 'b'], removed: ['a'] },
    );
  });
});

describe('task state machine (docs/api/state-machines.md, target)', () => {
  const allowed: [string, rules.TaskStatus][] = [
    ['assigned', 'in_progress'],
    ['assigned', 'cancelled'],
    ['assigned', 'assigned'],
    ['in_progress', 'completed'],
    ['in_progress', 'cancelled'],
  ];
  const refused: [string, rules.TaskStatus][] = [
    ['in_progress', 'assigned'],
    ['completed', 'in_progress'],
    ['completed', 'cancelled'],
    ['cancelled', 'assigned'],
    ['cancelled', 'in_progress'],
  ];

  for (const [from, to] of allowed) {
    it(`allows ${from} to ${to}`, () => assert.equal(rules.isTargetTransition(from, to), true));
  }
  for (const [from, to] of refused) {
    it(`refuses ${from} to ${to}`, () => assert.equal(rules.isTargetTransition(from, to), false));
  }

  it('treats completed and cancelled as final', () => {
    for (const to of rules.TASK_STATUSES) {
      assert.equal(rules.isTargetTransition('completed', to), false);
      assert.equal(rules.isTargetTransition('cancelled', to), false);
    }
  });

  it('refuses an unknown starting status', () => {
    assert.equal(rules.isTargetTransition('archived', 'assigned'), false);
  });
});

describe('who may set a status', () => {
  const change = (overrides: Partial<rules.StatusChange>) =>
    rules.checkStatusChange({
      task,
      to: 'in_progress',
      actor: 'crew',
      callerId: 'c1',
      ...overrides,
    });

  it('lets any crew member on the task start it', () => {
    assert.equal(change({}), null);
    assert.equal(change({ callerId: 'lead' }), null);
  });

  it('refuses crew who are not on the task', () => {
    assert.deepEqual(change({ callerId: 'stranger' }), {
      status: 403,
      message: 'Not assigned to this task',
    });
  });

  it('lets only the lead complete the task', () => {
    assert.equal(change({ to: 'completed', callerId: 'lead' }), null);
    assert.equal(change({ to: 'completed', callerId: 'c1' })?.status, 403);
  });

  it('keeps crew to in_progress and completed', () => {
    assert.equal(change({ to: 'cancelled', reason: 'rain' })?.status, 400);
    assert.equal(change({ to: 'assigned' })?.status, 400);
  });

  it('lets an admin set any known status, and nothing else', () => {
    for (const to of ['assigned', 'in_progress', 'completed']) {
      assert.equal(change({ actor: 'admin', to }), null);
    }
    assert.equal(change({ actor: 'admin', to: 'archived' })?.status, 400);
  });

  it('refuses callers who are neither admin nor crew', () => {
    assert.equal(change({ actor: 'other' })?.status, 403);
  });

  it('requires a reason to cancel', () => {
    assert.deepEqual(change({ actor: 'admin', to: 'cancelled' }), {
      status: 400,
      message: 'A reason is required to cancel a task',
    });
    assert.equal(change({ actor: 'admin', to: 'cancelled', reason: '   ' })?.status, 400);
    assert.equal(change({ actor: 'admin', to: 'cancelled', reason: 42 })?.status, 400);
    assert.equal(change({ actor: 'admin', to: 'cancelled', reason: 'Duplicate task' }), null);
  });

  it('limits the reason to 500 characters', () => {
    assert.equal(change({ actor: 'admin', to: 'cancelled', reason: 'x'.repeat(500) }), null);
    assert.equal(change({ actor: 'admin', to: 'cancelled', reason: 'x'.repeat(501) })?.status, 400);
  });

  it('tidies the reason', () => {
    assert.equal(rules.normalizeReason('  road\n closed  '), 'road closed');
  });
});

describe('evidence', () => {
  it('needs at least one photo', () => {
    assert.deepEqual(rules.checkEvidenceKeys('t1', []), {
      error: 'At least one evidence photo is required to complete a task',
    });
    assert.ok('error' in rules.checkEvidenceKeys('t1', undefined));
  });

  it('accepts only photos uploaded for this task', () => {
    assert.deepEqual(rules.checkEvidenceKeys('t1', ['evidence/t1/a.jpg', 'evidence/t1/a.jpg']), {
      keys: ['evidence/t1/a.jpg'],
    });
    assert.ok('error' in rules.checkEvidenceKeys('t1', ['evidence/t2/a.jpg']));
    assert.ok('error' in rules.checkEvidenceKeys('t1', ['evidence/t1/../t2/a.jpg']));
    assert.ok('error' in rules.checkEvidenceKeys('t1', [7]));
  });

  it('checks a key before it is deleted', () => {
    assert.equal(rules.isEvidenceKeyForTask('t1', 'evidence/t1/a.jpg'), true);
    assert.equal(rules.isEvidenceKeyForTask('t1', 'reports/t1/a.jpg'), false);
    assert.equal(rules.isEvidenceKeyForTask('t1', undefined), false);
  });

  it('takes no evidence once the task is closed', () => {
    assert.equal(rules.isClosedStatus('completed'), true);
    assert.equal(rules.isClosedStatus('cancelled'), true);
    assert.equal(rules.isClosedStatus('in_progress'), false);
  });

  it('needs attendance for every companion, once each', () => {
    const result = rules.checkCompanionAttendance(task, [
      { userId: 'c1', present: true },
      { userId: 'c2', present: false },
    ]);
    assert.ok('presentById' in result);
    assert.equal(result.presentById.get('c2'), false);

    assert.ok('error' in rules.checkCompanionAttendance(task, undefined));
    assert.ok('error' in rules.checkCompanionAttendance(task, [{ userId: 'c1', present: true }]));
    assert.ok(
      'error' in
        rules.checkCompanionAttendance(task, [
          { userId: 'c1', present: true },
          { userId: 'c1', present: false },
        ]),
    );
    assert.ok(
      'error' in
        rules.checkCompanionAttendance(task, [
          { userId: 'c1', present: true },
          { userId: 'c2', present: 'yes' },
        ]),
    );
    assert.ok(
      'error' in
        rules.checkCompanionAttendance(task, [
          { userId: 'c1', present: true },
          { userId: 'x', present: true },
        ]),
    );
  });

  it('needs an empty attendance list when there are no companions', () => {
    assert.ok('presentById' in rules.checkCompanionAttendance({ crewLeadId: 'lead' }, []));
  });
});

describe('reminders', () => {
  const now = new Date('2026-12-01T12:00:00.000Z');
  const due = (dueAt: string, extra: Record<string, unknown> = {}) => ({
    status: 'assigned',
    dueAt,
    ...extra,
  });

  it('reminds active tasks due within 24 hours, once', () => {
    assert.equal(rules.needsDueReminder(due('2026-12-02T11:00:00.000Z'), now), true);
    assert.equal(rules.needsDueReminder(due('2026-12-02T13:00:00.000Z'), now), false);
    assert.equal(rules.needsDueReminder(due('2026-12-01T11:00:00.000Z'), now), false);
    assert.equal(
      rules.needsDueReminder(due('2026-12-02T11:00:00.000Z', { reminderSentAt: 'x' }), now),
      false,
    );
  });

  it('includes assigned, in_progress and legacy scheduled tasks', () => {
    for (const status of ['assigned', 'in_progress', 'scheduled']) {
      assert.equal(rules.needsDueReminder(due('2026-12-02T00:00:00.000Z', { status }), now), true);
    }
    for (const status of ['completed', 'cancelled']) {
      assert.equal(rules.needsDueReminder(due('2026-12-02T00:00:00.000Z', { status }), now), false);
    }
  });

  it('alerts once when an active task passes its due time', () => {
    assert.equal(rules.needsOverdueAlert(due('2026-12-01T11:00:00.000Z'), now), true);
    assert.equal(rules.needsOverdueAlert(due('2026-12-01T13:00:00.000Z'), now), false);
    assert.equal(
      rules.needsOverdueAlert(due('2026-12-01T11:00:00.000Z', { overdueAlertSentAt: 'x' }), now),
      false,
    );
    assert.equal(
      rules.needsOverdueAlert(due('2026-12-01T11:00:00.000Z', { status: 'completed' }), now),
      false,
    );
  });

  it('gives the 24-hour window the due-date index is queried with', () => {
    assert.deepEqual(rules.reminderWindow(now), {
      from: '2026-12-01T12:00:00.000Z',
      to: '2026-12-02T12:00:00.000Z',
    });
  });
});

describe('edits and paging', () => {
  it('keeps only the fields an admin may edit', () => {
    assert.deepEqual(rules.pickUpdates({ title: 'T', status: 'completed', notes: '' }), {
      title: 'T',
      notes: '',
    });
  });

  it('clamps the page size to 1 to 500', () => {
    assert.equal(rules.clampPageLimit(undefined), 500);
    assert.equal(rules.clampPageLimit('20'), 20);
    assert.equal(rules.clampPageLimit('9000'), 500);
    assert.equal(rules.clampPageLimit('-3'), 500);
    assert.equal(rules.clampPageLimit('abc'), 500);
  });

  it('round-trips a page cursor, and ignores a broken one', () => {
    const cursor = { statusIndex: 2, lastKey: { taskId: 't1' } };
    assert.deepEqual(rules.decodeCursor(rules.encodeCursor(cursor)!), cursor);
    assert.equal(rules.encodeCursor(undefined), null);
    assert.equal(rules.decodeCursor('not base64 json'), undefined);
    assert.equal(rules.decodeCursor(undefined), undefined);
  });
});
