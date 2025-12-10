import { Child } from '@/components/ChoresAppContext';
import type Task from '@/types/task';

export interface AssignmentContext {
  date?: string; // YYYY-MM-DD
}

export interface AssignmentPlan {
  child: Child;
  rotationIndex?: number;
}

function uniqueNumbers(values?: (number | string)[] | null): number[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const nums = values
    .map((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return Number.isFinite(num) ? Number(num) : null;
    })
    .filter((val): val is number => typeof val === 'number' && !isNaN(val));
  if (nums.length === 0) return undefined;
  return Array.from(new Set(nums));
}

function resolveCandidateChildren(task: Task, allChildren: Child[]): Child[] {
  const assignedSet =
    uniqueNumbers(task.assignment?.childIds || []) ||
    uniqueNumbers(task.rotation?.assignedChildIds || task.assignedChildIds || []) ||
    (typeof task.assignedTo !== 'undefined' ? uniqueNumbers([task.assignedTo]) : undefined);

  if (!assignedSet || assignedSet.length === 0) {
    return allChildren;
  }

  const filtered = allChildren.filter((child) => assignedSet.includes(child.id));
  return filtered.length > 0 ? filtered : allChildren;
}

function computeRoundRobinIndex(task: Task, poolSize: number, date: string): number {
  if (poolSize === 0) return 0;
  const start = task.assignment?.rotationStartDate || task.rotation?.startDate || task.createdAt;
  if (start) {
    const startDate = new Date(start.split('T')[0]);
    const targetDate = new Date(date);
    const diffDays = Math.floor((Number(targetDate) - Number(startDate)) / (1000 * 60 * 60 * 24));
    if (Number.isFinite(diffDays)) {
      const idx = diffDays % poolSize;
      return idx < 0 ? idx + poolSize : idx;
    }
  }

  const lastIndex = task.assignment?.history?.lastRotationIndex ?? task.rotation?.lastRotationIndex ?? -1;
  return (lastIndex + 1) % poolSize;
}

export function assignTaskToChild(task: Task, allChildren: Child[], context: AssignmentContext = {}): AssignmentPlan[] {
  if (!task) return [];
  const pool = resolveCandidateChildren(task, allChildren);
  if (pool.length === 0) return [];

  const dateStr = context.date || new Date().toISOString().split('T')[0];
  const assignmentStrategy = task.assignment?.strategy;

  if (assignmentStrategy === 'simultaneous') {
    return pool.map((child) => ({ child }));
  }

  if (assignmentStrategy === 'random') {
    const hashInput = `${task.id}-${dateStr}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i += 1) {
      hash = (hash * 31 + hashInput.charCodeAt(i)) >>> 0;
    }
    const idx = hash % pool.length;
    return [{ child: pool[idx], rotationIndex: idx }];
  }

  const derivedModeFromAssignment =
    assignmentStrategy === 'round_robin' || assignmentStrategy === 'custom_sequence'
      ? 'round-robin'
      : assignmentStrategy === 'single'
      ? 'single-child'
      : undefined;

  const mode = derivedModeFromAssignment ?? task.rotation?.mode ?? (pool.length > 1 ? 'round-robin' : 'single-child');

  if (mode === 'simultaneous') {
    return pool.map((child) => ({ child }));
  }

  if (mode === 'round-robin') {
    const index = computeRoundRobinIndex(task, pool.length, dateStr);
    
    // If rotationOrder is specified, use it to determine which child is at this index
    const rotationOrder = task.rotation?.rotationOrder;
    if (rotationOrder && rotationOrder.length > 0) {
      // Map the index to the child ID from rotationOrder
      const orderedIndex = index % rotationOrder.length;
      const targetChildId = rotationOrder[orderedIndex];
      const targetChild = pool.find(c => c.id === targetChildId);
      if (targetChild) {
        return [{ child: targetChild, rotationIndex: orderedIndex }];
      }
      // Fall through if target child not found in pool
    }
    
    // Default behavior: use pool order
    return [{ child: pool[index], rotationIndex: index }];
  }

  // single-child (legacy): prefer explicit assignment
  if (task.assignedTo) {
    const targetId = parseInt(task.assignedTo, 10);
    const match = pool.find((child) => child.id === targetId);
    if (match) return [{ child: match }];
  }

  if (task.rotation?.assignedChildIds && task.rotation.assignedChildIds.length > 0) {
    const preferredId = task.rotation.assignedChildIds[0];
    const match = pool.find((child) => child.id === preferredId);
    if (match) return [{ child: match }];
  }

  if (task.assignedChildIds && task.assignedChildIds.length > 0) {
    const preferredId = task.assignedChildIds[0];
    const match = pool.find((child) => child.id === preferredId);
    if (match) return [{ child: match }];
  }

  return [{ child: pool[0] }];
}