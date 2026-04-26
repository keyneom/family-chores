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
  OverduePolicy,
  CarryOverPolicy,
  MoneyPolicyMode,
} from "../../types/task";
import { getNextExecutionDateTimes, describeSchedule, buildCronExpressionFromRule, deriveDueTimeFromCron, isValidCronExpression } from "../../utils/recurrenceBuilder";
import { getTheoreticalAssignment } from "../../utils/projectionUtils";
import { computeDueAt } from "../../utils/taskInstanceGeneration";
import { getLocalDateTimeString, getLocalDateString } from "../../utils/dateUtils";
import { hasCustomConsequenceRules } from "../../utils/consequenceEngine";
import {
  buildMissConsequencePayload,
  missConsequenceToFormState,
  taskHasMissConsequenceConfigured,
} from "../../utils/missConsequenceUtils";
import { requiresPin, hasApprovers } from "../../utils/approvalUtils";
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

/** True when saved task data uses non-default overdue, carry-over, miss, or money policy. */
function taskHasAdvancedPolicy(task: Task): boolean {
  const overdue = task.overduePolicy ?? 'none';
  if (overdue !== 'none') return true;
  const grace = task.graceMinutes ?? 15;
  if (grace !== 15) return true;

  const carry = task.carryOverPolicy ?? 'carry_none';
  if (carry !== 'carry_none') return true;
  const carryMax = task.carryMaxDays ?? 3;
  if (carryMax !== 3) return true;

  if (taskHasMissConsequenceConfigured(task.missConsequence)) return true;

  const mp = task.moneyPolicy;
  const mode = mp?.mode ?? 'simple';
  if (mode !== 'simple') return true;

  const tiers = mp?.tiers ?? [];
  for (const t of tiers) {
    if (t.id === 'tier_0_15' && Number(t.value) !== 1) return true;
    if (t.id === 'tier_15_30' && Number(t.value) !== 0) return true;
    if (t.id === 'tier_30_plus' && Number(t.value) !== -1) return true;
  }
  const rate = mp?.continuous?.ratePerMinuteLate;
  const minP = mp?.continuous?.minPayout;
  if (rate !== undefined && Number(rate) !== 0.01) return true;
  if (minP !== undefined && Number(minP) !== -2) return true;

  const undoneEnabled = Boolean(mp?.undonePenalty?.enabled);
  if (undoneEnabled) return true;
  const undone = mp?.undonePenalty?.value;
  if (undone !== undefined && Number(undone) !== -2) return true;

  if (hasCustomConsequenceRules(task)) return true;

  if (task.manualCompletionScore) return true;

  return false;
}

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
  const [oneOffDate, setOneOffDate] = useState(() => getLocalDateString());
  const [oneOffTime, setOneOffTime] = useState("17:00");

  // timed fields
  const [allowedMinutes, setAllowedMinutes] = useState(5);
  const [latePenaltyPercent, setLatePenaltyPercent] = useState(50);
  const [autoApproveOnStop, setAutoApproveOnStop] = useState(false);
  const [overduePolicy, setOverduePolicy] = useState<OverduePolicy>('none');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [carryOverPolicy, setCarryOverPolicy] = useState<CarryOverPolicy>('carry_none');
  const [carryMaxDays, setCarryMaxDays] = useState(3);
  const [missMoneyPenalty, setMissMoneyPenalty] = useState(0);
  const [missStarPenalty, setMissStarPenalty] = useState(0);
  const [missForfeitBaseReward, setMissForfeitBaseReward] = useState(false);
  const [customConsequenceLabel, setCustomConsequenceLabel] = useState('');
  const [moneyPolicyMode, setMoneyPolicyMode] = useState<MoneyPolicyMode>('simple');
  const [tier0to15, setTier0to15] = useState(1);
  const [tier15to30, setTier15to30] = useState(0);
  const [tier30plus, setTier30plus] = useState(-1);
  const [continuousRatePerMinute, setContinuousRatePerMinute] = useState(0.01);
  const [continuousMinPayout, setContinuousMinPayout] = useState(-2);
  const [enableUndonePenalty, setEnableUndonePenalty] = useState(false);
  const [undonePenaltyCutoffMode, setUndonePenaltyCutoffMode] = useState<'next_due' | 'end_of_day' | 'deadline'>('next_due');
  const [undonePenaltyCutoffAt, setUndonePenaltyCutoffAt] = useState('');
  const [undonePenaltyValue, setUndonePenaltyValue] = useState(-2);
  const [startDate, setStartDate] = useState(() => getLocalDateString());
  const [timezone, setTimezone] = useState(
    () => (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC")
  );
  const [endMode, setEndMode] = useState<'never' | 'onDate' | 'afterOccurrences'>('never');
  const [endDate, setEndDate] = useState(() => getLocalDateString());
  const [occurrenceCount, setOccurrenceCount] = useState(10);
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ task?: Task; instance?: TaskInstance } | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [showAdvancedPolicy, setShowAdvancedPolicy] = useState(false);
  const [manualCompletionScore, setManualCompletionScore] = useState(false);
  const [nonCompletable, setNonCompletable] = useState(false);
  const usesAdvancedTimerPayout = isTimed && moneyPolicyMode !== 'simple';

  useEffect(() => {
    const today = getLocalDateString();
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
        setLatePenaltyPercent((initialTask.timed.latePenaltyPercent ?? 0.5) * 100);
        setAutoApproveOnStop(Boolean(initialTask.timed.autoApproveOnStop));
      } else {
        setIsTimed(false);
      }
      setOverduePolicy(initialTask.overduePolicy || 'none');
      setGraceMinutes(initialTask.graceMinutes || 15);
      setCarryOverPolicy(initialTask.carryOverPolicy || 'carry_none');
      setCarryMaxDays(initialTask.carryMaxDays || 3);
      {
        const missForm = missConsequenceToFormState(initialTask.missConsequence);
        setMissMoneyPenalty(missForm.moneyPenalty);
        setMissStarPenalty(missForm.starPenalty);
        setMissForfeitBaseReward(missForm.forfeitBaseReward);
        setCustomConsequenceLabel(missForm.customLabel);
      }
      setMoneyPolicyMode(initialTask.moneyPolicy?.mode || 'simple');
      const loadedTiers = initialTask.moneyPolicy?.tiers || [];
      setTier0to15(Number(loadedTiers.find(t => t.id === 'tier_0_15')?.value ?? 1));
      setTier15to30(Number(loadedTiers.find(t => t.id === 'tier_15_30')?.value ?? 0));
      setTier30plus(Number(loadedTiers.find(t => t.id === 'tier_30_plus')?.value ?? -1));
      setContinuousRatePerMinute(Number(initialTask.moneyPolicy?.continuous?.ratePerMinuteLate ?? 0.01));
      setContinuousMinPayout(Number(initialTask.moneyPolicy?.continuous?.minPayout ?? -2));
      setEnableUndonePenalty(Boolean(initialTask.moneyPolicy?.undonePenalty?.enabled));
      setUndonePenaltyCutoffMode(initialTask.moneyPolicy?.undonePenalty?.cutoffMode || 'next_due');
      setUndonePenaltyCutoffAt(initialTask.moneyPolicy?.undonePenalty?.cutoffAt || '');
      setUndonePenaltyValue(Number(initialTask.moneyPolicy?.undonePenalty?.value ?? -2));
      setManualCompletionScore(Boolean(initialTask.manualCompletionScore));
      setNonCompletable(Boolean(initialTask.nonCompletable));
      setShowAdvancedPolicy(taskHasAdvancedPolicy(initialTask));
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
      setOverduePolicy('none');
      setGraceMinutes(15);
      setCarryOverPolicy('carry_none');
      setCarryMaxDays(3);
      setMissMoneyPenalty(0);
      setMissStarPenalty(0);
      setMissForfeitBaseReward(false);
      setCustomConsequenceLabel('');
      setMoneyPolicyMode('simple');
      setTier0to15(1);
      setTier15to30(0);
      setTier30plus(-1);
      setContinuousRatePerMinute(0.01);
      setContinuousMinPayout(-2);
      setEnableUndonePenalty(false);
      setUndonePenaltyCutoffMode('next_due');
      setUndonePenaltyCutoffAt('');
      setUndonePenaltyValue(-2);
      setManualCompletionScore(false);
      setNonCompletable(false);
      setShowAdvancedPolicy(false);
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
      setOneOffDate(getLocalDateString());
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

  const cronValid = useMemo(() => isValidCronExpression(cronExpression.trim()), [cronExpression]);

  const schedulePreviewDefinition = useMemo(() => {
    if (type === 'oneoff') return undefined;
    try {
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
    } catch {
      // guard against any unexpected parse errors during live editing
      return undefined;
    }
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
  // When linked, get the rotation order from the linked task for display only (not stored)
  const linkedTaskRotationOrder = useMemo(() => {
    if (linkedTaskId && rotationMode === 'round-robin') {
      const linkedTask = state.tasks.find(t => t.id === linkedTaskId);
      if (linkedTask?.rotation) {
        return linkedTask.rotation?.rotationOrder || 
               linkedTask.rotation?.assignedChildIds || 
               linkedTask.assignedChildIds || [];
      }
    }
    return [];
  }, [linkedTaskId, rotationMode, state.tasks]);

  useEffect(() => {
    if (!linkedTaskId) {
      setLinkedTaskOffset(0);
    }
  }, [linkedTaskId]);

  useEffect(() => {
    if (nonCompletable) {
      setIsTimed(false);
      setManualCompletionScore(false);
    }
  }, [nonCompletable]);

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
    try {
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
    } catch {
      // defensive; should never happen
    }
  };

  const performSave = (actorHandle?: string) => {
    const id = editingId ?? `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const nowIsoDate = getLocalDateString();
    const sanitizedLinkedTaskId = linkedTaskId && linkedTaskId !== id ? linkedTaskId : undefined;
    
    // When linked, don't store assignedChildIds or rotationOrder - read from linked task
    // When not linked, use selectedChildIds and rotationOrder
    const normalizedChildIds = sanitizedLinkedTaskId 
      ? [] // Will be read from linked task
      : (selectedChildIds.length > 0 ? selectedChildIds : state.children.map(child => child.id));

    const schedulePayload = type === 'oneoff' ? undefined : schedulePreviewDefinition;
    const rotationStartDate =
      (editingId && (editOption === 'future' || editOption === 'template'))
        ? nowIsoDate
        : initialTask?.assignment?.rotationStartDate || initialTask?.rotation?.startDate || nowIsoDate;
    
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
    const undonePenaltyPayload = enableUndonePenalty
      ? {
          enabled: true,
          cutoffMode: undonePenaltyCutoffMode,
          ...(undonePenaltyCutoffMode === 'deadline' && undonePenaltyCutoffAt
            ? { cutoffAt: undonePenaltyCutoffAt }
            : {}),
          moneyDeltaType: 'absolute' as const,
          value: Number(undonePenaltyValue || 0),
        }
      : undefined;

    const task: Task = {
      id,
      title,
      description: '',
      createdAt: new Date().toISOString(),
      enabled: true,
      requirePin,
      ...(voiceAnnouncements !== undefined && { voiceAnnouncements }),
      manualCompletionScore,
      nonCompletable,
      stars: Number(starReward),
      money: Number(moneyReward),
      type: type as TaskType,
      assignedChildIds: normalizedChildIds,
      rotation: {
        mode: rotationMode,
        assignedChildIds: normalizedChildIds,
        startDate: rotationStartDate,
        // Only store rotationOrder if not linked (linked tasks read from their anchor)
        ...(!sanitizedLinkedTaskId && rotationOrder.length > 0 && { rotationOrder }),
        ...(sanitizedLinkedTaskId && { linkedTaskId: sanitizedLinkedTaskId, linkedTaskOffset: linkedTaskOffset }),
      },
      assignment: assignmentPayload,
      overduePolicy,
      graceMinutes: overduePolicy === 'grace_then_open' ? Math.max(0, Number(graceMinutes || 0)) : undefined,
      carryOverPolicy,
      carryMaxDays: carryOverPolicy === 'carry_with_max_days' ? Math.max(1, Number(carryMaxDays || 1)) : undefined,
      missConsequence: buildMissConsequencePayload(
        missMoneyPenalty,
        missStarPenalty,
        missForfeitBaseReward,
        customConsequenceLabel,
      ),
      moneyPolicy: moneyPolicyMode === 'simple'
        ? {
            mode: 'simple',
            ...(undonePenaltyPayload ? { undonePenalty: undonePenaltyPayload } : {}),
          }
        : moneyPolicyMode === 'tiered'
          ? {
              mode: 'tiered',
              tiers: [
                { id: 'tier_0_15', fromMinutesLate: 0, toMinutesLate: 15, moneyDeltaType: 'absolute', value: Number(tier0to15 || 0) },
                { id: 'tier_15_30', fromMinutesLate: 15, toMinutesLate: 30, moneyDeltaType: 'absolute', value: Number(tier15to30 || 0) },
                { id: 'tier_30_plus', fromMinutesLate: 30, moneyDeltaType: 'absolute', value: Number(tier30plus || 0) },
              ],
              ...(undonePenaltyPayload ? { undonePenalty: undonePenaltyPayload } : {}),
            }
          : {
              mode: 'continuous',
              continuous: {
                ratePerMinuteLate: Number(continuousRatePerMinute || 0),
                minPayout: Number(continuousMinPayout || 0),
              },
              ...(undonePenaltyPayload ? { undonePenalty: undonePenaltyPayload } : {}),
            },
      ...(schedulePayload ? { schedule: schedulePayload } : {}),
      // Add timed settings if isTimed is true (can be on recurring or oneoff)
      ...(!nonCompletable && isTimed ? {
        timed: {
          allowedSeconds: Math.round(allowedMinutes * 60),
          latePenaltyPercent: latePenaltyPercent / 100,
          autoApproveOnStop,
          allowNegative: latePenaltyPercent < 0,
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
          const computedDueAt = type === 'oneoff'
            ? buildDueDate(oneOffDate, oneOffTime)
            : (computeDueAt(task, instance.date) || instance.dueAt);
          const updatedInstance: TaskInstance = {
            ...instance,
            childId: newChildId,
            stars: Number(starReward),
            money: Number(moneyReward),
            titleOverride: title || instance.titleOverride,
            emojiOverride: emoji || instance.emojiOverride,
            colorOverride: color || instance.colorOverride,
            dueAtOverride: computedDueAt || instance.dueAtOverride,
          };
          dispatch({ type: 'UPDATE_TASK_INSTANCE', payload: updatedInstance, actorHandle });
        }
      } else {
        // Edit template (for 'future' or 'template' options, or default)
        dispatch({ type: 'UPDATE_TASK', payload: task, actorHandle });
        if (onSave) onSave(task);

        if (task.type === 'oneoff' && task.oneOff?.dueDate) {
          const dueDateStr = task.oneOff.dueDate.split('T')[0];
          const updatedChildId = selectedChildIds.length > 0 ? selectedChildIds[0] : undefined;
          (state.taskInstances || [])
            .filter((inst) => inst.templateId === task.id && !inst.completed)
            .forEach((inst) => {
              dispatch({
                type: 'UPDATE_TASK_INSTANCE',
                payload: {
                  ...inst,
                  ...(updatedChildId !== undefined ? { childId: updatedChildId } : {}),
                  date: dueDateStr,
                  dueAt: task.oneOff?.dueDate,
                  dueAtOverride: undefined,
                  stars: task.stars,
                  money: task.money,
                },
                actorHandle,
              });
            });
        }
        
        // For recurring tasks, we no longer pre-generate instances.
        // The projection engine will calculate assignments on-the-fly.
        // Only remove uncompleted instances if editing template/future.
        if ((scope === 'template' || scope === 'future') && task.type !== 'oneoff') {
          const todayDate = getLocalDateString();
          const instanceDate = editInstanceId
            ? state.taskInstances.find(inst => inst.id === editInstanceId)?.date
            : undefined;
          const purgeDate = scope === 'future' ? (instanceDate || todayDate) : undefined;
          
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
      dispatch({ type: 'ADD_TASK', payload: task, actorHandle });
      
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
      const approvalRequired = requiresPin({
        action: 'editTasks',
        parentSettings: state.parentSettings,
      });
      if (approvalRequired) {
        if (!hasApprovers(state.parentSettings)) {
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

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'SELECT') {
        e.preventDefault();
      }
    }
  };

  const handlePinSuccess = (actorHandle?: string) => {
    setPinOpen(false);
    if (pendingSave) {
      performSave(actorHandle);
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
          <form id="task-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
            <label htmlFor="task-title">
              Title:
              <input 
                id="task-title"
                name="task-title"
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                required 
                placeholder="Enter task title"
                data-tour="task-title-input"
              />
            </label>
            <label htmlFor="task-emoji">
              Emoji:
              <input 
                id="task-emoji"
                name="task-emoji"
                type="text" 
                value={emoji} 
                onChange={e => setEmoji(e.target.value)} 
                maxLength={2} 
                placeholder="📝"
              />
            </label>
            <label htmlFor="task-color">
              Color:
              <input 
                id="task-color"
                name="task-color"
                type="color" 
                value={color} 
                onChange={e => setColor(e.target.value)} 
              />
            </label>
            <label htmlFor="task-type">
              Type:
              <select id="task-type" name="task-type" value={type} onChange={e => setType(e.target.value as 'recurring' | 'oneoff')}>
                <option value="recurring">Recurring</option>
                <option value="oneoff">One-off</option>
              </select>
            </label>
            <label htmlFor="task-non-completable">
              Behavior:
              <select
                id="task-non-completable"
                name="task-non-completable"
                value={nonCompletable ? 'reminder' : 'completable'}
                onChange={(e) => setNonCompletable(e.target.value === 'reminder')}
              >
                <option value="completable">Completable chore/task</option>
                <option value="reminder">Reminder or note (non-completable)</option>
              </select>
            </label>
            {nonCompletable && (
              <p className="helper-text" style={{ marginTop: -4 }}>
                Reminder tasks can repeat, rotate, and link rotations but children cannot complete them.
              </p>
            )}
            <label htmlFor="task-stars">
              Star Reward:
              <input 
                id="task-stars"
                name="task-stars"
                type="number" 
                value={starReward} 
                min={-10} 
                onChange={e => setStarReward(Number(e.target.value))}
                disabled={nonCompletable}
              />
            </label>
            <label htmlFor="task-money">
              Money Reward:
              <input 
                id="task-money"
                name="task-money"
                type="number" 
                value={moneyReward} 
                step="0.01" 
                onChange={e => setMoneyReward(Number(e.target.value))}
                disabled={nonCompletable}
              />
            </label>
            <label htmlFor="task-require-pin">
              Require PIN:
              <input 
                id="task-require-pin"
                name="task-require-pin"
                type="checkbox" 
                checked={requirePin} 
                onChange={e => setRequirePin(e.target.checked)} 
              />
            </label>
            <label htmlFor="task-voice">
              Voice Announcements:
              <input 
                id="task-voice"
                name="task-voice"
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
              
              {rotationMode === 'round-robin' && linkedTaskId ? (
                // When linked, show a read-only list derived from the linked task
                <div>
                  <label>Rotation Order (from linked task):</label>
                  <p className="helper-text">
                    This task uses the rotation order from &quot;{state.tasks.find(t => t.id === linkedTaskId)?.title || 'linked task'}&quot;. 
                    Edit that task to change which children are assigned and their order.
                  </p>
                  <div className="rotation-order-list">
                    {linkedTaskRotationOrder.length > 0 ? (
                      linkedTaskRotationOrder.map((childId, index) => {
                        const child = state.children.find(c => c.id === childId);
                        if (!child) return null;
                        return (
                          <div key={childId} className="rotation-order-item" style={{ opacity: 0.7 }}>
                            <span className="rotation-order-number">{index + 1}.</span>
                            <span className="rotation-order-name">{child.name}</span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="helper-text">No children assigned in linked task</p>
                    )}
                  </div>
                  <label style={{ marginTop: '12px' }}>
                    Rotation offset (can be negative):
                    <input
                      type="number"
                      value={linkedTaskOffset}
                      onChange={(e) => setLinkedTaskOffset(Number(e.target.value))}
                    />
                    <span className="helper-text" style={{ display: 'block', marginTop: '4px' }}>
                      Offset 0 = same child as linked task, 1 = next child, -1 = previous child, etc.
                    </span>
                  </label>
                </div>
              ) : (
                // When not linked, show combined selection + ordering UI
                <>
                  {state.children.length === 0 ? (
                    <p className="helper-text">Add children first to assign tasks.</p>
                  ) : (
                    <>
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
                      
                      {rotationMode === 'round-robin' ? (
                        // Round-robin: Combined reorderable list (selection + ordering in one)
                        <div className="rotation-order-section">
                          <label>Children and Rotation Order:</label>
                          <p className="helper-text">Select children and reorder them. The order determines rotation sequence.</p>
                          <div className="rotation-order-list">
                            {/* Show selected children in rotation order first */}
                            {rotationOrder.map((childId, orderIndex) => {
                              const child = state.children.find(c => c.id === childId);
                              if (!child) return null;
                              
                              return (
                                <div 
                                  key={childId} 
                                  className="rotation-order-item"
                                >
                                  <label style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={true}
                                      onChange={() => toggleChildSelection(childId)}
                                      style={{ marginRight: '8px' }}
                                    />
                                    <span className="rotation-order-number" style={{ marginRight: '8px', minWidth: '24px' }}>
                                      {orderIndex + 1}.
                                    </span>
                                    <span className="rotation-order-name">{child.name}</span>
                                  </label>
                                  <div className="rotation-order-controls">
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      onClick={() => moveChildInOrder(childId, 'up')}
                                      disabled={orderIndex === 0}
                                      title="Move up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      onClick={() => moveChildInOrder(childId, 'down')}
                                      disabled={orderIndex === rotationOrder.length - 1}
                                      title="Move down"
                                    >
                                      ↓
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {/* Then show unselected children */}
                            {state.children
                              .filter(child => !selectedChildIds.includes(child.id))
                              .map((child) => (
                                <div 
                                  key={child.id} 
                                  className="rotation-order-item"
                                  style={{ opacity: 0.6 }}
                                >
                                  <label style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={false}
                                      onChange={() => toggleChildSelection(child.id)}
                                      style={{ marginRight: '8px' }}
                                    />
                                    <span className="rotation-order-name">{child.name}</span>
                                  </label>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : rotationMode === 'simultaneous' ? (
                        // Simultaneous: Just checkboxes (no ordering needed)
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
                      ) : (
                        // Single child: Just checkboxes (only one can be selected)
                        <div className="child-multi-select">
                          {state.children.map((child) => (
                            <label key={child.id} className="checkbox-item">
                              <input
                                type="radio"
                                name="single-child-selection"
                                checked={selectedChildIds.includes(child.id)}
                                onChange={() => {
                                  if (!selectedChildIds.includes(child.id)) {
                                    setSelectedChildIds([child.id]);
                                  }
                                }}
                              />
                              {child.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
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
                  <label htmlFor="schedule-cron">
                    Cron Expression:
                    <input 
                      id="schedule-cron"
                      name="schedule-cron"
                      type="text" 
                      value={cronExpression}
                      onChange={e => setCronExpression(e.target.value)}
                      placeholder="0 17 * * *"
                    />
                    {!cronValid && cronExpression.trim().length > 0 && (
                      <p className="helper-text" style={{ color: 'red' }}>
                        Invalid cron expression
                      </p>
                    )}
                  </label>
                ) : (
                  <>
                    <label htmlFor="schedule-frequency">
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
                      <select id="schedule-frequency" name="schedule-frequency" value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </label>
                    <label htmlFor="schedule-interval">
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
                        id="schedule-interval"
                        name="schedule-interval"
                        type="number"
                        min={1}
                        value={interval}
                        onChange={e => setInterval(Math.max(1, Number(e.target.value)))}
                        title="How often the task repeats. For example, '2' with 'Daily' means every 2 days."
                      />
                    </label>
                    <label htmlFor="schedule-start-date">
                      Start Date:
                      <input
                        id="schedule-start-date"
                        name="schedule-start-date"
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                      />
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
                      <label htmlFor="schedule-month-day">
                        Day of month:
                        <input
                          id="schedule-month-day"
                          name="schedule-month-day"
                          type="number"
                          min={1}
                          max={31}
                          value={selectedMonthDay}
                          onChange={e => setSelectedMonthDay(Math.min(31, Math.max(1, Number(e.target.value))))}
                        />
                      </label>
                    )}
                    <label htmlFor="schedule-time">
                      Time of day:
                      <input id="schedule-time" name="schedule-time" type="time" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} />
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
                            id="schedule-end-date"
                            name="schedule-end-date"
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
                            id="schedule-occurrences"
                            name="schedule-occurrences"
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
                <label htmlFor="schedule-timezone">
                  Timezone:
                  <input
                    id="schedule-timezone"
                    name="schedule-timezone"
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
                <label htmlFor="oneoff-date">
                  Date:
                  <input
                    id="oneoff-date"
                    name="oneoff-date"
                    type="date"
                    value={oneOffDate}
                    onChange={e => setOneOffDate(e.target.value)}
                  />
                </label>
                <label htmlFor="oneoff-time">
                  Time:
                  <input
                    id="oneoff-time"
                    name="oneoff-time"
                    type="time"
                    value={oneOffTime}
                    onChange={e => setOneOffTime(e.target.value)}
                  />
                </label>
              </fieldset>
            )}

            {/* Timed task settings - can be enabled for both recurring and oneoff tasks */}
            {!nonCompletable && (
            <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginTop: '12px' }}>
              <legend style={{ padding: '0 8px', fontSize: '0.9rem', fontWeight: 600, color: '#4a5568' }}>
                ⏱️ Timer Settings
              </legend>
              <label htmlFor="timed-enabled" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input 
                  id="timed-enabled"
                  name="timed-enabled"
                  type="checkbox" 
                  checked={isTimed} 
                  onChange={e => setIsTimed(e.target.checked)} 
                />
                <span>This is a timed task</span>
              </label>
              {isTimed && (
                <>
                  <label htmlFor="timed-allowed-minutes">
                    Allowed Minutes:
                    <input 
                      id="timed-allowed-minutes"
                      name="timed-allowed-minutes"
                      type="number" 
                      value={allowedMinutes} 
                      min={1} 
                      onChange={e => setAllowedMinutes(Number(e.target.value))} 
                    />
                  </label>
                  <label htmlFor="timed-late-penalty">
                    Late Timer Payout (%):
                    <input 
                      id="timed-late-penalty"
                      name="timed-late-penalty"
                      type="number" 
                      value={latePenaltyPercent} 
                      min={-500}
                      disabled={usesAdvancedTimerPayout}
                      onChange={e => setLatePenaltyPercent(Number(e.target.value))} 
                    />
                  <p className="helper-text">
                    50 = half reward when late; 0 = no money; -50 = child loses half the base money reward.
                  </p>
                  {usesAdvancedTimerPayout && (
                    <p className="helper-text" style={{ marginTop: 4 }}>
                      Advanced Timer Money Rules are enabled below, so this percentage is currently ignored.
                    </p>
                  )}
                  </label>
                  <label htmlFor="timed-auto-approve">
                    Auto-approve on Stop:
                    <input 
                      id="timed-auto-approve"
                      name="timed-auto-approve"
                      type="checkbox" 
                      checked={autoApproveOnStop} 
                      onChange={e => setAutoApproveOnStop(e.target.checked)} 
                    />
                  </label>
                </>
              )}
            </fieldset>
            )}

            {!nonCompletable && (
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                id="task-modal-advanced-policy-toggle"
                className="btn btn-secondary"
                aria-expanded={showAdvancedPolicy}
                aria-controls="task-modal-advanced-policy-panel"
                onClick={() => setShowAdvancedPolicy((v) => !v)}
              >
                {showAdvancedPolicy ? 'Hide advanced policy settings' : 'Show advanced policy settings'}
              </button>
              {!showAdvancedPolicy && (
                <p className="helper-text" style={{ marginTop: '8px', marginBottom: 0 }}>
                  Using default scheduling and rewards. Open the section above to customize overdue behavior, carry-over, missed consequences, and money rules.
                </p>
              )}
              <div
                id="task-modal-advanced-policy-panel"
                hidden={!showAdvancedPolicy}
                style={showAdvancedPolicy ? { marginTop: '12px' } : undefined}
              >
                <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginTop: 0 }}>
                  <legend style={{ padding: '0 8px', fontSize: '0.9rem', fontWeight: 600, color: '#4a5568' }}>
                    Overdue, Carry-over, and Consequences
                  </legend>
                  {initialTask && hasCustomConsequenceRules(initialTask) && (
                    <p className="helper-text" style={{ marginTop: 0 }}>
                      Custom consequence rules are active for this task. These override the default timer payout behavior.
                    </p>
                  )}
                  <h4 style={{ margin: '8px 0 6px', fontSize: '0.95rem' }}>Who can complete after due time</h4>
                  <label htmlFor="overdue-policy">
                    Overdue Policy:
                    <select id="overdue-policy" value={overduePolicy} onChange={(e) => setOverduePolicy(e.target.value as OverduePolicy)}>
                      <option value="none">Only assigned child can complete on scheduled day</option>
                      <option value="expire">Expire at due time</option>
                      <option value="open_claim">Up for grabs after due time</option>
                      <option value="grace_then_open">Grace period then up for grabs</option>
                    </select>
                  </label>
                  {overduePolicy === 'grace_then_open' && (
                    <label htmlFor="grace-minutes">
                      Grace Minutes:
                      <input id="grace-minutes" type="number" min={0} value={graceMinutes} onChange={(e) => setGraceMinutes(Number(e.target.value))} />
                    </label>
                  )}
                  <p className="helper-text" style={{ marginTop: 6 }}>
                    Preview: {overduePolicy === 'expire'
                      ? 'Task expires at due time.'
                      : overduePolicy === 'open_claim'
                        ? 'Any child may claim it after due time.'
                        : overduePolicy === 'grace_then_open'
                          ? `Assigned child has ${Math.max(0, Number(graceMinutes || 0))} minute grace, then it becomes claimable.`
                          : 'Assigned child can complete on schedule; no post-due claim behavior.'}
                  </p>

                  <h4 style={{ margin: '12px 0 6px', fontSize: '0.95rem' }}>If missed</h4>
                  <label htmlFor="carry-policy">
                    Carry-over:
                    <select id="carry-policy" value={carryOverPolicy} onChange={(e) => setCarryOverPolicy(e.target.value as CarryOverPolicy)}>
                      <option value="carry_none">Do not carry unfinished tasks</option>
                      <option value="carry_until_complete">Carry until complete</option>
                      <option value="carry_with_max_days">Carry with max days</option>
                    </select>
                  </label>
                  {carryOverPolicy === 'carry_with_max_days' && (
                    <label htmlFor="carry-max-days">
                      Max Carry Days:
                      <input id="carry-max-days" type="number" min={1} value={carryMaxDays} onChange={(e) => setCarryMaxDays(Number(e.target.value))} />
                    </label>
                  )}
                  <fieldset style={{ border: 'none', padding: 0, margin: '12px 0 0' }}>
                    <legend style={{ padding: 0, fontSize: '0.95rem', fontWeight: 600, color: '#4a5568', marginBottom: 8 }}>
                      If the chore is missed (e.g. carry-over expires)
                    </legend>
                    <p className="helper-text" style={{ marginTop: 0 }}>
                      You can combine options: subtract money and stars, forfeit the task payout, and add a note shown on the instance.
                    </p>
                    <label htmlFor="miss-money-penalty" style={{ display: 'block', marginTop: 10 }}>
                      Subtract money ($)
                      <input
                        id="miss-money-penalty"
                        type="number"
                        step="0.01"
                        min={0}
                        value={missMoneyPenalty}
                        onChange={(e) => setMissMoneyPenalty(Number(e.target.value))}
                      />
                    </label>
                    <label htmlFor="miss-star-penalty" style={{ display: 'block', marginTop: 10 }}>
                      Subtract stars
                      <input
                        id="miss-star-penalty"
                        type="number"
                        step="1"
                        min={0}
                        value={missStarPenalty}
                        onChange={(e) => setMissStarPenalty(Number(e.target.value))}
                      />
                    </label>
                    <label htmlFor="miss-forfeit-base" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
                      <input
                        id="miss-forfeit-base"
                        type="checkbox"
                        checked={missForfeitBaseReward}
                        onChange={(e) => setMissForfeitBaseReward(e.target.checked)}
                      />
                      <span>Forfeit this task&apos;s base stars and money on a miss (no payout from the chore itself).</span>
                    </label>
                    <label htmlFor="custom-consequence" style={{ display: 'block', marginTop: 10 }}>
                      Custom note (optional)
                      <input
                        id="custom-consequence"
                        type="text"
                        value={customConsequenceLabel}
                        onChange={(e) => setCustomConsequenceLabel(e.target.value)}
                        placeholder="e.g. donate a toy to the sibling bin"
                      />
                    </label>
                  </fieldset>
                  <p className="helper-text" style={{ marginTop: 6 }}>
                    Preview: {carryOverPolicy === 'carry_none'
                      ? 'If not done, it is treated as missed after the scheduled day.'
                      : carryOverPolicy === 'carry_with_max_days'
                        ? `Carries forward up to ${Math.max(1, Number(carryMaxDays || 1))} day(s) before becoming missed.`
                        : 'Carries forward until completed.'}
                    {(Number(missMoneyPenalty || 0) > 0 || Number(missStarPenalty || 0) > 0 || missForfeitBaseReward || customConsequenceLabel.trim())
                      ? ` Miss result: ${missForfeitBaseReward ? 'no base payout' : 'base payout remains'}${Number(missStarPenalty || 0) > 0 ? `, -${Number(missStarPenalty || 0)} star(s)` : ''}${Number(missMoneyPenalty || 0) > 0 ? `, -$${Number(missMoneyPenalty || 0).toFixed(2)}` : ''}${customConsequenceLabel.trim() ? `, note: "${customConsequenceLabel.trim()}"` : ''}.`
                      : ' No additional missed-task consequence configured.'}
                  </p>

                  <h4 style={{ margin: '12px 0 6px', fontSize: '0.95rem' }}>Completion review</h4>
                  <label htmlFor="manual-completion-score" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '12px' }}>
                    <input
                      id="manual-completion-score"
                      type="checkbox"
                      checked={manualCompletionScore}
                      onChange={(e) => setManualCompletionScore(e.target.checked)}
                    />
                    <span>
                      Parent sets quality score (0–100%) when completing or approving timed runs. Rewards scale from the task’s base stars and money; you can change the score afterward with &quot;Adjust %&quot; on the task row.
                    </span>
                  </label>
                </fieldset>

                <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginTop: '12px' }}>
                  <legend style={{ padding: '0 8px', fontSize: '0.9rem', fontWeight: 600, color: '#4a5568' }}>
                    {isTimed ? 'Advanced Timer Money Rules' : 'Scheduled Late Money Rules'}
                  </legend>
                  {isTimed ? (
                    <>
                      <label htmlFor="use-advanced-timer-money-rules" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <input
                          id="use-advanced-timer-money-rules"
                          type="checkbox"
                          checked={usesAdvancedTimerPayout}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMoneyPolicyMode((prev) => (prev === 'simple' ? 'tiered' : prev));
                            } else {
                              setMoneyPolicyMode('simple');
                            }
                          }}
                        />
                        <span>Override the timer percentage with advanced timer payout rules.</span>
                      </label>
                      {!usesAdvancedTimerPayout && (
                        <p className="helper-text" style={{ marginTop: 6 }}>
                          Using only Late Timer Payout (%) from Timer Settings.
                        </p>
                      )}
                      {usesAdvancedTimerPayout && (
                        <>
                          <label htmlFor="money-policy-mode">
                            Advanced timer rule mode:
                            <select id="money-policy-mode" value={moneyPolicyMode} onChange={(e) => setMoneyPolicyMode(e.target.value as MoneyPolicyMode)}>
                              <option value="tiered">Tiered windows</option>
                              <option value="continuous">Continuous decay ($/minute)</option>
                            </select>
                          </label>
                          {moneyPolicyMode === 'tiered' && (
                            <>
                              <label htmlFor="tier-0-15">0-15 min late payout:
                                <input id="tier-0-15" type="number" step="0.01" value={tier0to15} onChange={(e) => setTier0to15(Number(e.target.value))} />
                              </label>
                              <label htmlFor="tier-15-30">15-30 min late payout:
                                <input id="tier-15-30" type="number" step="0.01" value={tier15to30} onChange={(e) => setTier15to30(Number(e.target.value))} />
                              </label>
                              <label htmlFor="tier-30-plus">&gt;30 min late payout:
                                <input id="tier-30-plus" type="number" step="0.01" value={tier30plus} onChange={(e) => setTier30plus(Number(e.target.value))} />
                              </label>
                            </>
                          )}
                          {moneyPolicyMode === 'continuous' && (
                            <>
                              <label htmlFor="continuous-rate">Subtract $ per minute late:
                                <input id="continuous-rate" type="number" step="0.01" min={0} value={continuousRatePerMinute} onChange={(e) => setContinuousRatePerMinute(Number(e.target.value))} />
                              </label>
                              <label htmlFor="continuous-min-payout">Minimum payout:
                                <input id="continuous-min-payout" type="number" step="0.01" value={continuousMinPayout} onChange={(e) => setContinuousMinPayout(Number(e.target.value))} />
                              </label>
                            </>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="helper-text" style={{ marginTop: 0 }}>
                        For non-timed tasks, use these rules to define money outcomes when completion happens after due time.
                      </p>
                      <label htmlFor="money-policy-mode">
                        Money Policy Mode:
                        <select id="money-policy-mode" value={moneyPolicyMode} onChange={(e) => setMoneyPolicyMode(e.target.value as MoneyPolicyMode)}>
                          <option value="simple">Simple (base reward)</option>
                          <option value="tiered">Tiered windows</option>
                          <option value="continuous">Continuous decay ($/minute)</option>
                        </select>
                      </label>
                      {moneyPolicyMode === 'tiered' && (
                        <>
                          <label htmlFor="tier-0-15">0-15 min late payout:
                            <input id="tier-0-15" type="number" step="0.01" value={tier0to15} onChange={(e) => setTier0to15(Number(e.target.value))} />
                          </label>
                          <label htmlFor="tier-15-30">15-30 min late payout:
                            <input id="tier-15-30" type="number" step="0.01" value={tier15to30} onChange={(e) => setTier15to30(Number(e.target.value))} />
                          </label>
                          <label htmlFor="tier-30-plus">&gt;30 min late payout:
                            <input id="tier-30-plus" type="number" step="0.01" value={tier30plus} onChange={(e) => setTier30plus(Number(e.target.value))} />
                          </label>
                        </>
                      )}
                      {moneyPolicyMode === 'continuous' && (
                        <>
                          <label htmlFor="continuous-rate">Subtract $ per minute late:
                            <input id="continuous-rate" type="number" step="0.01" min={0} value={continuousRatePerMinute} onChange={(e) => setContinuousRatePerMinute(Number(e.target.value))} />
                          </label>
                          <label htmlFor="continuous-min-payout">Minimum payout:
                            <input id="continuous-min-payout" type="number" step="0.01" value={continuousMinPayout} onChange={(e) => setContinuousMinPayout(Number(e.target.value))} />
                          </label>
                        </>
                      )}
                    </>
                  )}
                  <label htmlFor="enable-undone-penalty" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
                    <input
                      id="enable-undone-penalty"
                      type="checkbox"
                      checked={enableUndonePenalty}
                      onChange={(e) => setEnableUndonePenalty(e.target.checked)}
                    />
                    <span>Apply an additional money penalty when a chore remains undone past a chosen trigger.</span>
                  </label>
                  {enableUndonePenalty && (
                    <>
                      <label htmlFor="undone-penalty-cutoff-mode">
                        Undone penalty trigger:
                        <select
                          id="undone-penalty-cutoff-mode"
                          value={undonePenaltyCutoffMode}
                          onChange={(e) => setUndonePenaltyCutoffMode(e.target.value as 'next_due' | 'end_of_day' | 'deadline')}
                        >
                          <option value="next_due">After the next scheduled occurrence passes</option>
                          <option value="end_of_day">End of the scheduled day</option>
                          <option value="deadline">Specific deadline timestamp</option>
                        </select>
                      </label>
                      {undonePenaltyCutoffMode === 'deadline' && (
                        <label htmlFor="undone-penalty-cutoff-at">
                          Deadline timestamp:
                          <input
                            id="undone-penalty-cutoff-at"
                            type="datetime-local"
                            value={undonePenaltyCutoffAt}
                            onChange={(e) => setUndonePenaltyCutoffAt(e.target.value)}
                          />
                        </label>
                      )}
                      <label htmlFor="undone-penalty-value">
                        Additional money penalty:
                        <input id="undone-penalty-value" type="number" step="0.01" value={undonePenaltyValue} onChange={(e) => setUndonePenaltyValue(Number(e.target.value))} />
                      </label>
                    </>
                  )}
                </fieldset>
              </div>
            </div>
            )}
          </form>
        </div>
        <div className="modal-footer">
          <button 
            type="submit" 
            form="task-form"
            className="btn btn-primary"
            data-tour="task-submit-button"
            disabled={useCron && !cronValid}
            title={useCron && !cronValid ? 'Fix the cron expression before saving' : undefined}
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
          onSuccess={handlePinSuccess}
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
    // guard against garbage input; deriveDueTimeFromCron never throws now.
    if (!isValidCronExpression(expr)) {
      return undefined;
    }
    const derivedDueTime = deriveDueTimeFromCron(expr);
    return {
      cronExpression: expr,
      timezone: values.timezone,
      ...(derivedDueTime ? { dueTime: derivedDueTime } : {}),
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
  const baseDate = date || getLocalDateString();
  const [hourStr = '00', minuteStr = '00'] = (time || '00:00').split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  // Create date in local timezone to avoid timezone conversion issues
  const due = new Date(`${baseDate}T00:00:00`);
  due.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, 0, 0);
  return getLocalDateTimeString(due);
}

function formatPreviewDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    return Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  return date.toISOString();
}
