import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { applyQualityMultiplier, clampQualityPercent } from "../../utils/qualityScoreUtils";

export interface CompletionScoreModalProps {
  open: boolean;
  title: string;
  description?: string;
  /** Initial slider value (0–100). */
  initialPercent?: number;
  baseStars: number;
  baseMoney: number;
  confirmLabel?: string;
  onConfirm: (percent: number) => void;
  onCancel: () => void;
}

export default function CompletionScoreModal({
  open,
  title,
  description,
  initialPercent = 100,
  baseStars,
  baseMoney,
  confirmLabel = "Apply",
  onConfirm,
  onCancel,
}: CompletionScoreModalProps) {
  const [mounted, setMounted] = useState(false);
  const [percent, setPercent] = useState(initialPercent);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (open) setPercent(initialPercent);
  }, [open, initialPercent]);

  if (!open || !mounted) return null;

  const pct = clampQualityPercent(percent);
  const preview = applyQualityMultiplier(baseStars, baseMoney, pct);

  const modalContent = (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-score-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="completion-score-title">{title}</h2>
          <button type="button" className="close" onClick={onCancel} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          {description ? <p className="helper-text" style={{ marginTop: 0 }}>{description}</p> : null}
          <label htmlFor="completion-quality-range" style={{ display: "block", marginTop: "12px", fontWeight: 600 }}>
            How well was it done? ({pct}%)
          </label>
          <input
            id="completion-quality-range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setPercent(Number(e.target.value))}
            style={{ width: "100%", marginTop: "8px" }}
          />
          <p className="helper-text" style={{ marginBottom: 0 }}>
            Rewards for this completion: ⭐ {preview.stars} · 💰 ${preview.money.toFixed(2)} (from base ⭐ {baseStars} · $
            {Number(baseMoney).toFixed(2)})
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={() => onConfirm(pct)}>
            {confirmLabel}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
