import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  }, []);

  const handleJoinByCode = async (code) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim().toUpperCase();

    try {
      const snap = await db.collection('rooms').where('code', '==', cleanCode).get();
      if (snap.empty) {
        showSnackbar('Invalid or expired room code', 'error');
      } else {
        onNavigate(`chat/${snap.docs[0].id}`);
      }
    } catch (e) {
      console.error('Join code error:', e);
      showSnackbar('Error joining private room', 'error');
    } finally {
      setIsJoinCodeOpen(false);
    }
  };

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return publicRooms;
    return publicRooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [publicRooms, searchQuery]);

  const handleJoinRoom = useCallback((id) => onNavigate(`chat/${id}`), [onNavigate]);

  return (
    <div className="home-layout">
      <TopAppBar user={user} onLogout={onLogout} onOpenSettings={onOpenSettings} />

      <main className="home-content">
        {/* One UI style large title */}
        <div className="large-title">
          <div className="large-title__eyebrow">Ephemeral by design</div>
          <h1 className="large-title__text">Hi, {user.username}</h1>
          <p className="large-title__sub">Spin up a room, share the code, and everything disappears when it expires.</p>
        </div>

        {/* Action Cards */}
        <div className="home-actions">
          <button type="button" className="action-card" onClick={() => onNavigate('create')}>
            <div className="action-card__icon">
              <span className="material-symbols-rounded" aria-hidden="true">add</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 className="title-medium">Create room</h3>
              <p className="body-medium text-muted" style={{ marginTop: '2px' }}>
                Start a new self-destructing chat
              </p>
            </div>
          </button>

          <button type="button" className="action-card" onClick={() => setIsJoinCodeOpen(true)}>
            <div
              className="action-card__icon"
              style={{ backgroundColor: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' }}
            >
              <span className="material-symbols-rounded" aria-hidden="true">vpn_key</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 className="title-medium">Join with code</h3>
              <p className="body-medium text-muted" style={{ marginTop: '2px' }}>
                Enter a private 6-character room code
              </p>
            </div>
          </button>
        </div>

        {/* Search */}
        <div className="search-bar">
          <span className="material-symbols-rounded text-muted" aria-hidden="true">search</span>
          <input
            type="search"
            className="search-bar__input"
            placeholder="Search public rooms"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            enterKeyHint="search"
            aria-label="Search public rooms"
          />
          {searchQuery && (
            <button className="md-btn md-btn--icon" onClick={() => setSearchQuery('')} aria-label="Clear search" style={{ width: '36px', height: '36px', minHeight: '36px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>close</span>
            </button>
          )}
        </div>

        {/* Public Rooms */}
        <div className="section-header">
          <h2 className="title-large">Public rooms</h2>
          <span className="body-small text-muted">{filteredRooms.length} live</span>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-rounded" aria-hidden="true">forum</span>
            <h3 className="title-medium" style={{ marginTop: '12px' }}>No public rooms found</h3>
            <p className="body-medium" style={{ marginTop: '4px' }}>Be the first to create one!</p>
          </div>
        ) : (
          <div className="rooms-grid">
            {filteredRooms.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={handleJoinRoom} />
            ))}
          </div>
        )}

        <PrivacyBanner onOpenPrivacyModal={onOpenPrivacyModal} />
      </main>

      {/* Thumb-reachable primary action on mobile */}
      <button type="button" className="fab" onClick={() => onNavigate('create')} aria-label="Create room">
        <span className="material-symbols-rounded" aria-hidden="true">add</span>
        <span>New room</span>
      </button>

      {/* Join by Code Modal */}
      <DialogModal
        isOpen={isJoinCodeOpen}
        title="Join private room"
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
