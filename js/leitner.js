const MAX_BOX = 5;
const MIN_BOX = 1;

export function createLeitnerState(ids) {
  return new Map(ids.map(id => [id, MIN_BOX]));
}

export function recordAnswer(state, id, correct) {
  const current = state.get(id) ?? MIN_BOX;
  state.set(id, correct ? Math.min(current + 1, MAX_BOX) : MIN_BOX);
}

export function nextQuestionId(state, ids) {
  return ids.reduce((lowest, id) => {
    return state.get(id) < state.get(lowest) ? id : lowest;
  }, ids[0]);
}
