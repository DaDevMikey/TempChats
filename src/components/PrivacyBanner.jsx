import React, { useState } from 'react';

export default function PrivacyBanner({ onOpenPrivacyModal }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('privacy_dismissed_v2') === 'true');

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem('privacy_dismissed_v2', 'true');
    setDismissed(true);
  };

  return (
    <div className="privacy-banner" role="region" aria-label="Privacy notice">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div className="title-small" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true">shield_lock</span>
          <span>Your privacy matters</span>
        </div>
        <button className="md-btn md-btn--icon" onClick={handleDismiss} aria-label="Dismiss privacy notice" style={{ width: '36px', height: '36px', minHeight: '36px' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>close</span>
        </button>
      </div>
      <p className="body-small text-muted">
        Chats auto-delete. No personal data collected. Automated safety filtering active.{' '}
        <button
          type="button"
          onClick={onOpenPrivacyModal}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--md-sys-color-primary)',
            fontWeight: 600,
            cursor: 'pointer',
            font: 'inherit'
          }}
        >
          Read policy
        </button>
      </p>
    </div>
  );
}
