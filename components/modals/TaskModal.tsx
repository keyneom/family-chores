import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChoresApp } from "../ChoresAppContext";
import type {
  Task,
  TaskInstance,
  TaskType,
  RotationMode,
  RecurrenceFrequency,
  RecurringSettings,
  ScheduleDefinition,
  RecurrenceRule,
  TaskAssignmentSettings,
  Weekday,
} from "../../types/task";
import { getNextExecutionDateTimes, describeSchedule, buildCronExpressionFromRule } from "../../utils/recurrenceBuilder";
import { getTheoreticalAssignment } from "../../utils/projectionUtils";
import PinModal from "./PinModal";
import AlertModal from "./AlertModal";

export interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  // optional initial task to edit
  initialTask?: Task | null;
  // optional callback when saved (used to sync legacy chores state)
  onSave?: (task: Task) => void;
  // edit option: 'instance' to edit just one instance, 'future' to edit future instances, 'template' to edit template
  editOption?: 'instance' | 'future' | 'template' | null;
  // instance ID to edit (required when editOption is 'instance')
  editInstanceId?: string | null;
  // defaults when creating a new task
  initialDefaults?: {
    childId?: number;
    type?: TaskType;
    rotationMode?: RotationMode;
    rotationOrder?: number[];
    linkedTaskId?: string;
  };
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TaskModal({ open, onClose, initialTask = null, onSave, editOption = null, editInstanceId = null, initialDefaults }: TaskModalProps) {
  const { state, dispatch } = useChoresApp();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#cccccc");
  const [type, setType] = useState<'recurring'|'oneoff'>('recurring');
  const [isTimed, setIsTimed] = useState(false);
  const [starReward, setStarReward] = useState(1);
  const [moneyReward, setMoneyReward] = useState(0);
  const [requirePin, setRequirePin] = useState(false);
  const [voiceAnnouncements, setVoiceAnnouncements] = useState<boolean | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedChildIds, setSelectedChildIds] = useState<number[]>([]);
  const [rotationMode, setRotationMode] = useState<RotationMode>('single-child');
  const [rotationOrder, setRotationOrder] = useState<number[]>([]);
  const [linkedTaskId, setLinkedTaskId] = useState<string | undefined>(undefined);
  const [linkedTaskOffset, setLinkedTaskOffset] = useState<number>(0);

  const [frequency, setFrequency] = useState<RecurrenceFrequency>('daily');
  const [interval, setInterval] = useState(1);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1]);
  const [selectedMonthDay, setSelectedMonthDay] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState("17:00");
  const [useCron, setUseCron] = useState(false);
  const [cronExpression, setCronExpression] = useState("0 17 * * *");
  const [oneOffDate, setOneOffDate] = useState(new Date().toISOString().split('T')[0]);
  const [oneOffTime, setOneOffTime] = useState("17:00");

  // timed fields
  const [allowedMinutes, setAllowedMinutes] = useState(5);
  const [latePenaltyPercent, setLatePenaltyPercent] = useState(50);
  const [autoApproveOnStop, setAutoApproveOnStop] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timezone, setTimezone] = useState(
    () => (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC")
  );
  const [endMode, setEndMode] = useState<'never' | 'onDate' | 'afterOccurrences'>('never');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [occurrenceCount, setOccurrenceCount] = useState(10);
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ task?: Task; instance?: TaskInstance } | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (initialTask) {
      setEditingId(String(initialTask.id));
      // Handle unified Task type
      setTitle(initialTask.title || '');
      // For legacy compatibility, check if task has emoji/color properties
      // These are not in the unified Task type but may exist in legacy data
      const taskWithLegacy = initialTask as Task & { emoji?: string; color?: string };
      setEmoji(taskWithLegacy.emoji || '');
      setColor(taskWithLegacy.color || '#cccccc');
      setType(initialTask.type || 'recurring');
      setStarReward(typeof initialTask.stars === 'number' ? initialTask.stars : 1);
      setMoneyReward(typeof initialTask.money === 'number' ? initialTask.money : 0);
      setRequirePin(typeof initialTask.requirePin === 'boolean' ? initialTask.requirePin : false);
      setVoiceAnnouncements(initialTask.voiceAnnouncements);
      const assignedIds =
        initialTask.assignment?.childIds ||
        initialTask.rotation?.assignedChildIds ||
        initialTask.assignedChildIds ||
        (initialTask.assignedTo ? [parseInt(initialTask.assignedTo, 10)] : []);
      setSelectedChildIds(
        Array.isArray(assignedIds)
          ? Array.from(new Set(assignedIds.filter((id): id is number => typeof id === 'number' && !isNaN(id))))
          : []
      );
      const assignmentStrategy = initialTask.assignment?.strategy;
      const inferredMode: RotationMode =
        assignmentStrategy === 'simultaneous'
          ? 'simultaneous'
          : assignmentStrategy === 'round_robin'
            ? 'round-robin'
            : 'single-child';
      setRotationMode(initialTask.rotation?.mode || inferredMode || (assignedIds && assignedIds.length > 1 ? 'round-robin' : 'single-child'));
      setRotationOrder(initialTask.rotation?.rotationOrder || []);
      const loadedLinkedTaskId = initialTask.rotation?.linkedTaskId;
      const loadedLinkedTaskOffset = initialTask.rotation?.linkedTaskOffset ?? 0;
      setLinkedTaskId(loadedLinkedTaskId);
      setLinkedTaskOffset(loadedLinkedTaskOffset);

      if (initialTask.schedule?.cronExpression) {
        setUseCron(true);
        setCronExpression(initialTask.schedule.cronExpression);
      } else if (initialTask.schedule?.rule) {
        setUseCron(false);
        const rule = initialTask.schedule.rule;
        setFrequency(rule.frequency);
        setInterval(rule.interval || 1);
        if (rule.byWeekday) setSelectedWeekdays(rule.byWeekday);
        if (rule.byMonthday && rule.byMonthday.length > 0) setSelectedMonthDay(rule.byMonthday[0]);
        if (rule.startTime || rule.timeOfDay) setTimeOfDay(rule.startTime || rule.timeOfDay || timeOfDay);
        setStartDate(rule.startDate || today);
        setTimezone(initialTask.schedule.timezone || rule.timezone || timezone);
        if (rule.end?.type === 'afterDate') {
          setEndMode('onDate');
          setEndDate(rule.end.date || today);
        } else if (rule.end?.type === 'afterOccurrences') {
          setEndMode('afterOccurrences');
          setOccurrenceCount(rule.end.occurrences || 10);
        } else {
          setEndMode('never');
          setEndDate(today);
        }
      } else if (initialTask.recurring) {
        setUseCron(false);
        const cadence = initialTask.recurring.cadence || 'daily';
        setFrequency(cadence === 'custom-days' ? 'weekly' : (cadence as RecurrenceFrequency));
        if (cadence === 'custom-days' && initialTask.recurring.customDays) {
          setSelectedWeekdays(initialTask.recurring.customDays);
        }
        if (initialTask.recurring.timeOfDay) {
          setTimeOfDay(initialTask.recurring.timeOfDay);
        }
        setStartDate(today);
        setEndMode('never');
        setEndDate(today);
        setTimezone(typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
      }

      if (initialTask.oneOff?.dueDate) {
        const due = initialTask.oneOff.dueDate;
        setOneOffDate(due.split('T')[0]);
        const dueTime = due.split('T')[1]?.slice(0,5) || "17:00";
        setOneOffTime(dueTime);
      }
      // Check if task has timed settings (can be on recurring or oneoff)
      if (initialTask.timed) {
        setIsTimed(true);
        setAllowedMinutes(Math.round((initialTask.timed.allowedSeconds || 60) / 60));
        setLatePenaltyPercent((initialTask.timed.latePenaltyPercent ?? 0) * 100);
        setAutoApproveOnStop(Boolean(initialTask.timed.autoApproveOnStop));
      } else {
        setIsTimed(false);
      }
    } else {
      // reset
      setEditingId(null);
      const defaultChildId = initialDefaults?.childId;
      const defaultType = initialDefaults?.type || 'recurring';
      const defaultRotationMode = initialDefaults?.rotationMode || (defaultChildId ? 'single-child' : 'single-child');
      const defaultRotationOrder = initialDefaults?.rotationOrder || (defaultChildId ? [defaultChildId] : []);
      setTitle('');
      setEmoji('');
      setColor('#cccccc');
      setType(defaultType as 'recurring' | 'oneoff');
      setStarReward(1);
      setMoneyReward(0);
      setRequirePin(false);
      setVoiceAnnouncements(undefined);
      setIsTimed(false); setAllowedMinutes(5); setLatePenaltyPercent(50); setAutoApproveOnStop(false);
      setRotationOrder(defaultRotationOrder);
      setLinkedTaskId(initialDefaults?.linkedTaskId);
      setLinkedTaskOffset(0);
      setSelectedChildIds(defaultChildId ? [defaultChildId] : []);
      setRotationMode(defaultRotationMode);
      setFrequency('daily');
      setInterval(1);
      setSelectedWeekdays([1]);
      setSelectedMonthDay(1);
      setTimeOfDay('17:00');
      setUseCron(false);
      setCronExpression('0 17 * * *');
      setOneOffDate(new Date().toISOString().split('T')[0]);
      setOneOffTime('17:00');
      setStartDate(today);
      setEndMode('never');
      setEndDate(today);
      setOccurrenceCount(10);
      setPreviewDates([]);
      setTimezone(typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask, open, initialDefaults]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Initialize selectedChildIds when editing an instance
  useEffect(() => {
    if (editOption === 'instance' && editInstanceId) {
      const instance = state.taskInstances.find(inst => inst.id === editInstanceId);
      if (instance && instance.childId) {
        setSelectedChildIds([instance.childId]);
      }
    }
  }, [editOption, editInstanceId, state.taskInstances]);

  const schedulePreviewDefinition = useMemo(() => {
    if (type === 'oneoff') return undefined;
    return buildSchedulePayload({
      useCron,
      cronExpression,
      frequency,
      interval,
      selectedWeekdays,
      selectedMonthDay,
      timeOfDay,
      startDate,
      timezone,
      endMode,
      endDate,
      occurrenceCount,
    });
  }, [
    type,
    useCron,
    cronExpression,
    frequency,
    interval,
    selectedWeekdays,
    selectedMonthDay,
    timeOfDay,
    startDate,
    timezone,
    endMode,
    endDate,
    occurrenceCount,
  ]);

  useEffect(() => {
    if (!schedulePreviewDefinition) {
      setPreviewDates([]);
      return;
    }
    try {
      const occurrences = getNextExecutionDateTimes(schedulePreviewDefinition, startDate, 3);
      setPreviewDates(occurrences);
    } catch {
      setPreviewDates([]);
    }
  }, [schedulePreviewDefinition, startDate]);

  // Initialize rotationOrder when rotationMode changes to round-robin or children are selected
  useEffect(() => {
    if (rotationMode === 'round-robin' && selectedChildIds.length > 0) {
      // Check if rotationOrder needs updating
      const needsUpdate = rotationOrder.length === 0 || !selectedChildIds.every(id => rotationOrder.includes(id));
      if (needsUpdate) {
        // Initialize or update rotationOrder to match selectedChildIds
        const existingOrder = rotationOrder.filter(id => selectedChildIds.includes(id));
        const newChildren = selectedChildIds.filter(id => !rotationOrder.includes(id));
        setRotationOrder([...existingOrder, ...newChildren]);
      }
    } else if (rotationMode !== 'round-robin' && rotationOrder.length > 0) {
      // Clear rotationOrder when not in round-robin mode
      setRotationOrder([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotationMode, selectedChildIds.length]); // Only run when mode changes or selection count changes

  // Sync rotationOrder when linked task changes
  useEffect(() => {
    if (linkedTaskId && rotationMode === 'round-robin' && selectedChildIds.length > 0) {
      const linkedTask = state.tasks.find(t => t.id === linkedTaskId);
      if (linkedTask?.rotation?.rotationOrder) {
        // Use the linked task's rotation order, but filter to only include selected children
        const linkedOrder = linkedTask.rotation.rotationOrder.filter(id => selectedChildIds.includes(id));
        const missingChildren = selectedChildIds.filter(id => !linkedOrder.includes(id));
        setRotationOrder([...linkedOrder, ...missingChildren]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedTaskId]); // Only run when linkedTaskId changes

  useEffect(() => {
    if (!linkedTaskId) {
      setLinkedTaskOffset(0);
    }
  }, [linkedTaskId]);

  if (!open || !mounted) return null;

  const toggleChildSelection = (childId: number) => {
    setSelectedChildIds((prev) => {
      const newIds = prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId];
      // Sync rotationOrder with selectedChildIds when in round-robin mode
      if (rotationMode === 'round-robin') {
        // Keep existing order for children that are still selected, add new ones at the end
        const existingOrder = rotationOrder.filter(id => newIds.includes(id));
        const newChildren = newIds.filter(id => !rotationOrder.includes(id));
        setRotationOrder([...existingOrder, ...newChildren]);
      }
      return newIds;
    });
  };

  const moveChildInOrder = (childId: number, direction: 'up' | 'down') => {
    const currentIndex = rotationOrder.indexOf(childId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= rotationOrder.length) return;
    
    const newOrder = [...rotationOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    setRotationOrder(newOrder);
  };

  const handleToggleAllChildren = () => {
    if (selectedChildIds.length === state.children.length) {
      setSelectedChildIds([]);
    } else {
      setSelectedChildIds(state.children.map((child) => child.id));
    }
  };

  const handleClearChildren = () => setSelectedChildIds([]);

  const toggleWeekday = (weekday: number) => {
    setSelectedWeekdays((prev) => {
      if (prev.includes(weekday)) {
        return prev.filter((day) => day !== weekday);
      }
      return [...prev, weekday].sort((a, b) => a - b);
    });
  };

  const handleGenerateCron = () => {
    const schedule = buildSchedulePayload({
      useCron: false,
      cronExpression,
      frequency,
      interval,
      selectedWeekdays,
      selectedMonthDay,
      timeOfDay,
      startDate,
      timezone,
      endMode,
      endDate,
      occurrenceCount,
    });
    if (schedule?.rule) {
      const cron = buildCronExpressionFromRule(schedule.rule);
      if (cron) {
        setCronExpression(cron);
        setUseCron(true);
      }
    }
  };

  const performSave = () => {
    const id = editingId ?? `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const nowIsoDate = new Date().toISOString().split('T')[0];
    const normalizedChildIds = selectedChildIds.length > 0 ? selectedChildIds : state.children.map(child => child.id);

    const schedulePayload = type === 'oneoff' ? undefined : schedulePreviewDefinition;
    const rotationStartDate =
      (editingId && (editOption === 'future' || editOption === 'template'))
        ? nowIsoDate
        : initialTask?.assignment?.rotationStartDate || initialTask?.rotation?.startDate || nowIsoDate;
    const sanitizedLinkedTaskId = linkedTaskId && linkedTaskId !== id ? linkedTaskId : undefined;
    const assignmentPayload: TaskAssignmentSettings = {
      strategy:
        rotationMode === 'simultaneous'
          ? 'simultaneous'
          : rotationMode === 'round-robin'
            ? 'round_robin'
            : 'single',
      childIds: normalizedChildIds,
      rotationStartDate,
      allowSimultaneous: rotationMode === 'simultaneous',
    };

    const task: Task = {
      id,
      title,
      description: '',
      createdAt: new Date().toISOString(),
      enabled: true,
      requirePin,
      ...(voiceAnnouncements !== undefined && { voiceAnnouncements }),
      stars: Number(starReward),
      money: Number(moneyReward),
      type: type as TaskType,
      assignedChildIds: normalizedChildIds,
      rotation: {
        mode: rotationMode,
        assignedChildIds: normalizedChildIds,
        startDate: rotationStartDate,
        ...(rotationOrder.length > 0 && { rotationOrder }),
        ...(sanitizedLinkedTaskId && { linkedTaskId: sanitizedLinkedTaskId, linkedTaskOffset: linkedTaskOffset }),
      },
      assignment: assignmentPayload,
      ...(schedulePayload ? { schedule: schedulePayload } : {}),
      // Add timed settings if isTimed is true (can be on recurring or oneoff)
      ...(isTimed ? {
        timed: {
          allowedSeconds: Math.round(allowedMinutes * 60),
          latePenaltyPercent: latePenaltyPercent / 100,
          autoApproveOnStop,
          allowNegative: latePenaltyPercent > 100,
        },
      } : {}),
      ...(type === 'oneoff' ? {
        oneOff: { dueDate: buildDueDate(oneOffDate, oneOffTime) },
        completed: false,
      } : {}),
      ...(type !== 'oneoff' && !useCron ? {
        recurring: buildLegacyRecurringData(frequency, selectedWeekdays, timeOfDay),
      } : {}),
    };

    if (editingId) {
      // Handle different edit options
      const scope = editOption || 'template';
      if (scope === 'instance' && editInstanceId) {
        // Edit just this instance
        const instance = state.taskInstances.find(inst => inst.id === editInstanceId);
        if (instance) {
          // Get the new childId from selectedChildIds (for single instance, use first selected child)
          const newChildId = selectedChildIds.length > 0 ? selectedChildIds[0] : instance.childId;
          
          const updatedInstance: TaskInstance = {
            ...instance,
            childId: newChildId,
            stars: Number(starReward),
            money: Number(moneyReward),
          };
          dispatch({ type: 'UPDATE_TASK_INSTANCE', payload: updatedInstance });
        }
      } else {
        // Edit template (for 'future' or 'template' options, or default)
        dispatch({ type: 'UPDATE_TASK', payload: task });
        if (onSave) onSave(task);
        
        // For recurring tasks, we no longer pre-generate instances.
        // The projection engine will calculate assignments on-the-fly.
        // Only remove uncompleted instances if editing template/future.
        if (scope === 'template' || scope === 'future') {
          const todayDate = new Date().toISOString().split('T')[0];
          const purgeDate = scope === 'future' ? todayDate : undefined;
          
          // Remove uncompleted instances from purgeDate forward (keep completed ones)
          // The REPLACE_TASK_INSTANCES action will filter out uncompleted instances
          dispatch({
            type: 'REPLACE_TASK_INSTANCES',
            payload: {
              taskId: task.id,
              startDate: purgeDate,
              instances: [], // No new instances - projection engine handles it
              preserveCompleted: true,
            },
          });
        }
      }
    } else {
      // Creating a new task
      dispatch({ type: 'ADD_TASK', payload: task });
      
      // For one-off tasks, create instances immediately for the due date
      // One-off tasks are "realized" immediately since they're not recurring
      if (type === 'oneoff' && task.oneOff?.dueDate) {
        const dueDateStr = task.oneOff.dueDate.split('T')[0];
        
        // Use projection engine to determine assignments
        const assignments = getTheoreticalAssignment(task, dueDateStr, [...state.tasks, task]);
        
        // Create instances for each assigned child
        assignments.forEach((assign) => {
          const child = state.children.find(c => c.id === assign.childId);
          if (!child) return;
          
          const instance: TaskInstance = {
            id: `oneoff_${task.id}_${child.id}_${dueDateStr}_${Date.now()}`,
            templateId: task.id,
            childId: child.id,
            date: dueDateStr,
            dueAt: task.oneOff?.dueDate,
            stars: task.stars,
            money: task.money,
            completed: false,
            createdAt: new Date().toISOString(),
            rotationIndex: assign.rotationIndex
          };
          
          dispatch({ type: 'ADD_TASK_INSTANCE', payload: instance });
        });
      }
    }

    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if approval is required for editing tasks
    if (editingId) {
      const approvalRequired = !!state.parentSettings?.approvals?.editTasks;
      const approversExist = (state.parentSettings.pins || []).length > 0;
      
      if (approvalRequired) {
        if (!approversExist) {
          setAlertOpen(true);
          return;
        }
        // Store pending save and request PIN
        setPendingSave({});
        setPinOpen(true);
        return;
      }
    }
    
    // No approval required, save immediately
    performSave();
  };

  const handlePinSuccess = (actorHandle?: string) => {
    setPinOpen(false);
    if (pendingSave) {
      performSave();
      setPendingSave(null);
    }
  };

  const allChildrenSelected = state.children.length > 0 && selectedChildIds.length === state.children.length;
  const rotationHelperText =
    rotationMode === 'simultaneous'
      ? 'Every selected child receives this task each time it runs.'
      : rotationMode === 'round-robin'
        ? 'Selected children will take turns automatically based on the schedule.'
        : 'Task will stay assigned to the first selected child unless you reassign it.';

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} data-tour="task-modal">
        <div className="modal-header">
          <h2>{editingId ? 'Edit Task' : 'Create Task'}</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
        </div>
        <div className="modal-body">
          <form id="task-form" onSubmit={handleSubmit}>
            <label>
              Title:
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                required 
                placeholder="Enter task title"
                data-tour="task-title-input"
              />
            </label>
            <label>
              Emoji:
              <input 
                type="text" 
                value={emoji} 
                onChange={e => setEmoji(e.target.value)} 
                maxLength={2} 
                placeholder="📝"
              />
            </label>
            <label>
              Color:
              <input 
                type="color" 
                value={color} 
                onChange={e => setColor(e.target.value)} 
              />
            </label>
            <label>
              Type:
              <select value={type} onChange={e => setType(e.target.value as 'recurring' | 'oneoff')}>
                <option value="recurring">Recurring</option>
                <option value="oneoff">One-off</option>
              </select>
            </label>
            <label>
              Star Reward:
              <input 
                type="number" 
                value={starReward} 
                min={-10} 
                onChange={e => setStarReward(Number(e.target.value))} 
              />
            </label>
            <label>
              Money Reward:
              <input 
                type="number" 
                value={moneyReward} 
                step="0.01" 
                onChange={e => setMoneyReward(Number(e.target.value))} 
              />
            </label>
            <label>
              Require PIN:
              <input 
                type="checkbox" 
                checked={requirePin} 
                onChange={e => setRequirePin(e.target.checked)} 
              />
            </label>
            <label>
              Voice Announcements:
              <input 
                type="checkbox" 
                checked={voiceAnnouncements !== false} 
                onChange={e => setVoiceAnnouncements(e.target.checked ? true : false)} 
              />
              <span className="helper-text" style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
                {voiceAnnouncements !== false 
                  ? 'This task will announce during timers and when scheduled (if enabled in Settings)'
                  : 'This task will not use voice announcements'}
              </span>
            </label>

            <fieldset className="form-section">
              <legend>Assignment</legend>
              {state.children.length === 0 ? (
                <p className="helper-text">Add children first to assign tasks.</p>
              ) : (
                <div className="child-multi-select">
                  <div className="assignment-actions">
                    <button type="button" className="btn btn-ghost" onClick={handleToggleAllChildren}>
                      {allChildrenSelected ? 'Deselect all' : 'Select all'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleClearChildren}
                      disabled={selectedChildIds.length === 0}
                    >
                      Clear
                    </button>
                  </div>
                  {state.children.map((child) => (
                    <label key={child.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedChildIds.includes(child.id)}
                        onChange={() => toggleChildSelection(child.id)}
                      />
                      {child.name}
                    </label>
                  ))}
                </div>
              )}
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Rotation Mode:
                  <span 
                    title="How the task is assigned: Single child (stays with one), Rotate (takes turns), or Simultaneous (all children get it)."
                    style={{ 
                      cursor: 'help', 
                      fontSize: '14px',
                      color: '#666',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#e2e8f0',
                      lineHeight: '1'
                    }}
                  >
                    ℹ️
                  </span>
                </span>
                <select value={rotationMode} onChange={(e) => setRotationMode(e.target.value as RotationMode)}>
                  <option value="single-child">Single child</option>
                  <option value="round-robin">Rotate across children</option>
                  <option value="simultaneous">Assign to all selected children</option>
                </select>
              </label>
              <p className="helper-text">{rotationHelperText}</p>
              
              {rotationMode === 'round-robin' && selectedChildIds.length > 1 && (
                <div className="rotation-order-section">
                  <label>Rotation Order:</label>
                  <p className="helper-text">Drag to reorder which child the task rotates to first, second, third, etc.</p>
                  <div className="rotation-order-list">
                    {rotationOrder.length > 0 ? (
                      rotationOrder.map((childId, index) => {
                        const child = state.children.find(c => c.id === childId);
                        if (!child) return null;
                        return (
                          <div key={childId} className="rotation-order-item">
                            <span className="rotation-order-number">{index + 1}.</span>
                            <span className="rotation-order-name">{child.name}</span>
                            <div className="rotation-order-controls">
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => moveChildInOrder(childId, 'up')}
                                disabled={index === 0}
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => moveChildInOrder(childId, 'down')}
                                disabled={index === rotationOrder.length - 1}
                                title="Move down"
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="helper-text">Select children above to set rotation order</p>
                    )}
                  </div>
                </div>
              )}
              
              {rotationMode === 'round-robin' && (
                <label>
                  Link rotation with another task:
                  <select 
                    value={linkedTaskId || ''} 
                    onChange={(e) => setLinkedTaskId(e.target.value || undefined)}
                  >
                    <option value="">None (independent rotation)</option>
                    {state.tasks
                      .filter(t => t.id !== editingId && t.rotation?.mode === 'round-robin')
                      .map(task => (
                        <option key={task.id} value={task.id}>
                          {task.title || 'Untitled task'}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {rotationMode === 'round-robin' && linkedTaskId && (
                <label>
                  Rotation offset (can be negative):
                  <input
                    type="number"
                    value={linkedTaskOffset}
                    onChange={(e) => setLinkedTaskOffset(Number(e.target.value))}
                  />
                </label>
              )}
            </fieldset>

            {type !== 'oneoff' && (
              <fieldset className="form-section">
                <legend>Schedule</legend>
                <label className="checkbox-item">
                  <input type="checkbox" checked={useCron} onChange={e => setUseCron(e.target.checked)} />
                  Use advanced cron expression
                </label>
                {useCron ? (
                  <label>
                    Cron Expression:
                    <input 
                      type="text" 
                      value={cronExpression}
                      onChange={e => setCronExpression(e.target.value)}
                      placeholder="0 17 * * *"
                    />
                  </label>
                ) : (
                  <>
                    <label>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Frequency:
                        <span 
                          title="How often the task should repeat: Daily, Weekly, Monthly, or Yearly. Combined with Interval, this determines the schedule."
                          style={{ 
                            cursor: 'help', 
                            fontSize: '14px',
                            color: '#666',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: '#e2e8f0',
                            lineHeight: '1'
                          }}
                        >
                          ℹ️
                        </span>
                      </span>
                      <select value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </label>
                    <label>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Interval:
                        <span 
                          title="How often the task repeats. For example, '2' with 'Daily' means every 2 days, or '3' with 'Weekly' means every 3 weeks."
                          style={{ 
                            cursor: 'help', 
                            fontSize: '14px',
                            color: '#666',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: '#e2e8f0',
                            lineHeight: '1'
                          }}
                        >
                          ℹ️
                        </span>
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={interval}
                        onChange={e => setInterval(Math.max(1, Number(e.target.value)))}
                        title="How often the task repeats. For example, '2' with 'Daily' means every 2 days."
                      />
                    </label>
                    <label>
                      Start Date:
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </label>
                    {frequency === 'weekly' && (
                      <div className="weekday-picker">
                        {WEEKDAY_LABELS.map((label, index) => (
                          <label key={label} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={selectedWeekdays.includes(index)}
                              onChange={() => toggleWeekday(index)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}
                    {frequency === 'monthly' && (
                      <label>
                        Day of month:
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={selectedMonthDay}
                          onChange={e => setSelectedMonthDay(Math.min(31, Math.max(1, Number(e.target.value))))}
                        />
                      </label>
                    )}
                    <label>
                      Time of day:
                      <input type="time" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} />
                    </label>
                    <fieldset className="form-subsection">
                      <legend>Ends</legend>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="radio-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name="end-mode"
                            checked={endMode === 'never'}
                            onChange={() => setEndMode('never')}
                          />
                          <span>Never</span>
                        </label>
                        <label className="radio-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <input
                            type="radio"
                            name="end-mode"
                            checked={endMode === 'onDate'}
                            onChange={() => setEndMode('onDate')}
                          />
                          <span>On</span>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            disabled={endMode !== 'onDate'}
                            style={{ marginLeft: '4px' }}
                          />
                        </label>
                        <label className="radio-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <input
                            type="radio"
                            name="end-mode"
                            checked={endMode === 'afterOccurrences'}
                            onChange={() => setEndMode('afterOccurrences')}
                          />
                          <span>After</span>
                          <input
                            type="number"
                            min={1}
                            value={occurrenceCount}
                            onChange={(e) => setOccurrenceCount(Math.max(1, Number(e.target.value)))}
                            disabled={endMode !== 'afterOccurrences'}
                            style={{ width: '60px', marginLeft: '4px' }}
                          />
                          <span>occurrences</span>
                        </label>
                      </div>
                    </fieldset>
                    <button type="button" className="btn btn-ghost" onClick={handleGenerateCron}>
                      Generate cron expression
                    </button>
                  </>
                )}
                <label>
                  Timezone:
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g., America/Chicago"
                  />
                </label>
                {schedulePreviewDefinition && (
                  <div className="schedule-preview">
                    <p className="helper-text">{describeSchedule(schedulePreviewDefinition)}</p>
                    {previewDates.length > 0 ? (
                      <ul>
                        {previewDates.map((iso) => (
                          <li key={iso}>{formatPreviewDateTime(iso)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="helper-text">No upcoming occurrences within the preview window.</p>
                    )}
                  </div>
                )}
              </fieldset>
            )}

            {type === 'oneoff' && (
              <fieldset className="form-section">
                <legend>Due Date</legend>
                <label>
                  Date:
                  <input type="date" value={oneOffDate} onChange={e => setOneOffDate(e.target.value)} />
                </label>
                <label>
                  Time:
                  <input type="time" value={oneOffTime} onChange={e => setOneOffTime(e.target.value)} />
                </label>
              </fieldset>
            )}

            {/* Timed task settings - can be enabled for both recurring and oneoff tasks */}
            <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginTop: '12px' }}>
              <legend style={{ padding: '0 8px', fontSize: '0.9rem', fontWeight: 600, color: '#4a5568' }}>
                ⏱️ Timer Settings
              </legend>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input 
                  type="checkbox" 
                  checked={isTimed} 
                  onChange={e => setIsTimed(e.target.checked)} 
                />
                <span>This is a timed task</span>
              </label>
              {isTimed && (
                <>
                  <label>
                    Allowed Minutes:
                    <input 
                      type="number" 
                      value={allowedMinutes} 
                      min={1} 
                      onChange={e => setAllowedMinutes(Number(e.target.value))} 
                    />
                  </label>
                  <label>
                    Late Penalty (%):
                    <input 
                      type="number" 
                      value={latePenaltyPercent} 
                      min={-500}
                      onChange={e => setLatePenaltyPercent(Number(e.target.value))} 
                    />
                  <p className="helper-text">
                    50 = half reward when late; 150 = -50% (debt).
                  </p>
                  </label>
                  <label>
                    Auto-approve on Stop:
                    <input 
                      type="checkbox" 
                      checked={autoApproveOnStop} 
                      onChange={e => setAutoApproveOnStop(e.target.checked)} 
                    />
                  </label>
                </>
              )}
            </fieldset>
          </form>
        </div>
        <div className="modal-footer">
          <button 
            type="submit" 
            form="task-form"
            className="btn btn-primary"
            data-tour="task-submit-button"
          >
            {editingId ? 'Save' : 'Create'}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
        <PinModal 
          open={pinOpen} 
          onClose={() => { setPinOpen(false); setPendingSave(null); }} 
          onSuccess={() => handlePinSuccess()}
          message="Enter a parent PIN to save changes to this task."
        />
        <AlertModal
          open={alertOpen}
          onClose={() => setAlertOpen(false)}
          title="Approval Required"
          message="Editing tasks requires parent approval, but no approvers are defined. Please add an approver in Settings first."
        />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

type ScheduleFormValues = {
  useCron: boolean;
  cronExpression: string;
  frequency: RecurrenceFrequency;
  interval: number;
  selectedWeekdays: number[];
  selectedMonthDay: number;
  timeOfDay: string;
  startDate: string;
  timezone: string;
  endMode: 'never' | 'onDate' | 'afterOccurrences';
  endDate: string;
  occurrenceCount: number;
};

function buildSchedulePayload(values: ScheduleFormValues): ScheduleDefinition | undefined {
  if (values.useCron) {
    const expr = values.cronExpression.trim();
    if (!expr) return undefined;
    return {
      cronExpression: expr,
      timezone: values.timezone,
    };
  }

  const rule: RecurrenceRule = {
    frequency: values.frequency,
    interval: Math.max(1, values.interval),
    startDate: values.startDate,
    startTime: values.timeOfDay,
    timezone: values.timezone,
  };

  if (values.frequency === 'weekly') {
    rule.byWeekday = values.selectedWeekdays.length > 0 ? (values.selectedWeekdays as Weekday[]) : undefined;
  }
  if (values.frequency === 'monthly') {
    rule.byMonthday = [values.selectedMonthDay];
  }
  if (values.endMode === 'onDate') {
    rule.end = { type: 'afterDate', date: values.endDate };
  } else if (values.endMode === 'afterOccurrences') {
    rule.end = { type: 'afterOccurrences', occurrences: Math.max(1, values.occurrenceCount) };
  }

  return {
    rule,
    dueTime: values.timeOfDay,
    timezone: values.timezone,
  };
}

function buildLegacyRecurringData(
  frequency: RecurrenceFrequency,
  weekdays: number[],
  timeOfDay: string,
): RecurringSettings {
  switch (frequency) {
    case 'weekly':
      return weekdays.length > 0
        ? { cadence: 'custom-days', customDays: weekdays, timeOfDay }
        : { cadence: 'weekly', timeOfDay };
    case 'monthly':
      return { cadence: 'monthly', timeOfDay };
    case 'yearly':
      return { cadence: 'monthly', timeOfDay };
    default:
      return { cadence: 'daily', timeOfDay };
  }
}

function buildDueDate(date: string, time: string): string {
  const baseDate = date || new Date().toISOString().split('T')[0];
  const [hourStr = '00', minuteStr = '00'] = (time || '00:00').split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  // Create date in local timezone to avoid timezone conversion issues
  const due = new Date(`${baseDate}T00:00:00`);
  due.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, 0, 0);
  // Return ISO string - this is correct for storage, but we need to compare dates in local timezone
  return due.toISOString();
}

function formatPreviewDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    return Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  return date.toISOString();
}
