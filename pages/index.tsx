import ChildrenGrid from "@/components/ChildrenGrid";




import React from "react";
import { useChoresApp } from "@/components/ChoresAppContext";
import { useModalControl } from "@/components/ModalControlContext";

export default function Home() {
  const { state } = useChoresApp();
  const { openAddTaskModal } = useModalControl();
  return (
    <main className="main-view">
      <ChildrenGrid childrenList={state.children} onAddTask={openAddTaskModal} />
    </main>
  );
}
