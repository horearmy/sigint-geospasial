const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const ALLOWED_PERIODS = {
  week: "7 days",
  month: "30 days",
  year: "1 year",
  all: null,
};

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { period } = req.query;
    let whereClause = '';
    const params = [];

    if (period === 'all') {
      whereClause = '';
    } else if (ALLOWED_PERIODS[period]) {
      params.push(ALLOWED_PERIODS[period]);
      whereClause = `WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL`;
    } else {
      params.push("7 days");
      whereClause = `WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL`;
    }

    const result = await pool.query(`
      SELECT id, judul, deskripsi, kategori, lokasi_nama,
        ST_X(koordinat::geometry) AS longitude,
        ST_Y(koordinat::geometry) AS latitude,
        created_at
      FROM laporan
      ${whereClause}
      ORDER BY created_at ASC
    `, params);

    const timeline = result.rows.map(l => ({
      ...l,
      date: new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: new Date(l.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    }));

    res.json({ success: true, data: timeline });
  } catch (err) {
    console.error('Timeline error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil data timeline' });
  }
});

module.exports = router;
