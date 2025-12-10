import React from "react";
import { createPortal } from "react-dom";

interface AlertModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  buttonText?: string;
  buttonClass?: string;
}

export default function AlertModal({
  open,
  onClose,
  title = "Alert",
  message,
  buttonText = "OK",
  buttonClass = "btn btn-primary",
}: AlertModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

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
          <button className={buttonClass} onClick={onClose}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

