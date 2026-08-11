import { db } from '../firebase';
import { generateDmHandle, shouldEnrolOnRefresh } from './beta';

// Reservation documents give usernames and direct-message handles a single,
// unguessable owner: the document id is the name itself, and security rules
// only allow it to be created once. They also let the app look an identity up
// by id instead of querying the users collection, which stays private.
export const USERNAMES = 'usernames';
export const HANDLES = 'handles';

export function usernameKey(username) {
  return String(username || '').trim().toLowerCase();
}

export async function getUsernameOwner(username) {
  const key = usernameKey(username);
  if (!key) return null;
  const doc = await db.collection(USERNAMES).doc(key).get();
  return doc.exists ? doc.data() : null;
}

export async function getHandleOwner(handle) {
  const key = String(handle || '').trim().toLowerCase();
  if (!key) return null;
  const doc = await db.collection(HANDLES).doc(key).get();
  return doc.exists ? doc.data() : null;
}

// Returns true when the name now belongs to this account.
export async function reserveUsername(username, authUid, userId) {
  const key = usernameKey(username);
  const existing = await getUsernameOwner(key);
  if (existing) return existing.authUid === authUid;

  try {
    await db.collection(USERNAMES).doc(key).set({ authUid, userId, username });
    return true;
  } catch (err) {
    const owner = await getUsernameOwner(key);
    return Boolean(owner && owner.authUid === authUid);
  }
}

// Handles are short and human readable, so collisions are possible — claim
// them one at a time until a free one is reserved for this account.
export async function allocateDmHandle(authUid, username, attempts = 6) {
  for (let i = 0; i < attempts; i += 1) {
    const candidate = generateDmHandle();
    try {
      // eslint-disable-next-line no-await-in-loop
      const existing = await db.collection(HANDLES).doc(candidate).get();
      if (existing.exists) continue;
      // eslint-disable-next-line no-await-in-loop
      await db.collection(HANDLES).doc(candidate).set({ authUid, username });
      return candidate;
    } catch (err) {
      // Someone claimed it first — try another one
    }
  }
  return null;
}

// Backfills reservations for older accounts, re-rolls the beta enrolment for
// users who are not in it yet, and returns the freshest profile data. The tag
// update runs in a transaction so it cannot clobber a concurrent opt-out.
export async function ensureUserProfile(user) {
  if (!user?.uid) return user;

  try {
    const ref = db.collection('users').doc(user.uid);
    const doc = await ref.get();
    if (!doc.exists) return user;

    const data = doc.data() || {};
    if (data.authUid !== user.authUid) return user;

    const username = data.username || user.username;
    const owned = await reserveUsername(username, user.authUid, user.uid);
    if (!owned) return { ...user, usernameConflict: true };

    let dmHandle = data.dmHandle;
    if (!dmHandle) {
      dmHandle = await allocateDmHandle(user.authUid, username);
      if (dmHandle) await ref.update({ dmHandle });
    }

    const tags = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      const freshTags = (fresh.exists && fresh.data().tags && typeof fresh.data().tags === 'object')
        ? fresh.data().tags
        : null;

      if (freshTags && !shouldEnrolOnRefresh(freshTags)) return freshTags;

      // Enrolment is one-way — the roll can only ever set the flag to true.
      const nextTags = freshTags ? { ...freshTags, beta: true } : { beta: false };
      tx.update(ref, { tags: nextTags });
      return nextTags;
    });

    return { ...user, username, dmHandle, tags };
  } catch (err) {
    console.error('Profile sync error:', err);
    return user;
  }
}

// Explicit opt-in/opt-out from Settings. Opting out is remembered so the
// random rollout does not immediately re-enrol the user.
export async function setBetaPreference(user, enabled) {
  if (!user?.uid) return user;

  const tags = { ...(user.tags || {}), beta: Boolean(enabled), betaOptOut: !enabled };
  await db.collection('users').doc(user.uid).update({ tags });
  return { ...user, tags };
}

// Frees the reservations held by an account when it is wiped.
export async function releaseIdentity(user) {
  const tasks = [];
  if (user?.username) tasks.push(db.collection(USERNAMES).doc(usernameKey(user.username)).delete());
  if (user?.dmHandle) tasks.push(db.collection(HANDLES).doc(String(user.dmHandle).toLowerCase()).delete());
  await Promise.all(tasks.map((task) => task.catch(() => {})));
}
