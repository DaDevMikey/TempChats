import React from 'react';

export default function PrivacyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="md-dialog-overlay" onClick={onClose}>
      <div className="md-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <h2 className="md-dialog__title">Privacy & Trust Terms</h2>
        <div className="body-medium" style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
          <p>Welcome to <strong>TempChats</strong>! We believe in ephemeral communication and giving you full control over your data.</p>
          
          <h4 style={{ color: 'var(--md-sys-color-on-surface)', marginTop: '8px' }}>1. No Personal Data Required</h4>
          <p>We do not collect email addresses, phone numbers, or passwords. Anonymous accounts are linked only to your local browser session.</p>

          <h4 style={{ color: 'var(--md-sys-color-on-surface)', marginTop: '8px' }}>2. Cookies & Local Storage</h4>
          <p>We use LocalStorage strictly for maintaining your active session key. We do not place tracking cookies or share analytical profiles with third parties.</p>

          <h4 style={{ color: 'var(--md-sys-color-on-surface)', marginTop: '8px' }}>3. Safety & Content Filtering</h4>
          <p>To ensure a safe environment, public room messages pass through automated content filters. Messages containing severe abuse or illegal content are subject to automatic removal or account restriction.</p>

          <h4 style={{ color: 'var(--md-sys-color-on-surface)', marginTop: '8px' }}>4. Automatic Self-Destruction</h4>
          <p>When a chat room expires, all messages, read receipts, and room metadata are permanently wiped from server memory.</p>
        </div>

        <div className="md-dialog__actions" style={{ marginTop: '12px' }}>
          <button className="md-btn md-btn--filled" onClick={onClose}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
