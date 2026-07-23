// app.js

// --- Firebase Setup ---
if (!window.firebaseConfig) {
    console.error("Firebase config is missing.");
}
const app = firebase.initializeApp(window.firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- State Management ---
const state = {
  user: null,        // { username, uid, authUid }
  currentRoom: null, // room data object
  messages: [],      // message array
  publicRooms: [],   // public room array
  typingUsers: new Set(),
  unsubscribers: [], // Firestore listener cleanup
  replyTo: null,     // message object currently being replied to
};

// --- Helpers: DOM & Utility ---
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') el.className = value;
    else if (key === 'onclick' || key === 'onsubmit' || key === 'oninput' || key === 'onchange' || key === 'onkeydown') el[key] = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'htmlFor') el.htmlFor = value;
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let snackbarTimeout;
function showSnackbar(message, type = 'info') {
  const existing = document.querySelector('.md-snackbar');
  if (existing) existing.remove();
  clearTimeout(snackbarTimeout);
  
  const snackbar = h('div', { className: `md-snackbar md-snackbar--${type}` },
    h('span', { className: 'material-symbols-rounded' }, type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info'),
    h('span', {}, message)
  );
  document.body.appendChild(snackbar);
  requestAnimationFrame(() => snackbar.classList.add('md-snackbar--visible'));
  snackbarTimeout = setTimeout(() => {
    snackbar.classList.remove('md-snackbar--visible');
    setTimeout(() => snackbar.remove(), 300);
  }, 4000);
}

function showDialog({ title, content, confirmText = 'OK', cancelText = 'Cancel', onConfirm, onCancel, showInput = false, inputPlaceholder = '' }) {
  let inputEl = null;
  const actions = [];
  
  if (cancelText) {
      actions.push(h('button', { className: 'md-btn md-btn--text', onclick: () => closeDialog(false) }, cancelText));
  }
  if (confirmText) {
      actions.push(h('button', { className: 'md-btn md-btn--filled', onclick: () => closeDialog(true) }, confirmText));
  }

  const contentNodes = [h('p', {}, content)];
  if (showInput) {
      inputEl = h('input', { type: 'text', className: 'md-text-field__input', placeholder: inputPlaceholder });
      contentNodes.push(h('div', { className: 'md-text-field', style: { marginTop: '1rem' } }, inputEl));
  }

  const dialog = h('div', { className: 'md-dialog' },
    h('div', { className: 'md-dialog__scrim', onclick: () => closeDialog(false) }),
    h('div', { className: 'md-dialog__surface' },
      h('h3', { className: 'md-dialog__title' }, title),
      h('div', { className: 'md-dialog__content' }, ...contentNodes),
      h('div', { className: 'md-dialog__actions' }, ...actions)
    )
  );

  document.body.appendChild(dialog);
  requestAnimationFrame(() => dialog.classList.add('md-dialog--open'));
  
  if (showInput && inputEl) {
      setTimeout(() => inputEl.focus(), 100);
  }

  function closeDialog(isConfirm) {
    dialog.classList.remove('md-dialog--open');
    setTimeout(() => {
        dialog.remove();
        if (isConfirm && onConfirm) onConfirm(showInput ? inputEl.value : null);
        else if (!isConfirm && onCancel) onCancel();
    }, 200);
  }
}

function formatTimeLeft(expiryDate) {
  const now = new Date();
  const diff = expiryDate.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return 'Expiring soon';
}

let lastMessageTime = 0;
const MESSAGE_COOLDOWN = 1000;
function canSendMessage() {
  const now = Date.now();
  if (now - lastMessageTime < MESSAGE_COOLDOWN) return false;
  lastMessageTime = now;
  return true;
}

function isValidUsername(name) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(name);
}

function moderateContent(text, level) {
  const minimalPatterns = [
    /n[i1!]gg[e3]r/gi,
    /k[i1!]k[e3]/gi,
    /f[a@]gg?[o0]t/gi,
  ];
  const advancedPatterns = [
    /f[u\*\@]ck/gi,
    /sh[i1!]t/gi,
    /b[i1!]tch/gi,
    /d[i1!]ck/gi,
    /[a@]ss(?:hole)?/gi,
  ];
  let result = text;
  minimalPatterns.forEach(p => result = result.replace(p, '***'));
  if (level === 'advanced') {
    advancedPatterns.forEach(p => result = result.replace(p, '***'));
  }
  return result;
}

function animateStagger(container) {
  const items = container.querySelectorAll('.stagger-item');
  items.forEach((item, i) => {
    setTimeout(() => item.classList.add('stagger-item--visible'), i * 60);
  });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showSnackbar('Copied to clipboard', 'success');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showSnackbar('Failed to copy', 'error');
    });
}

// --- Firebase Auth ---
async function signInAnonymously() {
  try {
    const credential = await auth.signInAnonymously();
    return credential.user;
  } catch (error) {
    console.error('Auth error:', error);
    showSnackbar('Authentication failed', 'error');
    return null;
  }
}

