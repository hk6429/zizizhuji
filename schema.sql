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
