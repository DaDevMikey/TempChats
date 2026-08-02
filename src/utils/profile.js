import { db } from '../firebase';
import { generateDmHandle, rollBetaFlag } from './beta';

// Handles are short and human readable, so collisions are possible — retry a
// few times before falling back to the last generated value.
export async function allocateDmHandle(attempts = 5) {
  for (let i = 0; i < attempts; i += 1) {
    const candidate = generateDmHandle();
    try {
      // eslint-disable-next-line no-await-in-loop
      const snap = await db.collection('users').where('dmHandle', '==', candidate).limit(1).get();
      if (snap.empty) return candidate;
    } catch (err) {
      return candidate;
    }
  }
  return generateDmHandle();
}

export async function createUserProfileFields() {
  return {
    dmHandle: await allocateDmHandle(),
    tags: { beta: rollBetaFlag() }
  };
}

// Backfills the rollout tag and direct-message handle for accounts that were
// created before those fields existed, and returns the freshest user data.
export async function ensureUserProfile(user) {
  if (!user?.uid) return user;

  try {
    const ref = db.collection('users').doc(user.uid);
    const doc = await ref.get();
    if (!doc.exists) return user;

    const data = doc.data() || {};
    const updates = {};

    if (!data.dmHandle) updates.dmHandle = await allocateDmHandle();
    if (!data.tags || typeof data.tags !== 'object') updates.tags = { beta: rollBetaFlag() };

    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
    }

    return {
      ...user,
      username: data.username || user.username,
      dmHandle: updates.dmHandle || data.dmHandle,
      tags: updates.tags || data.tags || {}
    };
  } catch (err) {
    console.error('Profile sync error:', err);
    return user;
  }
}
