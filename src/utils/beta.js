// ==========================================================================
// Gradual feature rollout helpers
// A user is a beta tester when their Firestore user document carries
// `tags.beta === true`. Missing tags (or an empty tag map) mean "not beta".
// ==========================================================================

// Share of newly registered users that get opted into beta features.
const BETA_ROLLOUT_RATE = 0.25;

const HANDLE_ADJECTIVES = [
  'swift', 'quiet', 'lunar', 'amber', 'brave', 'cosmic', 'velvet', 'nimble',
  'solar', 'hidden', 'clever', 'silent', 'rapid', 'mellow', 'crimson', 'frosty'
];

const HANDLE_NOUNS = [
  'otter', 'falcon', 'cedar', 'comet', 'ember', 'harbor', 'lynx', 'maple',
  'nebula', 'onyx', 'quartz', 'raven', 'summit', 'tide', 'willow', 'zephyr'
];

function randomInt(max) {
  const buf = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function isBetaUser(user) {
  return Boolean(user?.tags?.beta);
}

export function rollBetaFlag() {
  return randomInt(1000) / 1000 < BETA_ROLLOUT_RATE;
}

export function generateDmHandle() {
  const adjective = HANDLE_ADJECTIVES[randomInt(HANDLE_ADJECTIVES.length)];
  const noun = HANDLE_NOUNS[randomInt(HANDLE_NOUNS.length)];
  const digits = String(randomInt(10000)).padStart(4, '0');
  return `${adjective}-${noun}-${digits}`;
}

export function normalizeDmHandle(value) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '');
}

export const DM_LIFETIME_HOURS = 24;
