import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import TopAppBar from '../components/TopAppBar';
import RoomCard from '../components/RoomCard';
import PrivacyBanner from '../components/PrivacyBanner';
import DialogModal from '../components/DialogModal';

export default function HomeView({ user, onNavigate, onLogout, onOpenPrivacyModal, onOpenSettings, showSnackbar }) {
  const [publicRooms, setPublicRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isJoinCodeOpen, setIsJoinCodeOpen] = useState(false);

  useEffect(() => {
    // Listen to non-expired public rooms
    const unsub = db.collection('rooms')
      .where('isPrivate', '==', false)
      .onSnapshot(
        (snapshot) => {
          const now = Date.now();
          const list = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((room) => {
              if (!room.expires_at) return true;
              const expTime = room.expires_at.toDate ? room.expires_at.toDate().getTime() : new Date(room.expires_at).getTime();
              return expTime > now;
            });
          setPublicRooms(list);
        },
        (err) => console.error('Rooms list error:', err)
      );

    return () => unsub();
  }, [showSnackbar]);

  const handleJoinByCode = async (code) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim().toUpperCase();

    try {
      const snap = await db.collection('rooms').where('code', '==', cleanCode).get();
      if (snap.empty) {
        showSnackbar('Invalid or expired room code', 'error');
      } else {
        const roomDoc = snap.docs[0];
        onNavigate(`chat/${roomDoc.id}`);
      }
    } catch (e) {
      console.error('Join code error:', e);
      showSnackbar('Error joining private room', 'error');
    } finally {
      setIsJoinCodeOpen(false);
    }
  };

  const filteredRooms = publicRooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="home-layout">
      <TopAppBar user={user} onLogout={onLogout} onOpenSettings={onOpenSettings} />

      <main className="home-content">
        <PrivacyBanner onOpenPrivacyModal={onOpenPrivacyModal} />

        {/* Action Cards */}
        <div className="home-actions">
          <div className="action-card" onClick={() => onNavigate('create')}>
            <div className="action-card__icon">
              <span className="material-symbols-rounded">add</span>
            </div>
            <h3 className="title-medium">Create Room</h3>
            <p className="body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
              Start a new temporary, self-destructing chat
            </p>
          </div>

          <div className="action-card" onClick={() => setIsJoinCodeOpen(true)}>
            <div className="action-card__icon" style={{ backgroundColor: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' }}>
              <span className="material-symbols-rounded">vpn_key</span>
            </div>
            <h3 className="title-medium">Join with Code</h3>
            <p className="body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
              Enter a private 6-character room code
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="search-bar">
          <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>search</span>
          <input
            type="text"
            className="search-bar__input"
            placeholder="Search public rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Public Rooms */}
        <h2 className="title-large" style={{ marginTop: '32px' }}>Public Rooms</h2>
        {filteredRooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '48px', opacity: 0.5 }}>forum</span>
            <h3 className="title-medium" style={{ marginTop: '12px' }}>No public rooms found</h3>
            <p className="body-medium" style={{ marginTop: '4px' }}>Be the first to create one!</p>
          </div>
        ) : (
          <div className="rooms-grid">
            {filteredRooms.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={(id) => onNavigate(`chat/${id}`)} />
            ))}
          </div>
        )}
      </main>

      {/* Join by Code Modal */}
      <DialogModal
        isOpen={isJoinCodeOpen}
        title="Join Private Room"
        content="Enter the 6-character room code provided by the creator:"
        showInput={true}
        inputPlaceholder="e.g. X7K9A2"
        confirmText="Join"
        onConfirm={handleJoinByCode}
        onCancel={() => setIsJoinCodeOpen(false)}
      />
    </div>
  );
}
