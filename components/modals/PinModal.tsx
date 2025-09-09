import React from "react";

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function PinModal({ open, onClose, children }: PinModalProps) {
  if (!open) return null;
  return (
    <div className="modal" style={{ display: open ? "block" : "none" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>🔒 Parent Approval Required</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">{children || <p>PIN entry form goes here.</p>}</div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
