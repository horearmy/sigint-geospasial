const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/hotspots', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH clustered AS (
        SELECT id, judul, kategori, lokasi_nama, koordinat, created_at,
          ST_ClusterDBSCAN(koordinat::geometry, eps := 0.05, minpoints := 2) OVER () AS cluster_id
        FROM laporan
      )
      SELECT cluster_id, COUNT(*) AS cluster_size,
        AVG(ST_Y(koordinat::geometry)) AS avg_lat,
        AVG(ST_X(koordinat::geometry)) AS avg_lng,
        array_agg(DISTINCT kategori) AS kategori_types
      FROM clustered
      WHERE cluster_id IS NOT NULL
      GROUP BY cluster_id
      HAVING COUNT(*) >= 2
      ORDER BY cluster_size DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Hotspots error:', err);
    res.status(500).json({ success: false, error: 'Gagal menghitung hotspot' });
  }
});

router.get('/trends', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT to_char(created_at, 'YYYY-MM-DD') AS period_label,
        kategori, COUNT(*) AS count
      FROM laporan
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY period_label, kategori
      ORDER BY period_label
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Trends error:', err);
    res.status(500).json({ success: false, error: 'Gagal menghitung tren' });
  }
});

router.get('/anomalies', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH daily_counts AS (
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS count
        FROM laporan GROUP BY day
      ),
      stats AS (
        SELECT AVG(count) AS mean, STDDEV(count) AS stddev FROM daily_counts
      )
      SELECT dc.day, dc.count,
        ROUND(((dc.count - s.mean) / NULLIF(s.stddev, 0))::numeric, 2) AS z_score
      FROM daily_counts dc, stats s
      WHERE (dc.count - s.mean) > (2 * NULLIF(s.stddev, 0))
      ORDER BY dc.count DESC LIMIT 10
    `);
    const summary = await pool.query(`
      SELECT COUNT(*) AS total, COUNT(DISTINCT kategori) AS kategori_count,
        COUNT(DISTINCT date_trunc('day', created_at)) AS days_active
      FROM laporan
    `);
    res.json({ success: true, data: { anomalies: result.rows, summary: summary.rows[0] } });
  } catch (err) {
    console.error('Anomalies error:', err);
    res.status(500).json({ success: false, error: 'Gagal mendeteksi anomali' });
  }
});

router.get('/spatial', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT kategori, COUNT(*) AS total,
        AVG(ST_Y(koordinat::geometry)) AS avg_lat,
        AVG(ST_X(koordinat::geometry)) AS avg_lng
      FROM laporan GROUP BY kategori ORDER BY total DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal analisis spasial' });
  }
});

module.exports = router;
