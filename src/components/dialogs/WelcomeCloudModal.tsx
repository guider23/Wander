import React, { useState } from 'react';
import { Cloud, Sparkles, RefreshCw, X, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';

interface WelcomeCloudModalProps {
  isOpen: boolean;
  onStartFresh: () => void;
  onRestored: (importedTrees: number) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const WelcomeCloudModal: React.FC<WelcomeCloudModalProps> = ({
  isOpen,
  onStartFresh,
  onRestored,
  onClose,
  showToast
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectAndRestore = async () => {
    setIsConnecting(true);
    setErrorMessage(null);

    try {
      const connectRes = await api.gdrive.connect();
      if (!connectRes.success) {
        setErrorMessage(connectRes.error || 'Connection was canceled or failed.');
        setIsConnecting(false);
        return;
      }

      setIsConnecting(false);
      setIsRestoring(true);

      const latestBackup = await api.gdrive.checkBackups();
      if (!latestBackup) {
        setIsRestoring(false);
        showToast(`Connected as ${connectRes.email || 'Google Account'}. No previous backups found.`);
        onStartFresh();
        return;
      }

      const restoreRes = await api.gdrive.restoreLatest(latestBackup.id);
      setIsRestoring(false);

      if (restoreRes.success) {
        showToast(`Restored ${restoreRes.importedTrees} trees and ${restoreRes.importedNodes} nodes from Google Drive`);
        onRestored(restoreRes.importedTrees);
      } else {
        setErrorMessage(restoreRes.error || 'Failed to restore backup from Google Drive.');
      }
    } catch (err: any) {
      setIsConnecting(false);
      setIsRestoring(false);
      setErrorMessage(err.message || 'An error occurred during restore.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 14, 12, 0.45)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 1500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConnecting && !isRestoring) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '560px',
          maxWidth: '92vw',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.22), 0 4px 16px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'notionFadeIn 160ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 24px 16px 24px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#FAF9F5'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#8C7A6B'
                }}
              >
                Welcome to Wander
              </span>
            </div>
            <h2
              style={{
                margin: '4px 0 0 0',
                fontSize: '18px',
                fontWeight: 650,
                color: '#181818',
                letterSpacing: '-0.02em'
              }}
            >
              Get Started
            </h2>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '12.5px',
                color: '#6A625A',
                lineHeight: 1.45
              }}
            >
              Choose how you would like to set up your attention canvas on this machine.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isConnecting || isRestoring}
            aria-label="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              color: '#8C7A6B',
              cursor: isConnecting || isRestoring ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 120ms ease, color 120ms ease'
            }}
            onMouseEnter={(e) => {
              if (!isConnecting && !isRestoring) {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.color = '#181818';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#8C7A6B';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Options */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Option A: Restore from Google Drive */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              border: '1.5px solid rgba(35, 131, 226, 0.28)',
              backgroundColor: 'rgba(35, 131, 226, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 140ms ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '9px',
                  backgroundColor: 'rgba(35, 131, 226, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Cloud size={18} color="#0B6ECA" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#181818' }}>
                    Restore from Google Drive
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(35, 131, 226, 0.1)',
                      color: '#0B6ECA'
                    }}
                  >
                    Recommended
                  </span>
                </div>
                <p
                  style={{
                    margin: '3px 0 0 0',
                    fontSize: '12px',
                    color: '#6A625A',
                    lineHeight: 1.45
                  }}
                >
                  Connect your Google account to restore your existing trees, active thoughts, and attention history from your other computer.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <button
                onClick={handleConnectAndRestore}
                disabled={isConnecting || isRestoring}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: '#181818',
                  color: '#F5E6D8',
                  fontSize: '12px',
                  fontWeight: 550,
                  cursor: isConnecting || isRestoring ? 'wait' : 'pointer',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
                  transition: 'opacity 120ms ease'
                }}
                onMouseEnter={(e) => {
                  if (!isConnecting && !isRestoring) e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {isConnecting || isRestoring ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{isConnecting ? 'Connecting Drive...' : 'Restoring Trees...'}</span>
                  </>
                ) : (
                  <>
                    <span>Connect & Restore</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Option B: Start Fresh */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 140ms ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '9px',
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Sparkles size={18} color="#6A625A" />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#181818' }}>
                  Start Fresh
                </span>
                <p
                  style={{
                    margin: '3px 0 0 0',
                    fontSize: '12px',
                    color: '#6A625A',
                    lineHeight: 1.45
                  }}
                >
                  Begin a new, blank workspace on this machine. You can connect Google Drive anytime later in Preferences.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <button
                onClick={onStartFresh}
                disabled={isConnecting || isRestoring}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  backgroundColor: '#FFFFFF',
                  color: '#181818',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: isConnecting || isRestoring ? 'not-allowed' : 'pointer',
                  transition: 'background-color 120ms ease'
                }}
                onMouseEnter={(e) => {
                  if (!isConnecting && !isRestoring) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <span>Start Fresh</span>
              </button>
            </div>
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#B91C1C',
                fontSize: '12px',
                lineHeight: 1.4
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#FAF9F5',
            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
            fontSize: '11px',
            color: '#8C7A6B',
            textAlign: 'center'
          }}
        >
          Cloud backups are end-to-end sandboxed inside your private Google Drive AppData folder.
        </div>
      </div>
    </div>
  );
};
