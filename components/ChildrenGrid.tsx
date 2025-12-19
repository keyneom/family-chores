import React from "react";
import ChildColumn from "./ChildColumn";
import { Child, useChoresApp } from "./ChoresAppContext";

interface ChildrenGridProps {
  childrenList: Child[];
  onAddTask?: (childId: number) => void;
}

export default function ChildrenGrid({ childrenList, onAddTask }: ChildrenGridProps) {
  const { state, dispatch } = useChoresApp();
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [draggedChildId, setDraggedChildId] = React.useState<number | null>(null);
  
  // Note: We no longer auto-generate instances on mount.
  // The projection engine in ChildColumn handles displaying tasks for today and the future.
  // Instances are only created ('realized') when users interact with them (complete, move, etc).
  
  const updateScrollIndicators = () => {
    const grid = gridRef.current;
    if (!grid) return;
    
    const isScrollable = grid.scrollWidth > grid.clientWidth;
    const isAtStart = grid.scrollLeft <= 5;
    const isAtEnd = grid.scrollLeft >= grid.scrollWidth - grid.clientWidth - 5;
    
    grid.classList.toggle('scrollable-left', isScrollable && !isAtStart);
    grid.classList.toggle('scrollable-right', isScrollable && !isAtEnd);
  };
  
  React.useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    
    updateScrollIndicators();
    grid.addEventListener('scroll', updateScrollIndicators);
    window.addEventListener('resize', updateScrollIndicators);
    
    return () => {
      grid.removeEventListener('scroll', updateScrollIndicators);
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [childrenList]);

  const handleDragStart = (e: React.DragEvent, childId: number) => {
    // Check if the drag is coming from a task item (not the column header)
    const target = e.target as HTMLElement;
    // If the drag started from a task item or within a task item, ignore it
    if (target.closest('.task-item') || target.closest('[data-task-id]')) {
      // This is a task drag, don't handle it here
      return;
    }
    
    setDraggedChildId(childId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `child-${childId}`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Only handle drag over for child column reordering
    // Task drags will be handled by ChildColumn, so we check if this is a child drag
    // by checking if we have a draggedChildId set
    if (draggedChildId !== null) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
    // Otherwise, let the event bubble to ChildColumn for task handling
  };

  const handleDrop = (e: React.DragEvent, targetChildId: number) => {
    e.preventDefault();
    
    const dragDataString = e.dataTransfer.getData('text/plain');
    
    // CRITICAL: Check if this is a task drag (JSON data or not starting with "child-")
    // If so, ignore it and let ChildColumn handle it
    if (!dragDataString.startsWith('child-')) {
      // This is likely a task drag, let ChildColumn handle it
      setDraggedChildId(null);
      return;
    }
    
    // Only handle child column reordering if drag data starts with "child-"
    if (draggedChildId === null || draggedChildId === targetChildId) {
      setDraggedChildId(null);
      return;
    }

    // Ensure we have a complete order that includes all children
    const existingOrder = state.parentSettings.childDisplayOrder || [];
    const allChildIds = state.children.map(c => c.id);
    
    // Build complete order: use existing order, then add any missing children
    const currentOrder = [
      ...existingOrder.filter(id => allChildIds.includes(id)),
      ...allChildIds.filter(id => !existingOrder.includes(id))
    ];
    
    const sourceIndex = currentOrder.indexOf(draggedChildId);
    const targetIndex = currentOrder.indexOf(targetChildId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedChildId(null);
      return;
    }

    // Reorder the array
    const newOrder = [...currentOrder];
    newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, draggedChildId);

    // Update parent settings
    dispatch({
      type: 'UPDATE_PARENT_SETTINGS',
      payload: {
        childDisplayOrder: newOrder,
      },
    });

    setDraggedChildId(null);
  };

  const handleDragEnd = () => {
    setDraggedChildId(null);
  };
  
  return (
    <div 
      ref={gridRef} 
      className="children-grid" 
      data-child-count={childrenList.length}
      onDragOver={handleDragOver}
    >
      {childrenList.length === 0 ? (
        <div className="no-children-message">
          <h3>No children configured</h3>
          <p>Add children using the &quot;+ Add Child&quot; button to start managing chores.</p>
        </div>
      ) : (
        childrenList.map((child) => (
          <div
            key={child.id}
            draggable
            onDragStart={(e) => handleDragStart(e, child.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, child.id)}
            onDragEnd={handleDragEnd}
            style={{
              opacity: draggedChildId === child.id ? 0.5 : 1,
              cursor: 'move',
            }}
          >
            <ChildColumn child={child} onAddTask={onAddTask ? () => onAddTask(child.id) : undefined} />
          </div>
        ))
      )}
    </div>
  );
}
