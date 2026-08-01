import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db, firebase } from '../firebase';
import TopAppBar from '../components/TopAppBar';
import MessageBubble from '../components/MessageBubble';
import DialogModal from '../components/DialogModal';
import { encryptText, decryptText } from '../utils/crypto';
import { playChime } from '../utils/audio';
import { getQRCodeUrl } from '../utils/qr';

// Only the most recent slice of a room is rendered — older messages expire anyway
// and unbounded listeners are the main source of jank on low-end phones.
const MESSAGE_WINDOW = 200;
const READ_RECEIPT_THROTTLE_MS = 5000;

function moderateContent(text, level = 'minimal') {
  if (!text || level === 'none') return text;
  const minimalPatterns = [/nigger/gi, /faggot/gi, /kike/gi, /chink/gi, /spic/gi];
  const advancedPatterns = [
    ...minimalPatterns,
    /fuck/gi, /shit/gi, /bitch/gi, /asshole/gi, /dick/gi, /pussy/gi, /cunt/gi
  ];
  const patterns = level === 'advanced' ? advancedPatterns : minimalPatterns;
  let result = text;
  patterns.forEach((pattern) => {
    result = result.replace(pattern, (match) => '*'.repeat(match.length));
  });
  return result;
}

const themePalettes = {
  indigo: { primary: '#a5b0ff', container: '#3b37a8' },
  emerald: { primary: '#5eead4', container: '#065f46' },
  violet: { primary: '#d7b4ff', container: '#581c87' },
  amber: { primary: '#fcd34d', container: '#78350f' },
  rose: { primary: '#fda4af', container: '#881337' }
};

const DEFAULT_PRIMARY = '#a5b0ff';
const DEFAULT_PRIMARY_CONTAINER = '#3b37a8';

