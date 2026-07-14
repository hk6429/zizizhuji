// 連連看核心：麻將式消除，兩張同組牌（字↔注音）之間存在「轉折 ≤2」的空路徑即可消。
// grid[r][c] = tile 物件或 null（已消/空）。周圍有一圈隱形空邊，路徑可繞出界外。
// 純函式、可測；DOM 與選取互動在 link-ui.js。

export function tilesMatch(a, b) {
  return !!a && !!b && a !== b && a.key === b.key;
}

// 把 n 組配對攤成 2n 張牌（字牌＋注音牌），洗牌後鋪滿 rows×cols 盤面。
// rows*cols 必須等於 2n（呼叫端負責挑合適盤面）。
export function buildLayout(pairs, rows, cols) {
  const tiles = [];
  pairs.forEach((p, i) => {
    tiles.push({ key: `p${i}`, kind: 'char', label: p.char, id: p.id });
    tiles.push({ key: `p${i}`, kind: 'zhuyin', label: p.zhuyin, id: p.id });
  });
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  const grid = [];
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(tiles[k++] ?? null);
    grid.push(row);
  }
  return grid;
}

// 界外一圈視為空；盤內看是否為 null。
function free(grid, r, c) {
  const R = grid.length, C = grid[0].length;
  if (r < -1 || r > R || c < -1 || c > C) return false;
  if (r === -1 || r === R || c === -1 || c === C) return true; // 隱形空邊
  return grid[r][c] === null;
}

function hClear(grid, r, c1, c2) {
  const [a, b] = c1 < c2 ? [c1, c2] : [c2, c1];
  for (let c = a + 1; c < b; c++) if (!free(grid, r, c)) return false;
  return true;
}

function vClear(grid, c, r1, r2) {
  const [a, b] = r1 < r2 ? [r1, r2] : [r2, r1];
  for (let r = a + 1; r < b; r++) if (!free(grid, r, c)) return false;
  return true;
}

// p、q 為 [r, c]。回傳兩點是否可用 ≤2 轉折的空路徑相連。
export function canConnect(grid, p, q) {
  const [r1, c1] = p, [r2, c2] = q;
  const R = grid.length, C = grid[0].length;

  // 0 轉折：同列或同行直線
  if (r1 === r2 && hClear(grid, r1, c1, c2)) return true;
  if (c1 === c2 && vClear(grid, c1, r1, r2)) return true;

  // 1 轉折：以 (r1,c2) 或 (r2,c1) 為轉角
  if (free(grid, r1, c2) && hClear(grid, r1, c1, c2) && vClear(grid, c2, r1, r2)) return true;
  if (free(grid, r2, c1) && vClear(grid, c1, r1, r2) && hClear(grid, r2, c1, c2)) return true;

  // 2 轉折：找一條中介橫走廊 rr
  for (let rr = -1; rr <= R; rr++) {
    if (rr === r1 || rr === r2) continue;
    if (free(grid, rr, c1) && free(grid, rr, c2)
        && vClear(grid, c1, r1, rr) && vClear(grid, c2, r2, rr)
        && hClear(grid, rr, c1, c2)) return true;
  }
  // 2 轉折：找一條中介直走廊 cc
  for (let cc = -1; cc <= C; cc++) {
    if (cc === c1 || cc === c2) continue;
    if (free(grid, r1, cc) && free(grid, r2, cc)
        && hClear(grid, r1, c1, cc) && hClear(grid, r2, c2, cc)
        && vClear(grid, cc, r1, r2)) return true;
  }
  return false;
}

export function countRemaining(grid) {
  let n = 0;
  for (const row of grid) for (const t of row) if (t) n++;
  return n;
}

// 盤面是否還有任何可消的一對（否則死局，UI 可重洗）。
export function hasMoves(grid) {
  const cells = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[0].length; c++)
      if (grid[r][c]) cells.push([r, c, grid[r][c]]);
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++)
      if (tilesMatch(cells[i][2], cells[j][2])
          && canConnect(grid, [cells[i][0], cells[i][1]], [cells[j][0], cells[j][1]]))
        return true;
  return false;
}
