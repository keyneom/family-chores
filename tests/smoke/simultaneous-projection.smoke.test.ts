import type { Task, TaskInstance } from '../../types/task';
import { choresAppReducer } from '../../components/ChoresAppContext';
import {
  hasBlockingRealizedInstanceForTheoreticalProjection,
  isSimultaneousTask,
  resolveUpcomingSlotForChild,
} from '../../utils/projectionUtils';
import { makeBaseState, makeRecurringTask, makeTaskInstance } from './helpers';

function mapsFromInstances(instances: TaskInstance[]) {
  const instanceByTemplateDate = new Map<string, TaskInstance>();
  const instanceByTemplateDateChild = new Map<string, TaskInstance>();
  instances.forEach((inst) => {
    const gk = `${inst.templateId}|${inst.date}`;
    if (!instanceByTemplateDate.has(gk)) instanceByTemplateDate.set(gk, inst);
    const ck = `${inst.templateId}|${inst.childId}|${inst.date}`;
    if (!instanceByTemplateDateChild.has(ck)) instanceByTemplateDateChild.set(ck, inst);
  });
  return { instanceByTemplateDate, instanceByTemplateDateChild };
}

describe('Smoke: simultaneous vs shared-slot projection', () => {
  const simultaneousTask: Task = makeRecurringTask({
    id: 't_simul',
    rotation: { mode: 'simultaneous', assignedChildIds: [1, 2] },
    assignment: { strategy: 'simultaneous', childIds: [1, 2] },
  });

  const roundRobinTask: Task = makeRecurringTask({
    id: 't_rr',
    rotation: { mode: 'round-robin', assignedChildIds: [1, 2], startDate: '2026-04-20' },
  });

  it('isSimultaneousTask detects rotation and assignment strategy', () => {
    expect(isSimultaneousTask(simultaneousTask)).toBe(true);
    expect(
      isSimultaneousTask({
        ...makeRecurringTask(),
        rotation: undefined,
        assignment: { strategy: 'simultaneous', childIds: [1, 2] },
      }),
    ).toBe(true);
    expect(isSimultaneousTask(roundRobinTask)).toBe(false);
  });

  it('theoretical projection: simultaneous blocks only the child who has a realized instance', () => {
    const inst1 = makeTaskInstance({
      id: 'r1',
      templateId: 't_simul',
      childId: 1,
      date: '2026-04-24',
      completed: true,
    });
    const { instanceByTemplateDate, instanceByTemplateDateChild } = mapsFromInstances([inst1]);

    expect(
      hasBlockingRealizedInstanceForTheoreticalProjection(
        simultaneousTask,
        '2026-04-24',
        1,
        instanceByTemplateDate,
        instanceByTemplateDateChild,
      ),
    ).toBe(true);

    expect(
      hasBlockingRealizedInstanceForTheoreticalProjection(
        simultaneousTask,
        '2026-04-24',
        2,
        instanceByTemplateDate,
        instanceByTemplateDateChild,
      ),
    ).toBe(false);
  });

  it('theoretical projection: round-robin blocks all children once any instance exists for that date', () => {
    const inst = makeTaskInstance({
      id: 'r_rr',
      templateId: 't_rr',
      childId: 1,
      date: '2026-04-24',
    });
    const { instanceByTemplateDate, instanceByTemplateDateChild } = mapsFromInstances([inst]);

    expect(
      hasBlockingRealizedInstanceForTheoreticalProjection(
        roundRobinTask,
        '2026-04-24',
        1,
        instanceByTemplateDate,
        instanceByTemplateDateChild,
      ),
    ).toBe(true);
    expect(
      hasBlockingRealizedInstanceForTheoreticalProjection(
        roundRobinTask,
        '2026-04-24',
        2,
        instanceByTemplateDate,
        instanceByTemplateDateChild,
      ),
    ).toBe(true);
  });

  it('resolveUpcomingSlotForChild: simultaneous uses per-child map only', () => {
    const inst1 = makeTaskInstance({
      templateId: 't_simul',
      childId: 1,
      date: '2026-04-25',
    });
    const { instanceByTemplateDate, instanceByTemplateDateChild } = mapsFromInstances([inst1]);

    expect(
      resolveUpcomingSlotForChild(
        simultaneousTask,
        '2026-04-25',
        1,
        instanceByTemplateDate,
        instanceByTemplateDateChild,
      ),
    ).toBe('show-realized');
    expect(
      resolveUpcomingSlotForChild(
        simultaneousTask,
        '2026-04-25',
        2,
        instanceByTemplateDate,
        instanceByTemplateDateChild,
      ),
    ).toBe('project-theoretical');
  });

  it('resolveUpcomingSlotForChild: round-robin skips non-assigned child when another child holds the slot', () => {
    const inst = makeTaskInstance({
      templateId: 't_rr',
      childId: 1,
      date: '2026-04-25',
    });
    const { instanceByTemplateDate, instanceByTemplateDateChild } = mapsFromInstances([inst]);

    expect(
      resolveUpcomingSlotForChild(
        roundRobinTask,
        '2026-04-25',
        1,
        instanceByTemplateDate,
        instanceByTemplateDateChild,
      ),
    ).toBe('show-realized');
    expect(
      resolveUpcomingSlotForChild(
        roundRobinTask,
        '2026-04-25',
        2,
        instanceByTemplateDate,
        instanceByTemplateDateChild,
      ),
    ).toBe('skip-child');
  });

  it('reducer: completing one child simultaneous instance does not imply a realized row for other children', () => {
    let state = makeBaseState();
    state = choresAppReducer(state, { type: 'ADD_TASK', payload: simultaneousTask });
    const tid = state.tasks[0].id;
    expect(isSimultaneousTask(state.tasks[0])).toBe(true);

    const onlyChild1 = makeTaskInstance({
      id: 'real_a',
      templateId: tid,
      childId: 1,
      date: '2026-04-24',
      completed: false,
    });
    state = choresAppReducer(state, { type: 'ADD_TASK_INSTANCE', payload: onlyChild1 });
    state = choresAppReducer(state, {
      type: 'COMPLETE_TASK_INSTANCE',
      payload: { instanceId: 'real_a', childId: 1, starReward: 3, moneyReward: 0 },
    });
    expect(state.taskInstances).toHaveLength(1);
    expect(state.children.find((c) => c.id === 1)?.stars).toBe(3);
    expect(state.children.find((c) => c.id === 2)?.stars).toBe(0);

    const { instanceByTemplateDate, instanceByTemplateDateChild } = mapsFromInstances(state.taskInstances);
    // Regression: child 2 must still get a projected slot (no per-child instance yet), not be treated as "wave collapsed".
    expect(
      hasBlockingRealizedInstanceForTheoreticalProjection(
        state.tasks[0],
        '2026-04-24',
        2,
        instanceByTemplateDate,
        instanceByTemplateDateChild,
      ),
    ).toBe(false);
  });

  it('reducer allows two realized simultaneous instances on the same template and date', () => {
    let state = makeBaseState();
    state = choresAppReducer(state, { type: 'ADD_TASK', payload: simultaneousTask });
    const tid = state.tasks[0].id;
    const a = makeTaskInstance({
      id: 'real_a',
      templateId: tid,
      childId: 1,
      date: '2026-04-24',
    });
    const b = makeTaskInstance({
      id: 'real_b',
      templateId: tid,
      childId: 2,
      date: '2026-04-24',
    });
    state = choresAppReducer(state, { type: 'ADD_TASK_INSTANCE', payload: a });
    state = choresAppReducer(state, { type: 'ADD_TASK_INSTANCE', payload: b });
    expect(state.taskInstances).toHaveLength(2);
  });
});
