import React, { useState } from 'react';
import { Plus, History, BookOpen, SlidersHorizontal, HelpCircle } from 'lucide-react';
import { WanderLogo } from '../icons/WanderLogo';
import { formatShortcut } from '../../utils/platform';

interface MacDockProps {
  activeTitle?: string | null;
  onNewWork: () => void;
  onOpenHistory: () => void;
  onOpenMentalModel: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  hasUpdate?: boolean;
  isContinuumMode?: boolean;
}

interface DockItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  active?: boolean;
  isNonClickable?: boolean;
}

export const MacDock: React.FC<MacDockProps> = ({
  activeTitle,
  onNewWork,
  onOpenHistory,
  onOpenMentalModel,
  onOpenSettings,
  onOpenGuide,
  hasUpdate,
  isContinuumMode = false
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const items: DockItem[] = [
    {
      id: 'active-status',
      label: activeTitle ? `Active: ${activeTitle}` : 'Wander (Active Session)',
      icon: <WanderLogo size={20} color={isContinuumMode ? '#FFFFFF' : '#181818'} />,
      action: () => {},
      active: !!activeTitle,
      isNonClickable: true
    },
    {
      id: 'new',
      label: `New Main Work (${formatShortcut('Ctrl+N')})`,
      icon: <Plus size={17} strokeWidth={2} />,
      action: onNewWork
    },
    {
      id: 'history',
      label: `Attention History (${formatShortcut('Ctrl+H')})`,
      icon: <History size={17} strokeWidth={1.75} />,
      action: onOpenHistory
    },
    {
      id: 'model',
      label: 'Mental Model & Botanical Guide',
      icon: <BookOpen size={17} strokeWidth={1.75} />,
      action: onOpenMentalModel
    },
    {
      id: 'settings',
      label: `Preferences (${formatShortcut('Ctrl+,')})`,
      icon: <SlidersHorizontal size={17} strokeWidth={1.75} />,
      action: onOpenSettings
    },
    {
      id: 'guide',
      label: `Shortcuts Guide (${formatShortcut('Ctrl+Shift+/')})`,
      icon: <HelpCircle size={17} strokeWidth={1.75} />,
      action: onOpenGuide
    }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: 'var(--background-glass)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--dock-border)',
        borderRadius: '24px',
        boxShadow: 'var(--shadow-dock)',
        transition: 'var(--theme-transition)'
      }}
      role="toolbar"
      aria-label="Application dock"
    >
      {items.map((item) => {
        const isHovered = hoveredId === item.id;

        return (
          <React.Fragment key={item.id}>
            <div style={{ position: 'relative' }}>
              {/* Tooltip Pill */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '48px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    color: '#F8FAFC',
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    letterSpacing: '0.01em',
                    animation: 'notionFadeIn 120ms ease-out'
                  }}
                >
                  {item.label}
                </div>
              )}

              {/* Dock Icon Button */}
              <button
                onClick={item.isNonClickable ? undefined : item.action}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: !item.isNonClickable && isHovered ? 'var(--dock-hover)' : 'transparent',
                  color: 'var(--ink)',
                  border: 'none',
                  outline: 'none',
                  cursor: item.isNonClickable ? 'default' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: item.isNonClickable
                    ? 'none'
                    : `scale(${isHovered ? 1.2 : 1}) translateY(${isHovered ? -3 : 0}px)`,
                  transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 140ms ease, color 1400ms ease',
                  position: 'relative'
                }}
                aria-label={item.label}
              >
                {item.icon}

                {/* Running indicator dot */}
                {item.active && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      width: '3px',
                      height: '3px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      boxShadow: '0 0 4px var(--accent)'
                    }}
                  />
                )}

                {/* Available update notification badge */}
                {item.id === 'settings' && hasUpdate && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#C49B71',
                      boxShadow: '0 0 5px rgba(196, 155, 113, 0.7)'
                    }}
                    title="App update available"
                  />
                )}
              </button>
            </div>

            {/* Subtle peach separator line differentiating the brand icon from active working menu */}
            {item.isNonClickable && (
              <div
                style={{
                  width: '1px',
                  height: '18px',
                  backgroundColor: 'rgba(180, 140, 115, 0.45)',
                  margin: '0 4px',
                  borderRadius: '1px',
                  alignSelf: 'center'
                }}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
