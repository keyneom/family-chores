import React, { useState, useEffect } from "react";
import { useChoresApp } from "../ChoresAppContext";
import { useAccount, useConnect } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { hashPin, genSalt } from "../../utils/pinUtils";
import Task from "../../types/task";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

type OnboardingStep = 'welcome' | 'approver' | 'child' | 'task' | 'wallet' | 'complete';

export default function OnboardingWizard({ open, onComplete, onSkip }: OnboardingWizardProps) {
  const { state, dispatch } = useChoresApp();
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [approverHandle, setApproverHandle] = useState('');
  const [approverPin, setApproverPin] = useState('');
  const [approverPinConfirm, setApproverPinConfirm] = useState('');
  const [approverError, setApproverError] = useState('');
  const [childName, setChildName] = useState('');
  const [childError, setChildError] = useState('');
  const [walletSkipped, setWalletSkipped] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep('welcome');
      setApproverHandle('');
      setApproverPin('');
      setApproverPinConfirm('');
      setApproverError('');
      setChildName('');
      setChildError('');
      setWalletSkipped(false);
    }
  }, [open]);

  if (!open) return null;

  const handleNext = () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('approver');
        break;
      case 'approver':
        handleCreateApprover();
        break;
      case 'child':
        handleCreateChild();
        break;
      case 'task':
        setCurrentStep('wallet');
        break;
      case 'wallet':
        handleComplete();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'approver':
        setCurrentStep('welcome');
        break;
      case 'child':
        setCurrentStep('approver');
        break;
      case 'task':
        setCurrentStep('child');
        break;
      case 'wallet':
        setCurrentStep('task');
        break;
    }
  };

  const handleSkip = () => {
    switch (currentStep) {
      case 'welcome':
      case 'approver':
      case 'child':
      case 'task':
        // Skip to next step
        if (currentStep === 'welcome') setCurrentStep('approver');
        else if (currentStep === 'approver') setCurrentStep('child');
        else if (currentStep === 'child') setCurrentStep('task');
        else if (currentStep === 'task') setCurrentStep('wallet');
        break;
      case 'wallet':
        setWalletSkipped(true);
        handleComplete();
        break;
    }
  };

  const handleCreateApprover = async () => {
    setApproverError('');
    
    if (!approverHandle.trim()) {
      setApproverError('Please enter an approver name');
      return;
    }
    
    if (approverPin.length !== 4 || !/^\d{4}$/.test(approverPin)) {
      setApproverError('PIN must be exactly 4 digits');
      return;
    }
    
    if (approverPin !== approverPinConfirm) {
      setApproverError('PINs do not match');
      return;
    }

    try {
      const salt = await genSalt();
      const pinHash = await hashPin(approverPin, salt);
      
      dispatch({
        type: 'UPDATE_PARENT_SETTINGS',
        payload: {
          pins: [
            ...(state.parentSettings.pins || []),
            { handle: approverHandle.trim(), pinHash, salt }
          ]
        }
      });
      
      setCurrentStep('child');
    } catch (error) {
      setApproverError('Failed to create approver. Please try again.');
      console.error('Approver creation error:', error);
    }
  };

  const handleCreateChild = () => {
    setChildError('');
    
    if (!childName.trim()) {
      setChildError('Please enter a child name');
      return;
    }

    const newChildId = state.children.length > 0 
      ? Math.max(...state.children.map(c => c.id)) + 1 
      : 1;

    dispatch({
      type: 'ADD_CHILD',
      payload: {
        id: newChildId,
        name: childName.trim(),
        stars: 0,
        money: 0
      }
    });

    setCurrentStep('task');
  };

  const handleCreateSampleTask = () => {
    const newTask: Task = {
      id: `onboarding_task_${Date.now()}`,
      title: "Sample Timed Task",
      description: "This is a sample timed task created during onboarding",
      createdAt: new Date().toISOString(),
      type: 'recurring',
      enabled: true,
      stars: 1,
      money: 0.5,
      emoji: "⏱️",
      color: "#FFB6C1",
      recurring: { cadence: 'daily' },
      timed: {
        allowedSeconds: 300, // 5 minutes
        latePenaltyPercent: 0.5,
        autoApproveOnStop: false,
      }
    };

    dispatch({
      type: 'ADD_TASK',
      payload: newTask
    });

    setCurrentStep('wallet');
  };

  const handleConnectWallet = async () => {
    try {
      await connectAsync({ connector: new InjectedConnector() });
      // Connection successful, proceed to complete
      setTimeout(() => handleComplete(), 500);
    } catch (error) {
      // User may have rejected, that's okay - they can skip
      console.log('Wallet connection skipped or failed:', error);
    }
  };

  const handleComplete = () => {
    // Mark onboarding as complete in action log
    dispatch({
      type: 'UPDATE_PARENT_SETTINGS',
      payload: {
        // Add a flag to track onboarding completion (stored in parentSettings for now)
        // This could be in actionLog but parentSettings is simpler for checking
      }
    });
    
    // Log onboarding completion
    dispatch({
      type: 'SET_STATE',
      payload: {
        ...state,
        actionLog: [
          ...(state.actionLog || []),
          {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
            actionType: 'ONBOARDING_COMPLETE',
            payload: { 
              walletConnected: isConnected || !walletSkipped,
              walletSkipped,
              approverCreated: state.parentSettings.pins && state.parentSettings.pins.length > 0,
              childCreated: state.children.length > 0,
            },
            actorHandle: null,
            timestamp: new Date().toISOString(),
          }
        ]
      }
    });
    
    onComplete();
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'approver':
        return approverHandle.trim().length > 0 && 
               approverPin.length === 4 && 
               approverPin === approverPinConfirm;
      case 'child':
        return childName.trim().length > 0;
      case 'task':
        return true; // Task creation is automatic
      case 'wallet':
        return true; // Can skip wallet
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="onboarding-step">
            <h2>👋 Welcome to Family Chores!</h2>
            <p>This quick setup will help you get started with managing your family&apos;s chores and rewards.</p>
            <p>We&apos;ll guide you through:</p>
            <ul style={{ textAlign: 'left', margin: '20px 0' }}>
              <li>Creating your first approver (parent PIN)</li>
              <li>Adding a child</li>
              <li>Creating a sample timed task</li>
              <li>Optionally connecting a wallet for payments</li>
            </ul>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              You can skip any step or cancel at any time.
            </p>
          </div>
        );

      case 'approver':
        return (
          <div className="onboarding-step">
            <h2>🔒 Create Your First Approver</h2>
            <p>An approver is a parent who can approve task completions and other actions using a PIN.</p>
            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Approver Name:
              </label>
              <input
                type="text"
                value={approverHandle}
                onChange={(e) => setApproverHandle(e.target.value)}
                placeholder="e.g., Mom, Dad, Parent"
                style={{ width: '100%', padding: '8px', fontSize: '16px' }}
              />
            </div>
            <div style={{ marginTop: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                4-Digit PIN:
              </label>
              <input
                type="password"
                value={approverPin}
                onChange={(e) => setApproverPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                style={{ width: '100%', padding: '8px', fontSize: '16px' }}
              />
            </div>
            <div style={{ marginTop: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Confirm PIN:
              </label>
              <input
                type="password"
                value={approverPinConfirm}
                onChange={(e) => setApproverPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                style={{ width: '100%', padding: '8px', fontSize: '16px' }}
              />
            </div>
            {approverError && (
              <div style={{ color: '#c00', marginTop: '10px' }}>{approverError}</div>
            )}
          </div>
        );

      case 'child':
        return (
          <div className="onboarding-step">
            <h2>👶 Add Your First Child</h2>
            <p>Add a child who will be assigned tasks and earn rewards.</p>
            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Child&apos;s Name:
              </label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g., Alice, Bob"
                style={{ width: '100%', padding: '8px', fontSize: '16px' }}
              />
            </div>
            {childError && (
              <div style={{ color: '#c00', marginTop: '10px' }}>{childError}</div>
            )}
          </div>
        );

      case 'task':
        return (
          <div className="onboarding-step">
            <h2>⏱️ Create a Sample Timed Task</h2>
            <p>Timed tasks have a time limit. Children start a timer when they begin and stop it when finished.</p>
            <p>Rewards are adjusted based on whether they finish on time or late.</p>
            <div style={{ marginTop: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
              <p><strong>Sample Task:</strong> &quot;Sample Timed Task&quot;</p>
              <p><strong>Time Limit:</strong> 5 minutes</p>
              <p><strong>Reward:</strong> 1 ⭐ + $0.50</p>
              <p><strong>Late Penalty:</strong> 50% of money reward</p>
            </div>
            <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#666' }}>
              Click &quot;Create Task&quot; to add this sample task, or skip to continue.
            </p>
          </div>
        );

      case 'wallet':
        return (
          <div className="onboarding-step">
            <h2>🌐 Connect Wallet (Optional)</h2>
            <p>You can connect a wallet to enable on-chain payments to your children.</p>
            <p>This is completely optional - you can skip this step and connect later if needed.</p>
            {isConnected ? (
              <div style={{ marginTop: '20px', padding: '15px', background: '#d4edda', borderRadius: '8px' }}>
                <p>✅ Wallet connected: {address ? `${String(address).slice(0,6)}...${String(address).slice(-4)}` : 'Connected'}</p>
              </div>
            ) : (
              <div style={{ marginTop: '20px' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={handleConnectWallet}
                  style={{ marginRight: '10px' }}
                >
                  Connect Wallet
                </button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const stepNumber: number = {
    'welcome': 1,
    'approver': 2,
    'child': 3,
    'task': 4,
    'wallet': 5,
    'complete': 5,
  }[currentStep] || 1;

  const totalSteps = 5;

  return (
    <div className="modal" style={{ display: "block", zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Getting Started</h2>
          <span className="close" onClick={onSkip}>&times;</span>
        </div>
        <div className="modal-body">
          {/* Progress indicator */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                Step {stepNumber} of {totalSteps}
              </span>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                {Math.round((stepNumber / totalSteps) * 100)}% Complete
              </span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '8px', 
              background: '#e0e0e0', 
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${(stepNumber / totalSteps) * 100}%`, 
                height: '100%', 
                background: '#4CAF50',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {renderStep()}
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {currentStep !== 'welcome' && (
              <button className="btn btn-secondary" onClick={handleBack}>
                ← Back
              </button>
            )}
          </div>
          <div>
            <button 
              className="btn btn-secondary" 
              onClick={handleSkip}
              style={{ marginRight: '10px' }}
            >
              Skip
            </button>
            {currentStep === 'task' ? (
              <button 
                className="btn btn-primary" 
                onClick={handleCreateSampleTask}
              >
                Create Task
              </button>
            ) : currentStep === 'wallet' ? (
              <button 
                className="btn btn-primary" 
                onClick={handleComplete}
                disabled={!isConnected && !walletSkipped}
              >
                {isConnected ? 'Complete' : 'Skip & Complete'}
              </button>
            ) : (
              <button 
                className="btn btn-primary" 
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

