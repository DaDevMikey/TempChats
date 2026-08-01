import React from 'react';

export default function Snackbar({ message, type = 'info', onClose }) {
  if (!message) return null;
  return (
    <div className={`snackbar ${type === 'error' ? 'snackbar--error' : ''}`} role="status" aria-live="polite">
      <span className="material-symbols-rounded" aria-hidden="true">
        {type === 'error' ? 'error' : 'info'}
      </span>
      <span className="snackbar__text">{message}</span>
      <button className="md-btn md-btn--icon" onClick={onClose} aria-label="Dismiss notification" style={{ width: '36px', height: '36px', minHeight: '36px', color: 'inherit' }}>
        <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>close</span>
      </button>
    </div>
  );
}
