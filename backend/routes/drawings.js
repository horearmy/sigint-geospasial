const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, u.username AS created_by_name
      FROM drawings d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `);
    const drawings = result.rows.map(r => ({
      ...r,
      coordinates: typeof r.coordinates === 'string' ? JSON.parse(r.coordinates) : r.coordinates,
    }));
    res.json({ success: true, data: drawings });
  } catch (err) {
    console.error('GET drawings error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil data gambar' });
  }
});

router.post('/', authMiddleware, roleMiddleware('admin', 'analis', 'operator'), async (req, res) => {
  try {
    const { name, description, shape_type, coordinates, color, stroke_width, fill_opacity } = req.body;
    if (!shape_type || !coordinates) {
      return res.status(400).json({ success: false, error: 'shape_type dan coordinates wajib diisi' });
    }
    const result = await pool.query(
      `INSERT INTO drawings (user_id, name, description, shape_type, coordinates, color, stroke_width, fill_opacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, name || '', description || '', shape_type, JSON.stringify(coordinates),
       color || '#1b4332', stroke_width || 3, fill_opacity || 0.2]
    );
    const drawing = result.rows[0];
    drawing.coordinates = typeof drawing.coordinates === 'string' ? JSON.parse(drawing.coordinates) : drawing.coordinates;
    res.json({ success: true, data: drawing });
  } catch (err) {
    console.error('POST drawing error:', err);
    res.status(500).json({ success: false, error: 'Gagal menyimpan gambar' });
  }
});

router.put('/:id', authMiddleware, roleMiddleware('admin', 'analis', 'operator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, stroke_width, fill_opacity, coordinates } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
    if (stroke_width !== undefined) { fields.push(`stroke_width = $${idx++}`); values.push(stroke_width); }
    if (fill_opacity !== undefined) { fields.push(`fill_opacity = $${idx++}`); values.push(fill_opacity); }
    if (coordinates !== undefined) { fields.push(`coordinates = $${idx++}`); values.push(JSON.stringify(coordinates)); }
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE drawings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Gambar tidak ditemukan' });
    }
    const drawing = result.rows[0];
    drawing.coordinates = typeof drawing.coordinates === 'string' ? JSON.parse(drawing.coordinates) : drawing.coordinates;
    res.json({ success: true, data: drawing });
  } catch (err) {
    console.error('PUT drawing error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengupdate gambar' });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM drawings WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Gambar tidak ditemukan' });
    }
    res.json({ success: true, data: { id: result.rows[0].id } });
  } catch (err) {
    console.error('DELETE drawing error:', err);
    res.status(500).json({ success: false, error: 'Gagal menghapus gambar' });
  }
});

module.exports = router;
