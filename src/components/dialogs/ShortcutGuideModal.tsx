import React, { useState, useEffect } from 'react';
import { X, Search, Command } from 'lucide-react';
import { formatShortcut } from '../../utils/platform';

interface ShortcutGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  category: 'Navigation' | 'Capture' | 'Actions' | 'Window';
  label: string;
  description: string;
  keys: string;
}

const getShortcuts = (): ShortcutItem[] => [
  { category: 'Navigation', label: 'Navigate Living Cursor', description: 'Glide the harmonic pointer (arrow pad only)', keys: '↑ ↓ ← →  /  H J K L' },
  { category: 'Navigation', label: 'Focus Navigated Node', description: 'Shift active attention to currently selected node', keys: 'Enter  or  Space' },
  { category: 'Actions', label: 'Node Action Wheel', description: 'Hold Shift to reveal radial wheel; release Shift to dismiss', keys: 'Hold Shift' },
  { category: 'Actions', label: 'Action Wheel Shortcuts', description: '[1] Step, [2] Thought, [3] Focus, [4] Done, [5] Drop, [6] Delete', keys: 'Shift + 1-6  /  Numpad' },
  { category: 'Actions', label: 'Delete Node / Branch', description: 'Instantly delete selected node and all child thoughts', keys: 'Delete  /  Backspace  /  Shift + 6' },
  { category: 'Actions', label: 'Drop All Open Branches', description: 'Abandon all unfinished curiosity branches in 1 click', keys: `${formatShortcut('Ctrl + Shift + D')}  /  ${formatShortcut('Alt + D')}` },
  { category: 'Capture', label: 'Capture Thought', description: 'Branch an exploratory thought without leaving focus', keys: `T  or  ${formatShortcut('Ctrl + T')}` },
  { category: 'Capture', label: 'Add Sequential Step', description: 'Extend current work forward along the stem', keys: `S  or  ${formatShortcut('Ctrl + S')}` },
  { category: 'Capture', label: 'Start New Main Work', description: 'Plant a new tree root and begin fresh session', keys: formatShortcut('Ctrl + N') },
  { category: 'Window', label: 'Dock to Screen Edge', description: 'Collapse into curved right-edge floating notch', keys: formatShortcut('Ctrl + M') },
  { category: 'Window', label: 'Attention History', description: 'Open timeline archive of previous trees', keys: formatShortcut('Ctrl + H') },
  { category: 'Window', label: 'Preferences', description: 'Adjust motion, time format, and data backup', keys: formatShortcut('Ctrl + ,') },
  { category: 'Window', label: 'Quit Application', description: 'Safely terminate background process and tray', keys: formatShortcut('Ctrl + Q') }
];

export const ShortcutGuideModal: React.FC<ShortcutGuideModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = getShortcuts();
  const filteredShortcuts = shortcuts.filter(
    (sc) =>
      sc.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.keys.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(20, 18, 16, 0.38)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 1400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '560px',
          height: '500px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'notionFadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Clean Notion / macOS Style Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            backgroundColor: '#FAFAF9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Command size={15} strokeWidth={2} style={{ color: '#1A1A1A' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A1A1A' }}>
              Keyboard Shortcuts & Controls
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '6px',
              color: '#9B9A97',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'color 120ms ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9B9A97')}
            aria-label="Close"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Search Input Bar (Matching Spotlight Search) */}
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Search size={15} color="#9B9A97" strokeWidth={2} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts or actions..."
              style={{
                flex: 1,
                fontSize: '13px',
                color: '#1A1A1A',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent'
              }}
            />
          </div>

          {/* Shortcuts List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            {filteredShortcuts.map((sc) => (
              <div
                key={sc.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  transition: 'background-color 100ms ease',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.035)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 550, color: '#1A1A1A' }}>
                    {sc.label}
                  </span>
                  <span style={{ fontSize: '11px', color: '#787774' }}>
                    {sc.description}
                  </span>
                </div>

                <kbd
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#2A2A2A',
                    whiteSpace: 'nowrap',
                    marginLeft: '14px'
                  }}
                >
                  {sc.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            backgroundColor: '#FAFAF9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#9B9A97',
            flexShrink: 0
          }}
        >
          <span>Press <kbd style={{ padding: '2px 5px', borderRadius: '4px', backgroundColor: 'rgba(0, 0, 0, 0.05)', border: '1px solid rgba(0, 0, 0, 0.08)', fontFamily: 'inherit' }}>esc</kbd> to dismiss</span>
          <span>Keyboard Shortcuts • Wander</span>
        </div>
      </div>
    </div>
  );
};
