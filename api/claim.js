const { cmd, TOTAL, MAX_PER_CLIENT, K, normNick, readBody, failCode } = require('./_redis');

// 한 번에 하나씩 원자적으로 처리(Lua)해서 동시에 눌러도 번호가 겹치거나 40장을 넘지 않습니다.
const LUA = `
local slots, cidcnt, bynick = KEYS[1], KEYS[2], KEYS[3]
local cid, nick, nk, total, now, maxper = ARGV[1], ARGV[2], ARGV[3], tonumber(ARGV[4]), tonumber(ARGV[5]), tonumber(ARGV[6])
-- 같은 닉네임이 이미 있으면 번호를 또 쓰지 않고 기존 초대장을 돌려줍니다.
local n = redis.call('HGET', bynick, nk)
if n then
  local raw = redis.call('HGET', slots, n)
  if raw then
    local r = cjson.decode(raw)
    if r.nk == nk then return {1, raw} end
  end
end
-- 이 브라우저에서 이미 신청한 인원 수 제한
local used = tonumber(redis.call('HGET', cidcnt, cid)) or 0
if used >= maxper then return {-2} end
for i = 1, total do
  local f = tostring(i)
  if redis.call('HEXISTS', slots, f) == 0 then
    local raw = cjson.encode({no = i, nick = nick, nk = nk, cid = cid, at = now})
    redis.call('HSET', slots, f, raw)
    redis.call('HSET', bynick, nk, f)
    redis.call('HINCRBY', cidcnt, cid, 1)
    return {0, raw}
  end
end
return {-1}
`;

// POST /api/claim  { cid, nick }
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const body = readBody(req);
  const cid = String(body.cid || '');
  const nick = normNick(body.nick || '').replace(/[\u0000-\u001f\u007f]/g, '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(cid)) return res.status(400).json({ error: 'bad_client' });
  if (!nick || [...nick].length > 20) return res.status(400).json({ error: 'bad_nick' });
  try {
    const out = await cmd(['EVAL', LUA, 3, K.slots, K.cidcnt, K.bynick, cid, nick, nick.toLowerCase(), TOTAL, Date.now(), MAX_PER_CLIENT]);
    if (Array.isArray(out) && out[0] === -2) return res.status(429).json({ error: 'limit' });
    if (!Array.isArray(out) || out[0] === -1) return res.status(409).json({ error: 'soldout' });
    const r = JSON.parse(out[1]);
    res.status(200).json({ ok: true, no: r.no, nick: r.nick, again: out[0] === 1 });
  } catch (e) {
    console.error(e); res.status(500).json({ error: failCode(e), detail: String((e && e.message) || e).slice(0, 160) });
  }
};
