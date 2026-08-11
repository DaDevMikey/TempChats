import React, { useEffect } from 'react';
import { RELEASE_NOTES } from '../releaseNotes';

export default function ReleaseNotesModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="md-dialog-overlay" onClick={onClose} role="presentation">
      <div className="md-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Release notes">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <h2 className="md-dialog__title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true">news</span>
            What&rsquo;s new
          </h2>
          <button className="md-btn md-btn--icon" onClick={onClose} aria-label="Close release notes">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className="release-notes">
          {RELEASE_NOTES.map((release) => (
            <section key={release.version} className="release-notes__release">
              <div className="release-notes__version">
                <span className="title-medium">Version {release.version}</span>
                <span className="body-small text-muted">{release.date}</span>
              </div>

              {release.highlights.map((item) => (
                <div key={item.title} className="release-notes__item">
                  <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true">
                    {item.icon}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="title-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{item.title}</span>
                      {item.badge && <span className="beta-badge">{item.badge}</span>}
                    </div>
                    <p className="body-small text-muted" style={{ marginTop: '2px' }}>{item.description}</p>
                    {item.badge && (
                      <p className="body-small release-notes__warning">
                        This feature is rolling out gradually to beta testers and randomly selected users for testing, so it may not be
                        available on your account yet.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>

        <div className="md-dialog__actions">
          <button className="md-btn md-btn--filled" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
