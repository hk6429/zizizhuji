CREATE TABLE IF NOT EXISTS saves (
  code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS report_rl (
  ip TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS leaderboard (
  board TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (board, name)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_board_score ON leaderboard(board, score DESC);

-- ============================================================
-- Redis-over-D1 shim 四表（即時對戰 rt: / 融合 fuse: / 市場 mkt: 共用）
-- 每列帶 exp（到期 epoch 毫秒，NULL=永不過期），讀取時惰性過濾過期資料。
-- ============================================================
CREATE TABLE IF NOT EXISTS kv (
  k   TEXT PRIMARY KEY,
  v   TEXT NOT NULL,
  exp INTEGER
);
CREATE TABLE IF NOT EXISTS hash (
  k   TEXT NOT NULL,
  f   TEXT NOT NULL,
  v   TEXT NOT NULL,
  exp INTEGER,
  PRIMARY KEY (k, f)
);
CREATE TABLE IF NOT EXISTS list (
  id  INTEGER PRIMARY KEY AUTOINCREMENT,
  k   TEXT NOT NULL,
  v   TEXT NOT NULL,
  exp INTEGER
);
CREATE INDEX IF NOT EXISTS idx_list_k ON list (k, id);
CREATE TABLE IF NOT EXISTS zset (
  k      TEXT NOT NULL,
  member TEXT NOT NULL,
  score  REAL NOT NULL,
  exp    INTEGER,
  PRIMARY KEY (k, member)
);
CREATE INDEX IF NOT EXISTS idx_zset_score ON zset (k, score);
