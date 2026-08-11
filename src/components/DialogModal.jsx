import React, { useState, useEffect } from 'react';

export default function DialogModal({
  isOpen,
  title,
  content,
  showInput = false,
  inputPlaceholder = '',
  initialValue = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}) {
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setVal(initialValue);
  }, [isOpen, initialValue]);

  // Close on Escape and lock background scrolling while open
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onCancel?.(); };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(showInput ? val : true);
  };

  return (
    <div className="md-dialog-overlay" onClick={onCancel} role="presentation">
      <div className="md-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="md-dialog__title">{title}</h2>
        {typeof content === 'string' ? <p className="body-large text-muted">{content}</p> : content}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {showInput && (
            <div className="md-text-field">
              <input
                type="text"
                className="md-text-field__input"
                placeholder=" "
                value={val}
                onChange={(e) => setVal(e.target.value)}
                autoFocus
                autoComplete="off"
                required
              />
              <label className="md-text-field__label">{inputPlaceholder}</label>
            </div>
          )}

          <div className="md-dialog__actions">
            {cancelText && (
              <button type="button" className="md-btn md-btn--tonal" onClick={onCancel}>
                {cancelText}
              </button>
            )}
            <button type="submit" className="md-btn md-btn--filled">
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
