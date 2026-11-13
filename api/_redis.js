// Upstash Redis REST 호출 도우미 (Vercel Marketplace의 Upstash/KV 연결 시 환경변수가 자동으로 들어옵니다)
const BASE = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function cmd(args) {
  if (!BASE || !TOKEN) throw new Error('storage_not_configured');
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(args.map((a) => (typeof a === 'number' ? String(a) : a))),
  });
  let j = null;
  try { j = await r.json(); } catch (_) {}
  if (!r.ok || !j || j.error) throw new Error((j && j.error) || 'redis_' + r.status);
  return j.result;
}

const TOTAL = 40;
const K = { slots: 'invite:slots', bycid: 'invite:bycid', bynick: 'invite:bynick' };

function normNick(s) {
  return String(s).trim().replace(/\s+/g, ' ').normalize('NFC');
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') { try { return JSON.parse(b); } catch (_) {} }
  return {};
}

module.exports = { cmd, TOTAL, K, normNick, readBody };
