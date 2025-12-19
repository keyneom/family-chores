import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Task } from "../../types/task";

export type DragDropOption = 'instance' | 'redo-rotations';

interface DragDropConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (option: DragDropOption) => void;
  task: Task | null;
  taskTitle?: string;
  targetChildName?: string;
}

export default function DragDropConfirmModal({
  open,
  onClose,
  onConfirm,
  task,
  taskTitle,
  targetChildName,
}: DragDropConfirmModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<DragDropOption>('instance');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (open && task) {
      // Default to 'instance' for moving just this occurrence
      setSelectedOption('instance');
    }
  }, [open, task]);

  if (!open || !mounted || !task) return null;

  const displayTitle = taskTitle || task.title || 'Task';
  const targetName = targetChildName || 'this child';

  const handleConfirm = () => {
    onConfirm(selectedOption);
    onClose();
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Move Task</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
        </div>
        <div className="modal-body">
          <p>This task rotates across children. How would you like to move <strong>{displayTitle}</strong> to {targetName}?</p>
          
          <div className="delete-options">
            <label className="delete-option">
              <input
                type="radio"
                name="dragDropOption"
                value="instance"
                checked={selectedOption === 'instance'}
                onChange={() => setSelectedOption('instance')}
              />
              <div>
                <strong>Move just this occurrence</strong>
                <p className="option-description">Move only this instance. Future rotations will continue as scheduled.</p>
              </div>
            </label>
            
            <label className="delete-option">
              <input
                type="radio"
                name="dragDropOption"
                value="redo-rotations"
                checked={selectedOption === 'redo-rotations'}
                onChange={() => setSelectedOption('redo-rotations')}
              />
              <div>
                <strong>Redo all future rotations</strong>
                <p className="option-description">Update the rotation to start from today with this child, and regenerate all future assignments.</p>
              </div>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleConfirm}>
            Move
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}






