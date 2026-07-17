// 供 Vercel／Netlify 呼叫同一個 Cloudflare D1 資料庫（透過 D1 HTTP REST API）。
// Cloudflare Pages 上的 functions/api/*.js 用原生 D1 binding，不吃這支；
// 這支只給非 Cloudflare 平台的 serverless function 橋接同一份資料。
const BOARD_RE = /^[\w一-鿿]{1,20}(::(progress|streak))?$/;
const TOP_N = 20;

export const CORS_POST = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export const CORS_GET = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export function validateBoard(board) {
  return BOARD_RE.test(board);
}

export async function d1Query(sql, params = []) {
  const accountId = process.env.CF_ACCOUNT_ID;
  const databaseId = process.env.CF_D1_DATABASE_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !databaseId || !token) {
    throw new Error('missing CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_API_TOKEN');
  }

  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const data = await r.json();
  if (!data.success) {
    throw new Error(`D1 HTTP API error: ${JSON.stringify(data.errors)}`);
  }
  return data.result[0]?.results || [];
}

export async function submitScore(board, name, score) {
  await d1Query(
    'INSERT INTO leaderboard (board, name, score, updated_at) VALUES (?1, ?2, ?3, ?4) ' +
    'ON CONFLICT(board, name) DO UPDATE SET score=?3, updated_at=?4 WHERE ?3 > leaderboard.score',
    [board, name, score, Date.now()],
  );
  return d1Query('SELECT name, score FROM leaderboard WHERE board = ?1 ORDER BY score DESC LIMIT ?2', [board, TOP_N]);
}

export async function fetchTop(board) {
  return d1Query('SELECT name, score FROM leaderboard WHERE board = ?1 ORDER BY score DESC LIMIT ?2', [board, TOP_N]);
}
