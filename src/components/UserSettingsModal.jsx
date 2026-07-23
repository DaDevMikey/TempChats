import React from 'react';

export default function UserSettingsModal({ isOpen, settings, onUpdateSettings, onClose, onOpenPrivacyModal }) {
  if (!isOpen) return null;

  return (
    <div className="md-dialog-overlay" onClick={onClose}>
      <div className="md-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="md-dialog__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }}>settings</span>
            User Settings
          </h2>
          <button className="md-btn md-btn--icon" onClick={onClose} style={{ width: '32px', height: '32px' }}>
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
          {/* Sound Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="title-small">Message Chimes</div>
              <div className="body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Play a subtle chime when sending & receiving messages
              </div>
            </div>
            <label className="md-switch">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => onUpdateSettings({ ...settings, soundEnabled: e.target.checked })}
              />
              <span className="md-switch__track">
                <span className="md-switch__thumb"></span>
              </span>
            </label>
          </div>

          {/* Compact Mode Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="title-small">Compact Message Spacing</div>
              <div className="body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Reduce padding between chat bubbles
              </div>
            </div>
            <label className="md-switch">
              <input
                type="checkbox"
                checked={settings.compactMode}
                onChange={(e) => onUpdateSettings({ ...settings, compactMode: e.target.checked })}
              />
              <span className="md-switch__track">
                <span className="md-switch__thumb"></span>
              </span>
            </label>
          </div>

          {/* Read Receipts Preference */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="title-small">Share Read Receipts</div>
              <div className="body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Allow rooms to show when you have read messages
              </div>
            </div>
            <label className="md-switch">
              <input
                type="checkbox"
                checked={settings.readReceiptsEnabled}
                onChange={(e) => onUpdateSettings({ ...settings, readReceiptsEnabled: e.target.checked })}
              />
              <span className="md-switch__track">
                <span className="md-switch__thumb"></span>
              </span>
            </label>
          </div>

          <hr style={{ borderColor: 'var(--md-sys-color-outline-variant)', opacity: 0.4 }} />

          <button
            type="button"
            className="md-btn md-btn--tonal"
            onClick={() => { onClose(); onOpenPrivacyModal(); }}
            style={{ justifyContent: 'flex-start' }}
          >
            <span className="material-symbols-rounded">shield_lock</span>
            <span>View Privacy Terms & Trust Policy</span>
          </button>
        </div>

        <div className="md-dialog__actions" style={{ marginTop: '12px' }}>
          <button className="md-btn md-btn--filled" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
