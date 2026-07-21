const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.id, n.type, n.title, n.message, n.related_id, n.is_read, n.created_at
      FROM notifications n
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil notifikasi' });
  }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ success: true, data: { count: parseInt(result.rows[0].count) } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal menghitung notifikasi' });
  }
});

router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal update notifikasi' });
  }
});

router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal update notifikasi' });
  }
});

router.post('/check-alerts', authMiddleware, async (req, res) => {
  try {
    const rules = await pool.query('SELECT * FROM alert_rules WHERE is_active = true');
    const alerts = [];

    for (const rule of rules.rows) {
      let conditionMet = false;
      let count = 0;

      if (rule.condition_type === 'count_in_area' && rule.center_point && rule.radius_meters) {
        const result = await pool.query(`
          SELECT COUNT(*) AS count FROM laporan
          WHERE ST_DWithin(koordinat::geography, $1::geography, $2)
          AND created_at >= NOW() - INTERVAL '24 hours'
        `, [rule.center_point, rule.radius_meters]);
        count = parseInt(result.rows[0].count);
        conditionMet = count >= rule.threshold;
      }

      if (conditionMet) {
        alerts.push({
          rule_name: rule.name,
          count,
          threshold: rule.threshold,
          condition_type: rule.condition_type,
        });
      }
    }

    res.json({ success: true, data: alerts });
  } catch (err) {
    console.error('Check alerts error:', err);
    res.status(500).json({ success: false, error: 'Gagal memeriksa alert' });
  }
});

module.exports = router;
