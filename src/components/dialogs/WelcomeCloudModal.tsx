import React, { useState } from 'react';
import { RefreshCw, X, ArrowRight, AlertCircle, HardDrive, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import { WanderLogo } from '../icons/WanderLogo';

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
        inset: 0,
        backgroundColor: 'rgba(12, 10, 8, 0.55)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
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
          width: '520px',
          maxWidth: '92vw',
          backgroundColor: 'var(--background-card)',
          borderRadius: '16px',
          border: '1px solid var(--ink-border)',
          boxShadow: 'var(--shadow-notion)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'notionFadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          color: 'var(--ink)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '28px 28px 20px 28px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            borderBottom: '1px solid var(--ink-border)'
          }}
        >
          <button
            onClick={onClose}
            disabled={isConnecting || isRestoring}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              background: 'none',
              border: 'none',
              color: 'var(--ink-muted)',
              cursor: isConnecting || isRestoring ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 120ms ease'
            }}
            onMouseEnter={(e) => {
              if (!isConnecting && !isRestoring) {
                e.currentTarget.style.color = 'var(--ink)';
                e.currentTarget.style.backgroundColor = 'var(--dock-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ink-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={16} />
          </button>

          {/* Botanical Emblem */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--background)',
              border: '1px solid var(--ink-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <WanderLogo size={24} color="currentColor" />
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '-0.025em',
              color: 'var(--ink)'
            }}
          >
            Welcome to Wander
          </h2>
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: '13px',
              color: 'var(--ink-secondary)',
              lineHeight: 1.5,
              maxWidth: '380px'
            }}
          >
            A local-first canvas for recording how attention moves between deep work and curiosity.
          </p>
        </div>

        {/* Options */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Option 1: Cloud Restore */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              border: '1px solid var(--ink-border)',
              backgroundColor: 'var(--background-glass)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'border-color 150ms ease, box-shadow 150ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--ink-border)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--ink-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px'
                }}
              >
                {/* Clean botanical cloud sync SVG */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                  <path d="M12 12v6" />
                  <path d="m9 15 3-3 3 3" />
                </svg>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                    Restore from Google Drive
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--ink-secondary)',
                      fontWeight: 500,
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--ink-border)',
                      padding: '2px 8px',
                      borderRadius: '9999px'
                    }}
                  >
                    Sync
                  </span>
                </div>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '12.5px',
                    color: 'var(--ink-secondary)',
                    lineHeight: 1.45
                  }}
                >
                  Retrieve your saved attention trees, active branches, and history from another device.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '2px' }}>
              <button
                onClick={handleConnectAndRestore}
                disabled={isConnecting || isRestoring}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--ink)',
                  color: 'var(--background)',
                  fontSize: '12.5px',
                  fontWeight: 550,
                  cursor: isConnecting || isRestoring ? 'wait' : 'pointer',
                  transition: 'opacity 120ms ease'
                }}
                onMouseEnter={(e) => {
                  if (!isConnecting && !isRestoring) e.currentTarget.style.opacity = '0.88';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {isConnecting || isRestoring ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{isConnecting ? 'Authorizing Drive...' : 'Restoring Trees...'}</span>
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

          {/* Option 2: Start Fresh */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              border: '1px solid var(--ink-border)',
              backgroundColor: 'var(--background-glass)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'border-color 150ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--ink-border)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--ink-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px'
                }}
              >
                <HardDrive size={18} strokeWidth={1.6} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                  Start with a Fresh Canvas
                </div>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '12.5px',
                    color: 'var(--ink-secondary)',
                    lineHeight: 1.45
                  }}
                >
                  Plant a brand new tree root on this machine. Cloud backup can be enabled anytime in Preferences.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '2px' }}>
              <button
                onClick={onStartFresh}
                disabled={isConnecting || isRestoring}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--ink-border)',
                  backgroundColor: 'var(--background-card)',
                  color: 'var(--ink)',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: isConnecting || isRestoring ? 'not-allowed' : 'pointer',
                  transition: 'background-color 120ms ease, border-color 120ms ease'
                }}
                onMouseEnter={(e) => {
                  if (!isConnecting && !isRestoring) {
                    e.currentTarget.style.backgroundColor = 'var(--dock-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--background-card)';
                }}
              >
                <span>Start Fresh</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
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
                color: '#EF4444',
                fontSize: '12px',
                lineHeight: 1.4
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 28px',
            backgroundColor: 'var(--background)',
            borderTop: '1px solid var(--ink-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--ink-muted)'
          }}
        >
          <ShieldCheck size={13} style={{ flexShrink: 0 }} />
          <span>Local-first SQLite • Cloud backups are sandboxed in your private Google Drive</span>
        </div>
      </div>
    </div>
  );
};
