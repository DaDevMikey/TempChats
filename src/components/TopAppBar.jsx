import React from 'react';

export default function TopAppBar({ user, onLogout, onBack, title = 'TempChats', extraActions, onOpenSettings }) {
  return (
    <header className="top-app-bar top-app-bar--bordered">
      <div className="top-app-bar__leading">
        {onBack && (
          <button className="md-btn md-btn--icon" onClick={onBack} title="Back" aria-label="Back">
            <span className="material-symbols-rounded">arrow_back</span>
          </button>
        )}
        <div className="top-app-bar__title">
          {!onBack && (
            <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true">
              chat_bubble
            </span>
          )}
          <span className="truncate">{title}</span>
        </div>
      </div>

      <div className="top-app-bar__actions">
        {extraActions}
        {user && (
          <>
            {onOpenSettings && (
              <button className="md-btn md-btn--icon" onClick={onOpenSettings} title="Settings" aria-label="Settings">
                <span className="material-symbols-rounded">settings</span>
              </button>
            )}
            <div className="user-avatar" title={user.username} aria-hidden="true">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="top-app-bar__username truncate">{user.username}</span>
            <button className="md-btn md-btn--icon" onClick={onLogout} title="Logout & wipe account" aria-label="Logout and wipe account">
              <span className="material-symbols-rounded">logout</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
