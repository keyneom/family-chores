
import React, { ReactNode, useState } from "react";
import { ModalControlContext } from "./ModalControlContext";
import Header from "./Header";

import SettingsModal from "./modals/SettingsModal";

import TaskEditModal from "./modals/TaskEditModal";
import AddTaskModal from "./modals/AddTaskModal";
import { useChoresApp } from "./ChoresAppContext";
import PinModal from "./modals/PinModal";
import OneOffTaskModal from "./modals/OneOffTaskModal";
import SyncModal from "./modals/SyncModal";
import EditChildModal from "./modals/EditChildModal";
import AddChildModal from "./modals/AddChildModal";
import AddChoreModal from "./modals/AddChoreModal";
import EditChoreModal from "./modals/EditChoreModal";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskEditOpen, setTaskEditOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<number|null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [oneOffTaskOpen, setOneOffTaskOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [addTaskChildId, setAddTaskChildId] = useState<number|null>(null);
  const [editChildOpen, setEditChildOpen] = useState(false);
  const [editChildId, setEditChildId] = useState<number|null>(null);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [addChoreOpen, setAddChoreOpen] = useState(false);
  const [editChoreOpen, setEditChoreOpen] = useState(false);
  const [editChoreId, setEditChoreId] = useState<number|null>(null);
  const { state, setState } = useChoresApp();
  // Handler to open AddChoreModal
  const openAddChoreModal = () => setAddChoreOpen(true);

  // Handler to add a new chore
  const handleAddChore = (chore: { name: string; emoji: string; color: string; starReward: number; moneyReward: number }) => {
    setState(prev => ({
      ...prev,
      chores: [
        ...prev.chores,
        {
          id: prev.chores.length > 0 ? Math.max(...prev.chores.map(c => c.id)) + 1 : 1,
          name: chore.name,
          emoji: chore.emoji,
          color: chore.color,
          recurrence: "daily",
          customDays: [],
          eligibleChildren: [],
          starReward: chore.starReward,
          moneyReward: chore.moneyReward,
        }
      ]
    }));
  };

  // Handler to open EditChoreModal for a specific chore
  const openEditChoreModal = (choreId: number) => {
    setEditChoreId(choreId);
    setEditChoreOpen(true);
  };

  // Handler to save edits to a chore
  const handleEditChore = (updatedChore: import("./ChoresAppContext").Chore) => {
    setState(prev => ({
      ...prev,
      chores: prev.chores.map(chore => chore.id === updatedChore.id ? { ...chore, ...updatedChore } : chore)
    }));
    setEditChoreOpen(false);
  };

  // Handler to delete a chore
  const handleDeleteChore = (choreId: number) => {
    if (window.confirm("Are you sure you want to delete this chore?")) {
      setState(prev => ({
        ...prev,
        chores: prev.chores.filter(chore => chore.id !== choreId)
      }));
      setEditChoreOpen(false);
    }
  };
  // Handler to open AddChildModal
  const openAddChildModal = () => setAddChildOpen(true);

  // Handler to add a new child
  const handleAddChild = (child: { name: string }) => {
    setState(prev => ({
      ...prev,
      children: [
        ...prev.children,
        {
          id: prev.children.length > 0 ? Math.max(...prev.children.map(c => c.id)) + 1 : 1,
          name: child.name,
          stars: 0,
          money: 0
        }
      ]
    }));
  };
  // Handler to open EditChildModal for a specific child
  const openEditChildModal = (childId: number) => {
    setEditChildId(childId);
    setEditChildOpen(true);
  };

  // Handler to save edits to a child
  const handleEditChild = (updatedChild: { id: number; name: string; stars?: number; money?: number }) => {
    setState(prev => ({
      ...prev,
      children: prev.children.map(child => child.id === updatedChild.id ? { ...child, ...updatedChild } : child)
    }));
    setEditChildOpen(false);
  };

  // Handler to delete a child
  const handleDeleteChild = (childId: number) => {
    if (window.confirm("Are you sure you want to delete this child?")) {
      setState(prev => ({
        ...prev,
        children: prev.children.filter(child => child.id !== childId)
      }));
      setEditChildOpen(false);
    }
  };


  // Handler to open AddTaskModal for a specific child
  const openAddTaskModal = (childId: number) => {
    setAddTaskChildId(childId);
    setAddTaskOpen(true);
  };

  // Handler to open TaskEditModal for a specific task
  const openTaskEditModal = (taskId: number) => {
    setEditTaskId(taskId);
    setTaskEditOpen(true);
  };

  // Handler to add a new task (chore) to state
  const handleAddTask = (task: { name: string; emoji: string; color: string; starReward: number; moneyReward: number }) => {
    setState(prev => ({
      ...prev,
      chores: [
        ...prev.chores,
        {
          id: prev.chores.length > 0 ? Math.max(...prev.chores.map(c => c.id)) + 1 : 1,
          name: task.name,
          emoji: task.emoji,
          color: task.color,
          recurrence: "daily",
          customDays: [],
          eligibleChildren: addTaskChildId !== null ? [addTaskChildId] : [],
          starReward: task.starReward,
          moneyReward: task.moneyReward,
        }
      ]
    }));
  };

  return (
    <ModalControlContext.Provider value={{
      openTaskEditModal,
      openAddTaskModal,
      openEditChildModal,
      openAddChildModal,
      openAddChoreModal,
      openEditChoreModal
    }}>
      <div className="container">
        <Header 
          onSettingsClick={() => setSettingsOpen(true)}
          onSyncClick={() => setSyncOpen(true)}
        />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <TaskEditModal
          open={taskEditOpen}
          onClose={() => setTaskEditOpen(false)}
          task={state.chores.find((chore) => chore.id === editTaskId) || null}
          onSave={(updatedTask) => {
            setState((prev) => ({
              ...prev,
              chores: prev.chores.map((chore) =>
                chore.id === updatedTask.id ? { ...chore, ...updatedTask } : chore
              ),
            }));
            setTaskEditOpen(false);
          }}
        />
        <AddTaskModal open={addTaskOpen} onClose={() => setAddTaskOpen(false)} onAdd={handleAddTask} />
        <AddChoreModal open={addChoreOpen} onClose={() => setAddChoreOpen(false)} onAdd={handleAddChore} />
        <EditChoreModal
          open={editChoreOpen}
          onClose={() => setEditChoreOpen(false)}
          chore={state.chores.find(chore => chore.id === editChoreId) || null}
          onSave={handleEditChore}
          onDelete={handleDeleteChore}
        />
        <AddChildModal open={addChildOpen} onClose={() => setAddChildOpen(false)} onAdd={handleAddChild} />
        <EditChildModal
          open={editChildOpen}
          onClose={() => setEditChildOpen(false)}
          child={state.children.find(child => child.id === editChildId) || null}
          onSave={handleEditChild}
          onDelete={handleDeleteChild}
        />
        <PinModal open={pinOpen} onClose={() => setPinOpen(false)} />
        <OneOffTaskModal open={oneOffTaskOpen} onClose={() => setOneOffTaskOpen(false)} />
        <SyncModal open={syncOpen} onClose={() => setSyncOpen(false)} />
        {children}
        {/* Add Child/Chore buttons (demo, move to UI as needed) */}
        <div style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 2000 }}>
          <button className="btn btn-primary" onClick={openAddChildModal} style={{marginRight: 4}}>+ Add Child</button>
          <button className="btn btn-primary" onClick={openAddChoreModal}>+ Add Chore</button>
        </div>
      </div>
    </ModalControlContext.Provider>
  );
}
