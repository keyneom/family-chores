import { useEffect, useRef } from "react";
import Shepherd from "shepherd.js";
import 'shepherd.js/dist/css/shepherd.css';
import { useChoresApp } from "../ChoresAppContext";

interface TourGuideProps {
  active: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export default function TourGuide({ active, onComplete, onSkip }: TourGuideProps) {
  const { state, dispatch } = useChoresApp();
  
  // Mark tour as complete in parent settings
  const markTourComplete = () => {
    dispatch({
      type: 'UPDATE_PARENT_SETTINGS',
      payload: {
        onboardingCompleted: true,
      },
    });
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tourRef = useRef<any>(null);
  const hasStartedRef = useRef(false);
  const callbacksRef = useRef({ onComplete, onSkip });
  const wasModalStateRef = useRef({ settings: false, addChild: false, task: false });
  const currentStepIdRef = useRef<string | null>(null);
  
  // Keep callbacks ref updated without causing re-renders
  useEffect(() => {
    callbacksRef.current = { onComplete, onSkip };
  }, [onComplete, onSkip]);

  // Monitor modal state by watching for modal appearance in DOM
  useEffect(() => {
    if (!active) return;
    
    const advanceFromStep = (expectedStepId: string) => {
      if (!tourRef.current?.isActive()) return false;
      if (currentStepIdRef.current === expectedStepId) {
        tourRef.current.next();
        return true;
      }
      return false;
    };

    const advanceToApproverForm = () => {
      setTimeout(() => {
        if (tourRef.current?.isActive()) {
          const approverForm = document.querySelector('[data-tour="approver-form"]');
          if (approverForm) {
            advanceFromStep('settings');
          }
        }
      }, 800);
    };
    
    const checkModals = () => {
      // Only proceed if tour exists and is active
      if (!tourRef.current || !tourRef.current.isActive()) {
        return;
      }
      
      const modalOverlay = document.querySelector('.modal-overlay');
      if (!modalOverlay) {
        // No modal open, reset state
        wasModalStateRef.current.settings = false;
        wasModalStateRef.current.addChild = false;
        wasModalStateRef.current.task = false;
        return;
      }
      
      const modalTitle = modalOverlay?.querySelector('.modal')?.querySelector('h2')?.textContent || '';
      const isSettings = modalTitle.includes('Settings') || modalTitle.includes('⚙️');
      const isAddChild = modalTitle.includes('Add Child');
      const isTask = modalTitle.includes('Create Task') || modalTitle.includes('Edit Task');
      
      const currentStepId = currentStepIdRef.current;
      if (!currentStepId) {
        wasModalStateRef.current.settings = isSettings;
        wasModalStateRef.current.addChild = isAddChild;
        wasModalStateRef.current.task = isTask;
        return;
      }
      
      // If Settings modal just opened (transition from closed to open), advance to modal step
      // This handles both clicking the tour button and clicking Settings directly
      // We advance regardless of which step we're on (welcome or settings), as long as we're in the tour
      if (isSettings && !wasModalStateRef.current.settings) {
        // If we're on welcome step and Settings opens, first advance to settings step, then to modal step
        if (currentStepId === 'welcome') {
          if (tourRef.current) {
            tourRef.current.next();
            setTimeout(() => {
              advanceToApproverForm();
            }, 300);
          }
        } else {
          // Already on settings step or another step, just advance to modal step
          advanceToApproverForm();
        }
      }
      
      // If Add Child modal just opened, advance to modal step
      if (isAddChild && !wasModalStateRef.current.addChild) {
        if (currentStepId === 'add-child' || document.querySelector('[data-tour="child-name-input"]')) {
          setTimeout(() => {
            if (tourRef.current?.isActive()) {
              advanceFromStep('add-child');
            }
          }, 500);
        }
      }
      
      // If Task modal just opened, advance to modal step
      if (isTask && !wasModalStateRef.current.task) {
        if (currentStepId === 'add-task' || document.querySelector('[data-tour="task-title-input"]')) {
          setTimeout(() => {
            if (tourRef.current?.isActive()) {
              advanceFromStep('add-task');
            }
          }, 500);
        }
      }
      
      // Update state tracking
      wasModalStateRef.current.settings = isSettings;
      wasModalStateRef.current.addChild = isAddChild;
      wasModalStateRef.current.task = isTask;
    };
    
    // Use MutationObserver to specifically watch for modal-overlay appearing
    const observer = new MutationObserver((mutations) => {
      // Only check if tour is active
      if (!tourRef.current?.isActive()) return;
      
      // Check if a modal-overlay was just added
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            // Check if the added node is a modal-overlay or contains one
            if (element.classList?.contains('modal-overlay') || element.querySelector?.('.modal-overlay')) {
              // Small delay to ensure modal content is rendered
              setTimeout(checkModals, 100);
              return;
            }
          }
        }
      }
      
      // Also check on any DOM change (for modal content updates)
      checkModals();
    });
    
    // Observe the body for modal additions
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also check periodically as a fallback
    const interval = setInterval(checkModals, 200);
    
    // Run immediately
    checkModals();
    
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      if (tourRef.current) {
        tourRef.current.complete();
        tourRef.current = null;
      }
      hasStartedRef.current = false;
      return;
    }

