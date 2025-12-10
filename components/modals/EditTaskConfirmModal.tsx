import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Task } from "../../types/task";

export type EditOption = 'instance' | 'future' | 'template';

interface EditTaskConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (option: EditOption) => void;
  task: Task | null;
  taskTitle?: string;
}

export default function EditTaskConfirmModal({
  open,
  onClose,
  onConfirm,
  task,
  taskTitle,
}: EditTaskConfirmModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<EditOption>('instance');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (open && task) {
      // Default to 'template' for one-off tasks, 'instance' for recurring/timed
      if (task.type === 'oneoff') {
        setSelectedOption('template');
      } else {
        setSelectedOption('instance');
      }
    }
  }, [open, task]);

  if (!open || !mounted || !task) return null;

  const isOneOff = task.type === 'oneoff' || task.oneOff;
  const displayTitle = taskTitle || task.title || 'Task';

  const handleConfirm = () => {
    onConfirm(selectedOption);
    onClose();
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Task</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
        </div>
        <div className="modal-body">
          <p>What would you like to edit for <strong>{displayTitle}</strong>?</p>
          
          {isOneOff ? (
            <div className="delete-options">
              <label className="delete-option">
                <input
                  type="radio"
                  name="editOption"
                  value="template"
                  checked={selectedOption === 'template'}
                  onChange={() => setSelectedOption('template')}
                />
                <div>
                  <strong>Edit this task</strong>
                  <p className="option-description">Modify the task completely (one-off tasks are edited entirely)</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="delete-options">
              <label className="delete-option">
                <input
                  type="radio"
                  name="editOption"
                  value="instance"
                  checked={selectedOption === 'instance'}
                  onChange={() => setSelectedOption('instance')}
                />
                <div>
                  <strong>Edit just this occurrence</strong>
                  <p className="option-description">Modify only this instance. Future occurrences will remain unchanged.</p>
                </div>
              </label>
              
              <label className="delete-option">
                <input
                  type="radio"
                  name="editOption"
                  value="future"
                  checked={selectedOption === 'future'}
                  onChange={() => setSelectedOption('future')}
                />
                <div>
                  <strong>Edit all future occurrences</strong>
                  <p className="option-description">Apply changes to all future instances, but keep past instances unchanged.</p>
                </div>
              </label>
              
              <label className="delete-option">
                <input
                  type="radio"
                  name="editOption"
                  value="template"
                  checked={selectedOption === 'template'}
                  onChange={() => setSelectedOption('template')}
                />
                <div>
                  <strong>Edit task template entirely</strong>
                  <p className="option-description">Modify the task template, affecting all instances (past and future).</p>
                </div>
              </label>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleConfirm}>
            Continue
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

