const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const { period } = req.query;
    let timeFilter = "created_at >= NOW() - INTERVAL '7 days'";
    if (period === 'month') timeFilter = "created_at >= NOW() - INTERVAL '30 days'";
    if (period === 'year') timeFilter = "created_at >= NOW() - INTERVAL '1 year'";
    if (period === 'all') timeFilter = '1=1';

    const result = await pool.query(`
      SELECT id, judul, deskripsi, kategori, lokasi_nama,
        ST_X(koordinat::geometry) AS longitude,
        ST_Y(koordinat::geometry) AS latitude,
        created_at
      FROM laporan
      WHERE ${timeFilter}
      ORDER BY created_at ASC
    `);

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
