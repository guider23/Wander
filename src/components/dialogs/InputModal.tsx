import React, { useState, useEffect, useRef } from 'react';

interface InputModalProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  isConfirmationOnly?: boolean;
  confirmationMessage?: string;
}

export const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  title,
  placeholder = '',
  defaultValue = '',
  submitLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onSubmit,
  onCancel,
  isConfirmationOnly = false,
  confirmationMessage
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmationOnly) {
      onSubmit('');
    } else if (value.trim()) {
      onSubmit(value.trim());
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
        backgroundColor: 'rgba(23, 23, 23, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          backgroundColor: 'var(--background)',
          border: '1.5px solid var(--ink)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
          width: '90%',
          maxWidth: '440px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <h2
          id="modal-title"
          style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            color: 'var(--ink)'
          }}
        >
          {title}
        </h2>

        {confirmationMessage && (
          <p style={{ fontSize: '0.95rem', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
            {confirmationMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isConfirmationOnly && (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '1rem',
                borderRadius: 'var(--radius)',
                border: '1.5px solid var(--ink)',
                backgroundColor: 'var(--background-input)',
                color: 'var(--ink)',
                outline: 'none'
              }}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--ink-border)',
                backgroundColor: 'transparent',
                color: 'var(--ink)',
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={!isConfirmationOnly && !value.trim()}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--ink)',
                color: 'var(--background)',
                fontSize: '0.9rem',
                fontWeight: 500,
                opacity: !isConfirmationOnly && !value.trim() ? 0.4 : 1
              }}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
