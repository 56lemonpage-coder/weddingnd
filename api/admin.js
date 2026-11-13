const crypto = require('crypto');
const { cmd, K, failCode } = require('./_redis');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

// GET    /api/admin           (헤더 x-admin-password) -> 신청자 명단
// DELETE /api/admin?no=7      (헤더 x-admin-password) -> 7번 초대장 삭제(번호 반환)
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return res.status(500).json({ error: 'admin_not_configured' });

  const ip = String((req.headers['x-forwarded-for'] || '')).split(',')[0].trim() || 'unknown';
  const failKey = 'invite:fail:' + ip;
  try {
    const fails = Number(await cmd(['GET', failKey])) || 0;
    if (fails >= 10) return res.status(429).json({ error: 'too_many' });

    const given = String(req.headers['x-admin-password'] || '');
    if (!crypto.timingSafeEqual(sha(given), sha(real))) {
      const n = await cmd(['INCR', failKey]);
      if (Number(n) === 1) await cmd(['EXPIRE', failKey, 600]);
      return res.status(401).json({ error: 'wrong_password' });
    }
    if (fails) await cmd(['DEL', failKey]);

    if (req.method === 'GET') {
      const flat = (await cmd(['HGETALL', K.slots])) || [];
      const rows = [];
      for (let i = 1; i < flat.length; i += 2) {
        try {
          const r = JSON.parse(flat[i]);
          rows.push({ no: r.no, nick: r.nick, at: r.at });
        } catch (_) {}
      }
      rows.sort((a, b) => a.no - b.no);
      return res.status(200).json({ rows });
    }

    if (req.method === 'DELETE') {
      const no = String((req.query && req.query.no) || '');
      if (!/^\d{1,3}$/.test(no)) return res.status(400).json({ error: 'bad_no' });
      const raw = await cmd(['HGET', K.slots, no]);
      if (raw) {
        const r = JSON.parse(raw);
        await cmd(['HDEL', K.slots, no]);
        if (r.cid) await cmd(['HINCRBY', K.cidcnt, r.cid, -1]);
        if (r.nk) await cmd(['HDEL', K.bynick, r.nk]);
      }
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method' });
  } catch (e) {
    console.error(e); res.status(500).json({ error: failCode(e), detail: String((e && e.message) || e).slice(0, 160) });
  }
};