function handleLogout() {
  showDialog({
    title: 'Delete Account?',
    content: 'Are you sure you want to log out? This will permanently delete your account and your abandoned chats.',
    confirmText: 'Delete & Logout',
    cancelText: 'Cancel',
    onConfirm: async () => {
      try {
        if (state.user) {
          const batch = db.batch();
          
          // Find all rooms created by this user
          const userRooms = await db.collection('rooms').where('creator', '==', state.user.username).get();
          
          for (const doc of userRooms.docs) {
              const roomId = doc.id;
              // Check for active chatters in this room's typing collection
              const typingUsers = await db.collection('rooms').doc(roomId).collection('typing').get();
              
              let newOwnerUsername = null;
              for (const tDoc of typingUsers.docs) {
                  if (tDoc.id !== state.user.username) {
                      newOwnerUsername = tDoc.id;
                      break;
                  }
              }
              
              if (!newOwnerUsername) {
                  // Fallback: check latest messages
                  const recentMsgs = await db.collection('messages')
                      .where('room_id', '==', roomId)
                      .orderBy('created_at', 'desc')
                      .limit(5).get();
                  for (const mDoc of recentMsgs.docs) {
                      const msgSender = mDoc.data().sender;
                      if (msgSender !== state.user.username) {
                          newOwnerUsername = msgSender;
                          break;
                      }
                  }
              }
              
              if (newOwnerUsername) {
                  // Find the new owner's authUid
                  const newOwnerQuery = await db.collection('users').where('username', '==', newOwnerUsername).limit(1).get();
                  if (!newOwnerQuery.empty) {
                      const newOwnerData = newOwnerQuery.docs[0].data();
                      batch.update(doc.ref, {
                          creator: newOwnerUsername,
                          authUid: newOwnerData.authUid
                      });
                  } else {
                      // New owner deleted account or not found, delete room
                      batch.delete(doc.ref);
                  }
              } else {
                  // No active chatters, delete room
                  batch.delete(doc.ref);
              }
          }

          // Delete all messages sent by THIS user globally
          const userMessages = await db.collection('messages').where('sender', '==', state.user.username).get();
          userMessages.forEach(mDoc => batch.delete(mDoc.ref));

          // Delete user document
          if (state.user.uid) {
              batch.delete(db.collection('users').doc(state.user.uid));
          }
          await batch.commit();
        }
        
        // Delete auth account
        const currentUser = auth.currentUser;
        if (currentUser) {
            await currentUser.delete();
        } else {
            await auth.signOut();
        }
        
        localStorage.removeItem('tempchats_user');
        state.user = null;
        state.currentRoom = null;
        state.messages = [];
        state.publicRooms = [];
        navigate('login');
        showSnackbar('Account successfully deleted and logged out.', 'success');
      } catch (error) {
        console.error('Logout error:', error);
        showSnackbar('Error during logout/deletion.', 'error');
      }
    }
  });
}

// --- Expiration Cleanup ---
function setupExpirationCleanup() {
  setInterval(async () => {
    try {
      const now = firebase.firestore.Timestamp.now();
      const expired = await db.collection('rooms').where('expires_at', '<=', now).get();
      if (expired.empty) return;
      const batch = db.batch();
      const roomIds = [];
      expired.forEach(doc => { roomIds.push(doc.id); batch.delete(doc.ref); });
      
      for (let i = 0; i < roomIds.length; i += 30) {
        const chunk = roomIds.slice(i, i + 30);
        const msgs = await db.collection('messages').where('room_id', 'in', chunk).get();
        msgs.forEach(doc => batch.delete(doc.ref));
      }
      await batch.commit();
    } catch (e) { console.error('Cleanup error:', e); }
  }, 60000);
}

// --- Router ---
function navigate(hash) {
  window.location.hash = hash;
}

function getRoute() {
  const hash = window.location.hash.slice(1) || 'login';
  const parts = hash.split('/');
  return { view: parts[0], param: parts[1] };
}

window.addEventListener('hashchange', () => render());

// --- Views ---

