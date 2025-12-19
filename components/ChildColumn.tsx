import React, { useMemo, useState, useEffect } from "react";
import TaskItem from "./TaskItem";
import { useChoresApp, Child } from "./ChoresAppContext";
import { Task, TaskInstance } from "../types/task";
import type { TimedCompletion } from "../types/task";
import { useModalControl } from "./ModalControlContext";
import { getTemplateForInstance, computeDueAt } from "../utils/taskInstanceGeneration";
import { getTheoreticalAssignment } from "../utils/projectionUtils";
import { getTodayString, getLocalDateString } from "../utils/dateUtils";
import AlertModal from "./modals/AlertModal";
import ConfirmationModal from "./modals/ConfirmationModal";
import WalletPayModal from "./modals/WalletPayModal";
import ActionLogModal from "./modals/ActionLogModal";
import PinModal from "./modals/PinModal";
import DragDropConfirmModal, { DragDropOption } from "./modals/DragDropConfirmModal";
import DeleteTaskModal, { DeleteOption } from "./modals/DeleteTaskModal";
import useScheduledTaskAnnouncements from "./hooks/useScheduledTaskAnnouncements";


interface ChildColumnProps {
  child: Child;
  onAddTask?: () => void;
}

export default function ChildColumn({ child, onAddTask }: ChildColumnProps) {
  const { state, dispatch } = useChoresApp();
  const { openEditChildModal } = useModalControl();
  const [payOpen, setPayOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [payAlertOpen, setPayAlertOpen] = React.useState(false);
  const [payConfirmOpen, setPayConfirmOpen] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [earlyCompleteAlertOpen, setEarlyCompleteAlertOpen] = React.useState(false);
  const [pendingEarlyCompletion, setPendingEarlyCompletion] = React.useState<{ task: Task; date: string } | null>(null);
  const [dragDropConfirmOpen, setDragDropConfirmOpen] = React.useState(false);
  const [pendingDragDrop, setPendingDragDrop] = React.useState<{ task: Task; instanceDate: string } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<{ task: Task; date: string } | null>(null);
  const [deleteApprovalAlertOpen, setDeleteApprovalAlertOpen] = React.useState(false);
  const [pendingDeleteOption, setPendingDeleteOption] = React.useState<DeleteOption | null>(null);
  const [dragDropApprovalAlertOpen, setDragDropApprovalAlertOpen] = React.useState(false);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };
  
  const handleDragLeave = () => {
    setDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const dragDataString = e.dataTransfer.getData('text/plain');
    
    // Check if this is a child column drag (starts with "child-")
    // If so, ignore it - let ChildrenGrid handle the reordering
    if (dragDataString.startsWith('child-')) {
      return;
    }
    
    try {
      const dragData = JSON.parse(dragDataString);
      const { taskId, sourceChildId, instanceDate } = dragData;
      
      if (sourceChildId === child.id) return; // Same column
      
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;
      
      // Check if approval is required for task move
      const requiresApproval = state.parentSettings.approvals.taskMove;
      const approvers = state.parentSettings.pins || [];
      
      if (requiresApproval) {
        if (approvers.length === 0) {
          setDragDropApprovalAlertOpen(true);
          return;
        }
        // Store the move action and request PIN
        setPendingDragDrop({ task, instanceDate: instanceDate || getTodayString() });
        setPinOpen(true);
        return;
      }
      
      // No approval required, proceed with move
      // Check if task has rotation
      if (task.rotation?.mode === 'round-robin') {
        // Show confirmation modal for rotating tasks
        setPendingDragDrop({ task, instanceDate: instanceDate || getTodayString() });
        setDragDropConfirmOpen(true);
      } else {
        // For non-rotating tasks, move just this instance
        handleMoveInstance(task, instanceDate || getTodayString());
      }
    } catch (error) {
      console.error('Drop error:', error);
    }
  };

  const handleMoveInstance = (task: Task, instanceDate: string) => {
    // Find the instance for this date - ensure we only find instances for THIS specific task
    const dateStr = instanceDate.split('T')[0];
    const existingInstance = (state.taskInstances || []).find(
      inst => inst.templateId === task.id && inst.date === dateStr
    );
    
    if (existingInstance) {
      // Update ONLY this specific instance's childId
      dispatch({
        type: 'UPDATE_TASK_INSTANCE',
        payload: {
          ...existingInstance,
          childId: child.id,
        },
      });
    } else {
      // Instance doesn't exist (it was theoretical). Realize it now with the NEW child assignment.
      const newInstance: TaskInstance = {
        id: `realized_${task.id}_${child.id}_${dateStr}_${Date.now()}`,
        templateId: task.id,
        childId: child.id, // Assign to the NEW child immediately
        date: dateStr,
        completed: false,
        createdAt: new Date().toISOString(),
        stars: task.stars,
        money: task.money
      };
      
      dispatch({ type: 'ADD_TASK_INSTANCE', payload: newInstance });
    }
  };

  const handleRedoRotations = (task: Task) => {
    // CRITICAL: Only update THIS specific task, not all tasks
    // Update rotation start date to today, adjusted so the target child is at index 0
    const today = new Date();
    
    // Find the index of the target child in the rotation order
    const assignedChildIds = task.rotation?.assignedChildIds || task.assignedChildIds || [];
    const targetIndex = assignedChildIds.indexOf(child.id);
    const rotationIndex = targetIndex >= 0 ? targetIndex : 0;
    
    // Adjust start date backwards by the target index so that today calculates to the target child
    // When diffDays = 0, we want index = targetIndex, so we set startDate to (today - targetIndex days)
    const adjustedStartDate = new Date(today);
    adjustedStartDate.setDate(adjustedStartDate.getDate() - rotationIndex);
    const adjustedStartDateStr = getLocalDateString(adjustedStartDate);
    
    // IMPORTANT: Only update THIS specific task by ID
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        ...task,
        id: task.id, // Ensure we're updating the correct task
        rotation: {
          ...task.rotation,
          mode: task.rotation?.mode || 'round-robin',
          assignedChildIds: assignedChildIds.length > 0 ? assignedChildIds : [child.id],
          startDate: adjustedStartDateStr,
          lastAssignedChildId: child.id,
          lastRotationIndex: rotationIndex,
        },
      },
    });
    
    // No need to regenerate instances - the projection engine will pick up the new start date automatically
  };

  const handleDragDropConfirm = (option: DragDropOption) => {
    if (!pendingDragDrop) return;
    
    const { task, instanceDate } = pendingDragDrop;
    
    if (option === 'instance') {
      handleMoveInstance(task, instanceDate);
    } else if (option === 'redo-rotations') {
      handleRedoRotations(task);
    }
    
    setPendingDragDrop(null);
  };

    const handlePayChild = () => {
      if ((child.money || 0) <= 0) {
        setPayAlertOpen(true);
        return;
      }
      setPayConfirmOpen(true);
    };

    const confirmPayChild = () => {
      dispatch({ type: 'PAY_CHILD', payload: child.id });
    };

  const handlePayOnChain = () => {
    setPayOpen(true);
  };
  
  const today = getTodayString();
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // --- Task Projection Logic ---
  
  // 1. Get Realized (DB) instances for today
  const dbInstancesToday = (state.taskInstances || []).filter(
    inst => inst.childId === child.id && inst.date === today
  );

  // 2. Calculate Theoretical assignments for today
  // Filter out any that already have a Realized instance (completed or moved)
  // Note: A realized instance might be on THIS child (handled above) or ANOTHER child (must be excluded here)
  const theoreticalTasksToday = useMemo(() => {
    if (!mounted) return [];
    
    const projected: TaskWithInstance[] = [];
    
    state.tasks.forEach(task => {
        if (!task.enabled) return;
        // Check if a realized instance exists for this task on this date (ANY child)
        const existingInstance = (state.taskInstances || []).find(
            inst => inst.templateId === task.id && inst.date === today
        );
        
        // If realized instance exists, the "wave has collapsed" - do not project
        if (existingInstance) return;

        // Calculate projection
        // We pass ALL tasks because Linked Tasks need to look up their parents
        const assignments = getTheoreticalAssignment(task, today, state.tasks);
        
        // Is this child assigned?
        const myAssignment = assignments.find(a => a.childId === child.id);
        
        if (myAssignment) {
            const dueAt = computeDueAt(task, today);
            const instance: TaskInstance = {
                id: `projected_${task.id}_${child.id}_${today}`,
                templateId: task.id,
                childId: child.id,
                date: today,
                dueAt,
                completed: false,
                createdAt: new Date().toISOString(),
                stars: task.stars,
                money: task.money,
                rotationIndex: myAssignment.rotationIndex
            };
            
            projected.push({
                ...task,
                instance,
                taskKey: `${child.id}-${task.id}-${today}`,
                isCompleted: false
            });
        }
    });
    
    return projected;
  }, [state.tasks, state.taskInstances, today, child.id, mounted]);

  
  // Build renderable tasks from Realized instances
  interface TaskWithInstance extends Task {
    instance: TaskInstance;
    taskKey: string;
    isCompleted: boolean;
    pendingCompletionId?: string;
    pendingCompletion?: TimedCompletion;
  }
  
  const realizedTasksToday = useMemo(() => {
      const results: TaskWithInstance[] = [];
      dbInstancesToday.forEach((instance) => {
        const template = getTemplateForInstance(instance, state.tasks);
        if (!template) return; // Skip if template not found
        
        // Build taskKey for backward compatibility with timers/completions
        const taskKey = `${instance.childId}-${instance.templateId}-${instance.date}`;
        const isCompleted = instance.completed;
        const pending = (state.timedCompletions || []).find(
          (c) => c.taskKey === taskKey && c.childId === instance.childId && !c.approved
        );
        
        results.push({
          ...template,
          instance,
          taskKey,
          isCompleted,
          pendingCompletionId: pending?.id,
          pendingCompletion: pending,
        });
      });
      return results;
  }, [dbInstancesToday, state.tasks, state.timedCompletions]);

  // Merge Realized + Projected
  // Realized takes precedence (already filtered out of projected if exists)
  const allTasksToday = useMemo(() => {
    return [...realizedTasksToday, ...theoreticalTasksToday];
  }, [realizedTasksToday, theoreticalTasksToday]);
  
  const activeTasks: TaskWithInstance[] = [];
  const inactiveTasks: TaskWithInstance[] = [];

  allTasksToday.forEach(task => {
    // Categorize by type
    if (task.type === 'oneoff' || task.oneOff) {
      // One-off tasks: active if due today, inactive otherwise
      const dueDate = task.oneOff?.dueDate;
      if (dueDate && dueDate.split('T')[0] === today) {
        activeTasks.push(task);
      } else {
        inactiveTasks.push(task);
      }
    } else {
      // Recurring/timed tasks: active for today
      activeTasks.push(task);
    }
  });

  const completedToday = activeTasks.filter(task => task.isCompleted);
  const pendingToday = activeTasks.filter(task => !task.isCompleted);

  // --- Upcoming Tasks (Projected) ---
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showCompletedToday, setShowCompletedToday] = useState(false);
  
  const upcomingScheduledTasks = useMemo(() => {
    if (!mounted) return [];
    const upcoming: Array<{ task: Task; dateTime: string; date: string }> = [];
    
    // Calculate 7 days from today
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    // Iterate dates from tomorrow to 7 days out
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() + 1); // Start tomorrow
    
    while (cursor <= sevenDaysFromNow) {
        const dateStr = getLocalDateString(cursor);
        
        // Skip today - those tasks are shown in "Today's Tasks" section
        if (dateStr === today) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }
        
        state.tasks.forEach(task => {
            if (!task.enabled) return;
            
            // Check for REALIZED instance first (e.g. rescheduled to future)
            const existingInstance = (state.taskInstances || []).find(
                inst => inst.templateId === task.id && inst.date === dateStr
            );
            
            if (existingInstance) {
                // If it exists and assigned to THIS child, show it
                if (existingInstance.childId === child.id) {
                    upcoming.push({ 
                        task, 
                        dateTime: `${dateStr}T${task.schedule?.dueTime || "00:00"}`, 
                        date: dateStr 
                    });
                }
                // If exists but assigned to another child, skip
                return;
            }
            
            // No realized instance -> Project it
            const assignments = getTheoreticalAssignment(task, dateStr, state.tasks);
            const myAssignment = assignments.find(a => a.childId === child.id);
            
            if (myAssignment) {
                upcoming.push({ 
                    task, 
                    dateTime: `${dateStr}T${task.schedule?.dueTime || "00:00"}`, 
                    date: dateStr 
                });
            }
        });
        
        cursor.setDate(cursor.getDate() + 1);
    }
    
    // Sort by date
    const sorted = upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Limit to 5 initially, or show all if "see more" is clicked
    return showAllUpcoming ? sorted : sorted.slice(0, 5);
  }, [state.tasks, state.taskInstances, child.id, today, mounted, showAllUpcoming]);
  
  // Calculate total count for "See more" button
  const totalUpcomingCount = useMemo(() => {
    if (!mounted) return 0;
    let count = 0;
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() + 1);
    
    while (cursor <= sevenDaysFromNow) {
      const dateStr = getLocalDateString(cursor);
      
      // Skip today - those tasks are shown in "Today's Tasks" section
      if (dateStr === today) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
      
      state.tasks.forEach(task => {
        if (!task.enabled) return;
        const existingInstance = (state.taskInstances || []).find(
          inst => inst.templateId === task.id && inst.date === dateStr
        );
        
        if (existingInstance) {
          if (existingInstance.childId === child.id) count++;
        } else {
          const assignments = getTheoreticalAssignment(task, dateStr, state.tasks);
          if (assignments.some(a => a.childId === child.id)) count++;
        }
      });
      
      cursor.setDate(cursor.getDate() + 1);
    }
    
    return count;
  }, [state.tasks, state.taskInstances, child.id, today, mounted]);
  
  const hasMoreUpcoming = totalUpcomingCount > 5;


  // Prepare scheduled tasks for announcements (Unified Logic)
  const scheduledTasksForAnnouncements = useMemo(() => {
    if (!mounted) return [];
    const tasks: Array<{ task: Task; instance: TaskInstance; child: Child }> = [];
    
    // Include today's tasks
    allTasksToday.forEach((t) => {
      if (!t.instance.dueAt && !t.schedule?.dueTime) return;
      tasks.push({ task: t, instance: t.instance, child });
    });
    
    // Include upcoming
    upcomingScheduledTasks.forEach(({ task, dateTime, date }) => {
        // Construct a theoretical instance for announcement purposes
        const instance: TaskInstance = {
            id: `scheduled_${task.id}_${child.id}_${date}`,
            templateId: task.id,
            childId: child.id,
            date,
            dueAt: dateTime,
            stars: task.stars,
            money: task.money,
            completed: false,
            createdAt: new Date().toISOString(),
        };
        tasks.push({ task, instance, child });
    });
    
    return tasks;
  }, [allTasksToday, upcomingScheduledTasks, child, mounted]);
  
  // Voice announcements for scheduled tasks
  // Filter to only tasks that have voiceAnnouncements enabled
  const voiceSettings = state.parentSettings.voiceAnnouncements;
  const scheduledTasksWithVoice = useMemo(() => {
    return scheduledTasksForAnnouncements.filter(({ task }) => {
      // Only include tasks where voiceAnnouncements is not explicitly false
      return task.voiceAnnouncements !== false;
    });
  }, [scheduledTasksForAnnouncements]);
  
  useScheduledTaskAnnouncements(
    scheduledTasksWithVoice,
    voiceSettings?.scheduledAnnouncements?.enabled ? {
      enabled: voiceSettings.enabled && (voiceSettings.scheduledAnnouncements?.enabled ?? false),
      volume: voiceSettings.volume ?? 1,
      rate: voiceSettings.rate ?? 1,
      pitch: voiceSettings.pitch ?? 1,
      announceMinutesBefore: voiceSettings.scheduledAnnouncements?.announceMinutesBefore,
      announceAtDueTime: voiceSettings.scheduledAnnouncements?.announceAtDueTime,
      messageFormat: voiceSettings.scheduledAnnouncements?.messageFormat,
    } : { enabled: false }
  );


  const performEarlyCompletion = (task: Task, date: string) => {
    const dateStr = date.split('T')[0];
    
    // Check if instance already exists
    const existingInstance = (state.taskInstances || []).find(
      inst => inst.templateId === task.id && inst.childId === child.id && inst.date === dateStr
    );
    
    if (existingInstance) {
      // Complete existing instance
      if (!existingInstance.completed) {
        dispatch({
          type: 'COMPLETE_TASK_INSTANCE',
          payload: {
            instanceId: existingInstance.id,
            childId: child.id,
            starReward: Number(existingInstance.stars ?? task.stars ?? 0),
            moneyReward: Number(existingInstance.money ?? task.money ?? 0),
          },
        });
      }
    } else {
      // Realize the theoretical instance
      const newInstance: TaskInstance = {
        id: `realized_${task.id}_${child.id}_${dateStr}_${Date.now()}`,
        templateId: task.id,
        childId: child.id,
        date: dateStr,
        completed: false,
        createdAt: new Date().toISOString(),
        stars: task.stars,
        money: task.money
      };
      
      // Add AND Complete
      dispatch({ type: 'ADD_TASK_INSTANCE', payload: newInstance });
      dispatch({
        type: 'COMPLETE_TASK_INSTANCE',
        payload: {
          instanceId: newInstance.id,
          childId: child.id,
          starReward: Number(task.stars ?? 0),
          moneyReward: Number(task.money ?? 0),
        },
      });
    }
  };


  const handlePinSuccess = () => {
    setPinOpen(false);
    if (pendingEarlyCompletion) {
      performEarlyCompletion(pendingEarlyCompletion.task, pendingEarlyCompletion.date);
      setPendingEarlyCompletion(null);
    } else if (pendingDragDrop) {
      // Approval granted for drag-and-drop, proceed with move
      const { task, instanceDate } = pendingDragDrop;
      // Check if task has rotation
      if (task.rotation?.mode === 'round-robin') {
        // Show confirmation modal for rotating tasks
        setDragDropConfirmOpen(true);
      } else {
        // For non-rotating tasks, move just this instance
        handleMoveInstance(task, instanceDate);
        setPendingDragDrop(null);
      }
    } else if (pendingDelete && pendingDeleteOption) {
      // Approval granted for deletion
      const { task, date } = pendingDelete;
      const dateStr = date.split('T')[0];
      if (pendingDeleteOption === 'template') {
        dispatch({ type: 'DELETE_TASK', payload: task.id });
      } else if (pendingDeleteOption === 'future') {
        // Disable task after the selected date (remove all future occurrences)
        dispatch({ type: 'DISABLE_TASK_AFTER_DATE', payload: { taskId: task.id, date: dateStr } });
      } else {
        // 'instance' on a future occurrence is not supported yet; fall back to future
        dispatch({ type: 'DISABLE_TASK_AFTER_DATE', payload: { taskId: task.id, date: dateStr } });
      }
      setPendingDelete(null);
      setPendingDeleteOption(null);
    }
  };

  return (
    <div 
      className={`child-column${dragOver ? ' drag-over' : ''}`} 
      data-child-id={child.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && <div className="drop-indicator">Drop task here</div>}
      <div className="child-header">
        <div className="child-name-row">
          <span className="child-name">{child.name}</span>
          <div className="child-header-actions">
            <button className="btn-icon-text" onClick={() => openEditChildModal(child.id)} title="Edit child">
              <span className="btn-icon">✏️</span>
              <span className="btn-text">Edit</span>
            </button>
            <button className="btn-icon-text" onClick={handlePayChild} title="Pay out cash">
              <span className="btn-icon">💵</span>
              <span className="btn-text">Pay</span>
            </button>
            <button className="btn-icon-text" onClick={handlePayOnChain} title="Pay on blockchain">
              <span className="btn-icon">🌐</span>
              <span className="btn-text">Wallet</span>
            </button>
            <button className="btn-icon-text" onClick={() => setLogOpen(true)} title="View action log">
              <span className="btn-icon">📝</span>
              <span className="btn-text">Log</span>
            </button>
          </div>
        </div>
        <div className="child-stats">
          <div className="stat-item">
            <span>⭐</span>
            <span>{child.stars ?? 0}</span>
          </div>
          <div className="stat-item">
            <span>💰</span>
            <span>${(child.money ?? 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="tasks-list">
        <div className="tasks-section">
          <div className="section-title">
            Today&apos;s Tasks
            <button className="add-task-btn" onClick={onAddTask}>
              + Task
            </button>
          </div>
          {pendingToday.length === 0 && completedToday.length === 0 ? (
            <div className="empty-state">No tasks for today</div>
          ) : (
            <>
              {pendingToday.map((task) => {
                // Determine key based on whether it's realized or projected
                // Use a prefix to ensure uniqueness and avoid key collisions during transitions
                const key = `${task.instance.id.startsWith('projected') ? 'p' : 'r'}-${task.instance.id}`;
                return (<TaskItem key={key} task={task} instance={task.instance} childId={child.id} />);
              })}
              {completedToday.length > 0 && (
                <div className="completed-tasks">
                  <button className="see-more-btn" onClick={() => setShowCompletedToday(!showCompletedToday)}>
                    {showCompletedToday ? 'Hide completed' : `Show completed (${completedToday.length})`}
                  </button>
                  {showCompletedToday && completedToday.map((task) => {
                    const key = `completed-${task.instance.id}`;
                    return (<TaskItem key={key} task={task} instance={task.instance} childId={child.id} />);
                  })}
                </div>
              )}
            </>
          )}
        </div>
        {inactiveTasks.length > 0 && (
          <div className="tasks-section inactive-tasks">
            <div className="section-title">Upcoming Tasks</div>
            <>
              {inactiveTasks.map((task) => {
                const key = `inactive-${task.instance.id}`;
                return (<TaskItem key={key} task={task} instance={task.instance} childId={child.id} />);
              })}
            </>
          </div>
        )}
        {upcomingScheduledTasks.length > 0 && (
          <div className="tasks-section upcoming-scheduled">
            <div className="section-title">Scheduled</div>
            <>
              {upcomingScheduledTasks.map(({ task, dateTime, date }) => {
                // For upcoming, we rely on the projection or existing instance passed in useMemo
                // We need to fetch the instance again or construct it to ensure TaskItem props are correct.
                
                // Re-check for realized instance
                const existingInstance = (state.taskInstances || []).find(
                  inst => inst.templateId === task.id && inst.childId === child.id && inst.date === date
                );
                
                const derivedInstance: TaskInstance = existingInstance || {
                  id: `scheduled_${task.id}_${child.id}_${date}`,
                  templateId: task.id,
                  childId: child.id,
                  date,
                  dueAt: dateTime,
                  stars: task.stars,
                  money: task.money,
                  completed: false,
                  createdAt: new Date().toISOString(),
                };

                const taskWithInstance: Task & { instance: TaskInstance; taskKey: string; isCompleted: boolean } = {
                  ...task,
                  instance: derivedInstance,
                  taskKey: `${derivedInstance.childId}-${derivedInstance.templateId}-${derivedInstance.date}`,
                  isCompleted: derivedInstance.completed || false,
                };
                
                const key = derivedInstance.id || `${task.id}-${dateTime}`;
                return (
                  <TaskItem 
                    key={key} 
                    task={taskWithInstance} 
                    instance={derivedInstance} 
                    childId={child.id} 
                  />
                );
              })}
            </>
            {hasMoreUpcoming && !showAllUpcoming && (
              <button 
                className="see-more-btn"
                onClick={() => setShowAllUpcoming(true)}
              >
                See more ({totalUpcomingCount} total)
              </button>
            )}
            {showAllUpcoming && hasMoreUpcoming && (
              <button 
                className="see-more-btn"
                onClick={() => setShowAllUpcoming(false)}
              >
                Show less
              </button>
            )}
          </div>
        )}
      </div>
      
      {payOpen && (
        <WalletPayModal open={payOpen} onClose={() => setPayOpen(false)} child={child} defaultAmount={child.money || 0} />
      )}
      {logOpen && (
        <ActionLogModal open={logOpen} onClose={() => setLogOpen(false)} childId={child.id} />
      )}
      <AlertModal
        open={payAlertOpen}
        onClose={() => setPayAlertOpen(false)}
        title="Cannot Pay Out"
        message={`${child.name} has no money to pay out.`}
      />
      <AlertModal
        open={earlyCompleteAlertOpen}
        onClose={() => setEarlyCompleteAlertOpen(false)}
        title="Approval Required"
        message="Early completion requires parent approval, but no approvers are defined. Please add an approver in Settings first."
      />
      <PinModal
        open={pinOpen}
        onClose={() => { setPinOpen(false); setPendingEarlyCompletion(null); setPendingDragDrop(null); setPendingDelete(null); setPendingDeleteOption(null); }}
        onSuccess={handlePinSuccess}
        message={
          pendingEarlyCompletion
            ? "Enter a parent PIN to approve completing this task early."
            : pendingDragDrop
            ? "Enter a parent PIN to approve moving this task."
            : pendingDelete
            ? "Enter a parent PIN to approve deleting or disabling this task."
            : "Enter a parent PIN."
        }
      />
      <AlertModal
        open={dragDropApprovalAlertOpen}
        onClose={() => setDragDropApprovalAlertOpen(false)}
        title="Approval Required"
        message="Moving tasks requires parent approval, but no approvers are defined. Please add an approver in Settings first."
      />
      <AlertModal
        open={deleteApprovalAlertOpen}
        onClose={() => setDeleteApprovalAlertOpen(false)}
        title="Approval Required"
        message="Editing/deleting tasks requires parent approval, but no approvers are defined. Please add an approver in Settings first."
      />
      <DeleteTaskModal
        open={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setPendingDelete(null); setPendingDeleteOption(null); }}
        onConfirm={(option) => {
          setDeleteConfirmOpen(false);
          if (!pendingDelete) return;
          // Require approval for edits/deletes if enabled
          const approvalRequired = !!state.parentSettings?.approvals?.editTasks;
          const approvers = state.parentSettings?.pins || [];
          if (approvalRequired) {
            if (approvers.length === 0) {
              setDeleteApprovalAlertOpen(true);
              return;
            }
            // Store and request PIN
            setPendingDeleteOption(option);
            setPinOpen(true);
            return;
          }
          // No approval required — execute immediately
          const { task, date } = pendingDelete;
          const dateStr = date.split('T')[0];
          if (option === 'template') {
            dispatch({ type: 'DELETE_TASK', payload: task.id });
          } else if (option === 'future') {
            dispatch({ type: 'DISABLE_TASK_AFTER_DATE', payload: { taskId: task.id, date: dateStr } });
          } else {
            // 'instance' fallback to future for upcoming entries
            dispatch({ type: 'DISABLE_TASK_AFTER_DATE', payload: { taskId: task.id, date: dateStr } });
          }
          setPendingDelete(null);
          setPendingDeleteOption(null);
        }}
        task={pendingDelete ? pendingDelete.task : null}
        taskTitle={pendingDelete ? (pendingDelete.task.title || 'Task') : undefined}
      />
      <ConfirmationModal
        open={payConfirmOpen}
        onClose={() => setPayConfirmOpen(false)}
        onConfirm={confirmPayChild}
        title="Pay Out"
        message={`Pay ${child.name} $${(child.money || 0).toFixed(2)}?`}
        confirmText="Pay"
        cancelText="Cancel"
      />
      <DragDropConfirmModal
        open={dragDropConfirmOpen}
        onClose={() => { setDragDropConfirmOpen(false); setPendingDragDrop(null); }}
        onConfirm={handleDragDropConfirm}
        task={pendingDragDrop?.task || null}
        targetChildName={child.name}
      />
    </div>
  );
}
