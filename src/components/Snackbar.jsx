import React from 'react';

export default function Snackbar({ message, type = 'info', onClose }) {
  if (!message) return null;
  return (
    <div className={`snackbar ${type === 'error' ? 'snackbar--error' : ''}`}>
      <span className="material-symbols-rounded">
        {type === 'error' ? 'error' : 'info'}
      </span>
      <span>{message}</span>
      <button className="md-btn md-btn--icon" onClick={onClose} style={{ marginLeft: 'auto', width: '28px', height: '28px' }}>
        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>close</span>
      </button>
    </div>
  );
}