// 1. Login View
function renderLogin(appEl) {
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        const usernameInput = e.target.elements.username.value.trim();
        if (!isValidUsername(usernameInput)) {
            showSnackbar('Username must be 3-20 alphanumeric characters.', 'error');
            return;
        }

        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Joining...';

        try {
                const authUser = await signInAnonymously();
                if (!authUser) throw new Error('Auth failed');

                // Check if username taken
                const userDoc = await db.collection('users').where('username', '==', usernameInput).get();
                if (!userDoc.empty) {
                    showSnackbar('Username is already taken.', 'error');
                    btn.disabled = false;
                    btn.textContent = 'Start Chatting';
                    return;
                }

            const newUserRef = await db.collection('users').add({
                username: usernameInput,
                authUid: authUser.uid,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });

            state.user = {
                username: usernameInput,
                uid: newUserRef.id,
                authUid: authUser.uid
            };
            localStorage.setItem('tempchats_user', JSON.stringify(state.user));
            navigate('home');
        } catch (error) {
            console.error('Login error', error);
            showSnackbar('An error occurred during login.', 'error');
            btn.disabled = false;
            btn.textContent = 'Start Chatting';
        }
    };

    const loginView = h('div', { className: 'login-screen animated-bg view flex-view view--active' },
        h('form', { className: 'login-card', onsubmit: handleLoginSubmit },
            h('div', { className: 'login-card__logo' },
                h('span', { className: 'material-symbols-rounded' }, 'chat_bubble'),
                'TempChats'
            ),
            h('div', { className: 'login-card__subtitle' }, 'Secure temporary chat rooms'),
            h('div', { className: 'md-text-field' },
                h('input', { type: 'text', name: 'username', id: 'login-username', className: 'md-text-field__input', placeholder: ' ', required: true, autocomplete: 'off' }),
                h('label', { className: 'md-text-field__label', htmlFor: 'login-username' }, 'Choose a username')
            ),
            h('button', { type: 'submit', className: 'md-btn md-btn--filled' }, 'Start Chatting')
        )
    );
    appEl.appendChild(loginView);
}

