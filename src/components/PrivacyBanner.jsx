import React, { useState } from 'react';

export default function PrivacyBanner({ onOpenPrivacyModal }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('privacy_dismissed_v2') === 'true');

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem('privacy_dismissed_v2', 'true');
    setDismissed(true);
  };

  return (
    <div className="privacy-banner">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }}>shield_lock</span>
          <span>Your Privacy Matters</span>
        </div>
        <button className="md-btn md-btn--icon" onClick={handleDismiss} style={{ width: '32px', height: '32px' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>close</span>
        </button>
      </div>
      <p className="body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        Chats auto-delete. No personal data collected. Automated safety filtering active.{' '}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onOpenPrivacyModal(); }}
          style={{ color: 'var(--md-sys-color-primary)', fontWeight: 600, textDecoration: 'none' }}
        >
          Read Policy
        </a>
      </p>
    </div>
  );
}
