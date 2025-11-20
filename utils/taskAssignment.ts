import { Child, Chore } from '@/components/ChoresAppContext';

export function getEligibleChildren(chore: Chore, allChildren: Child[]): Child[] {
  if (chore.eligibleChildren.length === 0) {
    return allChildren;
  }
  return allChildren.filter(child => 
    chore.eligibleChildren.includes(child.id)
  );
}

export function assignChoreToChild(chore: Chore, allChildren: Child[]): Child | null {
  const eligibleChildren = getEligibleChildren(chore, allChildren);
  if (eligibleChildren.length === 0) {
    return null;
  }

  // Use date-based rotation to ensure consistency
  const today = new Date();
  const daysSinceEpoch = Math.floor((today.getTime() - new Date(2023, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
  const rotationIndex = (daysSinceEpoch + chore.id) % eligibleChildren.length;
  
  return eligibleChildren[rotationIndex];
}

export function generateTaskKey(childId: number, choreId: number, date?: string): string {
  const dateStr = date || new Date().toISOString().split('T')[0];
  return `${childId}-${choreId}-${dateStr}`;
}

export function generateOneOffTaskKey(childId: number, taskId: number, date: string): string {
  return `${childId}-oneoff-${taskId}-${date}`;
}

// Assign a unified Task to a child. If the task has an explicit assignedTo, honor it.
// For recurring tasks without an explicit assignee, use a rotation based on task id string.
export function assignTaskToChild(task: any, allChildren: Child[]): Child | null {
  if (!task) return null;
  if (typeof task.assignedTo === 'number') {
    return allChildren.find(c => c.id === task.assignedTo) || null;
  }

  // Recurring tasks: rotate among children deterministically using a simple hash
  if (task.type === 'recurring' || task.type === 'timed') {
    if (allChildren.length === 0) return null;
    // hash the task id string to a number
    const s = String(task.id || task.title || JSON.stringify(task));
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    const idx = h % allChildren.length;
    return allChildren[idx];
  }

  return null;
}