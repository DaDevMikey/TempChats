import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { createUserProfileFields, ensureUserProfile } from '../utils/profile';

export default function LoginView({ onLoginSuccess, showSnackbar }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleaned = username.trim();
    if (!cleaned) return;

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleaned)) {
      showSnackbar('Username must be 3-20 letters, numbers, or underscores', 'error');
      return;
    }

    setLoading(true);

    try {
      // 1. Sign in anonymously
      const cred = await auth.signInAnonymously();
      const authUser = cred.user;

      // 2. Check if username is already claimed by someone else
      const existing = await db.collection('users').where('username', '==', cleaned).get();
      if (!existing.empty) {
        const doc = existing.docs[0];
        const docData = doc.data();
        if (docData.authUid !== authUser.uid) {
          showSnackbar('Username is already taken by another user', 'error');
          setLoading(false);
          return;
        }

        // Same account signing back in — reuse the existing profile
        const restored = await ensureUserProfile({
          username: cleaned,
          uid: doc.id,
          authUid: authUser.uid
        });

        localStorage.setItem('tempchats_user', JSON.stringify(restored));
        onLoginSuccess(restored);
        return;
      }

      // 3. Register user document
      const profileFields = await createUserProfileFields();
      const userRef = await db.collection('users').add({
        username: cleaned,
        authUid: authUser.uid,
        dmHandle: profileFields.dmHandle,
        tags: profileFields.tags,
        created_at: new Date()
      });

      const userData = {
        username: cleaned,
        uid: userRef.id,
        authUid: authUser.uid,
        dmHandle: profileFields.dmHandle,
        tags: profileFields.tags
      };

      localStorage.setItem('tempchats_user', JSON.stringify(userData));
      onLoginSuccess(userData);
    } catch (err) {
      console.error('Login error:', err);
      showSnackbar('Failed to login. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div style={{ textAlign: 'center' }}>
          <div
            className="action-card__icon"
            style={{ margin: '0 auto 16px', width: '64px', height: '64px', borderRadius: '20px' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '34px' }} aria-hidden="true">chat_bubble</span>
          </div>
          <h1 className="display-small" style={{ letterSpacing: '-0.02em' }}>TempChats</h1>
          <p className="body-medium text-muted" style={{ marginTop: '8px' }}>
            Temporary, self-destructing chat rooms. No email or password needed.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="md-text-field">
            <input
              type="text"
              className="md-text-field__input"
              placeholder=" "
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              autoComplete="off"
              inputMode="text"
              enterKeyHint="go"
              disabled={loading}
              autoFocus
            />
            <label className="md-text-field__label">Choose a username</label>
          </div>

          <button type="submit" className="md-btn md-btn--filled" disabled={loading} style={{ minHeight: '54px' }}>
            {loading ? (
              <>
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }} aria-hidden="true">hourglass_top</span>
                <span>Entering...</span>
              </>
            ) : (
              <>
                <span>Enter TempChats</span>
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }} aria-hidden="true">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        <p className="body-small text-muted" style={{ textAlign: 'center' }}>
          3–20 characters — letters, numbers or underscores.
        </p>
      </div>
    </div>
  );
}
