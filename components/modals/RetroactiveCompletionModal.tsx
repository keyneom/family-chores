import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getLocalDateTimeString } from "../../utils/dateUtils";

interface RetroactiveCompletionModalProps {
  open: boolean;
  taskTitle: string;
  isTimedTask: boolean;
  onConfirm: (completedAtIso: string, treatAsOnTime: boolean) => void;
  onCancel: () => void;
}

export default function RetroactiveCompletionModal({
  open,
  taskTitle,
  isTimedTask,
  onConfirm,
  onCancel,
}: RetroactiveCompletionModalProps) {
  const [completedAtLocal, setCompletedAtLocal] = useState(getLocalDateTimeString(new Date()));
  const [treatAsOnTime, setTreatAsOnTime] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCompletedAtLocal(getLocalDateTimeString(new Date()));
    setTreatAsOnTime(true);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log completed in the past</h2>
          <button type="button" className="close" onClick={onCancel} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p className="helper-text" style={{ marginTop: 0 }}>
            Record when <strong>{taskTitle}</strong> was actually completed.
          </p>
          <label htmlFor="retro-completed-at">
            Completed at:
            <input
              id="retro-completed-at"
              type="datetime-local"
              value={completedAtLocal}
              onChange={(e) => setCompletedAtLocal(e.target.value)}
            />
          </label>
          {isTimedTask && (
            <label
              htmlFor="retro-treat-on-time"
              style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12 }}
            >
              <input
                id="retro-treat-on-time"
                type="checkbox"
                checked={treatAsOnTime}
                onChange={(e) => setTreatAsOnTime(e.target.checked)}
              />
              <span>Treat this retroactive completion as on-time (use full base reward).</span>
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onConfirm(new Date(completedAtLocal).toISOString(), treatAsOnTime)}
          >
            Save completion
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
