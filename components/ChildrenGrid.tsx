import React from "react";
import ChildColumn, { Child } from "./ChildColumn";



interface ChildrenGridProps {
  childrenList: Child[];
  onAddTask?: (childId: number) => void;
}

export default function ChildrenGrid({ childrenList, onAddTask }: ChildrenGridProps) {
  return (
    <div className="children-grid" data-child-count={childrenList.length}>
      {childrenList.length === 0 ? (
        <div className="empty-state">No children found.</div>
      ) : (
        childrenList.map((child) => (
          <ChildColumn key={child.id} child={child} onAddTask={onAddTask ? () => onAddTask(child.id) : undefined} />
        ))
      )}
    </div>
  );
}
