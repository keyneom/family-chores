import React, { useEffect, useState } from "react";
import { useChoresApp } from "../ChoresAppContext";
import type { Task, TaskType, TaskTimed, TaskOneOff, TaskRecurring } from "../../types/task";

export interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  // optional initial task to edit
  initialTask?: Task | null;
  // optional callback when saved (used to sync legacy chores state)
  onSave?: (task: Task) => void;
}

export default function TaskModal({ open, onClose, initialTask = null, onSave }: TaskModalProps) {
  const { dispatch } = useChoresApp();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#cccccc");
  const [type, setType] = useState<'recurring'|'oneoff'|'timed'>('recurring');
  const [starReward, setStarReward] = useState(1);
  const [moneyReward, setMoneyReward] = useState(0);
  const [requirePin, setRequirePin] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // timed fields
  const [allowedMinutes, setAllowedMinutes] = useState(5);
  const [latePenaltyPercent, setLatePenaltyPercent] = useState(50);
  const [autoApproveOnStop, setAutoApproveOnStop] = useState(false);

  useEffect(() => {
    if (initialTask) {
      setEditingId(String(initialTask.id));
      const rec = initialTask as unknown as Record<string, unknown>;
      setTitle((initialTask.title as string) || (rec.name as string) || '');
      setEmoji((rec.emoji as string) || '');
      setColor((rec.color as string) || '#cccccc');
      setType((initialTask.type as TaskType) || 'recurring');
      setStarReward(typeof rec.stars === 'number' ? (rec.stars as number) : 1);
      setMoneyReward(typeof rec.money === 'number' ? (rec.money as number) : 0);
      setRequirePin(typeof rec.requirePin === 'boolean' ? (rec.requirePin as boolean) : false);
      if ((rec.type as string) === 'timed' && rec.timed) {
        const timed = rec.timed as Record<string, unknown>;
        setAllowedMinutes(Math.round(((timed.allowedSeconds as number) || 60) / 60));
        setLatePenaltyPercent(((timed.latePenaltyPercent as number) ?? 0) * 100);
        setAutoApproveOnStop(Boolean(timed.autoApproveOnStop));
      }
    } else {
      // reset
      setEditingId(null);
      setTitle(''); setEmoji(''); setColor('#cccccc'); setType('recurring'); setStarReward(1); setMoneyReward(0); setRequirePin(false);
      setAllowedMinutes(5); setLatePenaltyPercent(50); setAutoApproveOnStop(false);
    }
  }, [initialTask, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingId ?? `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

    const base: Omit<Task, 'type' | 'id' | 'createdAt'> & { id: string; createdAt: string } = {
      id,
      title,
      description: '',
      createdAt: new Date().toISOString(),
      enabled: true,
      requirePin,
      stars: Number(starReward),
      money: Number(moneyReward),
    } as unknown as Omit<Task, 'type' | 'id' | 'createdAt'> & { id: string; createdAt: string };

    let task: Task;
    if (type === 'timed') {
      task = {
        ...base,
        type: 'timed',
        timed: {
          allowedSeconds: Math.round(allowedMinutes * 60),
          latePenaltyPercent: latePenaltyPercent / 100,
          autoApproveOnStop,
          allowNegative: false,
        },
      } as TaskTimed;
    } else if (type === 'oneoff') {
      task = {
        ...base,
        type: 'oneoff',
        oneOff: { dueDate: new Date().toISOString() },
        completed: false,
      } as TaskOneOff;
    } else {
      task = {
        ...base,
        type: 'recurring',
        recurring: { cadence: 'daily' },
      } as TaskRecurring;
    }

    if (editingId) {
      dispatch({ type: 'UPDATE_TASK', payload: task });
      if (onSave) onSave(task);
    } else {
      dispatch({ type: 'ADD_TASK', payload: task });
    }

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{editingId ? 'Edit Task' : 'Create Task'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Title:
            <input value={title} onChange={e => setTitle(e.target.value)} required />
          </label>
          <label>
            Emoji:
            <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} />
          </label>
          <label>
            Color:
            <input type="color" value={color} onChange={e => setColor(e.target.value)} />
          </label>
          <label>
            Type:
            <select value={type} onChange={e => setType(e.target.value as unknown as TaskType)}>
              <option value="recurring">Recurring</option>
              <option value="oneoff">One-off</option>
              <option value="timed">Timed</option>
            </select>
          </label>
          <label>
            Star Reward:
            <input type="number" value={starReward} min={-10} onChange={e => setStarReward(Number(e.target.value))} />
          </label>
          <label>
            Money Reward:
            <input type="number" value={moneyReward} step="0.01" onChange={e => setMoneyReward(Number(e.target.value))} />
          </label>
          <label>
            Require PIN:
            <input type="checkbox" checked={requirePin} onChange={e => setRequirePin(e.target.checked)} />
          </label>

          {type === 'timed' && (
            <>
              <label>
                Allowed Minutes:
                <input type="number" value={allowedMinutes} min={1} onChange={e => setAllowedMinutes(Number(e.target.value))} />
              </label>
              <label>
                Late Penalty (%):
                <input type="number" value={latePenaltyPercent} onChange={e => setLatePenaltyPercent(Number(e.target.value))} />
              </label>
              <label>
                Auto-approve on Stop:
                <input type="checkbox" checked={autoApproveOnStop} onChange={e => setAutoApproveOnStop(e.target.checked)} />
              </label>
            </>
          )}

          <div className="modal-actions">
            <button type="submit">{editingId ? 'Save' : 'Create'}</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
