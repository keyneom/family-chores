import React from "react";
import { createPortal } from "react-dom";

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title = "Confirm",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "btn btn-primary",
}: ConfirmationModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className={confirmButtonClass} onClick={handleConfirm}>
            {confirmText}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

