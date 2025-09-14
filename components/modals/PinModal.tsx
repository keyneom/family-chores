import React, { useState } from "react";
import { useChoresApp } from "../ChoresAppContext";

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  message?: string;
  onSuccess: () => void;
}

export default function PinModal({ open, onClose, message, onSuccess }: PinModalProps) {
  const { state } = useChoresApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = () => {
    if (!state.parentSettings.pin) {
      // No PIN set, allow action
      onSuccess();
      onClose();
      return;
    }
    
    if (pin === state.parentSettings.pin) {
      onSuccess();
      onClose();
      setPin("");
      setError("");
    } else {
      setError("Incorrect PIN");
      setPin("");
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
