const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM form_templates ORDER BY created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil template' });
  }
});

router.post('/templates', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { name, kategori, fields, description } = req.body;
    if (!name || !kategori || !fields) {
      return res.status(400).json({ success: false, error: 'Name, kategori, dan fields wajib diisi' });
    }
    const result = await pool.query(`
      INSERT INTO form_templates (name, kategori, fields, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, kategori, JSON.stringify(fields), description || '', req.user.id]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ success: false, error: 'Gagal menyimpan template' });
  }
});

router.delete('/templates/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM form_templates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal menghapus template' });
  }
});

router.get('/workflow', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lw.id, lw.laporan_id, lw.status, lw.reviewer_note, lw.reviewed_by,
        lw.created_at, lw.updated_at,
        l.judul AS laporan_judul, l.kategori,
        u.username AS reviewer_name
      FROM laporan_workflow lw
      LEFT JOIN laporan l ON lw.laporan_id = l.id
      LEFT JOIN users u ON lw.reviewed_by = u.id
      ORDER BY lw.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil workflow' });
  }
});

router.post('/workflow', authMiddleware, async (req, res) => {
  try {
    const { laporan_id } = req.body;
    if (!laporan_id) {
      return res.status(400).json({ success: false, error: 'laporan_id wajib diisi' });
    }

    const laporanExists = await pool.query('SELECT id FROM laporan WHERE id = $1', [laporan_id]);
    if (laporanExists.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Laporan tidak ditemukan' });
    }

    const result = await pool.query(`
      INSERT INTO laporan_workflow (laporan_id, status, submitted_by)
      VALUES ($1, 'pending', $2)
      RETURNING *
    `, [laporan_id, req.user.id]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal submit workflow' });
  }
});

router.put('/workflow/:id/review', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { status, reviewer_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status harus approved atau rejected' });
    }
    const result = await pool.query(`
      UPDATE laporan_workflow
      SET status = $1, reviewer_note = $2, reviewed_by = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [status, reviewer_note || '', req.user.id, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal review workflow' });
  }
});

module.exports = router;
