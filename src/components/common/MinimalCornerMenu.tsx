import React from 'react';

interface MinimalCornerMenuProps {
  onStartNewWork: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  activeTitle?: string | null;
}

export const MinimalCornerMenu: React.FC<MinimalCornerMenuProps> = ({
  onStartNewWork,
  onOpenHistory,
  onOpenSettings,
  activeTitle
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '18px',
        right: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 500,
        backgroundColor: 'rgba(245, 230, 216, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(26, 26, 26, 0.15)',
        borderRadius: '20px',
        padding: '4px 12px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
      }}
    >
      {activeTitle && (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#1A1A1A',
            marginRight: '6px',
            maxWidth: '160px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {activeTitle}
        </span>
      )}

      <button
        onClick={onStartNewWork}
        style={{
          fontSize: '11.5px',
          fontWeight: 500,
          color: '#1A1A1A',
          padding: '3px 8px',
          borderRadius: '12px',
          backgroundColor: 'transparent'
        }}
        title="Start new main work context"
      >
        + New
      </button>

      <button
        onClick={onOpenHistory}
        style={{
          fontSize: '11.5px',
          fontWeight: 400,
          color: '#4A433D',
          padding: '3px 8px',
          borderRadius: '12px',
          backgroundColor: 'transparent'
        }}
      >
        History
      </button>

      <button
        onClick={onOpenSettings}
        style={{
          fontSize: '11.5px',
          fontWeight: 400,
          color: '#4A433D',
          padding: '3px 8px',
          borderRadius: '12px',
          backgroundColor: 'transparent'
        }}
      >
        Settings
      </button>
    </div>
  );
};
