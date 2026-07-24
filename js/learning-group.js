import {
  createRoundState, nextInRound, recordRound, advanceRound,
} from './practice-round.js';

export const LEARNING_GROUP_SIZE = 20;

export function buildLearningGroup(ids, leitner, opts = {}) {
  const size = opts.size ?? LEARNING_GROUP_SIZE;
  const shuffle = opts.shuffle ?? ((items) => items);
  const uniqueIds = [...new Set(ids)];
  const candidates = uniqueIds.filter((id) => (leitner.get(id) ?? 1) < 5);
  if (candidates.length === 0) return shuffle(uniqueIds).slice(0, size);
  const current = (opts.current ?? [])
    .filter((id, index, items) => candidates.includes(id) && items.indexOf(id) === index);
  const currentSet = new Set(current);
  const available = candidates.filter((id) => !currentSet.has(id));
  const inProgress = available
    .filter((id) => (leitner.get(id) ?? 1) > 1)
    .sort((a, b) => (leitner.get(b) ?? 1) - (leitner.get(a) ?? 1));
  const fresh = shuffle(available.filter((id) => (leitner.get(id) ?? 1) === 1));
  return [...current, ...inProgress, ...fresh].slice(0, size);
}

export function createLearningScheduler(ids, leitner, opts = {}) {
  const size = opts.size ?? LEARNING_GROUP_SIZE;
  const shuffle = opts.shuffle ?? ((items) => items);
  let active = buildLearningGroup(ids, leitner, { size, shuffle });
  const round = createRoundState(active);

  return {
    next(pickFn) {
      let id = nextInRound(round, pickFn);
      let transition = null;
      if (id === null) {
        if (round.wrong.size === 0) {
          active = buildLearningGroup(ids, leitner, {
            current: active,
            size,
            shuffle,
          });
        }
        transition = advanceRound(round, active, shuffle);
        id = nextInRound(round, pickFn);
      }
      return { id, transition };
    },
    record(id, correct) {
      recordRound(round, id, correct);
    },
    activeIds() {
      return [...active];
    },
  };
}
