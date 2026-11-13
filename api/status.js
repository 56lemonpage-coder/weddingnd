const { cmd, TOTAL, K } = require('./_redis');

// GET /api/status?cid=...  -> { left, mine }
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const taken = Number(await cmd(['HLEN', K.slots])) || 0;
    const out = { left: Math.max(0, TOTAL - taken), mine: null };
    const cid = String((req.query && req.query.cid) || '');
    if (/^[A-Za-z0-9-]{8,64}$/.test(cid)) {
      const n = await cmd(['HGET', K.bycid, cid]);
      if (n) {
        const raw = await cmd(['HGET', K.slots, n]);
        if (raw) {
          const r = JSON.parse(raw);
          if (r.cid === cid) out.mine = { no: r.no, nick: r.nick };
        }
      }
    }
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: 'server' });
  }
};
