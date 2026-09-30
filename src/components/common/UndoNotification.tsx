import React, { useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';

export interface UndoAction {
  id: string;
  label: string;
  description?: string;
  onUndo: () => Promise<void> | void;
  timestamp: number;
  durationMs?: number; // Defaults to 10000 (10s)
}

interface UndoNotificationProps {
  action: UndoAction | null;
  onDismiss: () => void;
}

export const UndoNotification: React.FC<UndoNotificationProps> = ({ action, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);

  const duration = action?.durationMs || 10000;

  useEffect(() => {
    if (!action) {
      setProgress(100);
      return;
    }

    const startTime = action.timestamp;
    const interval = setInterval(() => {
      if (isHovered) return; // Pause timer while user hovers over undo pill

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1 - elapsed / duration);
      setProgress(remaining * 100);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [action, duration, isHovered, onDismiss]);

  if (!action) return null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutHint = isMac ? '⌘Z' : 'Ctrl+Z';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '84px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 650,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 14px',
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(216, 199, 184, 0.85)',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
        animation: 'notionFadeIn 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        minWidth: '280px',
        maxWidth: '460px'
      }}
      role="status"
      aria-live="polite"
    >
      {/* Visual Progress Timer Bar (10s decay) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2.5px',
          width: `${progress}%`,
          backgroundColor: '#C49B71',
          transition: 'width 60ms linear',
          opacity: 0.85
        }}
      />

      {/* Action Description */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#181818',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.01em'
          }}
        >
          {action.label}
        </span>
        {action.description && (
          <span
            style={{
              fontSize: '11px',
              color: '#78716C',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {action.description}
          </span>
        )}
      </div>

      {/* Minimal Undo Button */}
      <button
        onClick={async () => {
          try {
            await action.onUndo();
          } finally {
            onDismiss();
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          backgroundColor: '#181818',
          color: '#F5E6D8',
          border: 'none',
          borderRadius: '7px',
          fontSize: '11.5px',
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 140ms ease',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#2B2623';
          e.currentTarget.style.transform = 'scale(1.03)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#181818';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={`Undo action (${shortcutHint})`}
      >
        <Undo2 size={12} strokeWidth={2.4} />
        <span>Undo</span>
        <span
          style={{
            fontSize: '10px',
            opacity: 0.7,
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
            padding: '1px 4px',
            borderRadius: '4px',
            marginLeft: '2px',
            fontFamily: 'monospace'
          }}
        >
          {shortcutHint}
        </span>
      </button>

      {/* Dismiss Button */}
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: '#8A827B',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'color 120ms ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#181818';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#8A827B';
        }}
        aria-label="Dismiss undo notification"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
};
