// Upstash Redis REST 호출 도우미 (Vercel Marketplace의 Upstash/KV 연결 시 환경변수가 자동으로 들어옵니다)
// 연결할 때 붙인 이름표(prefix)가 달라도 찾을 수 있도록 환경변수를 훑어봅니다.
function cfg() {
  const e = process.env;
  let url = e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL;
  let token = e.UPSTASH_REDIS_REST_TOKEN || e.KV_REST_API_TOKEN;
  for (const k of Object.keys(e)) {
    if (!url && /(REST_API_URL|REDIS_REST_URL)$/.test(k)) url = e[k];
    if (!token && /(REST_API_TOKEN|REDIS_REST_TOKEN)$/.test(k)) token = e[k];
  }
  return { url, token };
}

// 화면에 보여줄 원인 코드
function failCode(e) {
  return e && e.message === 'storage_not_configured' ? 'storage_not_configured' : 'server';
}

async function cmd(args) {
  const { url, token } = cfg();
  if (!url || !token) throw new Error('storage_not_configured');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(args.map((a) => (typeof a === 'number' ? String(a) : a))),
  });
  let j = null;
  try { j = await r.json(); } catch (_) {}
  if (!r.ok || !j || j.error) throw new Error((j && j.error) || 'redis_' + r.status);
  return j.result;
}

const TOTAL = 40;
// 한 브라우저(기기)에서 연달아 신청할 수 있는 최대 인원 (한 사람이 40장을 다 가져가는 것을 막는 안전장치)
const MAX_PER_CLIENT = 10;
const K = { slots: 'invite:slots', cidcnt: 'invite:cidcnt', bynick: 'invite:bynick' };

function normNick(s) {
  return String(s).trim().replace(/\s+/g, ' ').normalize('NFC');
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') { try { return JSON.parse(b); } catch (_) {} }
  return {};
}

module.exports = { cmd, TOTAL, MAX_PER_CLIENT, K, normNick, readBody, failCode };
