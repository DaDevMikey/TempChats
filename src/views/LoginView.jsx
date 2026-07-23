import React, { useState } from 'react';
import { db, auth } from '../firebase';

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
        const docData = existing.docs[0].data();
        if (docData.authUid !== authUser.uid) {
          showSnackbar('Username is already taken by another user', 'error');
          setLoading(false);
          return;
        }
      }

      // 3. Register user document
      const userRef = await db.collection('users').add({
        username: cleaned,
        authUid: authUser.uid,
        created_at: new Date()
      });

      const userData = {
        username: cleaned,
        uid: userRef.id,
        authUid: authUser.uid
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
        <div>
          <h1 className="login-card__logo" style={{ fontSize: '2.4rem', color: 'var(--md-sys-color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '36px' }}>chat_bubble</span>
            TempChats
          </h1>
          <p className="body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', textAlign: 'center', marginTop: '8px' }}>
            Temporary, self-destructing chat rooms. No email or password needed.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
              disabled={loading}
              autoFocus
            />
            <label className="md-text-field__label">Choose a Username</label>
          </div>

          <button type="submit" className="md-btn md-btn--filled" disabled={loading} style={{ height: '48px' }}>
            {loading ? 'Entering...' : 'Enter TempChats'}
          </button>
        </form>
      </div>
    </div>
  );
}
