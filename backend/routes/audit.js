const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const result = await pool.query(`
      SELECT al.id, al.action, al.resource, al.details, al.ip_address, al.timestamp,
        u.username, u.full_name
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), offset]);
    const countResult = await pool.query('SELECT COUNT(*) AS total FROM audit_log');
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].total) });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil audit log' });
  }
});

router.get('/export', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.id, al.action, al.resource, al.details, al.ip_address, al.timestamp,
        u.username
      FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
    `);
    const csvHeader = 'ID,Action,Resource,Details,IP,Username,Timestamp\n';
    const csvRows = result.rows.map(r =>
      `${r.id},"${r.action}","${r.resource}","${JSON.stringify(r.details || {}).replace(/"/g, '""')}","${r.ip_address || ''}","${r.username || ''}","${r.timestamp}"`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_log.csv');
    res.send(csvHeader + csvRows);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal export audit log' });
  }
});

module.exports = router;
