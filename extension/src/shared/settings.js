// Single source of truth for user settings stored in chrome.storage.sync.
// Both the background service worker and the popup read/write through here so
// defaults can never drift between the two.
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_SETTINGS = {
  cardPlacement: 'top',
  cacheTtlMs: DEFAULT_TTL_MS,
  replaceGhLanguages: true,
  silentUntilSuccess: false,
  skipForks: false,
  cardTitle: '',
  // Shows a star-history section in the panel for repos the logged-in
  // GitHub account owns. Only takes effect once logged in (see
  // shared/github-auth.js) — has no visible effect otherwise.
  showStarHistory: true,
};

// Migration marker for the skipForks default change. skipForks shipped as
// `true`, and the popup writes every setting on any change, so existing users
// have `skipForks: true` stored without ever choosing it. Rewriting it once
// here — instead of only flipping the default — is what makes the change reach
// them; users who really want skipping can turn it back on.
const SKIP_FORKS_MIGRATED_KEY = 'skipForksMigratedToDefaultOff';

export async function getSettings() {
  const keys = [...Object.keys(DEFAULT_SETTINGS), SKIP_FORKS_MIGRATED_KEY];
  const stored = await chrome.storage.sync.get(keys);

  if (!(SKIP_FORKS_MIGRATED_KEY in stored)) {
    const updates = { [SKIP_FORKS_MIGRATED_KEY]: true };
    if (stored.skipForks === true) {
      updates.skipForks = false;
      stored.skipForks = false;
    }
    await chrome.storage.sync.set(updates);
  }

  delete stored[SKIP_FORKS_MIGRATED_KEY];
  return { ...DEFAULT_SETTINGS, ...stored };
}
