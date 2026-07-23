import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from './firebase';
import LoginView from './views/LoginView';
import HomeView from './views/HomeView';
import CreateRoomView from './views/CreateRoomView';
import ChatRoomView from './views/ChatRoomView';
import Snackbar from './components/Snackbar';
import PrivacyModal from './components/PrivacyModal';
import DialogModal from './components/DialogModal';
import UserSettingsModal from './components/UserSettingsModal';

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
    if (hash.startsWith('chat/')) return { view: 'chat', id: hash.split('/')[1] };
    return { view: 'home' };
  });

  const [snackbar, setSnackbar] = useState({ message: '', type: 'info' });
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const showSnackbar = useCallback((message, type = 'info') => {
    setSnackbar({ message, type });
    setTimeout(() => setSnackbar({ message: '', type: 'info' }), 4000);
  }, []);

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('tempchats_settings', JSON.stringify(newSettings));
  };

  // Hash Navigation Handler
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!hash || hash === 'login') setRoute({ view: 'home' });
      else if (hash === 'create') setRoute({ view: 'create' });
      else if (hash.startsWith('chat/')) setRoute({ view: 'chat', id: hash.split('/')[1] });
      else setRoute({ view: 'home' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path) => {
    window.location.hash = path;
  };

  // Automatic Expired Messages & Orphaned Clean Routine
  useEffect(() => {
    const purgeExpiredData = async () => {
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
      } catch (err) {
        // Quiet catch for index or permission constraints
      }
    };

    purgeExpiredData();
    const interval = setInterval(purgeExpiredData, 60000);
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

      // 2. Delete user's user document
      if (user.uid) {
        await db.collection('users').doc(user.uid).delete().catch(() => {});
      }

      // 3. Wiping auth session & local storage
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
        />
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
      />

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
