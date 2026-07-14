import { validateZiyinEntry, validateChengyuEntry } from './schema.js';

const VALIDATORS = {
  ziyin: validateZiyinEntry,
  chengyu: validateChengyuEntry,
};

export function loadQuizBank(rawEntries, kind) {
  const validate = VALIDATORS[kind];
  if (!validate) throw new Error(`unknown kind: ${kind}`);

  const usable = [];
  const rejected = [];
  for (const entry of rawEntries) {
    const result = validate(entry);
    if (result.valid) {
      usable.push(entry);
    } else {
      rejected.push({ entry, errors: result.errors });
    }
  }
  return { usable, rejected };
}
