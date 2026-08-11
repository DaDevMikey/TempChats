import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';

const EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉'];
const LONG_PRESS_MS = 450;

function MessageBubble({ msg, isOwn, isContinuation, onReply, onEdit, onDelete, onReact, compactMode }) {
  const [vanishSeconds, setVanishSeconds] = useState(msg.vanishTimeSeconds || null);
  const [isRevealed, setIsRevealed] = useState(!msg.isBurnAfterReading);
  const [burnSeconds, setBurnSeconds] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const pressTimerRef = useRef(null);
  const pressOriginRef = useRef(null);

  const timeStr = msg.created_at?.toDate
    ? msg.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  // 1. Vanish Timer Fix (Does not restart on re-renders)
  useEffect(() => {
    if (!msg.vanishTimeSeconds || isOwn) return undefined;

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
    if (!msg.isBurnAfterReading || !isRevealed || isOwn) return undefined;

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

  // 3. Long press opens the action sheet — the hover toolbar is unreachable on touch
  const cancelLongPress = useCallback(() => {
    clearTimeout(pressTimerRef.current);
    pressOriginRef.current = null;
    setIsPressed(false);
  }, []);

  useEffect(() => () => clearTimeout(pressTimerRef.current), []);

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    pressOriginRef.current = { x: e.clientX, y: e.clientY };
    setIsPressed(true);
    pressTimerRef.current = setTimeout(() => {
      setIsPressed(false);
      setIsSheetOpen(true);
      if (navigator.vibrate) navigator.vibrate(12);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e) => {
    const origin = pressOriginRef.current;
    if (!origin) return;
    if (Math.abs(e.clientX - origin.x) > 10 || Math.abs(e.clientY - origin.y) > 10) cancelLongPress();
  };

  const handleContextMenu = (e) => {
    // Right click (desktop) and the native touch callout both land here
    e.preventDefault();
    setIsSheetOpen(true);
  };

  const runAction = (action) => {
    setIsSheetOpen(false);
    action();
  };

  const bubbleContent = msg.decryptedContent || msg.content;

  return (
    <div
      className={`message-item ${isOwn ? 'message-item--own' : 'message-item--other'} ${isContinuation ? 'message-item--continuation' : ''}`}
      style={{ marginBottom: compactMode ? '1px' : '4px' }}
    >
      <div className="message-bubble-wrapper">
        {/* Pointer-device floating toolbar */}
        <div className="message-actions-toolbar">
          <div className="message-actions-toolbar__emojis">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="md-btn md-btn--icon"
                onClick={() => onReact(msg.id, emoji)}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button type="button" className="md-btn md-btn--icon" onClick={() => onReply(msg)} title="Reply" aria-label="Reply">
            <span className="material-symbols-rounded">reply</span>
          </button>

          {isOwn && (
            <>
              <button type="button" className="md-btn md-btn--icon" onClick={() => onEdit(msg)} title="Edit message" aria-label="Edit message">
                <span className="material-symbols-rounded">edit</span>
              </button>
              <button type="button" className="md-btn md-btn--icon" onClick={() => onDelete(msg.id)} title="Delete message" aria-label="Delete message">
                <span className="material-symbols-rounded">delete</span>
              </button>
            </>
          )}
        </div>

        {/* Message bubble */}
        <div
          className={`message-bubble ${isPressed ? 'message-bubble--pressed' : ''}`}
          style={{ padding: compactMode ? '7px 12px' : '10px 14px' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onContextMenu={handleContextMenu}
        >
          {!isOwn && !isContinuation && <div className="message-sender">{msg.sender}</div>}

          {msg.reply_to && (
            <div className="message-reply-box">
              <div style={{ fontWeight: 600, fontSize: '0.72rem' }}>Replying to {msg.reply_to.sender}</div>
              <div className="truncate">{msg.decryptedReply || msg.reply_to.content}</div>
            </div>
          )}

          {/* Burn After Reading (One-Time View) or Normal Content */}
          {msg.isBurnAfterReading && !isRevealed && !isOwn ? (
            <button
              type="button"
              className="md-btn md-btn--tonal"
              onClick={() => setIsRevealed(true)}
              style={{ minHeight: '40px', fontSize: '0.8rem', padding: '0 14px' }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--md-sys-color-error)' }} aria-hidden="true">visibility_off</span>
              <span>Tap to reveal (destroys in 3s)</span>
            </button>
          ) : (
            <div className="body-large" style={{ whiteSpace: 'pre-wrap' }}>
              {bubbleContent}
              {msg.edited && <span className="message-edited-tag">(edited)</span>}
            </div>
          )}

          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div className="message-reactions">
              {Object.entries(msg.reactions).map(([emoji, count]) => (
                <span key={emoji} className="reaction-pill">
                  <span>{emoji}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </span>
              ))}
            </div>
          )}

          <div className="message-time">
            {burnSeconds !== null ? (
              <span style={{ color: 'var(--md-sys-color-error)', fontWeight: 600 }}>Destroying in {burnSeconds}s</span>
            ) : vanishSeconds !== null ? (
              <span style={{ color: 'var(--md-sys-color-error)', fontWeight: 600 }}>Vanishing in {vanishSeconds}s</span>
            ) : (
              <span />
            )}
            <span>{timeStr}</span>
          </div>
        </div>
      </div>

      {/* Touch action sheet — portalled to <body> because the message list uses
          paint containment, which would otherwise trap the fixed overlay. */}
      {isSheetOpen && createPortal(
        <div className="md-dialog-overlay" onClick={() => setIsSheetOpen(false)} role="presentation">
          <div className="md-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Message actions">
            <div className="action-sheet__emojis">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="action-sheet__emoji"
                  onClick={() => runAction(() => onReact(msg.id, emoji))}
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="action-sheet__list">
              <button type="button" className="action-sheet__item" onClick={() => runAction(() => onReply(msg))}>
                <span className="material-symbols-rounded" aria-hidden="true">reply</span>
                <span>Reply</span>
              </button>

              <button
                type="button"
                className="action-sheet__item"
                onClick={() => runAction(() => navigator.clipboard?.writeText(bubbleContent))}
              >
                <span className="material-symbols-rounded" aria-hidden="true">content_copy</span>
                <span>Copy text</span>
              </button>

              {isOwn && (
                <>
                  <button type="button" className="action-sheet__item" onClick={() => runAction(() => onEdit(msg))}>
                    <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="action-sheet__item action-sheet__item--danger"
                    onClick={() => runAction(() => onDelete(msg.id))}
                  >
                    <span className="material-symbols-rounded" aria-hidden="true">delete</span>
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>

            <button type="button" className="md-btn md-btn--tonal" onClick={() => setIsSheetOpen(false)} style={{ minHeight: '48px' }}>
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default memo(MessageBubble);
