const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

router.get('/laporan/:laporan_id', async (req, res) => {
  try {
    const { laporan_id } = req.params;
    const result = await pool.query(`
      SELECT c.id, c.content, c.parent_id, c.created_at, c.updated_at,
        u.id AS user_id, u.username, u.full_name, u.role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.laporan_id = $1
      ORDER BY c.created_at ASC
    `, [laporan_id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET comments error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil komentar' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { laporan_id, content, parent_id } = req.body;
    if (!laporan_id || !content) {
      return res.status(400).json({ success: false, error: 'laporan_id dan content wajib diisi' });
    }
    const result = await pool.query(`
      INSERT INTO comments (laporan_id, user_id, content, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, content, parent_id, created_at
    `, [laporan_id, req.user.id, content, parent_id || null]);

    const fullComment = await pool.query(`
      SELECT c.id, c.content, c.parent_id, c.created_at, c.updated_at,
        u.id AS user_id, u.username, u.full_name, u.role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `, [result.rows[0].id]);

    if (req.io) {
      req.io.emit('comment:created', fullComment.rows[0]);
    }

    res.status(201).json({ success: true, data: fullComment.rows[0] });
  } catch (err) {
    console.error('POST comment error:', err);
    res.status(500).json({ success: false, error: 'Gagal menambah komentar' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT user_id FROM comments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Komentar tidak ditemukan' });
    }
    if (existing.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Tidak memiliki akses' });
    }
    await pool.query('DELETE FROM comments WHERE id = $1', [id]);
    if (req.io) {
      req.io.emit('comment:deleted', { id: parseInt(id) });
    }
    res.json({ success: true, message: 'Komentar dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal menghapus komentar' });
  }
});

module.exports = router;
