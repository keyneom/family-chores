import React from "react";


import { Chore } from "../ChoresAppContext";

interface TaskEditModalProps {
  open: boolean;
  onClose: () => void;
  task: Chore | null;
  onSave: (task: Chore) => void;
}

export default function TaskEditModal({ open, onClose, task, onSave }: TaskEditModalProps) {
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState("");
  const [color, setColor] = React.useState("#cccccc");
  const [starReward, setStarReward] = React.useState(1);
  const [moneyReward, setMoneyReward] = React.useState(0);
  const [recurrence, setRecurrence] = React.useState("daily");
  const [customDays, setCustomDays] = React.useState<number[]>([]);
  const [timed, setTimed] = React.useState(false);
  const [allowedMinutes, setAllowedMinutes] = React.useState(5);
  const [latePenaltyPercent, setLatePenaltyPercent] = React.useState(50);
  const [autoApproveOnStop, setAutoApproveOnStop] = React.useState(false);

  React.useEffect(() => {
    if (task) {
      setName(task.name);
      setEmoji(task.emoji);
      setColor(task.color);
      setStarReward(task.starReward);
      setMoneyReward(task.moneyReward);
      setRecurrence(task.recurrence);
      setCustomDays(task.customDays);
      setTimed(!!task.timed);
      setAllowedMinutes(task.allowedSeconds ? Math.round(task.allowedSeconds / 60) : 5);
      setLatePenaltyPercent(task.latePenaltyPercent ? Math.round(task.latePenaltyPercent * 100) : 50);
      setAutoApproveOnStop(!!task.autoApproveOnStop);
    }
  }, [task]);

  if (!open || !task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...task, name, emoji, color, starReward, moneyReward, recurrence, customDays, timed, allowedSeconds: Math.round(allowedMinutes * 60), latePenaltyPercent: latePenaltyPercent / 100, autoApproveOnStop });
  };
  
  const handleCustomDayChange = (day: number, checked: boolean) => {
    if (checked) {
      setCustomDays([...customDays, day]);
    } else {
      setCustomDays(customDays.filter(d => d !== day));
    }
  };

  return (
    <div className="modal" style={{ display: open ? "block" : "none" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>✏️ Edit Task</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label>
            Name:
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label>
            Emoji:
            <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} required />
          </label>
          <label>
            Color:
            <input type="color" value={color} onChange={e => setColor(e.target.value)} />
          </label>
          <label>
            Star Reward:
            <input type="number" value={starReward} min={0} onChange={e => setStarReward(Number(e.target.value))} />
          </label>
          <label>
            Money Reward:
            <input type="number" value={moneyReward} min={0} step={0.01} onChange={e => setMoneyReward(Number(e.target.value))} />
          </label>
          <label>
            Timed Task:
            <input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} />
          </label>
          {timed && (
            <>
              <label>
                Allowed Minutes:
                <input type="number" value={allowedMinutes} min={1} onChange={e => setAllowedMinutes(Number(e.target.value))} />
              </label>
              <label>
                Late Penalty (% of reward when late):
                <input type="number" value={latePenaltyPercent} min={-200} max={200} onChange={e => setLatePenaltyPercent(Number(e.target.value))} />
              </label>
              <label>
                Auto-approve on Stop:
                <input type="checkbox" checked={autoApproveOnStop} onChange={e => setAutoApproveOnStop(e.target.checked)} />
              </label>
            </>
          )}
          <label>
            Recurrence:
            <select value={recurrence} onChange={e => setRecurrence(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="weekdays">Weekdays Only</option>
              <option value="weekends">Weekends Only</option>
              <option value="custom-days">Specific Days</option>
            </select>
          </label>
          {recurrence === "custom-days" && (
            <div className="custom-days">
              <label>Select days:</label>
              <div className="days-checkboxes">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                  <label key={index}>
                    <input
                      type="checkbox"
                      checked={customDays.includes(index)}
                      onChange={(e) => handleCustomDayChange(index, e.target.checked)}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="modal-footer">
            <button className="btn btn-primary" type="submit">Save</button>
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
