import React from 'react';
import { useUiStore, ViewType } from '../../state/ui-store';

interface SidebarProps {
  activeTreeTitle?: string | null;
  activeStatus?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTreeTitle, activeStatus }) => {
  const { currentView, setCurrentView, isAccessibleListView, toggleAccessibleListView } = useUiStore();

  const navItems: { id: ViewType; label: string }[] = [
    { id: 'now', label: 'Now' },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' }
  ];

  return (
    <aside
      style={{
        width: '200px',
        height: '100%',
        backgroundColor: 'var(--background-card)',
        borderRight: '1px solid var(--ink-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 14px',
        flexShrink: 0
      }}
    >
      <div>
        <div style={{ marginBottom: '28px', paddingLeft: '8px' }}>
          <h1 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Wander
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
            Journal of attention
          </p>
        </div>

        <nav aria-label="Main Navigation">
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const isSelected = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setCurrentView(item.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius)',
                      backgroundColor: isSelected ? 'var(--background)' : 'transparent',
                      color: 'var(--ink)',
                      fontWeight: isSelected ? 600 : 400,
                      border: isSelected ? '1px solid var(--ink)' : '1px solid transparent',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    aria-current={isSelected ? 'page' : undefined}
                  >
                    <span>{item.label}</span>
                    {item.id === 'now' && activeStatus === 'ACTIVE' && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--ink)'
                        }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {currentView === 'now' && (
          <button
            onClick={toggleAccessibleListView}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--ink-border)',
              backgroundColor: isAccessibleListView ? 'var(--ink)' : 'transparent',
              color: isAccessibleListView ? 'var(--background)' : 'var(--ink)',
              fontSize: '0.75rem',
              textAlign: 'center'
            }}
            aria-pressed={isAccessibleListView}
          >
            {isAccessibleListView ? 'Show Visual Graph' : 'Show Accessible List'}
          </button>
        )}

        {activeTreeTitle && (
          <div
            style={{
              padding: '10px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'var(--background)',
              border: '1px solid var(--ink-border)',
              fontSize: '0.78rem'
            }}
          >
            <div style={{ color: 'var(--ink-muted)', marginBottom: '2px', fontSize: '0.7rem' }}>
              CURRENT FOCUS
            </div>
            <div style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeTreeTitle}
            </div>
            <div style={{ color: 'var(--ink-secondary)', marginTop: '2px' }}>
              {activeStatus}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
