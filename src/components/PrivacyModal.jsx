import React from 'react';

const SECTIONS = [
  {
    title: '1. No personal data required',
    body: 'We do not collect email addresses, phone numbers, or passwords. Anonymous accounts are linked only to your local browser session.'
  },
  {
    title: '2. Cookies & local storage',
    body: 'We use LocalStorage strictly for maintaining your active session key. We do not place tracking cookies or share analytical profiles with third parties.'
  },
  {
    title: '3. Safety & content filtering',
    body: 'To ensure a safe environment, public room messages pass through automated content filters. Messages containing severe abuse or illegal content are subject to automatic removal or account restriction.'
  },
  {
    title: '4. Automatic self-destruction',
    body: 'When a chat room expires, all messages, read receipts, and room metadata are permanently wiped from server memory.'
  }
];

export default function PrivacyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="md-dialog-overlay" onClick={onClose} role="presentation">
      <div className="md-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }} role="dialog" aria-modal="true" aria-label="Privacy and trust terms">
        <h2 className="md-dialog__title">Privacy & trust terms</h2>
        <div className="body-medium text-muted" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p>Welcome to <strong>TempChats</strong>! We believe in ephemeral communication and giving you full control over your data.</p>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="title-small" style={{ color: 'var(--md-sys-color-on-surface)', marginBottom: '4px' }}>{section.title}</h4>
              <p>{section.body}</p>
            </div>
          ))}
        </div>

        <div className="md-dialog__actions">
          <button className="md-btn md-btn--filled" onClick={onClose}>I understand</button>
        </div>
      </div>
    </div>
  );
}
