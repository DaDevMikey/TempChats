import React, { useState, useEffect, useMemo } from 'react';
import { db, firebase } from '../firebase';
import TopAppBar from '../components/TopAppBar';
import { normalizeDmHandle, DM_LIFETIME_HOURS } from '../utils/beta';

function formatTimeLeft(expiresAt) {
  if (!expiresAt) return '';
  const target = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return 'Cleared';
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  return hours > 0 ? `Clears in ${hours}h ${mins % 60}m` : `Clears in ${mins}m`;
}

export default function DirectMessagesView({ user, onNavigate, onLogout, onOpenSettings, showSnackbar }) {
  const [threads, setThreads] = useState([]);
  const [handleInput, setHandleInput] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!user?.authUid) return undefined;

    // Equality + inequality filters would need a composite index, so the
    // expiry/direct filtering happens client side on this small result set.
    const unsub = db.collection('rooms')
      .where('participants', 'array-contains', user.authUid)
      .onSnapshot(
        (snapshot) => {
          const now = Date.now();
          const list = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((thread) => {
              if (!thread.isDirect) return false;
              if (!thread.expires_at) return true;
              const exp = thread.expires_at.toDate ? thread.expires_at.toDate().getTime() : new Date(thread.expires_at).getTime();
              return exp > now;
            })
            .sort((a, b) => {
              const aTime = a.updated_at?.toMillis ? a.updated_at.toMillis() : 0;
              const bTime = b.updated_at?.toMillis ? b.updated_at.toMillis() : 0;
              return bTime - aTime;
            });
          setThreads(list);
        },
        (err) => console.error('Direct messages list error:', err)
      );

    return () => unsub();
  }, [user?.authUid]);

  const myHandle = user?.dmHandle || '';

  const copyHandle = () => {
    if (!myHandle) return;
    navigator.clipboard?.writeText(myHandle);
    showSnackbar(`Copied your handle "${myHandle}" to clipboard!`);
  };

  const handleStartDm = async (e) => {
    e.preventDefault();
    const handle = normalizeDmHandle(handleInput);
    if (!handle || starting) return;

    if (handle === normalizeDmHandle(myHandle)) {
      showSnackbar('That is your own handle', 'error');
      return;
    }

    setStarting(true);

    try {
      const usersSnap = await db.collection('users').where('dmHandle', '==', handle).limit(1).get();
      if (usersSnap.empty) {
        showSnackbar('No user found with that handle', 'error');
        return;
      }

      const other = usersSnap.docs[0].data();
      if (!other.authUid || other.authUid === user.authUid) {
        showSnackbar('That handle cannot be messaged', 'error');
        return;
      }

      // Reuse an existing, non-expired thread with the same person
      const now = Date.now();
      const existing = threads.find((t) => Array.isArray(t.participants) && t.participants.includes(other.authUid));
      if (existing) {
        onNavigate(`chat/${existing.id}`);
        return;
      }

      const expiresAt = new Date(now + DM_LIFETIME_HOURS * 60 * 60 * 1000);
      const code = Math.random().toString(36).substring(2, 14).toUpperCase();

      const threadRef = await db.collection('rooms').add({
        name: `Direct message with ${handle}`,
        creator: user.username,
        authUid: user.authUid,
        isDirect: true,
        isPrivate: true,
        readReceipts: true,
        moderationLevel: 'minimal',
        theme: 'violet',
        code,
        participants: [user.authUid, other.authUid],
        participantHandles: { [user.authUid]: normalizeDmHandle(myHandle), [other.authUid]: handle },
        participantNames: { [user.authUid]: user.username, [other.authUid]: other.username || handle },
        durationHours: DM_LIFETIME_HOURS,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp(),
        expires_at: firebase.firestore.Timestamp.fromDate(expiresAt),
        latestMessage: ''
      });

      setHandleInput('');
      onNavigate(`chat/${threadRef.id}`);
    } catch (err) {
      console.error('Start direct message error:', err);
      showSnackbar('Failed to start direct message', 'error');
    } finally {
      setStarting(false);
    }
  };

  const threadItems = useMemo(() => threads.map((thread) => {
    const otherUid = (thread.participants || []).find((uid) => uid !== user.authUid);
    const otherHandle = thread.participantHandles?.[otherUid] || 'unknown';
    return { ...thread, otherHandle };
  }), [threads, user.authUid]);

  return (
    <div className="home-layout">
      <TopAppBar user={user} onLogout={onLogout} onBack={() => onNavigate('home')} title="Direct messages" onOpenSettings={onOpenSettings} />

      <main className="home-content">
        <div className="large-title">
          <div className="large-title__eyebrow">
            <span className="beta-badge">Beta — gradual rollout</span>
          </div>
          <h1 className="large-title__text">Direct messages</h1>
          <p className="large-title__sub">
            Share your handle so people can message you directly. Direct chats are end-to-end encrypted and every thread clears itself
            after {DM_LIFETIME_HOURS} hours.
          </p>
        </div>

        <div className="md-card md-card--elevated dm-handle-card">
          <div style={{ minWidth: 0 }}>
            <div className="body-small text-muted">Your handle</div>
            <div className="title-medium truncate">{myHandle || 'Generating…'}</div>
          </div>
          <button type="button" className="md-btn md-btn--tonal" onClick={copyHandle} disabled={!myHandle}>
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }} aria-hidden="true">content_copy</span>
            <span>Copy</span>
          </button>
        </div>

        <form className="dm-start-form" onSubmit={handleStartDm}>
          <div className="md-text-field" style={{ flex: 1 }}>
            <input
              type="text"
              className="md-text-field__input"
              placeholder=" "
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              autoComplete="off"
              enterKeyHint="go"
              disabled={starting}
              required
            />
            <label className="md-text-field__label">Start a chat with a handle</label>
          </div>
          <button type="submit" className="md-btn md-btn--filled" disabled={starting || !handleInput.trim()}>
            {starting ? 'Opening…' : 'Start chat'}
          </button>
        </form>

        <div className="section-header">
          <h2 className="title-large">Your direct chats</h2>
          <span className="body-small text-muted">{threadItems.length} active</span>
        </div>

        {threadItems.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-rounded" aria-hidden="true">mark_unread_chat_alt</span>
            <h3 className="title-medium" style={{ marginTop: '12px' }}>No direct chats yet</h3>
            <p className="body-medium" style={{ marginTop: '4px' }}>Share your handle or enter someone else&rsquo;s to get started.</p>
          </div>
        ) : (
          <div className="rooms-grid">
            {threadItems.map((thread) => (
              <article className="md-card md-card--elevated room-card" key={thread.id}>
                <div className="room-card__header">
                  <div style={{ minWidth: 0 }}>
                    <h3 className="room-card__title truncate">{thread.otherHandle}</h3>
                    <div className="room-card__meta" style={{ padding: 0, marginTop: '4px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }} aria-hidden="true">lock</span>
                        Encrypted
                      </span>
                    </div>
                  </div>
                  <div className="countdown-badge">
                    <span className="material-symbols-rounded" aria-hidden="true">timer</span>
                    <span>{formatTimeLeft(thread.expires_at)}</span>
                  </div>
                </div>

                {thread.latestMessage && <p className="room-card__preview truncate">{thread.latestMessage}</p>}

                <div className="room-card__footer">
                  <button className="md-btn md-btn--filled" onClick={() => onNavigate(`chat/${thread.id}`)}>
                    <span className="material-symbols-rounded" style={{ fontSize: '20px' }} aria-hidden="true">login</span>
                    <span>Open chat</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
