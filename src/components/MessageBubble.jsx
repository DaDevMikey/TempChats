import React, { useState, useEffect, useRef } from 'react';

export default function MessageBubble({ msg, isOwn, isContinuation, onReply, onEdit, onDelete, onReact, compactMode }) {
  const [vanishSeconds, setVanishSeconds] = useState(msg.vanishTimeSeconds || null);
  const [isRevealed, setIsRevealed] = useState(!msg.isBurnAfterReading);
  const [burnSeconds, setBurnSeconds] = useState(null);

  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const timeStr = msg.created_at?.toDate
    ? msg.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  // 1. Vanish Timer Fix (Does not restart on re-renders)
  useEffect(() => {
    if (!msg.vanishTimeSeconds || isOwn) return;

    setVanishSeconds(msg.vanishTimeSeconds);
    const interval = setInterval(() => {
      setVanishSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onDeleteRef.current) onDeleteRef.current(msg.id, true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [msg.vanishTimeSeconds, msg.id, isOwn]);

  // 2. Burn After Reading (One-Time Reveal Timer)
  useEffect(() => {
    if (!msg.isBurnAfterReading || !isRevealed || isOwn) return;

    setBurnSeconds(3);
    const interval = setInterval(() => {
      setBurnSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onDeleteRef.current) onDeleteRef.current(msg.id, true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [msg.isBurnAfterReading, isRevealed, msg.id, isOwn]);

  const emojis = ['👍', '❤️', '🔥', '😂', '🎉'];

  return (
    <div
      className={`message-item ${isOwn ? 'message-item--own' : 'message-item--other'}`}
      style={{ marginBottom: compactMode ? '1px' : '4px' }}
    >
      <div className="message-bubble-wrapper">
        {/* Floating Action Toolbar */}
        <div className="message-actions-toolbar">
          <div style={{ display: 'flex', gap: '2px', borderRight: '1px solid var(--md-sys-color-outline-variant)', paddingRight: '4px', marginRight: '2px' }}>
            {emojis.map((emoji) => (
              <button
                key={emoji}
                className="md-btn md-btn--icon"
                onClick={() => onReact(msg.id, emoji)}
                style={{ width: '26px', height: '26px', fontSize: '14px' }}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button className="md-btn md-btn--icon" onClick={() => onReply(msg)} title="Reply" style={{ width: '28px', height: '28px' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>reply</span>
          </button>

          {isOwn && (
            <>
              <button className="md-btn md-btn--icon" onClick={() => onEdit(msg)} title="Edit Message" style={{ width: '28px', height: '28px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>edit</span>
              </button>
              <button className="md-btn md-btn--icon" onClick={() => onDelete(msg.id)} title="Delete Message" style={{ width: '28px', height: '28px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>delete</span>
              </button>
            </>
          )}
        </div>

        {/* Message Bubble */}
        <div className="message-bubble md-card" style={{ padding: compactMode ? '8px 14px' : '12px 18px' }}>
          {!isOwn && !isContinuation && (
            <div className="message-sender" style={{ color: 'var(--md-sys-color-primary)' }}>
              {msg.sender}
            </div>
          )}

          {msg.reply_to && (
            <div className="message-reply-box">
              <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--md-sys-color-primary)' }}>
                Replying to {msg.reply_to.sender}
              </div>
              <div className="truncate">{msg.reply_to.content}</div>
            </div>
          )}

          {/* Burn After Reading (One-Time View) or Normal Content */}
          {msg.isBurnAfterReading && !isRevealed && !isOwn ? (
            <button
              type="button"
              className="md-btn md-btn--tonal"
              onClick={() => setIsRevealed(true)}
              style={{ height: '32px', fontSize: '0.8rem', padding: '0 12px' }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '16px', color: 'var(--md-sys-color-error)' }}>visibility_off</span>
              <span>Tap to Reveal (Destroys in 3s)</span>
            </button>
          ) : (
            <div className="body-large" style={{ whiteSpace: 'pre-wrap' }}>
              {msg.decryptedContent || msg.content}
              {msg.edited && <span className="message-edited-tag">(edited)</span>}
            </div>
          )}

          {/* Reactions */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
              {Object.entries(msg.reactions).map(([emoji, count]) => (
                <span
                  key={emoji}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '2px 6px',
                    fontSize: '0.75rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span>{emoji}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Status & Time */}
          <div className="message-time" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            {burnSeconds !== null ? (
              <span style={{ color: 'var(--md-sys-color-error)', fontWeight: 600, fontSize: '0.7rem' }}>
                Destroying in {burnSeconds}s
              </span>
            ) : vanishSeconds !== null ? (
              <span style={{ color: 'var(--md-sys-color-error)', fontWeight: 600, fontSize: '0.7rem' }}>
                Vanishing in {vanishSeconds}s
              </span>
            ) : <span />}
            <span>{timeStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