    // Only create tour once when active becomes true
    if (hasStartedRef.current || tourRef.current) {
      return;
    }

    // Clean up any existing tour first
    if (tourRef.current) {
      tourRef.current.complete();
      tourRef.current = null;
    }

    // Create new tour
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: {
          enabled: true
        },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' },
        modalOverlayOpeningPadding: 4,
        modalOverlayOpeningRadius: 8,
      }
    });

    tour.on('show', (event: { step?: { id?: string } }) => {
      currentStepIdRef.current = event?.step?.id || null;
    });

    // Step 1: Welcome & Explain Approvers
    tour.addStep({
      id: 'welcome',
      text: 'Welcome! This app helps families manage chores with rewards, timers, and parent approval. Let\'s get you set up. First, you\'ll need to create an "approver" - this is a parent PIN that lets you approve task completions and other actions.',
      title: 'Welcome to Family Chores',
      // Center the welcome message on screen
      attachTo: {
        element: 'body',
        on: 'auto' as const
      },
      buttons: [
        {
          text: 'Skip Tour',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onSkip();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Get Started →',
          action: tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Step 2: Click Settings
    tour.addStep({
      id: 'settings',
      text: 'Click the Settings button to open the settings panel where you can create your first approver. An approver is a parent who can approve task completions, early completions, and other actions using a 4-digit PIN. The tour will automatically continue once you open Settings.',
      title: 'Step 1: Open Settings',
      attachTo: {
        element: '[data-tour="settings-button"]',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Skip Tour',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onSkip();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: '← Back',
          action: tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Open Settings →',
          action: () => {
            const settingsBtn = document.querySelector('[data-tour="settings-button"]') as HTMLElement;
            if (settingsBtn) {
              settingsBtn.click();
              // Wait for modal to open before advancing
              const checkModal = setInterval(() => {
                const modal = document.querySelector('.modal-overlay')?.querySelector('.modal')?.querySelector('h2')?.textContent?.includes('Settings');
                if (modal) {
                  clearInterval(checkModal);
                  // Small delay to ensure modal is fully rendered
                  setTimeout(() => {
                    tour.next();
                  }, 300);
                }
              }, 100);
              // Timeout after 2 seconds if modal doesn't open
              setTimeout(() => clearInterval(checkModal), 2000);
            } else {
              tour.next();
            }
          },
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Step 3: Guide through Settings Modal - Approver Form
    tour.addStep({
      id: 'modal-approver-form',
      text: 'Great! Now in the Settings modal, scroll to the "Approvers" section. Enter a handle (like "Dad" or "Mom"), a 4-digit PIN, confirm the PIN, then click "Add Approver". This creates your first parent approver who can approve task completions. The tour will automatically continue once you add an approver.',
      title: 'Step 2: Create Your First Approver',
      beforeShowPromise: function() {
        return new Promise<void>((resolve) => {
          if (typeof window === 'undefined') {
            resolve();
            return;
          }
          const checkElement = () => {
            const element = document.querySelector('[data-tour="approver-form"]');
            if (element) {
              resolve();
            } else {
              setTimeout(checkElement, 50);
            }
          };
          checkElement();
          // Timeout after 5 seconds
          setTimeout(() => resolve(), 5000);
        });
      },
      attachTo: {
        element: '[data-tour="approver-form"]',
        on: 'top'
      },
      buttons: [
        {
          text: 'Skip Tour',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onSkip();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: '← Back',
          action: () => {
            // Close modal and go back
            const closeBtn = document.querySelector('.modal-overlay')?.querySelector('.close');
            if (closeBtn) {
              (closeBtn as HTMLElement).click();
            }
            setTimeout(() => tour.back(), 300);
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Skip Approver Setup →',
          action: () => {
            // Skip approver setup and all dependent steps - go to wallet (optional step)
            const hasWalletStep = typeof (tour as unknown as { getById?: (id: string) => unknown }).getById === 'function'
              ? !!(tour as unknown as { getById: (id: string) => unknown }).getById('wallet')
              : Array.isArray((tour as unknown as { steps?: Array<{ id?: string }> }).steps) && (tour as unknown as { steps: Array<{ id?: string }> }).steps.some((s: { id?: string }) => s.id === 'wallet');
            if (hasWalletStep) {
              tour.show('wallet');
            } else {
              // If no wallet step, just complete the tour
              markTourComplete();
              tour.complete();
              callbacksRef.current.onComplete();
            }
          },
          classes: 'shepherd-button-secondary'
        }
      ]
    });

    // Step 4: Add Child Button
    tour.addStep({
      id: 'add-child',
      text: 'Now let\'s add your first child. Children are the family members who will complete tasks. Each child can earn stars and money rewards. Click the "+ Add Child" button to add a child. The tour will automatically continue once you open the modal.',
      title: 'Step 3: Add Your First Child',
      attachTo: {
        element: '[data-tour="add-child-button"]',
        on: 'top'
      },
      buttons: [
        {
          text: 'Skip Tour',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onSkip();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: '← Back',
          action: tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Open Add Child →',
          action: () => {
            // Close Settings modal first (UX principle: single focus & modality)
            const settingsCloseBtn = document.querySelector('.modal-overlay')?.querySelector('.close') as HTMLElement;
            if (settingsCloseBtn) {
              settingsCloseBtn.click();
            }
            // Wait for Settings to close, then open Add Child
            setTimeout(() => {
              const addChildBtn = document.querySelector('[data-tour="add-child-button"]') as HTMLElement;
              if (addChildBtn) {
                addChildBtn.click();
                // Wait for modal to open before advancing
                const checkModal = setInterval(() => {
                  const modal = document.querySelector('.modal-overlay')?.querySelector('.modal')?.querySelector('h2')?.textContent?.includes('Add Child');
                  if (modal) {
                    clearInterval(checkModal);
                    setTimeout(() => {
                      tour.next();
                    }, 300);
                  }
                }, 100);
                setTimeout(() => clearInterval(checkModal), 2000);
              } else {
                tour.next();
              }
            }, 300);
          },
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Step 5: Guide through Add Child Modal
    tour.addStep({
      id: 'modal-add-child',
      text: 'In the "Add Child" modal, enter the child\'s name and optionally a blockchain address. Click "Add" when done. You can add multiple children later. Each child will have their own column on the main screen showing their assigned tasks. The tour will automatically continue once you add a child.',
      title: 'Step 4: Enter Child\'s Name',
      beforeShowPromise: function() {
        return new Promise<void>((resolve) => {
          if (typeof window === 'undefined') {
            resolve();
            return;
          }
          const checkElement = () => {
            // Check for the modal using data attribute
            const element = document.querySelector('[data-tour="add-child-modal"]');
            if (element) {
              resolve();
            } else {
              setTimeout(checkElement, 50);
            }
          };
          checkElement();
          // Timeout after 5 seconds
          setTimeout(() => resolve(), 5000);
        });
      },
      attachTo: {
        element: '[data-tour="add-child-modal"]',
        on: 'auto'
      },
      modalOverlayOpeningPadding: 200,
      buttons: [
        {
          text: 'Skip Tour',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onSkip();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: '← Back',
          action: () => {
            const closeBtn = document.querySelector('.modal-overlay')?.querySelector('.close');
            if (closeBtn) {
              (closeBtn as HTMLElement).click();
            }
            setTimeout(() => tour.back(), 300);
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Skip Adding Child →',
          action: () => {
            // Close modal and skip to wallet (optional step)
            const closeBtn = document.querySelector('.modal-overlay')?.querySelector('.close');
            if (closeBtn) {
              (closeBtn as HTMLElement).click();
            }
            const hasWalletStep = typeof (tour as unknown as { getById?: (id: string) => unknown }).getById === 'function'
              ? !!(tour as unknown as { getById: (id: string) => unknown }).getById('wallet')
              : Array.isArray((tour as unknown as { steps?: Array<{ id?: string }> }).steps) && (tour as unknown as { steps: Array<{ id?: string }> }).steps.some((s: { id?: string }) => s.id === 'wallet');
            if (hasWalletStep) {
              setTimeout(() => tour.show('wallet'), 300);
            } else {
              markTourComplete();
              tour.complete();
              callbacksRef.current.onComplete();
            }
          },
          classes: 'shepherd-button-secondary'
        }
      ]
    });

    // Step 6: Add Task Button
    tour.addStep({
      id: 'add-task',
      text: 'Now let\'s create your first task! Tasks can be recurring (daily, weekly, etc.) or one-time. You can also add timers with rewards for completing on time. Click "+ Add Chore" to create a task. The tour will automatically continue once you open the task modal.',
      title: 'Step 5: Create Your First Task',
      attachTo: {
        element: '[data-tour="add-task-button"]',
        on: 'top'
      },
      buttons: [
        {
          text: 'Skip Tour',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onSkip();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: '← Back',
          action: tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Open Add Task →',
          action: () => {
            const addTaskBtn = document.querySelector('[data-tour="add-task-button"]') as HTMLElement;
            if (addTaskBtn) {
              addTaskBtn.click();
              // Wait for modal to open before advancing
              const checkModal = setInterval(() => {
                const modal = document.querySelector('.modal-overlay')?.querySelector('.modal')?.querySelector('h2')?.textContent?.includes('Create Task') ||
                             document.querySelector('.modal-overlay')?.querySelector('.modal')?.querySelector('h2')?.textContent?.includes('Edit Task');
                if (modal) {
                  clearInterval(checkModal);
                  setTimeout(() => {
                    tour.next();
                  }, 300);
                }
              }, 100);
              setTimeout(() => clearInterval(checkModal), 2000);
            } else {
              tour.next();
            }
          },
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Step 7: Guide through Task Modal
    tour.addStep({
      id: 'modal-add-task',
      text: 'In the task creation modal, enter a title (like "Take out trash"). You can add an emoji and color. Choose the task type: Recurring (repeats daily/weekly) or One-off (single task). You can also enable timer settings for either type. Set star and money rewards, then click "Create". The tour will automatically continue once you create a task.',
      title: 'Step 6: Create Your Task',
      beforeShowPromise: function() {
        return new Promise<void>((resolve) => {
          if (typeof window === 'undefined') {
            resolve();
            return;
          }
          const checkElement = () => {
            // Check for the modal using data attribute
            const element = document.querySelector('[data-tour="task-modal"]');
            if (element) {
              resolve();
            } else {
              setTimeout(checkElement, 50);
            }
          };
          checkElement();
          // Timeout after 5 seconds
          setTimeout(() => resolve(), 5000);
        });
      },
      attachTo: {
        element: '[data-tour="task-modal"]',
        on: 'auto'
      },
      modalOverlayOpeningPadding: 200,
      buttons: [
        {
          text: 'Skip Tour',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onSkip();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: '← Back',
          action: () => {
            const closeBtn = document.querySelector('.modal-overlay')?.querySelector('.close');
            if (closeBtn) {
              (closeBtn as HTMLElement).click();
            }
            setTimeout(() => tour.back(), 300);
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Skip Creating Task →',
          action: () => {
            // Close modal and skip to next step
            const closeBtn = document.querySelector('.modal-overlay')?.querySelector('.close');
            if (closeBtn) {
              (closeBtn as HTMLElement).click();
            }
            setTimeout(() => tour.next(), 300);
          },
          classes: 'shepherd-button-secondary'
        }
      ]
    });

    // Step 8: Explain Task Assignment
    tour.addStep({
      id: 'explain-assignment',
      text: 'After creating tasks, you can assign them to children by dragging tasks to their columns, or by editing the task. Tasks appear in each child\'s column and can be marked complete. If parent approval is required, an approver will need to verify completion.',
      title: 'Task Assignment',
      attachTo: {
        element: 'body',
        on: 'auto' as const
      },
      buttons: [
        {
          text: 'Skip Tour',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onSkip();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: '← Back',
          action: tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Next →',
          action: tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Step 9: Wallet (Optional)
    tour.addStep({
      id: 'wallet',
      text: 'Optionally, you can connect a blockchain wallet for payments. This allows you to send cryptocurrency rewards to children. This is completely optional - you can use the app without it. Click "Connect Wallet" if you want to set this up, or skip this step.',
      title: 'Step 7: Connect Wallet (Optional)',
      attachTo: {
        element: '[data-tour="wallet-button"]',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Skip Tour',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onSkip();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: '← Back',
          action: tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Finish',
          action: () => {
            markTourComplete();
            tour.complete();
            callbacksRef.current.onComplete();
          },
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Handle tour completion
    tour.on('complete', () => {
      markTourComplete();
      hasStartedRef.current = false;
      tourRef.current = null;
      callbacksRef.current.onComplete();
      currentStepIdRef.current = null;
    });

    tour.on('cancel', () => {
      markTourComplete();
      hasStartedRef.current = false;
      tourRef.current = null;
      callbacksRef.current.onSkip();
      currentStepIdRef.current = null;
    });

    tourRef.current = tour;
    hasStartedRef.current = true;

    // Start tour after a small delay to ensure DOM is ready
    setTimeout(() => {
      if (tourRef.current === tour) {
        tour.start();
      }
    }, 300);

    return () => {
      if (tourRef.current === tour) {
        tour.complete();
        tourRef.current = null;
        hasStartedRef.current = false;
      }
    };
  }, [active]);

  // Auto-advance tour when actions are completed
  useEffect(() => {
    if (!active || !tourRef.current || !tourRef.current.isActive()) return;

    const currentStep = tourRef.current.getCurrentStep();
    if (!currentStep) return;

    const currentStepId = currentStep.id;

    switch (currentStepId) {
      case 'settings':
      case 'modal-approver-form':
        if (state.parentSettings.pins && state.parentSettings.pins.length > 0) {
          // Close Settings modal first (UX principle: single focus & modality)
          const settingsCloseBtn = document.querySelector('.modal-overlay')?.querySelector('.close') as HTMLElement;
          if (settingsCloseBtn) {
            settingsCloseBtn.click();
          }
          // Wait for Settings to close, then advance
          setTimeout(() => {
            if (tourRef.current?.isActive()) {
              // Skip to add-child step
              const steps = tourRef.current.steps;
              const addChildIndex = steps.findIndex((s: { id?: string }) => s.id === 'add-child');
              if (addChildIndex !== -1) {
                tourRef.current.show(addChildIndex);
              } else {
                tourRef.current.next();
              }
            }
          }, 500);
        }
        break;
      case 'add-child':
      case 'modal-add-child':
        if (state.children.length > 0) {
          setTimeout(() => {
            if (tourRef.current?.isActive()) {
              const steps = tourRef.current.steps;
              const addTaskIndex = steps.findIndex((s: { id?: string }) => s.id === 'add-task');
              if (addTaskIndex !== -1) {
                tourRef.current.show(addTaskIndex);
              } else {
                tourRef.current.next();
              }
            }
          }, 1000);
        }
        break;
      case 'add-task':
      case 'modal-add-task':
        if (state.tasks.length > 0) {
          setTimeout(() => {
            if (tourRef.current?.isActive()) {
              tourRef.current.next();
            }
          }, 1000);
        }
        break;
      // Wallet step is optional, can be manually advanced or skipped
    }
  }, [state.parentSettings.pins, state.children.length, state.tasks.length, active]);

  return null;
}
