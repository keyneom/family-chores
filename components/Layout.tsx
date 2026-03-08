
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
import { useChoresApp, type Child } from "./ChoresAppContext";
import SyncModal from "./modals/SyncModal";
import EditChildModal from "./modals/EditChildModal";
import AddChildModal from "./modals/AddChildModal";
import TaskModal from "./modals/TaskModal";
import Task, { RotationMode } from "../types/task";
import TourGuide from "./Onboarding/TourGuide";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  type ActiveModal = 'settings' | 'sync' | 'editChild' | 'addChild' | 'addTask' | 'editTask' | 'deleteChild' | null;
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [editChildId, setEditChildId] = useState<number|null>(null);
  const [taskModalDefaults, setTaskModalDefaults] = useState<{ type?: 'recurring' | 'oneoff'; childId?: number; rotationMode?: RotationMode }>({});
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
  const openAddUnifiedTaskModal = (defaults?: { type?: 'recurring' | 'oneoff'; childId?: number; rotationMode?: RotationMode }) => {
    setTaskModalDefaults(defaults || {});
    setInitialTaskForEdit(null);
    setEditOption(null);
    setEditInstanceId(null);
    setActiveModal('addTask');
  };
  
  // Legacy handlers for backward compatibility (used by ModalControlContext)
  const openEditChoreModal = () => {
    // No-op: legacy handler, use openTaskEditModal instead
  };
  // Handler to open AddChildModal
  const openAddChildModal = () => {
    setActiveModal('addChild');
  };

  // Handler to add a new child
  const handleAddChild = (child: { name: string; blockchainAddress?: string }) => {
    dispatch({
      type: 'ADD_CHILD',
      payload: {
        id: state.children.length > 0 ? Math.max(...state.children.map(c => c.id)) + 1 : 1,
        name: child.name,
        stars: 0,
        money: 0,
        blockchainAddress: child.blockchainAddress,
      },
    });
  };
  // Handler to open EditChildModal for a specific child
  const openEditChildModal = (childId: number) => {
    setEditChildId(childId);
    setActiveModal('editChild');
  };

  // Handler to save edits to a child
  const handleEditChild = (updatedChild: Child, actorHandle?: string) => {
    dispatch({
      type: 'UPDATE_CHILD',
      payload: updatedChild,
      actorHandle,
    });
    setActiveModal(null);
  };

  // Handler to delete a child
  const [childToDelete, setChildToDelete] = React.useState<number | null>(null);
  
  const handleDeleteChild = (childId: number) => {
    setChildToDelete(childId);
    setActiveModal('deleteChild');
  };

  const confirmDeleteChild = () => {
    if (childToDelete !== null) {
      dispatch({ type: 'DELETE_CHILD', payload: childToDelete });
      setChildToDelete(null);
      setActiveModal(null);
    }
  };


  // Handler to open AddTaskModal for a specific child (use unified TaskModal)
  const openAddTaskModal = (childId: number) => {
    setTaskModalDefaults({ type: 'oneoff', childId, rotationMode: 'single-child' });
    setInitialTaskForEdit(null);
    setEditOption(null);
    setEditInstanceId(null);
    setActiveModal('addTask');
  };
  

  // Handler to open TaskEditModal for a specific task
  const openTaskEditModal = (taskId: string | number, editOption?: 'instance' | 'future' | 'template', instanceId?: string) => {
    const taskIdStr = String(taskId);
    const task = state.tasks.find((t) => t.id === taskIdStr);
    if (task) {
      setInitialTaskForEdit(task);
      setEditOption(editOption || null);
      setEditInstanceId(instanceId || null);
      setActiveModal('editTask');
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
    }}>
      <div className="container">
        <Header 
          onSettingsClick={() => setActiveModal('settings')}
          onSyncClick={() => setActiveModal('sync')}
        />
        <SettingsModal
          open={activeModal === 'settings'}
          onClose={() => setActiveModal(null)}
          onCreateTask={() => openAddUnifiedTaskModal()}
          onEditTask={(taskId) => {
            setActiveModal(null);
            openTaskEditModal(taskId, 'template');
          }}
          onEditChild={(childId) => {
            setActiveModal(null);
            openEditChildModal(childId);
          }}
        />
        <TaskModal
          open={activeModal === 'addTask'}
          onClose={() => { setActiveModal(null); setTaskModalDefaults({}); }}
          initialDefaults={taskModalDefaults}
        />
        <TaskModal
          open={activeModal === 'editTask'}
          onClose={() => { 
            setActiveModal(null); 
            setInitialTaskForEdit(null); 
            setEditOption(null);
            setEditInstanceId(null);
          }}
          initialTask={initialTaskForEdit}
          editOption={editOption}
          editInstanceId={editInstanceId}
        />
        <AddChildModal open={activeModal === 'addChild'} onClose={() => setActiveModal(null)} onAdd={handleAddChild} />
        <EditChildModal
          open={activeModal === 'editChild'}
          onClose={() => setActiveModal(null)}
          child={state.children.find(child => child.id === editChildId) || null}
          onSave={handleEditChild}
          onDelete={handleDeleteChild}
        />
        <SyncModal open={activeModal === 'sync'} onClose={() => setActiveModal(null)} />
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
          open={activeModal === 'deleteChild'}
          onClose={() => { setActiveModal(null); setChildToDelete(null); }}
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
          <button className="btn btn-primary" onClick={() => openAddUnifiedTaskModal()} style={{pointerEvents: 'auto'}} data-tour="add-task-button">+ Add Chore</button>
        </div>
      </div>
    </ModalControlContext.Provider>
    </WagmiConfig>
  );
}
