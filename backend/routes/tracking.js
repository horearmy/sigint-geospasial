const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

router.post('/position', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, speed, heading, accuracy } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: 'Koordinat wajib diisi' });
    }

    const result = await pool.query(`
      INSERT INTO tracking_positions (user_id, location, speed, heading, accuracy, recorded_at)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, NOW())
      RETURNING id, recorded_at
    `, [req.user.id, parseFloat(longitude), parseFloat(latitude), speed || 0, heading || 0, accuracy || 0]);

    if (req.io) {
      req.io.emit('tracking:position', {
        user_id: req.user.id,
        username: req.user.username,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: speed || 0,
        heading: heading || 0,
        recorded_at: result.rows[0].recorded_at,
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Track position error:', err);
    res.status(500).json({ success: false, error: 'Gagal menyimpan posisi' });
  }
});

router.get('/active', authMiddleware, async (req, res) => {
  try {
    // All lapangan users + any active user from other roles
    const result = await pool.query(`
      WITH active_positions AS (
        SELECT DISTINCT ON (tp.user_id)
          tp.user_id,
          ST_Y(tp.location::geometry) AS latitude,
          ST_X(tp.location::geometry) AS longitude,
          tp.speed, tp.heading, tp.accuracy, tp.recorded_at,
          true AS has_active
        FROM tracking_positions tp
        WHERE tp.recorded_at >= NOW() - INTERVAL '5 minutes'
        ORDER BY tp.user_id, tp.recorded_at DESC
      ),
      latest_positions AS (
        SELECT DISTINCT ON (tp.user_id)
          tp.user_id,
          ST_Y(tp.location::geometry) AS latitude,
          ST_X(tp.location::geometry) AS longitude,
          tp.speed, tp.heading, tp.accuracy, tp.recorded_at,
          false AS has_active
        FROM tracking_positions tp
        ORDER BY tp.user_id, tp.recorded_at DESC
      )
      SELECT
        u.id AS user_id, u.username, u.full_name, u.role,
        u.pangkat, u.nrp, u.jabatan, u.satuan, u.avatar_url,
        COALESCE(ap.latitude, lp.latitude) AS latitude,
        COALESCE(ap.longitude, lp.longitude) AS longitude,
        COALESCE(ap.speed, 0) AS speed,
        COALESCE(ap.heading, 0) AS heading,
        COALESCE(ap.recorded_at, lp.recorded_at) AS recorded_at,
        CASE WHEN ap.user_id IS NOT NULL THEN true ELSE false END AS is_active
      FROM users u
      LEFT JOIN active_positions ap ON u.id = ap.user_id
      LEFT JOIN latest_positions lp ON u.id = lp.user_id
      WHERE u.role = 'lapangan'
         OR ap.user_id IS NOT NULL
      ORDER BY is_active DESC, u.full_name ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get active tracking error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil posisi aktif' });
  }
});

router.get('/history/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ success: false, error: 'Tidak memiliki akses' });
    }
    const hours = parseInt(req.query.hours) || 24;
    const safeHours = Math.min(Math.max(hours, 1), 720);
    const result = await pool.query(`
      SELECT id, ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude,
        speed, heading, accuracy, recorded_at
      FROM tracking_positions
      WHERE user_id = $1 AND recorded_at >= NOW() - ($2::text || ' hours')::INTERVAL
      ORDER BY recorded_at ASC
    `, [userId, safeHours]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil history' });
  }
});

router.get('/path/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ success: false, error: 'Tidak memiliki akses' });
    }
    const hours = parseInt(req.query.hours) || 24;
    const safeHours = Math.min(Math.max(hours, 1), 720);
    const result = await pool.query(`
      SELECT ST_AsGeoJSON(
        ST_MakeLine(location::geometry ORDER BY recorded_at)
      ) AS path,
      SUM(
        ST_Distance(
          location::geography,
          LAG(location::geography) OVER (ORDER BY recorded_at)
        )
      ) AS total_distance_m
      FROM tracking_positions
      WHERE user_id = $1 AND recorded_at >= NOW() - ($2::text || ' hours')::INTERVAL
    `, [userId, safeHours]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil jalur' });
  }
});

module.exports = router;
