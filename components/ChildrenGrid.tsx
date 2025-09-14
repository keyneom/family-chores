import React from "react";
import ChildColumn, { Child } from "./ChildColumn";



interface ChildrenGridProps {
  childrenList: Child[];
  onAddTask?: (childId: number) => void;
}

export default function ChildrenGrid({ childrenList, onAddTask }: ChildrenGridProps) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  
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
  
  return (
    <div ref={gridRef} className="children-grid" data-child-count={childrenList.length}>
      {childrenList.length === 0 ? (
        <div className="no-children-message">
          <h3>No children configured</h3>
          <p>Add children using the &quot;+ Add Child&quot; button to start managing chores.</p>
        </div>
      ) : (
        childrenList.map((child) => (
          <ChildColumn key={child.id} child={child} onAddTask={onAddTask ? () => onAddTask(child.id) : undefined} />
        ))
      )}
    </div>
  );
}
