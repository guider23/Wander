import React, { useState } from 'react';
import { RefreshCw, X, ArrowRight, AlertCircle, Shield } from 'lucide-react';
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
        backgroundColor: 'rgba(10, 9, 8, 0.65)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
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
          width: '480px',
          maxWidth: '92vw',
          backgroundColor: 'var(--background-card)',
          borderRadius: '20px',
          border: '1px solid var(--ink-border)',
          boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.28), 0 0 0 1px var(--ink-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'notionFadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          color: 'var(--ink)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Close Icon */}
        <button
          onClick={onClose}
          disabled={isConnecting || isRestoring}
          aria-label="Dismiss"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--ink-muted)',
            cursor: isConnecting || isRestoring ? 'not-allowed' : 'pointer',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 140ms ease',
            zIndex: 10
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
          <X size={15} />
        </button>

        {/* Minimal Hero Header */}
        <div
          style={{
            padding: '36px 32px 24px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          {/* Handcrafted Emblem Ring */}
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'var(--background)',
              border: '1px solid var(--ink-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)'
            }}
          >
            <WanderLogo size={28} color="currentColor" />
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 650,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
              fontFamily: 'inherit'
            }}
          >
            Wander
          </h2>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: '13.5px',
              color: 'var(--ink-secondary)',
              lineHeight: 1.5,
              maxWidth: '340px',
              fontWeight: 400
            }}
          >
            Record how your attention moves between deep focused work and wandering thoughts.
          </p>
        </div>

        {/* Two Choice Tiles */}
        <div style={{ padding: '0 28px 24px 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Card 1: Restore from Cloud */}
          <div
            onClick={(!isConnecting && !isRestoring) ? handleConnectAndRestore : undefined}
            style={{
              padding: '16px 20px',
              borderRadius: '14px',
              border: '1px solid var(--ink-border)',
              backgroundColor: 'var(--background-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: isConnecting || isRestoring ? 'wait' : 'pointer',
              transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
              gap: '16px'
            }}
            onMouseEnter={(e) => {
              if (!isConnecting && !isRestoring) {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.06)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--ink-border)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                  color: 'var(--ink)'
                }}
              >
                {/* Minimalist Cloud Restore Glyph */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                  <path d="M12 13v5" />
                  <path d="m9.5 15.5 2.5-2.5 2.5 2.5" />
                </svg>
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                  Restore from Google Drive
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '2px' }}>
                  Sync trees & history from another device
                </div>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleConnectAndRestore();
              }}
              disabled={isConnecting || isRestoring}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--ink)',
                color: 'var(--background)',
                fontSize: '12px',
                fontWeight: 550,
                cursor: isConnecting || isRestoring ? 'wait' : 'pointer',
                flexShrink: 0,
                transition: 'opacity 120ms ease'
              }}
            >
              {isConnecting || isRestoring ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>{isConnecting ? 'Connecting...' : 'Restoring...'}</span>
                </>
              ) : (
                <>
                  <span>Connect</span>
                  <ArrowRight size={12} />
                </>
              )}
            </button>
          </div>

          {/* Card 2: Start Fresh */}
          <div
            onClick={(!isConnecting && !isRestoring) ? onStartFresh : undefined}
            style={{
              padding: '16px 20px',
              borderRadius: '14px',
              border: '1px solid var(--ink-border)',
              backgroundColor: 'var(--background-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: isConnecting || isRestoring ? 'not-allowed' : 'pointer',
              transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
              gap: '16px'
            }}
            onMouseEnter={(e) => {
              if (!isConnecting && !isRestoring) {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.06)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--ink-border)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                  color: 'var(--ink)'
                }}
              >
                {/* Minimalist Botanical Seed / Sprout Glyph */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21V11" />
                  <path d="M12 11c0-4 4-7 9-7 0 5-3 9-9 9Z" />
                  <path d="M12 15c-2.5-3-6-4-9-4 0 4 3 6.5 9 6.5" />
                </svg>
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                  Start Fresh
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '2px' }}>
                  Begin with a clean canvas on this computer
                </div>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartFresh();
              }}
              disabled={isConnecting || isRestoring}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid var(--ink-border)',
                backgroundColor: 'var(--background-card)',
                color: 'var(--ink)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: isConnecting || isRestoring ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                transition: 'background-color 120ms ease'
              }}
            >
              <span>Begin</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
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

        {/* Quiet Reassurance Footnote */}
        <div
          style={{
            padding: '14px 28px',
            backgroundColor: 'var(--background)',
            borderTop: '1px solid var(--ink-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            fontSize: '11.5px',
            color: 'var(--ink-muted)'
          }}
        >
          <Shield size={12} strokeWidth={1.7} style={{ flexShrink: 0 }} />
          <span>Local-first SQLite • Cloud backups are sandboxed and optional</span>
        </div>
      </div>
    </div>
  );
};