export default function ChatRoomView({ roomId, user, onNavigate, onLogout, showSnackbar, onOpenSettings, settings }) {
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [vanishTimer, setVanishTimer] = useState(null); // null, 10, or 30
  const [isBurnAfterReading, setIsBurnAfterReading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [presenceUsers, setPresenceUsers] = useState([]);
  const [readers, setReaders] = useState([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [chatVelocity, setChatVelocity] = useState('Calm');
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  // Modals
  const [editingMsg, setEditingMsg] = useState(null);
  const [deletingMsgId, setDeletingMsgId] = useState(null);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Refs keep the Firestore listener stable — depending on state such as
  // `messages.length` used to tear down and re-create the subscription on
  // *every single message*, which re-downloaded the whole room each time.
  const soundEnabledRef = useRef(settings.soundEnabled);
  soundEnabledRef.current = settings.soundEnabled;
  const usernameRef = useRef(user.username);
  usernameRef.current = user.username;
  const lastMessageIdRef = useRef(null);
  const decryptCacheRef = useRef(new Map());
  const isAtBottomRef = useRef(true);
  const lastReceiptRef = useRef(0);

  // 1. Listen to Room Document & Apply Theme
  useEffect(() => {
    if (!roomId) return undefined;

    const unsub = db.collection('rooms').doc(roomId).onSnapshot(
      (doc) => {
        if (!doc.exists) {
          showSnackbar('Room has been deleted or expired', 'error');
          onNavigate('home');
          return;
        }
        const roomData = { id: doc.id, ...doc.data() };
        setRoom(roomData);

        // Apply theme variables dynamically
        const pal = themePalettes[roomData.theme];
        if (pal) {
          document.documentElement.style.setProperty('--md-sys-color-primary', pal.primary);
          document.documentElement.style.setProperty('--md-sys-color-primary-container', pal.container);
        }
      },
      (err) => console.error('Room error:', err)
    );

    return () => {
      unsub();
      document.documentElement.style.setProperty('--md-sys-color-primary', DEFAULT_PRIMARY);
      document.documentElement.style.setProperty('--md-sys-color-primary-container', DEFAULT_PRIMARY_CONTAINER);
    };
  }, [roomId, onNavigate, showSnackbar]);

  // 2. Presence Pinger
  useEffect(() => {
    if (!roomId || !user) return undefined;

    const presenceRef = db.collection('rooms').doc(roomId).collection('presence').doc(user.username);
    const pingPresence = () => {
      if (document.hidden) return;
      presenceRef.set({ last_seen: Date.now() }).catch(() => {});
    };

    pingPresence();
    const interval = setInterval(pingPresence, 15000);
    document.addEventListener('visibilitychange', pingPresence);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', pingPresence);
      presenceRef.delete().catch(() => {});
    };
  }, [roomId, user]);

  // 3. Listen to Active Presence Users
  useEffect(() => {
    if (!roomId) return undefined;

    const unsub = db.collection('rooms').doc(roomId).collection('presence').onSnapshot((snapshot) => {
      const now = Date.now();
      const active = snapshot.docs
        .filter((d) => {
          const data = d.data();
          return data.last_seen && now - data.last_seen < 45000;
        })
        .map((d) => d.id);
      setPresenceUsers(active);
    });

    return () => unsub();
  }, [roomId]);

  // 4. Countdown Timer
  useEffect(() => {
    if (!room?.expires_at) return undefined;

    const updateTimer = () => {
      const target = room.expires_at.toDate ? room.expires_at.toDate() : new Date(room.expires_at);
      const diffMs = target.getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft('Expired');
        showSnackbar('Room expired', 'error');
        onNavigate('home');
        return;
      }
      const mins = Math.floor(diffMs / 60000);
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      setTimeLeft(hours > 0 ? `${hours}h ${remMins}m left` : `${remMins}m left`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000);
    return () => clearInterval(interval);
  }, [room?.expires_at, onNavigate, showSnackbar]);

  // 5. Listen & Decrypt Messages & Velocity Calculation
  const isPrivateRoom = Boolean(room?.isPrivate);
  const roomCode = room?.code;

  useEffect(() => {
    if (!roomId) return undefined;

    let cancelled = false;

    const unsub = db.collection('messages')
      .where('room_id', '==', roomId)
      .orderBy('created_at', 'asc')
      .limitToLast(MESSAGE_WINDOW)
      .onSnapshot(
        async (snapshot) => {
          const rawList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          // Chat velocity (messages in the last 2 minutes)
          const now = Date.now();
          const recentCount = rawList.filter((m) => {
            const time = m.created_at?.toDate ? m.created_at.toDate().getTime() : now;
            return now - time < 120000;
          }).length;

          if (recentCount >= 8) setChatVelocity('High velocity');
          else if (recentCount >= 3) setChatVelocity('Active');
          else setChatVelocity('Calm');

          let processed = rawList;

          if (isPrivateRoom && roomCode) {
            // Decrypting is expensive (PBKDF2 per message); cache by content so
            // an incoming message never re-decrypts the whole backlog.
            const cache = decryptCacheRef.current;
            processed = await Promise.all(
              rawList.map(async (msg) => {
                const key = `${msg.id}:${msg.content}`;
                if (!cache.has(key)) cache.set(key, await decryptText(msg.content, roomCode));
                return { ...msg, decryptedContent: cache.get(key) };
              })
            );

            if (cache.size > MESSAGE_WINDOW * 2) {
              const live = new Set(rawList.map((m) => `${m.id}:${m.content}`));
              cache.forEach((_, key) => { if (!live.has(key)) cache.delete(key); });
            }
          }

          if (cancelled) return;

          const latest = rawList[rawList.length - 1];
          const isNewIncoming =
            latest &&
            latest.id !== lastMessageIdRef.current &&
            lastMessageIdRef.current !== null &&
            latest.sender !== usernameRef.current;

          lastMessageIdRef.current = latest ? latest.id : null;
          setMessages(processed);

          if (isNewIncoming && soundEnabledRef.current) playChime('receive');
        },
        (err) => console.error('Messages snapshot error:', err)
      );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [roomId, isPrivateRoom, roomCode]);

  // Reset per-room caches when navigating between rooms
  useEffect(() => {
    decryptCacheRef.current.clear();
    lastMessageIdRef.current = null;
    isAtBottomRef.current = true;
    setShowJumpToLatest(false);
  }, [roomId]);

  const markRead = useCallback((force = false) => {
    if (!room?.readReceipts || !roomId || !user?.username) return;
    const now = Date.now();
    if (!force && now - lastReceiptRef.current < READ_RECEIPT_THROTTLE_MS) return;
    lastReceiptRef.current = now;
    db.collection('rooms').doc(roomId).collection('read_receipts').doc(user.username)
      .set({ timestamp: now })
      .catch(() => {});
  }, [room?.readReceipts, roomId, user?.username]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    isAtBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  // 6. Auto scroll only when the user is already following the conversation
  useEffect(() => {
    if (messages.length === 0) return;
    if (isAtBottomRef.current) {
      scrollToBottom(false);
      markRead();
    } else {
      setShowJumpToLatest(true);
    }
  }, [messages.length, scrollToBottom, markRead]);

  // 7. Listen to Typing
  useEffect(() => {
    if (!roomId) return undefined;

    const unsub = db.collection('rooms').doc(roomId).collection('typing').onSnapshot((snapshot) => {
      const typers = [];
      snapshot.docs.forEach((doc) => {
        if (doc.id === user.username) return;
        const data = doc.data();
        if (!data.updated_at) return;
        const time = data.updated_at.toDate ? data.updated_at.toDate().getTime() : new Date(data.updated_at).getTime();
        if (Date.now() - time < 5000) typers.push(doc.id);
      });
      setTypingUsers(typers);
    });

    return () => unsub();
  }, [roomId, user.username]);

  // 8. Listen to Read Receipts
  useEffect(() => {
    if (!roomId || !room?.readReceipts) return undefined;

    const unsub = db.collection('rooms').doc(roomId).collection('read_receipts').onSnapshot((snapshot) => {
      setReaders(snapshot.docs.filter((doc) => doc.id !== user.username).map((doc) => doc.id));
    });

    return () => unsub();
  }, [roomId, room?.readReceipts, user.username]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + 60;
    isAtBottomRef.current = atBottom;
    setShowJumpToLatest((prev) => (prev === !atBottom ? prev : !atBottom));
    if (atBottom) markRead();
  }, [markRead]);

  // 9. Input Typing Handler (Debounced)
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);

    const el = e.target;
    if (el.tagName === 'TEXTAREA') {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }

    if (val.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        db.collection('rooms').doc(roomId).collection('typing').doc(user.username).set({
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        db.collection('rooms').doc(roomId).collection('typing').doc(user.username).delete().catch(() => {});
      }, 3000);
    }
  };

  useEffect(() => () => clearTimeout(typingTimeoutRef.current), []);

  // 10. Send Message Handler
  const handleSend = async (e) => {
    e.preventDefault();
    const cleanContent = inputVal.trim();
    if (!cleanContent || !room) return;

    setInputVal('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    isTypingRef.current = false;
    clearTimeout(typingTimeoutRef.current);
    db.collection('rooms').doc(roomId).collection('typing').doc(user.username).delete().catch(() => {});

    const moderated = moderateContent(cleanContent, room.moderationLevel);
    const finalContent = room.isPrivate && room.code
      ? await encryptText(moderated, room.code)
      : moderated;

    const messageData = {
      room_id: roomId,
      sender: user.username,
      content: finalContent,
      authUid: user.authUid,
      expires_at: room.expires_at,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (vanishTimer) messageData.vanishTimeSeconds = vanishTimer;
    if (isBurnAfterReading) messageData.isBurnAfterReading = true;

    if (replyTo) {
      messageData.reply_to = {
        id: replyTo.id,
        sender: replyTo.sender,
        content: replyTo.decryptedContent || replyTo.content
      };
      setReplyTo(null);
    }

    isAtBottomRef.current = true;

    try {
      await db.collection('messages').add(messageData);
      if (settings.soundEnabled) playChime('send');

      db.collection('rooms').doc(roomId).update({
        latestMessage: room.isPrivate ? '🔒 [Encrypted message]' : moderated,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    } catch (err) {
      console.error('Send error:', err);
      showSnackbar('Failed to send message', 'error');
      setInputVal(cleanContent);
    }
  };

  const handleInputKeyDown = (e) => {
    // Enter sends on pointer devices; phones keep Enter as newline so the
    // on-screen keyboard's send button stays predictable.
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      handleSend(e);
    }
  };

  // 11. Reaction Handler
  const handleReact = useCallback(async (msgId, emoji) => {
    try {
      await db.collection('messages').doc(msgId).update({
        [`reactions.${emoji}`]: firebase.firestore.FieldValue.increment(1)
      });
    } catch (err) {
      console.error('Reaction error:', err);
    }
  }, []);

  // 13. Delete Message Handler
  const handleConfirmDelete = useCallback(async (msgId, silent = false) => {
    const targetId = typeof msgId === 'string' ? msgId : deletingMsgId;
    if (!targetId) return;
    try {
      await db.collection('messages').doc(targetId).delete();
    } catch (err) {
      if (!silent) {
        console.error('Delete error:', err);
        showSnackbar('Failed to delete message', 'error');
      }
    } finally {
      setDeletingMsgId(null);
    }
  }, [deletingMsgId, showSnackbar]);

  const handleMessageDelete = useCallback((msgId, silent) => {
    if (silent) {
      handleConfirmDelete(msgId, true);
      return;
    }
    setDeletingMsgId(msgId);
  }, [handleConfirmDelete]);

  // 12. Edit Message Handler
  const handleConfirmEdit = async (newContent) => {
    if (!editingMsg || !newContent || !newContent.trim()) {
      setEditingMsg(null);
      return;
    }
    const clean = newContent.trim();
    if (clean === (editingMsg.decryptedContent || editingMsg.content)) {
      setEditingMsg(null);
      return;
    }
    try {
      const moderated = moderateContent(clean, room.moderationLevel);
      const finalContent = room.isPrivate && room.code
        ? await encryptText(moderated, room.code)
        : moderated;

      await db.collection('messages').doc(editingMsg.id).update({
        content: finalContent,
        edited: true
      });
    } catch (err) {
      console.error('Edit error:', err);
      showSnackbar('Failed to edit message', 'error');
    } finally {
      setEditingMsg(null);
    }
  };

  const handleReply = useCallback((m) => {
    setReplyTo(m);
    inputRef.current?.focus();
  }, []);

  const handleEdit = useCallback((m) => setEditingMsg(m), []);

  const copyRoomCode = () => {
    if (!room?.code) return;
    navigator.clipboard?.writeText(room.code);
    showSnackbar(`Copied room code "${room.code}" to clipboard!`);
  };

  const renderedMessages = useMemo(() => messages.map((msg, idx) => {
    const prevMsg = messages[idx - 1];
    return (
      <MessageBubble
        key={msg.id}
        msg={msg}
        isOwn={msg.sender === user.username}
        isContinuation={Boolean(prevMsg && prevMsg.sender === msg.sender)}
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleMessageDelete}
        onReact={handleReact}
        compactMode={settings.compactMode}
      />
    );
  }), [messages, user.username, handleReply, handleEdit, handleMessageDelete, handleReact, settings.compactMode]);

  return (
    <div className="chat-layout">
      <TopAppBar
        user={user}
        onLogout={onLogout}
        onBack={() => onNavigate('home')}
        onOpenSettings={onOpenSettings}
        title={room ? room.name : 'Loading...'}
      />

      {/* Room status strip — scrolls horizontally instead of overflowing the app bar on phones */}
      {room && (
        <div className="chat-room-bar">
          <button
            type="button"
            className="md-chip"
            onClick={() => setIsOnlineModalOpen(true)}
            title="View online users"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '12px', color: 'var(--md-sys-color-success)' }} aria-hidden="true">
              fiber_manual_record
            </span>
            <span>{presenceUsers.length || 1} online</span>
          </button>

          {timeLeft && (
            <span className="md-chip" aria-label={`Room expires: ${timeLeft}`}>
              <span className="material-symbols-rounded" aria-hidden="true">timer</span>
              <span>{timeLeft}</span>
            </span>
          )}

          <span className="md-chip">{chatVelocity}</span>

          {room.isPrivate && (
            <>
              <button type="button" className="md-chip" onClick={copyRoomCode} title="Copy room code">
                <span className="material-symbols-rounded" aria-hidden="true">content_copy</span>
                <span>{room.code}</span>
              </button>
              <button type="button" className="md-chip" onClick={() => setIsQRModalOpen(true)} title="Share QR code">
                <span className="material-symbols-rounded" aria-hidden="true">qr_code</span>
                <span>Share</span>
              </button>
              <span className="md-chip">
                <span className="material-symbols-rounded" aria-hidden="true">lock</span>
                <span>Encrypted</span>
              </span>
            </>
          )}
        </div>
      )}

      {/* Messages Container */}
      <main className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
        {renderedMessages}
        <div ref={messagesEndRef} />
      </main>

      {showJumpToLatest && (
        <button type="button" className="md-btn md-btn--tonal jump-latest" onClick={() => scrollToBottom(true)}>
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }} aria-hidden="true">arrow_downward</span>
          <span>Latest</span>
        </button>
      )}

      {/* Read receipts indicator */}
      {room?.readReceipts && readers.length > 0 && (
        <div className="read-receipts-bar">✓✓ Seen by {readers.join(', ')}</div>
      )}

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <span className="truncate">
            {typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : `${typingUsers.length} people are typing...`}
          </span>
        </div>
      )}

      {/* Input Area */}
      <div className="chat-input-area">
        {replyTo && (
          <div className="message-reply-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.72rem', color: 'var(--md-sys-color-primary)' }}>
                Replying to {replyTo.sender}
              </div>
              <div className="truncate">{replyTo.decryptedContent || replyTo.content}</div>
            </div>
            <button className="md-btn md-btn--icon" onClick={() => setReplyTo(null)} aria-label="Cancel reply" style={{ width: '36px', height: '36px', minHeight: '36px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>
        )}

        {/* Composer options */}
        <div className="composer-options">
          <span className="composer-options__label">Vanish</span>
          {[null, 10, 30].map((opt) => (
            <button
              type="button"
              key={String(opt)}
              className={`md-chip ${vanishTimer === opt ? 'md-chip--selected' : ''}`}
              aria-pressed={vanishTimer === opt}
              onClick={() => setVanishTimer(opt)}
              style={{ minHeight: '32px' }}
            >
              {opt === null ? 'Off' : `${opt}s`}
            </button>
          ))}

          <button
            type="button"
            className={`md-chip ${isBurnAfterReading ? 'md-chip--selected' : ''}`}
            aria-pressed={isBurnAfterReading}
            onClick={() => setIsBurnAfterReading(!isBurnAfterReading)}
            style={{ minHeight: '32px' }}
          >
            <span className="material-symbols-rounded" aria-hidden="true">visibility_off</span>
            <span>One-time view</span>
          </button>
        </div>

        <form className="chat-input-bar" onSubmit={handleSend}>
          <textarea
            ref={inputRef}
            rows={1}
            className="chat-input-bar__input"
            placeholder={room?.isPrivate ? 'Send an encrypted message' : 'Message'}
            value={inputVal}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
            enterKeyHint="send"
            aria-label="Message"
          />
          <button
            type="submit"
            className="md-btn md-btn--filled chat-send-btn"
            disabled={!inputVal.trim()}
            aria-label="Send message"
          >
            <span className="material-symbols-rounded">send</span>
          </button>
        </form>
      </div>

      {/* Online Users Modal */}
      <DialogModal
        isOpen={isOnlineModalOpen}
        title="Online right now"
        content={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {presenceUsers.length === 0 ? (
              <p className="body-medium text-muted">Just you online right now.</p>
            ) : (
              presenceUsers.map((name) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '12px', color: 'var(--md-sys-color-success)' }} aria-hidden="true">
                    fiber_manual_record
                  </span>
                  <span className="title-small">{name}</span>
                </div>
              ))
            )}
          </div>
        }
        confirmText="Close"
        cancelText=""
        onConfirm={() => setIsOnlineModalOpen(false)}
        onCancel={() => setIsOnlineModalOpen(false)}
      />

      {/* QR Code Sharing Modal */}
      <DialogModal
        isOpen={isQRModalOpen}
        title="Scan to join"
        content={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            {room?.code && (
              <img
                src={getQRCodeUrl(window.location.href)}
                alt="Room QR code"
                width="200"
                height="200"
                loading="lazy"
                style={{ width: '200px', height: '200px', borderRadius: '16px', border: '4px solid var(--md-sys-color-outline-variant)' }}
              />
            )}
            <p className="body-small text-muted" style={{ textAlign: 'center' }}>
              Scan with a phone camera to open this room with code <strong>{room?.code}</strong>
            </p>
          </div>
        }
        confirmText="Done"
        cancelText=""
        onConfirm={() => setIsQRModalOpen(false)}
        onCancel={() => setIsQRModalOpen(false)}
      />

      {/* Edit Dialog Modal */}
      <DialogModal
        isOpen={Boolean(editingMsg)}
        title="Edit message"
        showInput={true}
        inputPlaceholder="Message"
        initialValue={editingMsg ? (editingMsg.decryptedContent || editingMsg.content) : ''}
        confirmText="Save"
        onConfirm={handleConfirmEdit}
        onCancel={() => setEditingMsg(null)}
      />

      {/* Delete Confirmation Modal */}
      <DialogModal
        isOpen={Boolean(deletingMsgId)}
        title="Delete message"
        content="Are you sure you want to permanently delete this message?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => handleConfirmDelete()}
        onCancel={() => setDeletingMsgId(null)}
      />
    </div>
  );
}
