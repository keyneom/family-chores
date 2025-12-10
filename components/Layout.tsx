
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
import ConfirmationModal from "./modals/ConfirmationModal";
import { useChoresApp } from "./ChoresAppContext";
import OneOffTaskModal from "./modals/OneOffTaskModal";
import SyncModal from "./modals/SyncModal";
import EditChildModal from "./modals/EditChildModal";
import AddChildModal from "./modals/AddChildModal";
import TaskModal from "./modals/TaskModal";
import Task from "../types/task";
import TourGuide from "./Onboarding/TourGuide";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [oneOffTaskOpen, setOneOffTaskOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [addTaskChildId, setAddTaskChildId] = useState<number|null>(null);
  const [editChildOpen, setEditChildOpen] = useState(false);
  const [editChildId, setEditChildId] = useState<number|null>(null);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [addUnifiedTaskOpen, setAddUnifiedTaskOpen] = useState(false);
  const [editUnifiedTaskOpen, setEditUnifiedTaskOpen] = useState(false);
  const [initialTaskForEdit, setInitialTaskForEdit] = useState<Task | null>(null);
  const [editOption, setEditOption] = useState<'instance' | 'future' | 'template' | null>(null);
  const [editInstanceId, setEditInstanceId] = useState<string | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const { state, dispatch } = useChoresApp();

  // Check if onboarding is needed on mount
  React.useEffect(() => {
    // Check if onboarding has been completed or skipped (stored in parentSettings)
    const onboardingCompleted = state.parentSettings.onboardingCompleted === true;

    // Don't show tour if it's already been completed or skipped
    if (onboardingCompleted) {
      setTourActive(false);
      return;
    }

    // Check if there are any approvers (pins may be undefined or empty array)
    const hasApprovers = state.parentSettings.pins && state.parentSettings.pins.length > 0;

    // Show tour if no approvers exist (meaning it's a fresh install or user hasn't set up approvers yet)
    // But only if it hasn't been explicitly completed/skipped
    const needsTour = !hasApprovers;

    if (needsTour) {
      setTourActive(true);
    }
  }, [state.parentSettings.onboardingCompleted, state.parentSettings.pins]);
  
  // Handler to open the unified TaskModal
  const openAddUnifiedTaskModal = () => {
    // Close Settings modal if open (UX principle: only one primary modal at a time)
    if (settingsOpen) {
      setSettingsOpen(false);
    }
    // Close Add Child modal if open
    if (addChildOpen) {
      setAddChildOpen(false);
    }
    setAddUnifiedTaskOpen(true);
  };
  
  // Legacy handlers for backward compatibility (used by ModalControlContext)
  const openEditChoreModal = () => {
    // No-op: legacy handler, use openTaskEditModal instead
  };
  // Handler to open AddChildModal
  const openAddChildModal = () => {
    // Close Settings modal if open (UX principle: only one primary modal at a time)
    if (settingsOpen) {
      setSettingsOpen(false);
    }
    setAddChildOpen(true);
  };

  // Handler to add a new child
  const handleAddChild = (child: { name: string; blockchainAddress?: string }) => {
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
            money: 0,
            blockchainAddress: child.blockchainAddress
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
  const [deleteChildConfirmOpen, setDeleteChildConfirmOpen] = React.useState(false);
  const [childToDelete, setChildToDelete] = React.useState<number | null>(null);
  
  const handleDeleteChild = (childId: number) => {
    setChildToDelete(childId);
    setDeleteChildConfirmOpen(true);
  };

  const confirmDeleteChild = () => {
    if (childToDelete !== null) {
      dispatch({
        type: 'SET_STATE',
        payload: {
          ...state,
          children: state.children.filter(child => child.id !== childToDelete)
        }
      });
      setChildToDelete(null);
      setEditChildOpen(false);
    }
  };


  // Handler to open AddTaskModal for a specific child (use unified TaskModal)
  const openAddTaskModal = (childId: number) => {
    setAddTaskChildId(childId);
    setAddUnifiedTaskOpen(true);
  };
  
  // Handler to open OneOffTaskModal for a specific child
  const openOneOffTaskModal = (childId: number) => {
    setAddTaskChildId(childId);
    setOneOffTaskOpen(true);
  };

  // Handler to open TaskEditModal for a specific task
  const openTaskEditModal = (taskId: string | number, editOption?: 'instance' | 'future' | 'template', instanceId?: string) => {
    const taskIdStr = String(taskId);
    const task = state.tasks.find((t) => t.id === taskIdStr);
    if (task) {
      setInitialTaskForEdit(task);
      setEditOption(editOption || null);
      setEditInstanceId(instanceId || null);
      setEditUnifiedTaskOpen(true);
    }
    // If task not found, do nothing (task may have been deleted)
  };

  return (
    <WagmiConfig config={wagmiConfig}>
    <ModalControlContext.Provider value={{
      openTaskEditModal,
      openAddTaskModal,
      openEditChildModal,
      openAddChildModal,
      openAddChoreModal: openAddUnifiedTaskModal, // Map to unified task modal (legacy compatibility)
      openEditChoreModal,
      openOneOffTaskModal
    }}>
      <div className="container">
        <Header 
          onSettingsClick={() => {
            // Close other modals if open (UX principle: only one primary modal at a time)
            if (addChildOpen) {
              setAddChildOpen(false);
            }
            if (addUnifiedTaskOpen) {
              setAddUnifiedTaskOpen(false);
            }
            if (editUnifiedTaskOpen) {
              setEditUnifiedTaskOpen(false);
            }
            setSettingsOpen(true);
          }}
          onSyncClick={() => setSyncOpen(true)}
        />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <TaskModal open={addUnifiedTaskOpen} onClose={() => setAddUnifiedTaskOpen(false)} />
        <TaskModal
          open={editUnifiedTaskOpen}
          onClose={() => { 
            setEditUnifiedTaskOpen(false); 
            setInitialTaskForEdit(null); 
            setEditOption(null);
            setEditInstanceId(null);
          }}
          initialTask={initialTaskForEdit}
          editOption={editOption}
          editInstanceId={editInstanceId}
        />
        <AddChildModal open={addChildOpen} onClose={() => setAddChildOpen(false)} onAdd={handleAddChild} />
        <EditChildModal
          open={editChildOpen}
          onClose={() => setEditChildOpen(false)}
          child={state.children.find(child => child.id === editChildId) || null}
          onSave={handleEditChild}
          onDelete={handleDeleteChild}
        />
        <OneOffTaskModal 
          open={oneOffTaskOpen} 
          onClose={() => setOneOffTaskOpen(false)} 
          childId={addTaskChildId || undefined}
        />
        <SyncModal open={syncOpen} onClose={() => setSyncOpen(false)} />
        <TourGuide 
          active={tourActive} 
          onComplete={() => {
            setTourActive(false);
            // Mark tour as complete - the action log will be updated when state changes
            // We'll check for ONBOARDING_COMPLETE in the action log to prevent showing tour again
          }}
          onSkip={() => {
            setTourActive(false);
            // Mark tour as skipped - same as complete for our purposes
          }}
        />
        <ConfirmationModal
          open={deleteChildConfirmOpen}
          onClose={() => { setDeleteChildConfirmOpen(false); setChildToDelete(null); }}
          onConfirm={confirmDeleteChild}
          title="Delete Child"
          message="Are you sure you want to delete this child? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmButtonClass="btn btn-danger"
        />
        <div className="layout-content">
          {children}
        </div>
        {/* Add Child/Chore buttons (demo, move to UI as needed) */}
        <div style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 2000, pointerEvents: 'auto' }}>
          <button className="btn btn-primary" onClick={openAddChildModal} style={{marginRight: 4, pointerEvents: 'auto'}} data-tour="add-child-button">+ Add Child</button>
          <button className="btn btn-primary" onClick={openAddUnifiedTaskModal} style={{pointerEvents: 'auto'}} data-tour="add-task-button">+ Add Chore</button>
        </div>
      </div>
    </ModalControlContext.Provider>
    </WagmiConfig>
  );
}
