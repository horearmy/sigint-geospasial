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
    const result = await pool.query(`
      SELECT DISTINCT ON (tp.user_id)
        tp.user_id, u.username, u.full_name,
        ST_Y(tp.location::geometry) AS latitude,
        ST_X(tp.location::geometry) AS longitude,
        tp.speed, tp.heading, tp.accuracy, tp.recorded_at
      FROM tracking_positions tp
      LEFT JOIN users u ON tp.user_id = u.id
      WHERE tp.recorded_at >= NOW() - INTERVAL '5 minutes'
      ORDER BY tp.user_id, tp.recorded_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil posisi aktif' });
  }
});

router.get('/history/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { hours = 24 } = req.query;
    const result = await pool.query(`
      SELECT id, ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude,
        speed, heading, accuracy, recorded_at
      FROM tracking_positions
      WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '${parseInt(hours)} hours'
      ORDER BY recorded_at ASC
    `, [userId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil history' });
  }
});

router.get('/path/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { hours = 24 } = req.query;
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
      WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '${parseInt(hours)} hours'
    `, [userId]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil jalur' });
  }
});

module.exports = router;
