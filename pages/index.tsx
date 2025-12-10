import Head from "next/head";
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

  // Sort children based on display order
  const sortedChildren = React.useMemo(() => {
    const order = state.parentSettings.childDisplayOrder || [];
    if (order.length === 0) {
      // If no order is set, use current order (by ID as fallback)
      return [...state.children].sort((a, b) => a.id - b.id);
    }
    
    // Create a map for quick lookup
    const childMap = new Map(state.children.map(child => [child.id, child]));
    const ordered: typeof state.children = [];
    const unordered: typeof state.children = [];
    
    // Add children in the specified order
    order.forEach(id => {
      const child = childMap.get(id);
      if (child) {
        ordered.push(child);
        childMap.delete(id);
      }
    });
    
    // Add any remaining children (newly added ones not in order yet)
    childMap.forEach(child => unordered.push(child));
    unordered.sort((a, b) => a.id - b.id);
    
    return [...ordered, ...unordered];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.children, state.parentSettings.childDisplayOrder]);

  if (!mounted) {
    return (
      <>
        <Head>
          <title>Family Chores</title>
        </Head>
        <main className="main-view">
          <div className="children-grid">
            <div className="empty-state">Loading...</div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Family Chores</title>
      </Head>
      <main className="main-view">
        <ChildrenGrid childrenList={sortedChildren} onAddTask={openOneOffTaskModal} />
      </main>
    </>
  );
}
