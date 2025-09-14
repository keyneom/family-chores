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