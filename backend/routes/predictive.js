const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

router.get('/forecast', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      WITH daily AS (
        SELECT date_trunc('day', created_at)::date AS day, kategori, COUNT(*) AS count
        FROM laporan
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY day, kategori
      ),
      stats AS (
        SELECT kategori,
          AVG(count) AS avg_daily,
          STDDEV(count) AS stddev_daily,
          MAX(count) AS max_daily,
          MIN(count) AS min_daily
        FROM daily
        GROUP BY kategori
      ),
      trend AS (
        SELECT kategori,
          SUM(CASE WHEN day >= NOW() - INTERVAL '7 days' THEN count ELSE 0 END) AS last_7d,
          SUM(CASE WHEN day >= NOW() - INTERVAL '14 days' AND day < NOW() - INTERVAL '7 days' THEN count ELSE 0 END) AS prev_7d
        FROM daily
        GROUP BY kategori
      )
      SELECT s.kategori,
        ROUND(s.avg_daily::numeric, 1) AS avg_daily,
        ROUND(s.stddev_daily::numeric, 1) AS stddev_daily,
        s.max_daily, s.min_daily,
        t.last_7d, t.prev_7d,
        CASE WHEN t.prev_7d > 0
          THEN ROUND(((t.last_7d - t.prev_7d)::numeric / t.prev_7d * 100), 1)
          ELSE 0 END AS trend_pct
      FROM stats s
      LEFT JOIN trend t ON s.kategori = t.kategori
      ORDER BY s.avg_daily DESC
    `);

    const riskAreas = await pool.query(`
      WITH recent AS (
        SELECT ST_Y(koordinat::geometry) AS lat, ST_X(koordinat::geometry) AS lng,
          kategori, created_at
        FROM laporan
        WHERE created_at >= NOW() - INTERVAL '30 days'
      )
      SELECT lat, lng, kategori, COUNT(*) AS incident_count
      FROM recent
      GROUP BY lat, lng, kategori
      HAVING COUNT(*) >= 1
      ORDER BY incident_count DESC
      LIMIT 20
    `);

    const predictionSummary = await pool.query(`
      SELECT
        COUNT(*) AS total_90d,
        COUNT(*) / 90.0 AS avg_per_day,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS last_7d,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS last_30d
      FROM laporan
      WHERE created_at >= NOW() - INTERVAL '90 days'
    `);

    res.json({
      success: true,
      data: {
        forecasts: result.rows,
        riskAreas: riskAreas.rows,
        summary: predictionSummary.rows[0],
      }
    });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ success: false, error: 'Gagal menghitung prediksi' });
  }
});

router.get('/risk-score', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      WITH recent_kat AS (
        SELECT kategori, COUNT(*) AS count
        FROM laporan
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY kategori
      ),
      total AS (
        SELECT SUM(count) AS total FROM recent_kat
      )
      SELECT rk.kategori, rk.count,
        ROUND((rk.count::numeric / t.total * 100), 1) AS risk_pct,
        CASE
          WHEN rk.count >= 10 THEN 'CRITICAL'
          WHEN rk.count >= 5 THEN 'HIGH'
          WHEN rk.count >= 2 THEN 'MEDIUM'
          ELSE 'LOW'
        END AS risk_level
      FROM recent_kat rk, total t
      ORDER BY rk.count DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal menghitung risk score' });
  }
});

module.exports = router;
