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
      <TopAppBar user={user} onLogout={onLogout} onBack={() => onNavigate('home')} title="Create room" onOpenSettings={onOpenSettings} />

      <main className="home-content">
        <form
          className="md-card md-card--elevated"
          onSubmit={handleCreate}
          style={{
            padding: 'clamp(18px, 4vw, 32px)',
            maxWidth: '640px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            borderRadius: 'var(--md-sys-shape-corner-extra-large)'
          }}
        >
          {/* Room Name */}
          <div>
            <h4 className="title-small" style={{ color: 'var(--md-sys-color-primary)', marginBottom: '12px' }}>Room details</h4>
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
                enterKeyHint="done"
                disabled={loading}
                autoFocus
              />
              <label className="md-text-field__label">Room name</label>
            </div>
          </div>

          {/* Room Theme Accent */}
          <div>
            <h4 className="title-small" style={{ color: 'var(--md-sys-color-primary)', marginBottom: '12px' }}>Theme accent</h4>
            <div className="chip-row">
              {themeOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  className={`md-chip ${theme === opt.id ? 'md-chip--selected' : ''}`}
                  onClick={() => setTheme(opt.id)}
                  aria-pressed={theme === opt.id}
                  style={theme === opt.id ? { backgroundColor: opt.color, borderColor: opt.color, color: '#10121f' } : undefined}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: opt.color, display: 'inline-block' }} />
                  <span>{opt.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Private Room Switch */}
          <div className="setting-row">
            <div className="setting-row__text">
              <div className="title-small" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)', fontSize: '20px' }} aria-hidden="true">lock</span>
                <span>Private room</span>
              </div>
              <div className="body-small text-muted" style={{ marginTop: '2px' }}>
                Requires a 6-character code to join. Messages are end-to-end encrypted and lifetimes can be customised.
              </div>
            </div>
            <label className="md-switch">
              <input
                type="checkbox"
                checked={isPrivate}
                aria-label="Private room"
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
              Room lifetime {!isPrivate && <span className="body-small text-muted">(public rooms capped at 24h)</span>}
            </h4>

            <div className="chip-row">
              {durationOptions.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`md-chip ${(!isCustomDuration && duration === opt) ? 'md-chip--selected' : ''}`}
                  aria-pressed={!isCustomDuration && duration === opt}
                  onClick={() => { setDuration(opt); setIsCustomDuration(false); }}
                >
                  {opt} {opt === 1 ? 'hour' : 'hours'}
                </button>
              ))}

              {isPrivate && (
                <button
                  type="button"
                  className={`md-chip ${isCustomDuration ? 'md-chip--selected' : ''}`}
                  aria-pressed={isCustomDuration}
                  onClick={() => setIsCustomDuration(true)}
                >
                  Custom (up to 7 days)
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
                  inputMode="numeric"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  required
                />
                <label className="md-text-field__label">Lifetime in hours (1 to 168)</label>
              </div>
            )}
          </div>

          {/* Moderation */}
          <div>
            <h4 className="title-small" style={{ color: 'var(--md-sys-color-primary)', marginBottom: '12px' }}>
              Content moderation filter
            </h4>
            <select
              className="md-select"
              value={moderation}
              onChange={(e) => setModeration(e.target.value)}
              disabled={loading}
              aria-label="Content moderation filter"
            >
              <option value="minimal">Minimal (slurs & severe hate speech)</option>
              <option value="advanced">Advanced (profanity & severe hate speech)</option>
              {isPrivate && <option value="none">Off / unfiltered (private rooms only)</option>}
            </select>
          </div>

          {/* Read Receipts Switch */}
          <div className="setting-row">
            <div className="setting-row__text">
              <div className="title-small">Read receipts</div>
              <div className="body-small text-muted">Show when users read messages in this room</div>
            </div>
            <label className="md-switch">
              <input
                type="checkbox"
                checked={readReceipts}
                aria-label="Read receipts"
                onChange={(e) => setReadReceipts(e.target.checked)}
                disabled={loading}
              />
              <span className="md-switch__track">
                <span className="md-switch__thumb"></span>
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="md-dialog__actions" style={{ marginTop: '4px' }}>
            <button type="button" className="md-btn md-btn--tonal" onClick={() => onNavigate('home')} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="md-btn md-btn--filled" disabled={loading}>
              {loading ? 'Creating...' : 'Create room'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
