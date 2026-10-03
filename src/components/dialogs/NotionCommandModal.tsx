import React, { useState, useEffect, useRef } from 'react';
import { CornerDownRight, Lightbulb, Compass, CornerDownLeft, Sparkles } from 'lucide-react';
import { autocorrectSentence, autocorrectOnDelimiter } from '../../domain/autocorrect/engine';

export type NotionInputKind = 'work' | 'thought' | 'step';

interface NotionCommandModalProps {
  isOpen: boolean;
  kind: NotionInputKind;
  contextNodeTitle?: string | null;
  onSubmit: (title: string, kind: NotionInputKind) => void;
  onCancel: () => void;
}

export const NotionCommandModal: React.FC<NotionCommandModalProps> = ({
  isOpen,
  kind: initialKind,
  contextNodeTitle,
  onSubmit,
  onCancel
}) => {
  const [kind, setKind] = useState<NotionInputKind>(initialKind);
  const [value, setValue] = useState('');
  const [lastCorrection, setLastCorrection] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setKind(initialKind);
      setValue('');
      setLastCorrection(null);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen, initialKind]);

  const MODES: NotionInputKind[] = ['work', 'step', 'thought'];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      // ArrowUp / ArrowDown or Tab switches between work, step, thought
      if (e.key === 'ArrowUp' || (e.shiftKey && e.key === 'Tab')) {
        e.preventDefault();
        setKind((prev) => {
          const idx = MODES.indexOf(prev);
          return MODES[(idx - 1 + MODES.length) % MODES.length];
        });
      } else if (e.key === 'ArrowDown' || (!e.shiftKey && e.key === 'Tab')) {
        e.preventDefault();
        setKind((prev) => {
          const idx = MODES.indexOf(prev);
          return MODES[(idx + 1) % MODES.length];
        });
      } else if ((e.key === 'ArrowLeft' && value === '') || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        setKind((prev) => {
          const idx = MODES.indexOf(prev);
          return MODES[(idx - 1 + MODES.length) % MODES.length];
        });
      } else if ((e.key === 'ArrowRight' && value === '') || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        setKind((prev) => {
          const idx = MODES.indexOf(prev);
          return MODES[(idx + 1) % MODES.length];
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, value]);

  if (!isOpen) return null;

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Real-time word autocorrect on Space, comma, or period
    if (e.key === ' ' || e.key === ',' || e.key === '.') {
      const input = inputRef.current;
      if (!input) return;
      const cursorPos = input.selectionStart ?? value.length;
      const { newText, newCursor, corrected } = autocorrectOnDelimiter(value, cursorPos, e.key);
      if (corrected) {
        e.preventDefault();
        setValue(newText);
        const before = value.slice(0, cursorPos).match(/([a-zA-Z0-9#+.-]+)$/)?.[1] || '';
        const after = newText.slice(0, newCursor - 1).split(/\s+/).pop() || '';
        if (before && after && before.toLowerCase() === after.toLowerCase()) {
          setLastCorrection(`${after}`);
        } else if (before && after) {
          setLastCorrection(`${before} → ${after}`);
        }
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = newCursor;
            inputRef.current.selectionEnd = newCursor;
          }
        }, 0);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      const { text: finalizedText } = autocorrectSentence(value.trim());
      onSubmit(finalizedText, kind);
      setValue('');
      setLastCorrection(null);
    }
  };

  const getPlaceholder = () => {
    if (kind === 'work') return 'What intentional work are you starting?';
    if (kind === 'step') return contextNodeTitle ? `Next step after "${contextNodeTitle}"...` : 'Next sequential step...';
    return 'What thought or curiosity caught your attention?';
  };

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
        zIndex: 1200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '16vh'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '90%',
          maxWidth: '560px',
          backgroundColor: 'var(--background-card)',
          borderRadius: '16px',
          border: '1px solid var(--ink-border)',
          boxShadow: 'var(--shadow-notion)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          overflow: 'hidden',
          animation: 'notionFadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Tag Pills: Clean Segmented Control */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--ink-border)',
            backgroundColor: 'var(--background-input)'
          }}
        >
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--dock-hover)',
              padding: '2px',
              borderRadius: '9px',
              gap: '2px',
              border: '1px solid var(--ink-border)'
            }}
          >
            <button
              type="button"
              onClick={() => setKind('step')}
              style={{
                fontSize: '12px',
                fontWeight: kind === 'step' ? 600 : 450,
                padding: '4px 10px',
                borderRadius: '7px',
                backgroundColor: kind === 'step' ? 'var(--background-card)' : 'transparent',
                color: kind === 'step' ? 'var(--ink)' : 'var(--ink-secondary)',
                boxShadow: kind === 'step' ? '0 1px 3px rgba(0, 0, 0, 0.2)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                transition: 'all 120ms ease'
              }}
            >
              <CornerDownRight size={13} strokeWidth={2} />
              <span>Step</span>
            </button>
            <button
              type="button"
              onClick={() => setKind('thought')}
              style={{
                fontSize: '12px',
                fontWeight: kind === 'thought' ? 600 : 450,
                padding: '4px 10px',
                borderRadius: '7px',
                backgroundColor: kind === 'thought' ? 'var(--background-card)' : 'transparent',
                color: kind === 'thought' ? 'var(--ink)' : 'var(--ink-secondary)',
                boxShadow: kind === 'thought' ? '0 1px 3px rgba(0, 0, 0, 0.2)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                transition: 'all 120ms ease'
              }}
            >
              <Lightbulb size={13} strokeWidth={2} />
              <span>Thought</span>
            </button>
            <button
              type="button"
              onClick={() => setKind('work')}
              style={{
                fontSize: '12px',
                fontWeight: kind === 'work' ? 600 : 450,
                padding: '4px 10px',
                borderRadius: '7px',
                backgroundColor: kind === 'work' ? 'var(--background-card)' : 'transparent',
                color: kind === 'work' ? 'var(--ink)' : 'var(--ink-secondary)',
                boxShadow: kind === 'work' ? '0 1px 3px rgba(0, 0, 0, 0.2)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                transition: 'all 120ms ease'
              }}
            >
              <Compass size={13} strokeWidth={2} />
              <span>New Work</span>
            </button>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
            {contextNodeTitle ? `Under: ${contextNodeTitle.slice(0, 24)}` : 'Attention Journal'}
          </span>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ padding: '18px 20px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={getPlaceholder()}
              style={{
                width: '100%',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--ink)',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '4px 0',
                letterSpacing: '-0.01em',
                lineHeight: 1.4
              }}
            />
          </div>

          {/* Bottom Action Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid var(--ink-border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--ink-muted)' }}>
              <span>Press <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--dock-hover)', border: '1px solid var(--ink-border)', color: 'var(--ink)', fontFamily: 'inherit' }}>Enter</kbd> to save</span>
              <span>•</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--ink-secondary)' }}>
                <Sparkles size={11} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                <span>Auto-correct</span>
                {lastCorrection && (
                  <span
                    style={{
                      marginLeft: '3px',
                      color: 'var(--accent)',
                      fontWeight: 600,
                      backgroundColor: 'var(--dock-hover)',
                      border: '1px solid var(--ink-border)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      animation: 'notionFadeIn 120ms ease'
                    }}
                  >
                    {lastCorrection}
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!value.trim()}
              style={{
                padding: '5px 14px',
                borderRadius: '7px',
                backgroundColor: 'var(--accent)',
                color: 'var(--background-canvas)',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: value.trim() ? 'pointer' : 'default',
                opacity: value.trim() ? 1 : 0.35,
                transition: 'opacity 140ms ease'
              }}
            >
              <span>Record</span>
              <CornerDownLeft size={12} strokeWidth={2} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
