import React, { useState } from 'react';
import { ArrowUpCircle, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { UpdateInfo, dismissUpdate } from '../../utils/updater';
import { api } from '../../api/client';

interface UpdateBannerProps {
  update: UpdateInfo;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ update, onDismiss }) => {
  const [showNotes, setShowNotes] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      if (update.downloadUrl) {
        await api.updater.install(update.downloadUrl);
      } else {
        await api.updater.install(update.releaseUrl);
      }
    } catch {
      window.open(update.downloadUrl || update.releaseUrl, '_blank');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeepCurrent = () => {
    dismissUpdate(update.latestVersion);
    onDismiss();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '24px',
        zIndex: 680,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '10px 14px',
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(216, 199, 184, 0.9)',
        borderRadius: '12px',
        boxShadow: '0 10px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
        animation: 'notionFadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '380px',
        minWidth: '300px'
      }}
      role="alert"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpCircle size={16} strokeWidth={2.2} color="#C49B71" />
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#181818', letterSpacing: '-0.01em' }}>
            Update {update.latestVersion} available
          </span>
        </div>

        <button
          onClick={handleKeepCurrent}
          style={{
            background: 'none',
            border: 'none',
            color: '#8A827B',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
          title="Dismiss"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      <div style={{ fontSize: '11.5px', color: '#5C554F', lineHeight: '1.4' }}>
        You are on <code style={{ backgroundColor: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: '4px' }}>v{update.currentVersion}</code>.
        Install the latest version to get fixes and performance updates.
      </div>

      {/* Release notes preview accordion */}
      {update.releaseNotes && (
        <div>
          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '11px',
              color: '#A58E7A',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '2px'
            }}
          >
            {showNotes ? 'Hide release notes' : "See what's new"}
            {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showNotes && (
            <div
              style={{
                marginTop: '6px',
                padding: '6px 8px',
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#3A3632',
                maxHeight: '120px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.35'
              }}
            >
              {update.releaseNotes}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
        <button
          onClick={handleKeepCurrent}
          style={{
            background: 'none',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 500,
            color: '#5C554F',
            cursor: 'pointer',
            transition: 'background-color 120ms ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          Keep v{update.currentVersion}
        </button>

        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#181818',
            border: 'none',
            padding: '4px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#F5E6D8',
            cursor: isUpdating ? 'wait' : 'pointer',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
            transition: 'transform 120ms ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <ExternalLink size={11} strokeWidth={2} />
          {isUpdating ? 'Opening...' : 'Update Now'}
        </button>
      </div>
    </div>
  );
};
