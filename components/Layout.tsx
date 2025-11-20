
import React, { ReactNode, useState } from "react";
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { mainnet, arbitrum, base } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { InjectedConnector } from 'wagmi/connectors/injected';

const { chains, publicClient } = configureChains([mainnet, arbitrum, base], [publicProvider()]);
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [new InjectedConnector({ chains })],
  publicClient,
});
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
import TaskModal from "./modals/TaskModal";
import Task from "../types/task";
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
  const [addUnifiedTaskOpen, setAddUnifiedTaskOpen] = useState(false);
  const [editUnifiedTaskOpen, setEditUnifiedTaskOpen] = useState(false);
  const [initialTaskForEdit, setInitialTaskForEdit] = useState<Task | null>(null);
  const [editChoreOpen, setEditChoreOpen] = useState(false);
  const [editChoreId, setEditChoreId] = useState<number|null>(null);
  const { state, dispatch } = useChoresApp();
  // Handler to open AddChoreModal (legacy)
  const openAddChoreModal = () => setAddChoreOpen(true);
  // Handler to open the unified TaskModal
  const openAddUnifiedTaskModal = () => setAddUnifiedTaskOpen(true);

  // Handler to add a new chore
  const handleAddChore = (chore: { name: string; emoji: string; color: string; starReward: number; moneyReward: number; timed?: boolean; allowedSeconds?: number; latePenaltyPercent?: number; autoApproveOnStop?: boolean }) => {
    dispatch({
      type: 'SET_STATE',
      payload: {
        ...state,
        chores: [
          ...state.chores,
          {
            id: state.chores.length > 0 ? Math.max(...state.chores.map(c => c.id)) + 1 : 1,
            name: chore.name,
            emoji: chore.emoji,
            color: chore.color,
            recurrence: "daily",
            customDays: [],
            eligibleChildren: [],
            starReward: chore.starReward,
            moneyReward: chore.moneyReward,
            timed: chore.timed || false,
            allowedSeconds: chore.allowedSeconds || undefined,
            latePenaltyPercent: chore.latePenaltyPercent || undefined,
            autoApproveOnStop: chore.autoApproveOnStop || false,
          }
        ]
      }
    });
  };

  // Handler to open EditChoreModal for a specific chore
  const openEditChoreModal = (choreId: number) => {
    setEditChoreId(choreId);
    setEditChoreOpen(true);
  };

  // Handler to save edits to a chore
  const handleEditChore = (updatedChore: import("./ChoresAppContext").Chore) => {
    dispatch({
      type: 'SET_STATE',
      payload: {
        ...state,
        chores: state.chores.map(chore => chore.id === updatedChore.id ? { ...chore, ...updatedChore } : chore)
      }
    });
    setEditChoreOpen(false);
  };

  // Handler to delete a chore
  const handleDeleteChore = (choreId: number) => {
    if (window.confirm("Are you sure you want to delete this chore?")) {
      dispatch({
        type: 'SET_STATE',
        payload: {
          ...state,
          chores: state.chores.filter(chore => chore.id !== choreId)
        }
      });
      setEditChoreOpen(false);
    }
  };
  // Handler to open AddChildModal
  const openAddChildModal = () => setAddChildOpen(true);

  // Handler to add a new child
  const handleAddChild = (child: { name: string }) => {
    dispatch({
      type: 'SET_STATE',
      payload: {
        ...state,
        children: [
          ...state.children,
          {
            id: state.children.length > 0 ? Math.max(...state.children.map(c => c.id)) + 1 : 1,
            name: child.name,
            stars: 0,
            money: 0
          }
        ]
      }
    });
  };
  // Handler to open EditChildModal for a specific child
  const openEditChildModal = (childId: number) => {
    setEditChildId(childId);
    setEditChildOpen(true);
  };

  // Handler to save edits to a child
  const handleEditChild = (updatedChild: { id: number; name: string; stars?: number; money?: number }) => {
    dispatch({
      type: 'SET_STATE',
      payload: {
        ...state,
        children: state.children.map(child => child.id === updatedChild.id ? { ...child, ...updatedChild } : child)
      }
    });
    setEditChildOpen(false);
  };

  // Handler to delete a child
  const handleDeleteChild = (childId: number) => {
    if (window.confirm("Are you sure you want to delete this child?")) {
      dispatch({
        type: 'SET_STATE',
        payload: {
          ...state,
          children: state.children.filter(child => child.id !== childId)
        }
      });
      setEditChildOpen(false);
    }
  };


  // Handler to open AddTaskModal for a specific child
  const openAddTaskModal = (childId: number) => {
    setAddTaskChildId(childId);
    setAddTaskOpen(true);
  };
  
  // Handler to open OneOffTaskModal for a specific child
  const openOneOffTaskModal = (childId: number) => {
    setAddTaskChildId(childId);
    setOneOffTaskOpen(true);
  };

  // Handler to open TaskEditModal for a specific task
  const openTaskEditModal = (taskId: string | number) => {
    const numericId = typeof taskId === 'number' ? taskId : Number(taskId);
    setEditTaskId(Number.isNaN(numericId) ? null : numericId);
    // Try to find the legacy chore and convert to Task shape for editing
    const chore = Number.isNaN(numericId) ? null : (state.chores.find((c) => c.id === numericId) || null);
    if (chore) {
      const t: Task = {
        id: `chore_${chore.id}`,
        title: chore.name,
        description: '',
        createdAt: new Date().toISOString(),
        enabled: true,
        requirePin: false,
        stars: chore.starReward,
        money: chore.moneyReward,
        type: chore.timed ? 'timed' : 'recurring',
        ...(chore.timed ? { timed: { allowedSeconds: chore.allowedSeconds || 60, latePenaltyPercent: chore.latePenaltyPercent ?? 0.5, autoApproveOnStop: chore.autoApproveOnStop ?? false, allowNegative: false } } : { recurring: { cadence: chore.recurrence || 'daily' } }),
      } as Task;
      setInitialTaskForEdit(t);
      setEditUnifiedTaskOpen(true);
    } else {
      setTaskEditOpen(true);
    }
  };

  // Handler to add a new task (chore) to state
  const handleAddTask = (task: { name: string; emoji: string; color: string; starReward: number; moneyReward: number }) => {
    dispatch({
      type: 'SET_STATE',
      payload: {
        ...state,
        chores: [
          ...state.chores,
          {
            id: state.chores.length > 0 ? Math.max(...state.chores.map(c => c.id)) + 1 : 1,
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
      }
    });
  };

  return (
    <WagmiConfig config={wagmiConfig}>
    <ModalControlContext.Provider value={{
      openTaskEditModal,
      openAddTaskModal,
      openEditChildModal,
      openAddChildModal,
      openAddChoreModal,
      openEditChoreModal,
      openOneOffTaskModal
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
            dispatch({
              type: 'SET_STATE',
              payload: {
                ...state,
                chores: state.chores.map((chore) =>
                  chore.id === updatedTask.id ? { ...chore, ...updatedTask } : chore
                ),
              }
            });
            setTaskEditOpen(false);
          }}
        />
  <AddTaskModal open={addTaskOpen} onClose={() => setAddTaskOpen(false)} onAdd={handleAddTask} />
  <AddChoreModal open={addChoreOpen} onClose={() => setAddChoreOpen(false)} onAdd={handleAddChore} />
  <TaskModal open={addUnifiedTaskOpen} onClose={() => setAddUnifiedTaskOpen(false)} />
  <TaskModal
    open={editUnifiedTaskOpen}
    onClose={() => { setEditUnifiedTaskOpen(false); setInitialTaskForEdit(null); }}
    initialTask={initialTaskForEdit}
    onSave={(task) => {
      // If editing a legacy chore, sync edits back to chores
      if (initialTaskForEdit && initialTaskForEdit.id?.startsWith('chore_')) {
        const choreId = parseInt(initialTaskForEdit.id.split('_')[1], 10);
        dispatch({ type: 'SET_STATE', payload: { ...state, chores: state.chores.map(ch => ch.id === choreId ? { ...ch, name: task.title, starReward: task.stars ?? ch.starReward, moneyReward: task.money ?? ch.moneyReward, timed: task.type === 'timed', allowedSeconds: task.type === 'timed' ? task.timed?.allowedSeconds : ch.allowedSeconds, latePenaltyPercent: task.type === 'timed' ? task.timed?.latePenaltyPercent : ch.latePenaltyPercent, autoApproveOnStop: task.type === 'timed' ? task.timed?.autoApproveOnStop : ch.autoApproveOnStop } : ch) } });
      }
      setEditUnifiedTaskOpen(false);
      setInitialTaskForEdit(null);
    }}
  />
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
        <PinModal open={pinOpen} onClose={() => setPinOpen(false)} onSuccess={() => setPinOpen(false)} />
        <OneOffTaskModal 
          open={oneOffTaskOpen} 
          onClose={() => setOneOffTaskOpen(false)} 
          childId={addTaskChildId || undefined}
        />
        <SyncModal open={syncOpen} onClose={() => setSyncOpen(false)} />
        {children}
        {/* Add Child/Chore buttons (demo, move to UI as needed) */}
        <div style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 2000 }}>
          <button className="btn btn-primary" onClick={openAddChildModal} style={{marginRight: 4}}>+ Add Child</button>
          <button className="btn btn-primary" onClick={openAddUnifiedTaskModal}>+ Add Chore</button>
        </div>
      </div>
    </ModalControlContext.Provider>
    </WagmiConfig>
  );
}