// 2. Home View
function renderHome(appEl) {
    let searchTimeout;
    
    const handleJoinWithCode = () => {
        showDialog({
            title: 'Join Room',
            content: 'Enter the room code to join:',
            showInput: true,
            inputPlaceholder: 'Room code...',
            confirmText: 'Join',
            onConfirm: async (code) => {
                if (!code || !code.trim()) return;
                try {
                    const roomQuery = await db.collection('rooms').where('code', '==', code.trim()).get();
                    if (roomQuery.empty) {
                        showSnackbar('Room not found or expired', 'error');
                    } else {
                        navigate(`chat/${roomQuery.docs[0].id}`);
                    }
                } catch (e) {
                    console.error('Join room error', e);
                    showSnackbar('Error joining room', 'error');
                }
            }
        });
    };

    const handleSearch = (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.toLowerCase();
        searchTimeout = setTimeout(() => {
            const roomCards = document.querySelectorAll('.room-card');
            let visibleCount = 0;
            roomCards.forEach(card => {
                const title = card.querySelector('.room-card__title').textContent.toLowerCase();
                if (title.includes(query)) {
                    card.style.display = 'flex';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
            const emptyState = document.getElementById('home-empty-state');
            if (emptyState) {
                emptyState.style.display = visibleCount === 0 && state.publicRooms.length > 0 ? 'flex' : 'none';
            }
        }, 300);
    };

    const roomsContainer = h('div', { className: 'rooms-grid' });
    const emptyState = h('div', { className: 'empty-state', id: 'home-empty-state', style: { display: 'none' } },
        h('span', { className: 'material-symbols-rounded empty-state__icon' }, 'forum'),
        h('div', { className: 'empty-state__title' }, 'No rooms found'),
        h('div', { className: 'empty-state__subtitle' }, 'Try a different search or create a new room.')
    );

    const updateRoomsList = (rooms) => {
        roomsContainer.innerHTML = '';
        if (rooms.length === 0) {
            emptyState.style.display = 'flex';
            emptyState.querySelector('.empty-state__title').textContent = 'No public rooms';
            emptyState.querySelector('.empty-state__subtitle').textContent = 'Be the first to create one!';
        } else {
            emptyState.style.display = 'none';
            rooms.forEach(room => {
                const isUrgent = room.expires_at && (room.expires_at.toDate().getTime() - Date.now() < 30 * 60000);
                const card = h('div', { className: 'room-card md-card md-card--elevated stagger-item' },
                    h('div', { className: 'room-card__header' },
                        h('div', { className: 'room-card__title' }, room.name),
                        h('div', { className: `room-card__badge countdown-badge ${isUrgent ? 'countdown-badge--urgent' : ''}` }, 
                            h('span', { className: 'material-symbols-rounded' }, 'timer'),
                            room.expires_at ? formatTimeLeft(room.expires_at.toDate()) : 'Unknown'
                        )
                    ),
                    h('div', { className: 'room-card__meta' },
                        h('span', { className: 'room-card__meta-item' },
                            h('span', { className: 'material-symbols-rounded' }, 'person'),
                            room.creator
                        )
                    ),
                    room.latestMessage ? h('div', { className: 'room-card__preview truncate' }, `${room.latestMessage}`) : null,
                    h('button', { className: 'md-btn md-btn--tonal room-card__action', onclick: () => navigate(`chat/${room.id}`) }, 'Join')
                );
                roomsContainer.appendChild(card);
            });
            animateStagger(roomsContainer);
        }
    };

    const showPrivacyModal = () => {
        showDialog({
            title: 'Privacy & Terms',
            content: h('div', { className: 'privacy-modal-content' },
                h('p', {}, 'Welcome to TempChats! We believe in giving you full control over your privacy.'),
                h('h3', {}, 'No Personal Data'),
                h('p', {}, 'We do not collect names, emails, or phone numbers. Your session is tied only to your current browser and will be destroyed when you log out.'),
                h('h3', {}, 'Cookies & Tracking'),
                h('p', {}, 'We use LocalStorage solely to keep you logged in. We do not use third-party tracking cookies or sell your activity.'),
                h('h3', {}, 'Safety & Monitoring'),
                h('p', {}, 'To keep the platform safe, public rooms are monitored for dangerous content. Our system uses automated filters, and we reserve the right to review messages if they are reported for violating our safety guidelines.'),
                h('h3', {}, 'Your Control'),
                h('p', {}, 'You can delete your own messages at any time. When a room expires, all messages are permanently wiped from our servers.')
            ),
            confirmText: 'I Understand',
            onConfirm: () => {}
        });
    };

    const homeView = h('div', { className: 'home-layout view view--active' },
        h('header', { className: 'chat-header top-app-bar' },
            h('div', { className: 'top-app-bar__title' },
                h('span', { className: 'material-symbols-rounded' }, 'chat_bubble'),
                'TempChats'
            ),
            h('div', { className: 'top-app-bar__actions' },
                h('div', { className: 'user-avatar' }, state.user.username.charAt(0).toUpperCase()),
                h('span', {}, state.user.username),
                h('button', { className: 'md-btn md-btn--icon', onclick: handleLogout, title: 'Logout' },
                    h('span', { className: 'material-symbols-rounded' }, 'logout')
                )
            )
        ),
        h('main', { className: 'home-content' },
            // Privacy Banner
            (!localStorage.getItem('privacy_dismissed_v2')) ? h('div', { className: 'privacy-banner md-card md-card--outlined', id: 'privacy-banner', style: { flexDirection: 'column', alignItems: 'flex-start' } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' } },
                    h('div', { className: 'flex-center', style: { fontWeight: 'bold' } },
                        h('span', { className: 'material-symbols-rounded', style: { marginRight: '8px' } }, 'shield_lock'),
                        'Your Privacy Matters'
                    ),
                    h('button', { className: 'md-btn md-btn--icon', onclick: (e) => {
                        e.target.closest('.privacy-banner').remove();
                        localStorage.setItem('privacy_dismissed_v2', 'true');
                    } }, h('span', { className: 'material-symbols-rounded' }, 'close'))
                ),
                h('div', { style: { marginTop: '8px', fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface-variant)' } },
                    'Chats auto-delete. No personal data collected. We monitor for safety. ',
                    h('a', { href: '#', onclick: (e) => { e.preventDefault(); showPrivacyModal(); }, style: { color: 'var(--md-sys-color-primary)', textDecoration: 'none', fontWeight: 'bold' } }, 'Read Policy')
                )
            ) : null,
            
            // Actions
            h('div', { className: 'home-actions' },
                h('div', { className: 'action-card md-card md-card--elevated stagger-item', onclick: () => navigate('create') },
                    h('span', { className: 'material-symbols-rounded action-card__icon' }, 'add'),
                    h('div', { className: 'action-card__title' }, 'Create Room'),
                    h('div', { className: 'action-card__description' }, 'Start a new temporary chat')
                ),
                h('div', { className: 'action-card md-card md-card--elevated stagger-item', onclick: handleJoinWithCode },
                    h('span', { className: 'material-symbols-rounded action-card__icon' }, 'vpn_key'),
                    h('div', { className: 'action-card__title' }, 'Join with Code'),
                    h('div', { className: 'action-card__description' }, 'Enter a private room code')
                )
            ),

            // Search
            h('div', { className: 'search-bar' },
                h('span', { className: 'material-symbols-rounded search-bar__icon' }, 'search'),
                h('input', { type: 'text', className: 'search-bar__input', placeholder: 'Search rooms...', oninput: handleSearch })
            ),

            h('h2', { style: { marginTop: '2rem', marginBottom: '1rem' } }, 'Public Rooms'),
            roomsContainer,
            emptyState
        )
    );
    
    appEl.appendChild(homeView);
    animateStagger(homeView);

    // Listen to public rooms
    const unsubscribe = db.collection('rooms')
        .where('isPrivate', '==', false)
        .where('expires_at', '>', firebase.firestore.Timestamp.now())
        .onSnapshot(snapshot => {
            state.publicRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateRoomsList(state.publicRooms);
        }, error => {
            console.error('Rooms listener error:', error);
            showSnackbar('Failed to load rooms', 'error');
        });
        
    state.unsubscribers.push(unsubscribe);
}

// 3. Create Room View
function renderCreateRoom(appEl) {
    let selectedDuration = 3; // default 3 hours
    let isPrivate = false;
    let readReceipts = true;
    let moderationLevel = 'minimal';

    const handleCreate = async (e) => {
        e.preventDefault();
        const roomName = e.target.elements.roomName.value.trim();
        if (!roomName) {
            showSnackbar('Room name is required', 'error');
            return;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + selectedDuration);
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            const newRoomRef = await db.collection('rooms').add({
                name: roomName,
                creator: state.user.username,
                authUid: state.user.authUid,
                isPrivate: isPrivate,
                readReceipts: readReceipts,
                moderationLevel: moderationLevel,
                durationHours: selectedDuration,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                expires_at: firebase.firestore.Timestamp.fromDate(expiresAt),
                code: roomCode,
                latestMessage: ''
            });

            navigate(`chat/${newRoomRef.id}`);
        } catch (error) {
            console.error('Create room error:', error);
            showSnackbar('Failed to create room', 'error');
            btn.disabled = false;
            btn.textContent = 'Create Room';
        }
    };

    const durationOptions = [1, 3, 6, 12, 24];
    const durationChipsContainer = h('div', { className: 'duration-chips' });
    
    const updateChips = () => {
        durationChipsContainer.innerHTML = '';
        durationOptions.forEach(dur => {
            const chip = h('div', { 
                className: `md-chip ${selectedDuration === dur ? 'md-chip--selected' : ''}`,
                onclick: () => { selectedDuration = dur; updateChips(); }
            }, `${dur}h`);
            durationChipsContainer.appendChild(chip);
        });
    };
    updateChips();

    const createView = h('div', { className: 'home-layout view view--active' },
        h('header', { className: 'top-app-bar' },
            h('button', { className: 'md-btn md-btn--icon', onclick: () => navigate('home') },
                h('span', { className: 'material-symbols-rounded' }, 'arrow_back')
            ),
            h('div', { className: 'top-app-bar__title' }, 'Create Room'),
            h('div', { className: 'top-app-bar__actions' })
        ),
        h('main', { className: 'home-content' },
            h('form', { className: 'create-room-form md-card md-card--elevated', onsubmit: handleCreate },
                h('div', { className: 'form-section' },
                    h('div', { className: 'form-section__title' }, 'Room Details'),
                    h('div', { className: 'md-text-field' },
                        h('input', { type: 'text', name: 'roomName', id: 'create-name', className: 'md-text-field__input', placeholder: ' ', required: true, maxLength: 50, autocomplete: 'off' }),
                        h('label', { className: 'md-text-field__label', htmlFor: 'create-name' }, 'Room Name')
                    )
                ),
                h('div', { className: 'form-section' },
                    h('div', { className: 'form-section__title' }, 'Duration'),
                    durationChipsContainer
                ),
                h('div', { className: 'form-section' },
                    h('div', { className: 'form-section__title' }, 'Moderation Level'),
                    h('select', { className: 'md-select', onchange: (e) => moderationLevel = e.target.value },
                        h('option', { value: 'minimal' }, 'Minimal (Slurs)'),
                        h('option', { value: 'advanced' }, 'Advanced (Profanity)')
                    )
                ),
                h('div', { className: 'form-section form-row' },
                    h('div', {},
                        h('div', { style: { fontWeight: '500' } }, 'Private Room'),
                        h('div', { style: { fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' } }, 'Requires code to join')
                    ),
                    h('label', { className: 'md-switch' },
                        h('input', { type: 'checkbox', onchange: (e) => isPrivate = e.target.checked }),
                        h('span', { className: 'md-switch__track' },
                            h('span', { className: 'md-switch__thumb' })
                        )
                    )
                ),
                h('div', { className: 'form-section form-row' },
                    h('div', {},
                        h('div', { style: { fontWeight: '500' } }, 'Read Receipts'),
                        h('div', { style: { fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' } }, 'Show who has read messages')
                    ),
                    h('label', { className: 'md-switch' },
                        h('input', { type: 'checkbox', checked: true, onchange: (e) => readReceipts = e.target.checked }),
                        h('span', { className: 'md-switch__track' },
                            h('span', { className: 'md-switch__thumb' })
                        )
                    )
                ),
                h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' } },
                    h('button', { type: 'button', className: 'md-btn md-btn--tonal', onclick: () => navigate('home') }, 'Cancel'),
                    h('button', { type: 'submit', className: 'md-btn md-btn--filled' }, 'Create Room')
                )
            )
        )
    );
    appEl.appendChild(createView);
}

// 4. Chat Room View
function renderChatRoom(appEl, roomId) {
    if (!roomId) {
        navigate('home');
        return;
    }

    const messagesContainer = h('div', { className: 'chat-messages' });
    const typingIndicatorContainer = h('div', { className: 'typing-indicator', style: { display: 'none' } },
        h('div', { className: 'typing-dot' }),
        h('div', { className: 'typing-dot' }),
        h('div', { className: 'typing-dot' }),
        h('span', { style: { marginLeft: '8px', fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' } }, 'Someone is typing...')
    );
    
    let isScrolledToBottom = true;
    messagesContainer.addEventListener('scroll', () => {
        isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 20;
    });

    const scrollToBottom = (force = false) => {
        if (force || isScrolledToBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    };

    const headerTitle = h('div', { className: 'top-app-bar__title truncate' }, 'Loading...');
    const headerCode = h('div', { className: 'room-code-chip', style: { display: 'none' }, onclick: () => copyToClipboard(state.currentRoom?.code) });
    const headerTime = h('div', { className: 'countdown-badge' }, h('span', { className: 'material-symbols-rounded' }, 'timer'), h('span', { id: 'chat-time-left' }, '...'));

    const replyPreviewArea = h('div', { className: 'chat-reply-preview', style: { display: 'none' } });

    const clearReply = () => {
        state.replyTo = null;
        replyPreviewArea.style.display = 'none';
        replyPreviewArea.innerHTML = '';
    };

    const setReply = (msg) => {
        state.replyTo = msg;
        replyPreviewArea.innerHTML = '';
        replyPreviewArea.appendChild(
            h('div', { style: { flex: 1, overflow: 'hidden' } },
                h('div', { style: { fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--md-sys-color-primary)' } }, `Replying to ${msg.sender}`),
                h('div', { className: 'truncate', style: { fontSize: '0.9rem' } }, msg.content)
            )
        );
        replyPreviewArea.appendChild(
            h('button', { className: 'md-btn md-btn--icon', onclick: clearReply },
                h('span', { className: 'material-symbols-rounded' }, 'close')
            )
        );
        replyPreviewArea.style.display = 'flex';
        document.getElementById('chat-input').focus();
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!state.currentRoom) return;
        if (!canSendMessage()) {
            showSnackbar('Please wait before sending another message', 'error');
            return;
        }

        const input = document.getElementById('chat-input');
        const content = input.value.trim();
        if (!content) return;

        input.value = '';
        input.focus();
        
        // update typing indicator (clear it)
        db.collection('rooms').doc(roomId).collection('typing').doc(state.user.username).delete().catch(()=>console.log("Typing clear err"));

        const moderatedContent = moderateContent(content, state.currentRoom.moderationLevel);
        
        const messageData = {
            room_id: roomId,
            sender: state.user.username,
            content: moderatedContent,
            authUid: state.user.authUid,
            expires_at: state.currentRoom.expires_at,
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
        };

        if (state.replyTo) {
            messageData.reply_to = {
                id: state.replyTo.id,
                sender: state.replyTo.sender,
                content: state.replyTo.content
            };
            clearReply();
        }

        try {
            await db.collection('messages').add(messageData);
            await db.collection('rooms').doc(roomId).update({
                latestMessage: moderatedContent,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Send message error:', error);
            showSnackbar('Failed to send message', 'error');
            input.value = content; // restore
        }
    };

    let typingTimeout;
    let isTyping = false;
    const handleInput = (e) => {
        const val = e.target.value.trim();
        if (val.length > 0) {
            if (!isTyping) {
                isTyping = true;
                db.collection('rooms').doc(roomId).collection('typing').doc(state.user.username).set({
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(e => console.log(e));
            }
            
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                isTyping = false;
                db.collection('rooms').doc(roomId).collection('typing').doc(state.user.username).delete().catch(e => console.log(e));
            }, 3000);
        }
    };

    const deleteMessage = async (msgId) => {
        if (!confirm('Delete this message permanently?')) return;
        try {
            await db.collection('messages').doc(msgId).delete();
        } catch (error) {
            console.error('Delete error', error);
            showSnackbar('Failed to delete message', 'error');
        }
    };

    const editMessage = async (msg) => {
        showDialog({
            title: 'Edit Message',
            content: 'Modify your message:',
            showInput: true,
            inputPlaceholder: 'New message...',
            inputValue: msg.content,
            confirmText: 'Save',
            onConfirm: async (newContent) => {
                if (!newContent || !newContent.trim() || newContent.trim() === msg.content) return;
                try {
                    const moderated = moderateContent(newContent.trim(), state.currentRoom.moderationLevel);
                    await db.collection('messages').doc(msg.id).update({
                        content: moderated,
                        edited: true
                    });
                } catch (e) {
                    console.error('Edit error', e);
                    showSnackbar('Failed to edit message', 'error');
                }
            }
        });
    };

    const readReceiptsContainer = h('div', { className: 'message-read-receipts', style: { display: 'none' } });

    const chatView = h('div', { className: 'chat-layout view flex-view view--active' },
        h('header', { className: 'chat-header top-app-bar' },
            h('button', { className: 'md-btn md-btn--icon', onclick: () => navigate('home') },
                h('span', { className: 'material-symbols-rounded' }, 'arrow_back')
            ),
            h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingLeft: '8px' } },
                headerTitle,
                headerCode
            ),
            h('div', { className: 'top-app-bar__actions' }, headerTime)
        ),
        h('main', { style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' } },
            messagesContainer,
            readReceiptsContainer,
            typingIndicatorContainer
        ),
        h('div', { className: 'chat-input-area' },
            replyPreviewArea,
            h('form', { className: 'chat-input-bar', onsubmit: handleSend },
                h('input', { type: 'text', id: 'chat-input', className: 'chat-input-bar__input', placeholder: 'Type a message...', oninput: handleInput, autoComplete: 'off' }),
                h('button', { type: 'submit', className: 'md-btn md-fab', title: 'Send' },
                    h('span', { className: 'material-symbols-rounded' }, 'send')
                )
            )
        )
    );
    appEl.appendChild(chatView);

    // 1. Listen to Room Data
    const roomUnsub = db.collection('rooms').doc(roomId).onSnapshot(doc => {
        if (!doc.exists) {
            showSnackbar('Room has been deleted or expired', 'error');
            navigate('home');
            return;
        }
        state.currentRoom = { id: doc.id, ...doc.data() };
        headerTitle.textContent = state.currentRoom.name;
        headerCode.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px;margin-right:4px;">content_copy</span>Code: ${state.currentRoom.code}`;
        headerCode.style.display = state.currentRoom.isPrivate ? 'inline-flex' : 'none';
        
        if (state.currentRoom.expires_at) {
            const isUrgent = (state.currentRoom.expires_at.toDate().getTime() - Date.now() < 30 * 60000);
            if (isUrgent) headerTime.classList.add('countdown-badge--urgent');
            document.getElementById('chat-time-left').textContent = formatTimeLeft(state.currentRoom.expires_at.toDate());
        }
    }, err => {
        console.error('Room error', err);
        showSnackbar('Error loading room', 'error');
    });
    state.unsubscribers.push(roomUnsub);

    // Update time interval
    const timeInterval = setInterval(() => {
        if (state.currentRoom && state.currentRoom.expires_at) {
            const text = formatTimeLeft(state.currentRoom.expires_at.toDate());
            const el = document.getElementById('chat-time-left');
            if (el) el.textContent = text;
            if (text === 'Expired') {
                showSnackbar('Room expired', 'error');
                navigate('home');
            }
        }
    }, 60000);
    state.unsubscribers.push(() => clearInterval(timeInterval));

    // 2. Listen to Messages
    const msgsUnsub = db.collection('messages')
        .where('room_id', '==', roomId)
        .orderBy('created_at', 'asc')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const msg = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added') {
                    state.messages.push(msg);
                    
                    const isOwn = msg.sender === state.user.username;
                    const prevMsg = state.messages[state.messages.length - 2];
                    const isContinuation = prevMsg && prevMsg.sender === msg.sender;
                    
                    const timeStr = msg.created_at ? msg.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    
                    const contentWrap = h('div', { className: 'message__content' }, sanitize(msg.content));
                    if (msg.edited) contentWrap.appendChild(h('span', { className: 'message-edited-badge' }, '(edited)'));

                    const messageEl = h('div', { id: `msg-${msg.id}`, className: `message ${isOwn ? 'message--own' : 'message--other'} ${isContinuation ? 'message--continuation' : ''} message--entering` },
                        h('div', { className: 'message__bubble' },
                            (!isOwn && !isContinuation) ? h('div', { className: 'message__sender' }, msg.sender) : null,
                            msg.reply_to ? h('div', { className: 'message__reply' },
                                h('div', { className: 'message__reply-sender' }, msg.reply_to.sender),
                                h('div', { className: 'truncate', style: { fontSize: '0.85rem' } }, msg.reply_to.content)
                            ) : null,
                            contentWrap,
                            h('div', { className: 'message__time' }, timeStr)
                        ),
                        h('div', { className: 'message__actions' },
                            h('button', { className: 'md-btn md-btn--icon', onclick: () => setReply(msg), title: 'Reply' },
                                h('span', { className: 'material-symbols-rounded', style: { fontSize: '18px' } }, 'reply')
                            ),
                            isOwn ? h('button', { className: 'md-btn md-btn--icon', onclick: () => editMessage(msg), title: 'Edit' },
                                h('span', { className: 'material-symbols-rounded', style: { fontSize: '18px' } }, 'edit')
                            ) : null,
                            isOwn ? h('button', { className: 'md-btn md-btn--icon', onclick: () => deleteMessage(msg.id), title: 'Delete' },
                                h('span', { className: 'material-symbols-rounded', style: { fontSize: '18px' } }, 'delete')
                            ) : null
                        )
                    );
                    
                    messageEl.addEventListener('animationend', () => messageEl.classList.remove('message--entering'), { once: true });
                    messagesContainer.appendChild(messageEl);
                    scrollToBottom(isOwn);
                } else if (change.type === 'modified') {
                    const el = document.getElementById(`msg-${msg.id}`);
                    if (el) {
                        const contentEl = el.querySelector('.message__content');
                        contentEl.innerHTML = sanitize(msg.content);
                        if (msg.edited) {
                            contentEl.appendChild(h('span', { className: 'message-edited-badge' }, '(edited)'));
                        }
                    }
                    const idx = state.messages.findIndex(m => m.id === msg.id);
                    if (idx !== -1) state.messages[idx] = msg;
                } else if (change.type === 'removed') {
                    const el = document.getElementById(`msg-${msg.id}`);
                    if (el) el.remove();
                    state.messages = state.messages.filter(m => m.id !== msg.id);
                }
            });
            scrollToBottom();
            
            if (state.currentRoom && state.currentRoom.readReceipts && isScrolledToBottom) {
                db.collection('rooms').doc(roomId).collection('read_receipts').doc(state.user.username).set({
                    timestamp: Date.now()
                }).catch(e => console.log('Receipt err', e));
            }
        }, err => console.error('Messages error', err));
    state.unsubscribers.push(msgsUnsub);

    // 2.5 Listen to Read Receipts
    messagesContainer.addEventListener('scroll', () => {
        if (state.currentRoom && state.currentRoom.readReceipts && isScrolledToBottom) {
            db.collection('rooms').doc(roomId).collection('read_receipts').doc(state.user.username).set({
                timestamp: Date.now()
            }).catch(e => console.log('Receipt err', e));
        }
    });

    const receiptsUnsub = db.collection('rooms').doc(roomId).collection('read_receipts').onSnapshot(snapshot => {
        if (!state.currentRoom || !state.currentRoom.readReceipts) return;
        const readers = [];
        snapshot.docs.forEach(doc => {
            if (doc.id !== state.user.username) {
                readers.push(doc.id);
            }
        });
        if (readers.length > 0) {
            readReceiptsContainer.textContent = `Seen by ${readers.join(', ')}`;
            readReceiptsContainer.style.display = 'block';
        } else {
            readReceiptsContainer.style.display = 'none';
        }
    });
    state.unsubscribers.push(receiptsUnsub);

    // 3. Listen to Typing
    const typingUnsub = db.collection('rooms').doc(roomId).collection('typing').onSnapshot(snapshot => {
        state.typingUsers.clear();
        snapshot.docs.forEach(doc => {
            if (doc.id !== state.user.username) {
                // Check if recently updated (within 5s)
                const data = doc.data();
                if (data.updated_at && (Date.now() - data.updated_at.toDate().getTime() < 5000)) {
                    state.typingUsers.add(doc.id);
                }
            }
        });
        
        typingIndicatorContainer.style.display = state.typingUsers.size > 0 ? 'flex' : 'none';
        if (state.typingUsers.size > 0) {
            const typistSpan = typingIndicatorContainer.querySelector('span');
            const typists = Array.from(state.typingUsers);
            if (typists.length === 1) typistSpan.textContent = `${typists[0]} is typing...`;
            else typistSpan.textContent = `${typists.length} people are typing...`;
            scrollToBottom();
        }
    });
    state.unsubscribers.push(typingUnsub);
}

// --- Main Initialization ---
function render() {
  const route = getRoute();
  const appEl = document.getElementById('app');
  
  state.unsubscribers.forEach(fn => fn());
  state.unsubscribers = [];
  state.messages = []; // reset messages for new room
  
  if (route.view !== 'login' && !state.user) {
    navigate('login');
    return;
  }
  
  appEl.innerHTML = '';
  
  switch (route.view) {
    case 'login': renderLogin(appEl); break;
    case 'home': renderHome(appEl); break;
    case 'create': renderCreateRoom(appEl); break;
    case 'chat': renderChatRoom(appEl, route.param); break;
    default: navigate('login');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  let hasRendered = false;
  
  auth.onAuthStateChanged((user) => {
      const saved = localStorage.getItem('tempchats_user');
      
      if (user && saved) {
          try {
              const parsedUser = JSON.parse(saved);
              if (parsedUser.authUid === user.uid) {
                  state.user = parsedUser;
                  if (getRoute().view === 'login') navigate('home');
              } else {
                  // Session rotated or mismatched
                  localStorage.removeItem('tempchats_user');
                  state.user = null;
                  if (getRoute().view !== 'login') navigate('login');
              }
          } catch {
              localStorage.removeItem('tempchats_user');
              state.user = null;
              if (getRoute().view !== 'login') navigate('login');
          }
      } else {
          state.user = null;
          localStorage.removeItem('tempchats_user');
          if (getRoute().view !== 'login') navigate('login');
      }
      
      if (!hasRendered) {
          setupExpirationCleanup();
          render();
          hasRendered = true;
      } else {
          // If auth state changes while app is running, re-render
          render();
      }
  });
});
