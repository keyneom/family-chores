import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useChoresApp } from "../ChoresAppContext";

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  message?: string;
  // onSuccess returns the actor handle (if any) that performed the approval
  onSuccess: (actorHandle?: string) => void;
}

export default function PinModal({ open, onClose, message, onSuccess }: PinModalProps) {
  const { state } = useChoresApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  React.useEffect(() => {
    setPin("");
    setError("");
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const pins = state.parentSettings.pins || [];
    if (pins.length === 0) {
      setError('No approvers defined. Please add an approver in Settings first.');
      return;
    }
    if (!/^[0-9]{4,12}$/.test(pin)) {
      setError('Enter a 4-12 digit PIN');
      return;
    }
    try {
      const { hashPin } = await import('../../utils/pinUtils');
      for (const entry of pins) {
        const hashed = await hashPin(pin, entry.salt);
        if (hashed === entry.pinHash) {
          onSuccess(entry.handle);
          setPin("");
          setError("");
          onClose();
          return;
        }
      }
      setError('PIN not recognized');
      setPin("");
    } catch {
      setError('Verification error');
    }
  };

  const handleClose = () => {
    setPin("");
    setError("");
    onClose();
  };

  const modalContent = (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔒 Parent Approval Required</h2>
          <span className="close" onClick={handleClose}>&times;</span>
        </div>
        <div className="modal-body">
          <p>{message || "Enter parent PIN to continue:"}</p>
          <div className="input-group">
            <label>PIN:</label>
            <input
              type="password"
              placeholder="Enter PIN (4-12 digits)"
              minLength={4}
              maxLength={12}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              style={{ flex: 1 }}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleSubmit}>Submit</button>
          <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document root to prevent it from being constrained by parent containers
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
}
