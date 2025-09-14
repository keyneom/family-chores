import ChildrenGrid from "@/components/ChildrenGrid";
import React, { useEffect, useState } from "react";
import { useChoresApp } from "@/components/ChoresAppContext";
import { useModalControl } from "@/components/ModalControlContext";

export default function Home() {
  const { state } = useChoresApp();
  const { openOneOffTaskModal } = useModalControl();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="main-view">
        <div className="children-grid">
          <div className="empty-state">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="main-view">
      <ChildrenGrid childrenList={state.children} onAddTask={openOneOffTaskModal} />
    </main>
  );
}
