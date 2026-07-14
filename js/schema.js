const ZIYIN_TYPES = new Set(['字音', '字形']);
const CHENGYU_TYPES = new Set(['意義', '錯別字', '近似成語']);
const CHENGYU_SOURCES = new Set(['真題', '自編']);

function baseChecks(entry) {
  const errors = [];
  if (!entry.id) errors.push('id is required');
  if (entry.level !== '國小') errors.push('level must be "國小" for P1');
  if (!Array.isArray(entry.options) || entry.options.length !== 4) {
    errors.push('options must have exactly 4 entries');
  }
  if (!entry.answer || !Array.isArray(entry.options) || !entry.options.includes(entry.answer)) {
    errors.push('answer must be non-empty and included in options');
  }
  if (!entry.question) errors.push('question is required');
  return errors;
}

export function validateZiyinEntry(entry) {
  const errors = baseChecks(entry);
  if (!ZIYIN_TYPES.has(entry.type)) errors.push('type must be "字音" or "字形"');
  if (!entry.source) errors.push('source is required');
  if (!entry.year) errors.push('year is required');
  return { valid: errors.length === 0, errors };
}

export function validateChengyuEntry(entry) {
  const errors = baseChecks(entry);
  if (!CHENGYU_TYPES.has(entry.type)) errors.push('type must be "意義", "錯別字", or "近似成語"');
  if (!CHENGYU_SOURCES.has(entry.source)) errors.push('source must be "真題" or "自編"');
  return { valid: errors.length === 0, errors };
}
