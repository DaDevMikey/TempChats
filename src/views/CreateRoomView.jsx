import React, { useState } from 'react';
import { db, firebase } from '../firebase';
import TopAppBar from '../components/TopAppBar';

export default function CreateRoomView({ user, onNavigate, onLogout, showSnackbar, onOpenSettings }) {
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [theme, setTheme] = useState('indigo'); // indigo, emerald, violet, amber, rose
  const [duration, setDuration] = useState(3); // default 3h
  const [customHours, setCustomHours] = useState(48);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [moderation, setModeration] = useState('minimal');
  const [readReceipts, setReadReceipts] = useState(true);
  const [loading, setLoading] = useState(false);

  const durationOptions = [1, 3, 6, 12, 24];
  const themeOptions = [
    { id: 'indigo', name: 'Indigo', color: '#818cf8' },
    { id: 'emerald', name: 'Emerald', color: '#34d399' },
    { id: 'violet', name: 'Violet', color: '#c084fc' },
    { id: 'amber', name: 'Amber', color: '#fbbf24' },
    { id: 'rose', name: 'Rose', color: '#fb7185' }
  ];

  const handleCreate = async (e) => {
    e.preventDefault();
    const cleanName = roomName.trim();
    if (!cleanName) {
      showSnackbar('Room name is required', 'error');
      return;
    }

    const finalDuration = (isPrivate && isCustomDuration) ? Math.min(168, Math.max(1, Number(customHours))) : duration;

    setLoading(true);

    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + finalDuration);
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const newRoomRef = await db.collection('rooms').add({
        name: cleanName,
        creator: user.username,
        authUid: user.authUid,
        theme: theme,
        isPrivate: isPrivate,
        readReceipts: readReceipts,
        moderationLevel: isPrivate ? moderation : (moderation === 'none' ? 'minimal' : moderation),
        durationHours: finalDuration,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        expires_at: firebase.firestore.Timestamp.fromDate(expiresAt),
        code: roomCode,
        latestMessage: ''
      });

      onNavigate(`chat/${newRoomRef.id}`);
    } catch (err) {
      console.error('Create room error:', err);
      showSnackbar('Failed to create room. Please try again.', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="home-layout">
      <TopAppBar user={user} onLogout={onLogout} onBack={() => onNavigate('home')} title="Create Room" onOpenSettings={onOpenSettings} />

      <main className="home-content">
        <form className="md-card md-card--elevated" onSubmit={handleCreate} style={{ padding: '32px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Room Name */}
          <div>
            <h4 className="title-small" style={{ color: 'var(--md-sys-color-primary)', marginBottom: '12px' }}>Room Details</h4>
            <div className="md-text-field">
              <input
                type="text"
                className="md-text-field__input"
                placeholder=" "
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                maxLength={50}
                autoComplete="off"
                disabled={loading}
                autoFocus
              />
              <label className="md-text-field__label">Room Name</label>
            </div>
          </div>

          {/* Room Theme Accent */}
          <div>
            <h4 className="title-small" style={{ color: 'var(--md-sys-color-primary)', marginBottom: '12px' }}>Room Theme Accent</h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {themeOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  className="md-btn"
                  onClick={() => setTheme(opt.id)}
                  style={{
                    backgroundColor: theme === opt.id ? opt.color : 'var(--md-sys-color-surface-container-high)',
                    color: theme === opt.id ? '#000' : 'var(--md-sys-color-on-surface)',
                    fontWeight: 600
                  }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: opt.color, display: 'inline-block' }}></span>
                  <span>{opt.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Private Room Switch */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--md-sys-color-surface-container-high)', padding: '16px 20px', borderRadius: '16px' }}>
            <div>
              <div className="title-small" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }}>lock</span>
                <span>Private Room (Unlocks Encryption & Custom Lifetime)</span>
              </div>
              <div className="body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
                Requires a 6-character code to join. Messages are End-to-End Encrypted.
              </div>
            </div>
            <label className="md-switch">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => {
                  const val = e.target.checked;
                  setIsPrivate(val);
                  if (!val) {
                    setIsCustomDuration(false);
                    if (moderation === 'none') setModeration('minimal');
                  }
                }}
                disabled={loading}
              />
              <span className="md-switch__track">
                <span className="md-switch__thumb"></span>
              </span>
            </label>
          </div>

          {/* Duration */}
          <div>
            <h4 className="title-small" style={{ color: 'var(--md-sys-color-primary)', marginBottom: '12px' }}>
              Room Lifetime {!isPrivate && <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>(Public rooms capped at 24h)</span>}
            </h4>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {durationOptions.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`md-btn ${(!isCustomDuration && duration === opt) ? 'md-btn--filled' : 'md-btn--tonal'}`}
                  onClick={() => { setDuration(opt); setIsCustomDuration(false); }}
                >
                  {opt} {opt === 1 ? 'Hour' : 'Hours'}
                </button>
              ))}

              {isPrivate && (
                <button
                  type="button"
                  className={`md-btn ${isCustomDuration ? 'md-btn--filled' : 'md-btn--tonal'}`}
                  onClick={() => setIsCustomDuration(true)}
                >
                  Custom (Up to 7 Days)
                </button>
              )}
            </div>

            {isPrivate && isCustomDuration && (
              <div className="md-text-field" style={{ marginTop: '16px' }}>
                <input
                  type="number"
                  className="md-text-field__input"
                  placeholder=" "
                  min={1}
                  max={168}
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  required
                />
                <label className="md-text-field__label">Lifetime in Hours (1 to 168)</label>
              </div>
            )}
          </div>

          {/* Moderation */}
          <div>
            <h4 className="title-small" style={{ color: 'var(--md-sys-color-primary)', marginBottom: '12px' }}>
              Content Moderation Filter
            </h4>
            <select
              className="md-select"
              value={moderation}
              onChange={(e) => setModeration(e.target.value)}
              disabled={loading}
            >
              <option value="minimal">Minimal (Filter Slurs & Severe Hate Speech)</option>
              <option value="advanced">Advanced (Filter Profanity & Severe Hate Speech)</option>
              {isPrivate && (
                <option value="none">Off / Unfiltered (Private Room Exclusive)</option>
              )}
            </select>
          </div>

          {/* Read Receipts Switch */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="title-small">Read Receipts</div>
              <div className="body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Show when users read messages in this room
              </div>
            </div>
            <label className="md-switch">
              <input
                type="checkbox"
                checked={readReceipts}
                onChange={(e) => setReadReceipts(e.target.checked)}
                disabled={loading}
              />
              <span className="md-switch__track">
                <span className="md-switch__thumb"></span>
              </span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" className="md-btn md-btn--tonal" onClick={() => onNavigate('home')} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="md-btn md-btn--filled" disabled={loading}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
