const { cmd, K, failCode } = require('./_redis');

// GET /api/list?cid=...  -> { rows: [{no, nick}], mine: 가장 최근에 내가 신청한 {no, nick} | null, mineAll: 내가 신청한 전체 }
// 누구나 볼 수 있는 참석 명단입니다. 내부 식별값(cid)은 내려보내지 않습니다.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const flat = (await cmd(['HGETALL', K.slots])) || [];
    const cid = String((req.query && req.query.cid) || '');
    const okCid = /^[A-Za-z0-9-]{8,64}$/.test(cid);
    const rows = [];
    const mineAll = [];
    let mine = null, mineAt = -1;
    for (let i = 1; i < flat.length; i += 2) {
      try {
        const r = JSON.parse(flat[i]);
        rows.push({ no: r.no, nick: r.nick });
        if (okCid && r.cid === cid) {
          mineAll.push({ no: r.no, nick: r.nick });
          if ((r.at || 0) >= mineAt) { mineAt = r.at || 0; mine = { no: r.no, nick: r.nick }; }
        }
      } catch (_) {}
    }
    rows.sort((a, b) => a.no - b.no);
    res.status(200).json({ rows, mine, mineAll });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: failCode(e), detail: String((e && e.message) || e).slice(0, 160) });
  }
};
