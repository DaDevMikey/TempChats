// ==========================================================================
// Gradual feature rollout helpers
// A user is a beta tester when their Firestore user document carries
// `tags.beta === true`. Missing tags (or an empty tag map) mean "not beta".
//
// Enrolment is one-way: the random roll can only ever turn the flag on. Only
// an explicit action by the user (the Settings toggle) can turn it back off,
// and doing so records `tags.betaOptOut` so the roll stops re-enrolling them.
// ==========================================================================

// Share of newly registered users that start out in the beta.
const BETA_SIGNUP_RATE = 0.25;

// Chance of an existing, non-beta user being enrolled on any given app load.
const BETA_REFRESH_RATE = 0.05;

const HANDLE_ADJECTIVES = [
  'swift', 'quiet', 'lunar', 'amber', 'brave', 'cosmic', 'velvet', 'nimble',
  'solar', 'hidden', 'clever', 'silent', 'rapid', 'mellow', 'crimson', 'frosty'
];

const HANDLE_NOUNS = [
  'otter', 'falcon', 'cedar', 'comet', 'ember', 'harbor', 'lynx', 'maple',
  'nebula', 'onyx', 'quartz', 'raven', 'summit', 'tide', 'willow', 'zephyr'
];

const HANDLE_PATTERN = /^[a-z]+-[a-z]+-\d{4}$/;

function randomInt(max) {
  const buf = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
    // Reject the tail of the range so the modulo stays uniform
    const limit = Math.floor(0x100000000 / max) * max;
    let value = buf[0];
    while (value >= limit) {
      globalThis.crypto.getRandomValues(buf);
      value = buf[0];
    }
    return value % max;
  }
  return Math.floor(Math.random() * max);
}

function chance(rate) {
  return randomInt(1000000) / 1000000 < rate;
}

export function isBetaUser(user) {
  return Boolean(user?.tags?.beta);
}

export function hasOptedOutOfBeta(user) {
  return Boolean(user?.tags?.betaOptOut);
}

export function rollSignupBetaFlag() {
  return chance(BETA_SIGNUP_RATE);
}

// Existing users are re-rolled on each load until they win a spot. Users who
// already have the flag, or who explicitly opted out, are never re-rolled.
export function shouldEnrolOnRefresh(tags) {
  if (tags?.beta) return false;
  if (tags?.betaOptOut) return false;
  return chance(BETA_REFRESH_RATE);
}

export function generateDmHandle() {
  const adjective = HANDLE_ADJECTIVES[randomInt(HANDLE_ADJECTIVES.length)];
  const noun = HANDLE_NOUNS[randomInt(HANDLE_NOUNS.length)];
  const digits = String(randomInt(10000)).padStart(4, '0');
  return `${adjective}-${noun}-${digits}`;
}

// Room and thread codes double as encryption secrets, so they come from the
// cryptographic RNG rather than Math.random().
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSecureCode(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function normalizeDmHandle(value) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '');
}

export function isValidDmHandle(value) {
  return HANDLE_PATTERN.test(normalizeDmHandle(value));
}

// Direct threads live in their own collection so security rules can restrict
// them to their two participants without affecting public room queries.
export const DIRECT_THREADS = 'direct_threads';

export const DM_LIFETIME_HOURS = 24;
export const DM_MAX_THREADS = 50;
