export const ADVANCED_PLAY_REVEALED_KEY = 'zizhu:advancedPlayRevealed';

export function revealAdvancedPlayOnce(details, storage = globalThis.localStorage) {
  if (!details || !storage || storage.getItem(ADVANCED_PLAY_REVEALED_KEY) === '1') return false;
  details.open = true;
  storage.setItem(ADVANCED_PLAY_REVEALED_KEY, '1');
  return true;
}
