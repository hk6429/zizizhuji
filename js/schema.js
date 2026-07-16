const ZIYIN_TYPES = new Set(['字音', '字形']);
const CHENGYU_TYPES = new Set(['意義', '錯別字', '近似成語', '成語']);
const CHENGYU_SOURCES = new Set(['真題', '自編']);
const LEVELS = new Set(['國小', '國中', '選手']);
const ZIYIN_FORMATS = {
  字音: new Set(['reading', 'reading-alt', 'reading-odd', 'reading-live']),
  字形: new Set(['zixing-blank', 'zixing-pick-wrong', 'zixing-sentence', 'zixing-story', 'zixing-fix']),
};
const CHENGYU_FORMATS = new Set([
  'def-pick', 'idiom-def', 'usage-judge', 'usage-wrong', 'fill-blank',
  'synonym', 'antonym', 'story-blank', 'error-char',
]);

function baseChecks(entry) {
  const errors = [];
  if (!entry.id) errors.push('id is required');
  if (!LEVELS.has(entry.level)) errors.push('level must be "國小", "國中", or "選手"');
  if (!Array.isArray(entry.options) || entry.options.length !== 4) {
    errors.push('options must have exactly 4 entries');
  } else if (entry.options.some((option) => typeof option !== 'string' || option.length === 0) || new Set(entry.options).size !== 4) {
    errors.push('options must be four distinct non-empty strings');
  }
  if (!entry.answer || !Array.isArray(entry.options) || !entry.options.includes(entry.answer)) {
    errors.push('answer must be non-empty and included in options');
  }
  if (!entry.question) errors.push('question is required');
  return errors;
}

function optionalFormatChecks(entry, allowedFormats) {
  const errors = [];
  if (entry.qformat !== undefined) {
    if (typeof entry.qformat !== 'string' || !allowedFormats?.has(entry.qformat)) {
      errors.push('qformat is not allowed for this entry type');
    }
  }
  if (entry.anchor !== undefined) {
    if (!Array.isArray(entry.anchor) || entry.anchor.length === 0 || entry.anchor.some((item) => typeof item !== 'string' || item.length === 0)) {
      errors.push('anchor must be a non-empty string array');
    }
  }
  return errors;
}

export function validateZiyinEntry(entry) {
  const errors = baseChecks(entry);
  if (!ZIYIN_TYPES.has(entry.type)) errors.push('type must be "字音" or "字形"');
  errors.push(...optionalFormatChecks(entry, ZIYIN_FORMATS[entry.type]));
  if (!entry.source) errors.push('source is required');
  // 真題必須附考試年份；自編（國中／選手擴充題）沒有年份，用 origin:'自編' 豁免
  if (entry.origin !== '自編' && !entry.year) errors.push('year is required for 真題');
  return { valid: errors.length === 0, errors };
}

export function validateChengyuEntry(entry) {
  const errors = baseChecks(entry);
  if (!CHENGYU_TYPES.has(entry.type)) errors.push('type must be "意義", "錯別字", "近似成語", or "成語"');
  errors.push(...optionalFormatChecks(entry, CHENGYU_FORMATS));
  if (!CHENGYU_SOURCES.has(entry.source)) errors.push('source must be "真題" or "自編"');
  return { valid: errors.length === 0, errors };
}
