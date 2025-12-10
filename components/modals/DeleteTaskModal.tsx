import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Task } from "../../types/task";

export type DeleteOption = 'instance' | 'future' | 'template';

interface DeleteTaskModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (option: DeleteOption) => void;
  task: Task | null;
  taskTitle?: string;
}

export default function DeleteTaskModal({
  open,
  onClose,
  onConfirm,
  task,
  taskTitle,
}: DeleteTaskModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<DeleteOption>('instance');

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
          <h2>Delete Task</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
        </div>
        <div className="modal-body">
          <p>What would you like to delete for <strong>{displayTitle}</strong>?</p>
          
          {isOneOff ? (
            <div className="delete-options">
              <label className="delete-option">
                <input
                  type="radio"
                  name="deleteOption"
                  value="template"
                  checked={selectedOption === 'template'}
                  onChange={() => setSelectedOption('template')}
                />
                <div>
                  <strong>Delete this task</strong>
                  <p className="option-description">Remove the task completely (one-off tasks are deleted entirely)</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="delete-options">
              <label className="delete-option">
                <input
                  type="radio"
                  name="deleteOption"
                  value="instance"
                  checked={selectedOption === 'instance'}
                  onChange={() => setSelectedOption('instance')}
                />
                <div>
                  <strong>Delete just this occurrence</strong>
                  <p className="option-description">Remove only this instance. Future occurrences will still be generated.</p>
                </div>
              </label>
              
              <label className="delete-option">
                <input
                  type="radio"
                  name="deleteOption"
                  value="future"
                  checked={selectedOption === 'future'}
                  onChange={() => setSelectedOption('future')}
                />
                <div>
                  <strong>Delete all future occurrences</strong>
                  <p className="option-description">Stop generating new instances, but keep past completed instances.</p>
                </div>
              </label>
              
              <label className="delete-option">
                <input
                  type="radio"
                  name="deleteOption"
                  value="template"
                  checked={selectedOption === 'template'}
                  onChange={() => setSelectedOption('template')}
                />
                <div>
                  <strong>Delete task template entirely</strong>
                  <p className="option-description">Remove the task completely for all children and all dates (past and future).</p>
                </div>
              </label>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleConfirm}>
            Delete
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


