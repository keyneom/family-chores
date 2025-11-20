import React, { useState } from "react";
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
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);

  React.useEffect(() => {
    if (state.parentSettings.pins && state.parentSettings.pins.length > 0) {
      setSelectedHandle(state.parentSettings.pins[0].handle);
    } else {
      setSelectedHandle(null);
    }
    setPin("");
    setError("");
  }, [open, state.parentSettings.pins]);

  if (!open) return null;

  const handleSubmit = async () => {
    // If named pins exist, prefer secure verification
    const pins = state.parentSettings.pins || [];
    if (pins.length > 0) {
      const chosen = pins.find(p => p.handle === selectedHandle);
      if (!chosen) {
        setError("Please select an approver handle");
        return;
      }
      try {
        // lazy import utils to ensure crypto available in browser
        const { hashPin } = await import('../../utils/pinUtils');
        const h = await hashPin(pin, chosen.salt);
        if (h === chosen.pinHash) {
          onSuccess(chosen.handle);
          onClose();
          setPin("");
          setError("");
          return;
        }
        setError('Incorrect PIN for ' + chosen.handle);
        setPin("");
      } catch {
        setError('Verification error');
      }
      return;
    }
    // If there are no named approvers, inform the user and do not allow
    // approval via this modal — approvers must be created first.
    if (pins.length === 0) {
      setError('No approvers defined. Please add an approver in Settings first.');
      return;
    }
  };

  const handleClose = () => {
    setPin("");
    setError("");
    onClose();
  };

  return (
    <div className="modal" style={{ display: "block" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>🔒 Parent Approval Required</h2>
          <span className="close" onClick={handleClose}>&times;</span>
        </div>
        <div className="modal-body">
          <p>{message || "Enter parent PIN to continue:"}</p>
          {state.parentSettings.pins && state.parentSettings.pins.length > 0 && (
            <div className="input-group">
              <label>Approver:</label>
              <select value={selectedHandle || ''} onChange={(e) => setSelectedHandle(e.target.value)}>
                {state.parentSettings.pins!.map(p => (
                  <option key={p.handle} value={p.handle}>{p.handle}</option>
                ))}
              </select>
            </div>
          )}
          <div className="pin-input">
            <input
              type="password"
              placeholder="Enter 4-digit PIN"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
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
}
