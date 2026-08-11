import { db } from '../firebase';
import { generateDmHandle, rollSignupBetaFlag, shouldEnrolOnRefresh } from './beta';

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
    tags: { beta: rollSignupBetaFlag() }
  };
}

// Backfills the direct-message handle for older accounts, re-rolls the beta
// enrolment for users who are not in it yet, and returns the freshest data.
export async function ensureUserProfile(user) {
  if (!user?.uid) return user;

  try {
    const ref = db.collection('users').doc(user.uid);
    const doc = await ref.get();
    if (!doc.exists) return user;

    const data = doc.data() || {};
    if (data.authUid !== user.authUid) return user;

    const tags = (data.tags && typeof data.tags === 'object') ? data.tags : {};
    const updates = {};
    let nextTags = tags;

    if (!data.dmHandle) updates.dmHandle = await allocateDmHandle();

    if (shouldEnrolOnRefresh(tags)) {
      // Enrolment is one-way — the roll can only ever set the flag to true.
      nextTags = { ...tags, beta: true };
      updates.tags = nextTags;
    } else if (!data.tags || typeof data.tags !== 'object') {
      nextTags = { beta: false };
      updates.tags = nextTags;
    }

    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
    }

    return {
      ...user,
      username: data.username || user.username,
      dmHandle: updates.dmHandle || data.dmHandle,
      tags: nextTags
    };
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
