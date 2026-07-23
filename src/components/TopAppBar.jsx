import React from 'react';

export default function TopAppBar({ user, onLogout, onBack, title = 'TempChats', extraActions, onOpenSettings }) {
  return (
    <header className="top-app-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {onBack && (
          <button className="md-btn md-btn--icon" onClick={onBack} title="Back">
            <span className="material-symbols-rounded">arrow_back</span>
          </button>
        )}
        <div className="top-app-bar__title">
          {!onBack && <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }}>chat_bubble</span>}
          <span>{title}</span>
        </div>
      </div>

      <div className="top-app-bar__actions">
        {extraActions}
        {user && (
          <>
            {onOpenSettings && (
              <button className="md-btn md-btn--icon" onClick={onOpenSettings} title="Settings">
                <span className="material-symbols-rounded">settings</span>
              </button>
            )}
            <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
            <span className="body-medium" style={{ fontWeight: 500 }}>{user.username}</span>
            <button className="md-btn md-btn--icon" onClick={onLogout} title="Logout & Wipe Account">
              <span className="material-symbols-rounded">logout</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
