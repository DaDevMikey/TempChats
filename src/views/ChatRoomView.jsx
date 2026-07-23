import React, { useState, useEffect, useRef } from 'react';
import { db, firebase } from '../firebase';
import TopAppBar from '../components/TopAppBar';
import MessageBubble from '../components/MessageBubble';
import DialogModal from '../components/DialogModal';
import { encryptText, decryptText } from '../utils/crypto';
import { playChime } from '../utils/audio';
import { getQRCodeUrl } from '../utils/qr';

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
  indigo: { primary: '#818cf8', container: '#3730a3' },
  emerald: { primary: '#34d399', container: '#065f46' },
  violet: { primary: '#c084fc', container: '#581c87' },
  amber: { primary: '#fbbf24', container: '#78350f' },
  rose: { primary: '#fb7185', container: '#881337' }
};

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

  // Modals
  const [editingMsg, setEditingMsg] = useState(null);
  const [deletingMsgId, setDeletingMsgId] = useState(null);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // 1. Listen to Room Document & Apply Theme
  useEffect(() => {
    if (!roomId) return;

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
        if (roomData.theme && themePalettes[roomData.theme]) {
          const pal = themePalettes[roomData.theme];
          document.documentElement.style.setProperty('--md-sys-color-primary', pal.primary);
          document.documentElement.style.setProperty('--md-sys-color-primary-container', pal.container);
        }
      },
      (err) => console.error('Room error:', err)
    );

    return () => {
      unsub();
      // Reset theme
      document.documentElement.style.setProperty('--md-sys-color-primary', '#818cf8');
      document.documentElement.style.setProperty('--md-sys-color-primary-container', '#3730a3');
    };
  }, [roomId, onNavigate, showSnackbar]);

  // 2. Presence Pinger
  useEffect(() => {
    if (!roomId || !user) return;

    const pingPresence = () => {
      db.collection('rooms').doc(roomId).collection('presence').doc(user.username).set({
        last_seen: Date.now()
      }).catch(() => {});
    };

    pingPresence();
    const interval = setInterval(pingPresence, 15000);

    return () => {
      clearInterval(interval);
      db.collection('rooms').doc(roomId).collection('presence').doc(user.username).delete().catch(() => {});
    };
  }, [roomId, user]);

  // 3. Listen to Active Presence Users
  useEffect(() => {
    if (!roomId) return;

    const unsub = db.collection('rooms').doc(roomId).collection('presence').onSnapshot((snapshot) => {
      const active = [];
      const now = Date.now();
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.last_seen && now - data.last_seen < 45000) {
          active.push(d.id);
        }
      });
      setPresenceUsers(active);
    });

    return () => unsub();
  }, [roomId]);

  // 4. Countdown Timer
  useEffect(() => {
    if (!room?.expires_at) return;

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
  useEffect(() => {
    if (!roomId) return;

    const unsub = db.collection('messages')
      .where('room_id', '==', roomId)
      .orderBy('created_at', 'asc')
      .onSnapshot(
        async (snapshot) => {
          const rawList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          // Calculate Chat Velocity (messages in last 2 minutes)
          const now = Date.now();
          const recentCount = rawList.filter((m) => {
            const time = m.created_at?.toDate ? m.created_at.toDate().getTime() : Date.now();
            return now - time < 120000;
          }).length;

          if (recentCount >= 8) setChatVelocity('High Velocity');
          else if (recentCount >= 3) setChatVelocity('Active');
          else setChatVelocity('Calm');

          // Decrypt private room messages
          const processed = await Promise.all(
            rawList.map(async (msg) => {
              if (room?.isPrivate && room?.code) {
                const dec = await decryptText(msg.content, room.code);
                return { ...msg, decryptedContent: dec };
              }
              return msg;
            })
          );

          setMessages(processed);
          if (settings.soundEnabled && rawList.length > messages.length && messages.length > 0) {
            const latest = rawList[rawList.length - 1];
            if (latest.sender !== user.username) {
              playChime('receive');
            }
          }
        },
        (err) => console.error('Messages snapshot error:', err)
      );

    return () => unsub();
  }, [roomId, room?.isPrivate, room?.code, settings.soundEnabled, user.username, messages.length]);

  // 6. Auto scroll & Trigger Read Receipt
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (room?.readReceipts && roomId && user?.username) {
      db.collection('rooms').doc(roomId).collection('read_receipts').doc(user.username).set({
        timestamp: Date.now()
      }).catch(() => {});
    }
  }, [messages.length, room?.readReceipts, roomId, user?.username]);

  // 7. Listen to Typing
  useEffect(() => {
    if (!roomId) return;

    const unsub = db.collection('rooms').doc(roomId).collection('typing').onSnapshot((snapshot) => {
      const typers = [];
      snapshot.docs.forEach((doc) => {
        if (doc.id !== user.username) {
          const data = doc.data();
          if (data.updated_at) {
            const time = data.updated_at.toDate ? data.updated_at.toDate().getTime() : new Date(data.updated_at).getTime();
            if (Date.now() - time < 5000) {
              typers.push(doc.id);
            }
          }
        }
      });
      setTypingUsers(typers);
    });

    return () => unsub();
  }, [roomId, user.username]);

  // 8. Listen to Read Receipts
  useEffect(() => {
    if (!roomId || !room?.readReceipts) return;

    const unsub = db.collection('rooms').doc(roomId).collection('read_receipts').onSnapshot((snapshot) => {
      const activeReaders = [];
      snapshot.docs.forEach((doc) => {
        if (doc.id !== user.username) {
          activeReaders.push(doc.id);
        }
      });
      setReaders(activeReaders);
    });

    return () => unsub();
  }, [roomId, room?.readReceipts, user.username]);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el || !room?.readReceipts || !roomId) return;
    const isAtBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + 30;
    if (isAtBottom) {
      db.collection('rooms').doc(roomId).collection('read_receipts').doc(user.username).set({
        timestamp: Date.now()
      }).catch(() => {});
    }
  };

  // 9. Input Typing Handler (Debounced)
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);

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

  // 10. Send Message Handler
  const handleSend = async (e) => {
    e.preventDefault();
    const cleanContent = inputVal.trim();
    if (!cleanContent || !room) return;

    setInputVal('');
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

    try {
      await db.collection('messages').add(messageData);
      if (settings.soundEnabled) playChime('send');

      db.collection('rooms').doc(roomId).update({
        latestMessage: room.isPrivate ? '🔒 [Encrypted Message]' : moderated,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    } catch (err) {
      console.error('Send error:', err);
      showSnackbar('Failed to send message', 'error');
      setInputVal(cleanContent);
    }
  };

  // 11. Reaction Handler
  const handleReact = async (msgId, emoji) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    const reactions = msg.reactions || {};
    const count = (reactions[emoji] || 0) + 1;
    try {
      await db.collection('messages').doc(msgId).update({
        [`reactions.${emoji}`]: count
      });
    } catch (e) {
      console.error('Reaction error:', e);
    }
  };

  // 12. Edit Message Handler
  const handleConfirmEdit = async (newContent) => {
    if (!editingMsg || !newContent || !newContent.trim()) {
      setEditingMsg(null);
      return;
    }
    const clean = newContent.trim();
    if (clean === editingMsg.content) {
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
    } catch (e) {
      console.error('Edit error:', e);
      showSnackbar('Failed to edit message', 'error');
    } finally {
      setEditingMsg(null);
    }
  };

  // 13. Delete Message Handler
  const handleConfirmDelete = async (msgId, silent = false) => {
    const targetId = msgId || deletingMsgId;
    if (!targetId) return;
    try {
      await db.collection('messages').doc(targetId).delete();
    } catch (e) {
      if (!silent) {
        console.error('Delete error:', e);
        showSnackbar('Failed to delete message', 'error');
      }
    } finally {
      setDeletingMsgId(null);
    }
  };

  const copyRoomCode = () => {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    showSnackbar(`Copied room code "${room.code}" to clipboard!`);
  };

  return (
    <div className="chat-layout">
      <TopAppBar
        user={user}
        onLogout={onLogout}
        onBack={() => onNavigate('home')}
        onOpenSettings={onOpenSettings}
        title={room ? room.name : 'Loading...'}
        extraActions={
          room && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Velocity Badge */}
              <span className="countdown-badge" style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-on-surface)' }}>
                {chatVelocity}
              </span>

              {/* Online Users Badge */}
              <button
                className="md-btn md-btn--tonal"
                onClick={() => setIsOnlineModalOpen(true)}
                style={{ height: '32px', padding: '0 10px', fontSize: '0.8rem' }}
                title="View Online Users"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '14px', color: '#4ade80' }}>fiber_manual_record</span>
                <span>{presenceUsers.length || 1} Online</span>
              </button>

              {/* Private Room Tools */}
              {room.isPrivate && (
                <>
                  <button
                    className="md-btn md-btn--tonal"
                    onClick={copyRoomCode}
                    style={{ height: '32px', padding: '0 10px', fontSize: '0.8rem' }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>content_copy</span>
                    <span>{room.code}</span>
                  </button>

                  <button
                    className="md-btn md-btn--tonal"
                    onClick={() => setIsQRModalOpen(true)}
                    style={{ height: '32px', width: '32px', padding: 0 }}
                    title="Share QR Code"
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>qr_code</span>
                  </button>
                </>
              )}

              {timeLeft && (
                <div className="countdown-badge">
                  <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>timer</span>
                  <span>{timeLeft}</span>
                </div>
              )}
            </div>
          )
        }
      />

      {/* Messages Container */}
      <main className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
        {messages.map((msg, idx) => {
          const isOwn = msg.sender === user.username;
          const prevMsg = messages[idx - 1];
          const isContinuation = prevMsg && prevMsg.sender === msg.sender;

          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={isOwn}
              isContinuation={isContinuation}
              onReply={(m) => setReplyTo(m)}
              onEdit={(m) => setEditingMsg(m)}
              onDelete={(id, silent) => handleConfirmDelete(id, silent)}
              onReact={handleReact}
              compactMode={settings.compactMode}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Read receipts indicator */}
      {room?.readReceipts && readers.length > 0 && (
        <div className="read-receipts-bar">
          ✓✓ Seen by {readers.join(', ')}
        </div>
      )}

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <span>
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.length} people are typing...`}
          </span>
        </div>
      )}

      {/* Input Area */}
      <div className="chat-input-area">
        {replyTo && (
          <div className="message-reply-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--md-sys-color-primary)' }}>
                Replying to {replyTo.sender}
              </div>
              <div className="truncate" style={{ fontSize: '0.85rem' }}>
                {replyTo.decryptedContent || replyTo.content}
              </div>
            </div>
            <button className="md-btn md-btn--icon" onClick={() => setReplyTo(null)} style={{ width: '28px', height: '28px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        )}

        {/* Options Toolbar */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span className="body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Timer:</span>
          <button
            type="button"
            className={`md-btn ${vanishTimer === null ? 'md-btn--filled' : 'md-btn--tonal'}`}
            onClick={() => setVanishTimer(null)}
            style={{ height: '26px', padding: '0 10px', fontSize: '0.75rem' }}
          >
            Off
          </button>
          <button
            type="button"
            className={`md-btn ${vanishTimer === 10 ? 'md-btn--filled' : 'md-btn--tonal'}`}
            onClick={() => setVanishTimer(10)}
            style={{ height: '26px', padding: '0 10px', fontSize: '0.75rem' }}
          >
            10s
          </button>
          <button
            type="button"
            className={`md-btn ${vanishTimer === 30 ? 'md-btn--filled' : 'md-btn--tonal'}`}
            onClick={() => setVanishTimer(30)}
            style={{ height: '26px', padding: '0 10px', fontSize: '0.75rem' }}
          >
            30s
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--md-sys-color-outline-variant)', margin: '0 4px' }} />

          <button
            type="button"
            className={`md-btn ${isBurnAfterReading ? 'md-btn--filled' : 'md-btn--tonal'}`}
            onClick={() => setIsBurnAfterReading(!isBurnAfterReading)}
            style={{ height: '26px', padding: '0 10px', fontSize: '0.75rem' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>visibility_off</span>
            <span>One-Time View</span>
          </button>
        </div>

        <form className="chat-input-bar" onSubmit={handleSend}>
          <input
            type="text"
            className="chat-input-bar__input"
            placeholder={room?.isPrivate ? "Type an end-to-end encrypted message..." : "Type a message..."}
            value={inputVal}
            onChange={handleInputChange}
            autoComplete="off"
          />
          <button type="submit" className="md-btn md-btn--filled" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}>
            <span className="material-symbols-rounded">send</span>
          </button>
        </form>
      </div>

      {/* Online Users Modal */}
      <DialogModal
        isOpen={isOnlineModalOpen}
        title="Active Online Users"
        content={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {presenceUsers.length === 0 ? (
              <p>Just you online right now.</p>
            ) : (
              presenceUsers.map((name) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '14px', color: '#4ade80' }}>fiber_manual_record</span>
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
        title="Scan QR Code to Join Room"
        content={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
            {room?.code && (
              <img
                src={getQRCodeUrl(window.location.href)}
                alt="Room QR Code"
                style={{ width: '200px', height: '200px', borderRadius: '16px', border: '4px solid var(--md-sys-color-outline-variant)' }}
              />
            )}
            <p className="body-small" style={{ textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Scan with mobile camera to instantly open and join this room with Code <strong>{room?.code}</strong>
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
        title="Edit Message"
        showInput={true}
        initialValue={editingMsg ? (editingMsg.decryptedContent || editingMsg.content) : ''}
        confirmText="Save"
        onConfirm={handleConfirmEdit}
        onCancel={() => setEditingMsg(null)}
      />

      {/* Delete Confirmation Modal */}
      <DialogModal
        isOpen={Boolean(deletingMsgId)}
        title="Delete Message"
        content="Are you sure you want to permanently delete this message?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => handleConfirmDelete()}
        onCancel={() => setDeletingMsgId(null)}
      />
    </div>
  );
}
