import React from "react";

interface OneOffTaskModalProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function OneOffTaskModal({ open, onClose, children }: OneOffTaskModalProps) {
  if (!open) return null;
  return (
    <div className="modal" style={{ display: open ? "block" : "none" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>➕ Add One-off Task</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">{children || <p>One-off task form goes here.</p>}</div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
