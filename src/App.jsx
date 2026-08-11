import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, auth } from './firebase';
import LoginView from './views/LoginView';
import HomeView from './views/HomeView';
import CreateRoomView from './views/CreateRoomView';
import ChatRoomView from './views/ChatRoomView';
import DirectMessagesView from './views/DirectMessagesView';
import Snackbar from './components/Snackbar';
import PrivacyModal from './components/PrivacyModal';
import DialogModal from './components/DialogModal';
import UserSettingsModal from './components/UserSettingsModal';
import ReleaseNotesModal from './components/ReleaseNotesModal';
import { ensureUserProfile, setBetaPreference } from './utils/profile';
import { isBetaUser } from './utils/beta';
import { CURRENT_RELEASE } from './releaseNotes';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('tempchats_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('tempchats_settings');
    return saved ? JSON.parse(saved) : { soundEnabled: true, readReceiptsEnabled: true, compactMode: false };
  });

  const [route, setRoute] = useState(() => {
    const hash = window.location.hash.slice(1);
    if (!hash || hash === 'login') return { view: 'home' };
    if (hash === 'create') return { view: 'create' };
    if (hash === 'dms') return { view: 'dms' };
    if (hash.startsWith('chat/')) return { view: 'chat', id: hash.split('/')[1] };
    return { view: 'home' };
  });

  const [snackbar, setSnackbar] = useState({ message: '', type: 'info' });
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);

  const snackbarTimerRef = useRef(null);

  const showSnackbar = useCallback((message, type = 'info') => {
    setSnackbar({ message, type });
    clearTimeout(snackbarTimerRef.current);
    snackbarTimerRef.current = setTimeout(() => setSnackbar({ message: '', type: 'info' }), 4000);
  }, []);

  useEffect(() => () => clearTimeout(snackbarTimerRef.current), []);

  const closeReleaseNotes = useCallback(() => {
    setIsReleaseNotesOpen(false);
    localStorage.setItem('tempchats_release_seen', CURRENT_RELEASE);
  }, []);

  // Sync rollout tags & direct-message handle for accounts created before
  // those fields existed, and pick up server-side changes to the beta tag.
  useEffect(() => {
    if (!user?.uid) return undefined;

    let cancelled = false;
    ensureUserProfile(user).then((updated) => {
      if (cancelled || !updated) return;
      const changed = updated.dmHandle !== user.dmHandle
        || JSON.stringify(updated.tags || {}) !== JSON.stringify(user.tags || {});
      if (!changed) return;
      localStorage.setItem('tempchats_user', JSON.stringify(updated));
      setUser(updated);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Surface the release notes once per version
  useEffect(() => {
    if (!user?.uid) return;
    if (localStorage.getItem('tempchats_release_seen') !== CURRENT_RELEASE) {
      setIsReleaseNotesOpen(true);
    }
  }, [user?.uid]);

  const updateBetaPreference = useCallback(async (enabled) => {
    if (!user?.uid) return;
    try {
      const updated = await setBetaPreference(user, enabled);
      localStorage.setItem('tempchats_user', JSON.stringify(updated));
      setUser(updated);
      showSnackbar(enabled ? 'Direct messages beta enabled' : 'Direct messages beta disabled');
      if (!enabled && window.location.hash.slice(1) === 'dms') window.location.hash = 'home';
    } catch (err) {
      console.error('Beta preference error:', err);
      showSnackbar('Could not update the beta setting. Please try again.', 'error');
    }
  }, [user, showSnackbar]);

  const updateSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('tempchats_settings', JSON.stringify(newSettings));
  }, []);

  // Hash Navigation Handler
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!hash || hash === 'login') setRoute({ view: 'home' });
      else if (hash === 'create') setRoute({ view: 'create' });
      else if (hash === 'dms') setRoute({ view: 'dms' });
      else if (hash.startsWith('chat/')) setRoute({ view: 'chat', id: hash.split('/')[1] });
      else setRoute({ view: 'home' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Stable identity: child effects depend on this and would otherwise
  // re-subscribe to Firestore on every App re-render.
  const navigate = useCallback((path) => {
    window.location.hash = path;
  }, []);

  // Automatic Expired Messages & Orphaned Clean Routine
  const authUidRef = useRef(user?.authUid || null);
  authUidRef.current = user?.authUid || null;

  useEffect(() => {
    const purgeExpiredData = async () => {
      const currentAuthUid = authUidRef.current;
      try {
        const now = new Date();
        // Query expired messages
        const snap = await db.collection('messages')
          .where('expires_at', '<', now)
          .limit(50)
          .get();

        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          console.log(`Purged ${snap.size} expired messages`);
        }

        // Direct message threads are disposable — remove the thread documents
        // once their 24h lifetime is over so they stop showing up anywhere.
        // Only the current user's own threads are queried; other people's
        // direct threads are not readable.
        if (currentAuthUid) {
          const ownThreads = await db.collection('rooms')
            .where('participants', 'array-contains', currentAuthUid)
            .limit(50)
            .get();

          const expiredDirect = ownThreads.docs.filter((doc) => {
            const data = doc.data();
            if (!data.isDirect || !data.expires_at) return false;
            const exp = data.expires_at.toDate ? data.expires_at.toDate() : new Date(data.expires_at);
            return exp < now;
          });

          if (expiredDirect.length > 0) {
            const roomBatch = db.batch();
            expiredDirect.forEach((doc) => roomBatch.delete(doc.ref));
            await roomBatch.commit();
          }
        }
      } catch (err) {
        // Quiet catch for index or permission constraints
      }
    };

    const purgeIfVisible = () => {
      if (!document.hidden) purgeExpiredData();
    };

    purgeIfVisible();
    // Every client used to run this every 60s, even in background tabs.
    const interval = setInterval(purgeIfVisible, 300000);
    return () => clearInterval(interval);
  }, []);

  // Auth Persistence Listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((firebaseUser) => {
      const savedStr = localStorage.getItem('tempchats_user');
      if (firebaseUser && savedStr) {
        try {
          const parsed = JSON.parse(savedStr);
          if (parsed.authUid === firebaseUser.uid) {
            setUser(parsed);
          } else {
            localStorage.removeItem('tempchats_user');
            setUser(null);
          }
        } catch (e) {
          localStorage.removeItem('tempchats_user');
          setUser(null);
        }
      } else if (!firebaseUser) {
        localStorage.removeItem('tempchats_user');
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  // Secure Logout with Ownership Transfer & Message Purge
  const handlePerformLogout = async () => {
    setIsLogoutConfirmOpen(false);
    if (!user) return;

    try {
      showSnackbar('Cleaning up user data and rooms...', 'info');

      // 1. Find rooms created by user
      const roomsSnap = await db.collection('rooms').where('authUid', '==', user.authUid).get();

      for (const roomDoc of roomsSnap.docs) {
        const roomId = roomDoc.id;

        // Direct threads belong to their two participants only — they are
        // never handed over, they are destroyed with the account.
        if (roomDoc.data().isDirect) {
          const dmMsgs = await db.collection('messages').where('room_id', '==', roomId).get();
          const dmBatch = db.batch();
          dmMsgs.docs.forEach((d) => dmBatch.delete(d.ref));
          dmBatch.delete(roomDoc.ref);
          await dmBatch.commit();
          continue;
        }

        // Check active chatters in typing/presence collection
        const typingSnap = await db.collection('rooms').doc(roomId).collection('typing').get();
        const activeTypers = typingSnap.docs.filter((d) => d.id !== user.username);

        const msgsSnap = await db.collection('messages')
          .where('room_id', '==', roomId)
          .orderBy('created_at', 'desc')
          .limit(10)
          .get();

        const recentChatters = new Map();
        msgsSnap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.sender !== user.username && data.authUid) {
            recentChatters.set(data.sender, data.authUid);
          }
        });

        if (activeTypers.length > 0 || recentChatters.size > 0) {
          let newOwnerName = '';
          let newOwnerUid = '';

          if (activeTypers.length > 0) {
            newOwnerName = activeTypers[0].id;
            const chatterDoc = await db.collection('users').where('username', '==', newOwnerName).get();
            if (!chatterDoc.empty) {
              newOwnerUid = chatterDoc.docs[0].data().authUid;
            }
          } else {
            const entry = Array.from(recentChatters.entries())[0];
            newOwnerName = entry[0];
            newOwnerUid = entry[1];
          }

          if (newOwnerName && newOwnerUid) {
            await db.collection('rooms').doc(roomId).update({
              creator: newOwnerName,
              authUid: newOwnerUid
            });
            console.log(`Transferred room ${roomId} to ${newOwnerName}`);
            continue;
          }
        }

        // Room is abandoned — delete room and all associated messages
        const roomMsgs = await db.collection('messages').where('room_id', '==', roomId).get();
        const batch = db.batch();
        roomMsgs.docs.forEach((d) => batch.delete(d.ref));
        batch.delete(roomDoc.ref);
        await batch.commit();
        console.log(`Deleted abandoned room ${roomId} and its messages`);
      }

      // 2. Remove direct threads the user takes part in but did not create.
      // Their counterpart's messages expire on their own 24h schedule.
      const dmSnap = await db.collection('rooms').where('participants', 'array-contains', user.authUid).get();
      for (const dmDoc of dmSnap.docs) {
        if (!dmDoc.data().isDirect) continue;
        const ownMsgs = await db.collection('messages')
          .where('room_id', '==', dmDoc.id)
          .where('authUid', '==', user.authUid)
          .get();
        const dmBatch = db.batch();
        ownMsgs.docs.forEach((d) => dmBatch.delete(d.ref));
        dmBatch.delete(dmDoc.ref);
        await dmBatch.commit();
      }

      // 3. Delete user's user document
      if (user.uid) {
        await db.collection('users').doc(user.uid).delete().catch(() => {});
      }

      // 4. Wiping auth session & local storage
      localStorage.removeItem('tempchats_user');
      setUser(null);
      await auth.signOut();

      showSnackbar('Successfully logged out and wiped session');
      navigate('login');
    } catch (err) {
      console.error('Logout error:', err);
      showSnackbar('Logout cleanup completed', 'info');
      localStorage.removeItem('tempchats_user');
      setUser(null);
      auth.signOut().catch(() => {});
    }
  };

  if (!user) {
    return (
      <>
        <LoginView onLoginSuccess={(u) => { setUser(u); navigate('home'); }} showSnackbar={showSnackbar} />
        <Snackbar message={snackbar.message} type={snackbar.type} onClose={() => setSnackbar({ message: '', type: 'info' })} />
      </>
    );
  }

  return (
    <>
      {route.view === 'home' && (
        <HomeView
          user={user}
          onNavigate={navigate}
          onLogout={() => setIsLogoutConfirmOpen(true)}
          onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          showSnackbar={showSnackbar}
          isBeta={isBetaUser(user)}
        />
      )}

      {route.view === 'dms' && (
        isBetaUser(user) ? (
          <DirectMessagesView
            user={user}
            onNavigate={navigate}
            onLogout={() => setIsLogoutConfirmOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            showSnackbar={showSnackbar}
          />
        ) : (
          <HomeView
            user={user}
            onNavigate={navigate}
            onLogout={() => setIsLogoutConfirmOpen(true)}
            onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            showSnackbar={showSnackbar}
            isBeta={false}
          />
        )
      )}

      {route.view === 'create' && (
        <CreateRoomView
          user={user}
          onNavigate={navigate}
          onLogout={() => setIsLogoutConfirmOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          showSnackbar={showSnackbar}
        />
      )}

      {route.view === 'chat' && (
        <ChatRoomView
          roomId={route.id}
          user={user}
          onNavigate={navigate}
          onLogout={() => setIsLogoutConfirmOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          showSnackbar={showSnackbar}
          settings={settings}
        />
      )}

      {/* Modals & Notifications */}
      <Snackbar message={snackbar.message} type={snackbar.type} onClose={() => setSnackbar({ message: '', type: 'info' })} />
      <PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
      <UserSettingsModal
        isOpen={isSettingsModalOpen}
        settings={settings}
        onUpdateSettings={updateSettings}
        onClose={() => setIsSettingsModalOpen(false)}
        onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
        onOpenReleaseNotes={() => setIsReleaseNotesOpen(true)}
        isBeta={isBetaUser(user)}
        onUpdateBeta={updateBetaPreference}
      />

      <ReleaseNotesModal isOpen={isReleaseNotesOpen} onClose={closeReleaseNotes} />

      {/* Logout Confirmation Dialog */}
      <DialogModal
        isOpen={isLogoutConfirmOpen}
        title="Logout & Account Wiping"
        content="Logging out will permanently wipe your user identity and abandoned rooms along with their messages. Active rooms will be transferred to active chatters. Proceed?"
        confirmText="Yes, Logout & Wipe Account"
        cancelText="Cancel"
        onConfirm={handlePerformLogout}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />
    </>
  );
}
