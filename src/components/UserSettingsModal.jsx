import React from 'react';

const SETTINGS = [
  {
    key: 'soundEnabled',
    icon: 'notifications_active',
    title: 'Message chimes',
    description: 'Play a subtle chime when sending & receiving messages'
  },
  {
    key: 'compactMode',
    icon: 'density_small',
    title: 'Compact spacing',
    description: 'Reduce padding between chat bubbles'
  },
  {
    key: 'readReceiptsEnabled',
    icon: 'done_all',
    title: 'Share read receipts',
    description: 'Allow rooms to show when you have read messages'
  }
];

export default function UserSettingsModal({ isOpen, settings, onUpdateSettings, onClose, onOpenPrivacyModal, onOpenReleaseNotes, isBeta = false, onUpdateBeta }) {
  if (!isOpen) return null;

  return (
    <div className="md-dialog-overlay" onClick={onClose} role="presentation">
      <div className="md-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="User settings">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <h2 className="md-dialog__title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true">settings</span>
            Settings
          </h2>
          <button className="md-btn md-btn--icon" onClick={onClose} aria-label="Close settings">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SETTINGS.map((item) => (
            <div className="setting-row" key={item.key}>
              <div className="setting-row__text" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)', fontSize: '22px', marginTop: '2px' }} aria-hidden="true">
                  {item.icon}
                </span>
                <div>
                  <div className="title-small">{item.title}</div>
                  <div className="body-small text-muted">{item.description}</div>
                </div>
              </div>
              <label className="md-switch">
                <input
                  type="checkbox"
                  checked={Boolean(settings[item.key])}
                  onChange={(e) => onUpdateSettings({ ...settings, [item.key]: e.target.checked })}
                  aria-label={item.title}
                />
                <span className="md-switch__track">
                  <span className="md-switch__thumb"></span>
                </span>
              </label>
            </div>
          ))}

          {onUpdateBeta && (
            <div className="setting-row">
              <div className="setting-row__text" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)', fontSize: '22px', marginTop: '2px' }} aria-hidden="true">
                  science
                </span>
                <div>
                  <div className="title-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>Direct messages</span>
                    <span className="beta-badge">Beta</span>
                  </div>
                  <div className="body-small text-muted">
                    Try one-to-one chats that clear after 24 hours. This feature is still rolling out gradually, so turn it on here to
                    join early or turn it off to leave the beta.
                  </div>
                </div>
              </div>
              <label className="md-switch">
                <input
                  type="checkbox"
                  checked={isBeta}
                  onChange={(e) => onUpdateBeta(e.target.checked)}
                  aria-label="Direct messages beta"
                />
                <span className="md-switch__track">
                  <span className="md-switch__thumb"></span>
                </span>
              </label>
            </div>
          )}

          <button
            type="button"
            className="action-sheet__item"
            onClick={() => { onClose(); onOpenPrivacyModal(); }}
          >
            <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true">shield_lock</span>
            <span>Privacy terms & trust policy</span>
          </button>

          <button
            type="button"
            className="action-sheet__item"
            onClick={() => { onClose(); onOpenReleaseNotes?.(); }}
          >
            <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true">news</span>
            <span>What&rsquo;s new (release notes)</span>
          </button>
        </div>

        <div className="md-dialog__actions">
          <button className="md-btn md-btn--filled" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
