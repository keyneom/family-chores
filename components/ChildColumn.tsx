import React, { useMemo, useState, useEffect } from "react";
import TaskItem from "./TaskItem";
import { useChoresApp, Child } from "./ChoresAppContext";
import { Task, TaskInstance } from "../types/task";
import type { TimedCompletion } from "../types/task";
import { useModalControl } from "./ModalControlContext";
import { getInstancesForChildAndDate, getTemplateForInstance, generateInstancesForDate } from "../utils/taskInstanceGeneration";
import { getNextExecutionDateTimes } from "../utils/recurrenceBuilder";
import { assignTaskToChild } from "../utils/taskAssignment";
import { getTodayString, getLocalDateString } from "../utils/dateUtils";
import AlertModal from "./modals/AlertModal";
import ConfirmationModal from "./modals/ConfirmationModal";
import WalletPayModal from "./modals/WalletPayModal";
import ActionLogModal from "./modals/ActionLogModal";
import PinModal from "./modals/PinModal";
import DragDropConfirmModal, { DragDropOption } from "./modals/DragDropConfirmModal";
import DeleteTaskModal, { DeleteOption } from "./modals/DeleteTaskModal";


interface ChildColumnProps {
  child: Child;
  onAddTask?: () => void;
}

export default function ChildColumn({ child, onAddTask }: ChildColumnProps) {
  const { state, dispatch } = useChoresApp();
  const { openEditChildModal, openTaskEditModal } = useModalControl();
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
    const instance = (state.taskInstances || []).find(
      inst => inst.templateId === task.id && inst.date === instanceDate.split('T')[0]
    );
    
    if (instance) {
      // Update ONLY this specific instance's childId
      dispatch({
        type: 'UPDATE_TASK_INSTANCE',
        payload: {
          ...instance,
          childId: child.id,
        },
      });
    } else {
      // If instance doesn't exist yet, we need to create it
      // This shouldn't normally happen, but handle it gracefully
      const dateStr = instanceDate.split('T')[0];
      const { instances } = generateInstancesForDate(
        [task], // Only generate for this specific task
        state.children,
        dateStr,
        state.taskInstances || []
      );
      
      const newInstance = instances.find(
        inst => inst.templateId === task.id && inst.date === dateStr
      );
      
      if (newInstance) {
        // Update the childId before adding - ensure we only add this one instance
        const updatedInstance = { ...newInstance, childId: child.id };
        dispatch({ type: 'ADD_TASK_INSTANCE', payload: updatedInstance });
      }
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
    
    // Regenerate instances for today and future dates
    // This will be handled by ChildrenGrid's instance generation logic
    // NOTE: ChildrenGrid should only regenerate instances for tasks that changed,
    // not all tasks. The UPDATE_TASK reducer should only update the specific task.
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
  
  // Note: Instance generation is now handled in ChildrenGrid to prevent duplicates
  
  // Get instances for this child today
  const todayInstances = getInstancesForChildAndDate(
    state.taskInstances || [],
    child.id,
    today
  );
  
  // Build renderable tasks from instances
  interface TaskWithInstance extends Task {
    instance: TaskInstance;
    taskKey: string;
    isCompleted: boolean;
    pendingCompletionId?: string;
    pendingCompletion?: TimedCompletion;
  }
  
  const activeTasks: TaskWithInstance[] = [];
  const inactiveTasks: TaskWithInstance[] = [];

  todayInstances.forEach((instance) => {
    const template = getTemplateForInstance(instance, state.tasks);
    if (!template) return; // Skip if template not found
    
    // Build taskKey for backward compatibility with timers/completions
    const taskKey = `${instance.childId}-${instance.templateId}-${instance.date}`;
    const isCompleted = instance.completed;
    const pending = (state.timedCompletions || []).find(
      (c) => c.taskKey === taskKey && c.childId === instance.childId && !c.approved
    );
    
    const taskWithInstance: TaskWithInstance = {
      ...template,
      instance,
      taskKey,
      isCompleted,
      pendingCompletionId: pending?.id,
      pendingCompletion: pending,
    };
    
    // Categorize by type
    if (template.type === 'oneoff' || template.oneOff) {
      // One-off tasks: active if due today, inactive otherwise
      const dueDate = template.oneOff?.dueDate;
      if (dueDate && dueDate.split('T')[0] === today) {
        activeTasks.push(taskWithInstance);
      } else {
        inactiveTasks.push(taskWithInstance);
      }
    } else {
      // Recurring/timed tasks: active for today
      activeTasks.push(taskWithInstance);
    }
  });

  // Get upcoming scheduled tasks for this child
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  
  const upcomingScheduledTasks = useMemo(() => {
    if (!mounted) return [];
    const upcoming: Array<{ task: Task; dateTime: string; date: string }> = [];
    
    // Calculate 7 days from today
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysFromNowStr = getLocalDateString(sevenDaysFromNow);
    
    state.tasks.forEach((task) => {
      if (!task.enabled || !task.schedule) return;
      
      // Check if this task is assigned to this child
      const assignedChildIds = task.assignedChildIds || [];
      if (assignedChildIds.length === 0) return;
      
      // Get next occurrences (get more than we need to filter properly)
      const occurrences = getNextExecutionDateTimes(task.schedule, today, 20);
      
      occurrences.forEach((dateTime) => {
        const dateOnly = dateTime.split('T')[0];
        // Skip today (already shown in Today's Tasks)
        if (dateOnly === today) return;
        
        // Only show tasks within the next 7 days
        if (dateOnly > sevenDaysFromNowStr) return;
        
        // Check assignment for this date - CRITICAL: only show if assigned to THIS child
        const assignments = assignTaskToChild(task, state.children, { date: dateOnly });
        const assignedToThisChild = assignments.some(plan => plan.child.id === child.id);
        
        if (assignedToThisChild) {
          upcoming.push({ task, dateTime, date: dateOnly });
        }
      });
    });
    
    // Sort by date
    const sorted = upcoming.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    
    // Limit to 5 initially, or show all if "see more" is clicked
    return showAllUpcoming ? sorted : sorted.slice(0, 5);
  }, [state.tasks, state.children, child.id, today, mounted, showAllUpcoming]);
  
  const hasMoreUpcoming = useMemo(() => {
    if (!mounted) return false;
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysFromNowStr = getLocalDateString(sevenDaysFromNow);
    
    let count = 0;
    state.tasks.forEach((task) => {
      if (!task.enabled || !task.schedule) return;
      const assignedChildIds = task.assignedChildIds || [];
      if (assignedChildIds.length === 0) return;
      
      const occurrences = getNextExecutionDateTimes(task.schedule, today, 20);
      occurrences.forEach((dateTime) => {
        const dateOnly = dateTime.split('T')[0];
        if (dateOnly === today || dateOnly > sevenDaysFromNowStr) return;
        const assignments = assignTaskToChild(task, state.children, { date: dateOnly });
        if (assignments.some(plan => plan.child.id === child.id)) {
          count++;
        }
      });
    });
    return count > 5;
  }, [state.tasks, state.children, child.id, today, mounted]);

  const formatDateTime = (dateTime: string): string => {
    const date = new Date(dateTime);
    if (Number.isNaN(date.getTime())) return dateTime;
    if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
      return Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
    }
    return date.toISOString();
  };

  const performEarlyCompletion = (task: Task, date: string) => {
    // Check if instance already exists
    const existingInstance = (state.taskInstances || []).find(
      inst => inst.templateId === task.id && inst.childId === child.id && inst.date === date
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
      // Generate instance for this date and complete it
      const { instances } = generateInstancesForDate(
        [task],
        state.children,
        date,
        state.taskInstances || []
      );
      
      const newInstance = instances.find(
        inst => inst.templateId === task.id && inst.childId === child.id && inst.date === date
      );
      
      if (newInstance) {
        // Add the instance first
        dispatch({ type: 'ADD_TASK_INSTANCE', payload: newInstance });
        // Then complete it
        dispatch({
          type: 'COMPLETE_TASK_INSTANCE',
          payload: {
            instanceId: newInstance.id,
            childId: child.id,
            starReward: Number(newInstance.stars ?? task.stars ?? 0),
            moneyReward: Number(newInstance.money ?? task.money ?? 0),
          },
        });
      }
    }
  };

  const handleCompleteUpcomingTask = (task: Task, date: string) => {
    // Check if approval is required for early completion
    // Use explicit boolean check to ensure we catch true values
    const requiresApproval = !!(state.parentSettings?.approvals?.earlyComplete);
    const approvers = state.parentSettings?.pins || [];
    
    if (requiresApproval) {
      // Check if there are any approvers defined
      if (approvers.length === 0) {
        // Show alert if no approvers are defined
        setEarlyCompleteAlertOpen(true);
        return;
      }
      
      // Store pending completion and open PIN modal
      setPendingEarlyCompletion({ task, date });
      setPinOpen(true);
      return;
    }
    
    // No approval required, complete directly
    performEarlyCompletion(task, date);
  };

  const handlePinSuccess = (actorHandle?: string) => {
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
          {activeTasks.length === 0 ? (
            <div className="empty-state">No tasks for today</div>
          ) : (
            <>
              {activeTasks.map((task) => {
                const key = task.instance.id;
                return (<TaskItem key={key} task={task} instance={task.instance} childId={child.id} />);
              })}
            </>
          )}
        </div>
        {inactiveTasks.length > 0 && (
          <div className="tasks-section inactive-tasks">
            <div className="section-title">Upcoming Tasks</div>
            <>
              {inactiveTasks.map((task) => {
                const key = task.instance.id;
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
                // Check if instance already exists for this date
                const existingInstance = (state.taskInstances || []).find(
                  inst => inst.templateId === task.id && inst.childId === child.id && inst.date === date
                );
                
                // Create a task-like object for TaskItem component
                const taskWithInstance: Task & { instance?: TaskInstance; taskKey: string; isCompleted: boolean } = {
                  ...task,
                  instance: existingInstance,
                  taskKey: existingInstance ? `${existingInstance.childId}-${existingInstance.templateId}-${existingInstance.date}` : `${child.id}-${task.id}-${date}`,
                  isCompleted: existingInstance?.completed || false,
                };
                
                const key = existingInstance?.id || `${task.id}-${dateTime}`;
                return (
                  <TaskItem 
                    key={key} 
                    task={taskWithInstance} 
                    instance={existingInstance} 
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
                See more ({upcomingScheduledTasks.length} shown)
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
