const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT tz.id, tz.name, tz.zone_type, tz.risk_level, tz.description, tz.created_at,
        ST_AsGeoJSON(tz.boundary::geometry) AS boundary,
        u.username AS created_by_name,
        (SELECT COUNT(*) FROM laporan l 
         WHERE ST_DWithin(l.koordinat::geography, tz.boundary::geography, 0)) AS insiden_count
      FROM threat_zones tz
      LEFT JOIN users u ON tz.created_by = u.id
      ORDER BY tz.risk_level DESC, tz.created_at DESC
    `);
    const zones = result.rows.map(r => ({
      ...r,
      boundary: JSON.parse(r.boundary),
    }));
    res.json({ success: true, data: zones });
  } catch (err) {
    console.error('GET zones error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil data zona' });
  }
});

router.post('/', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { name, zone_type, risk_level, description, boundary_geojson } = req.body;
    if (!name || !zone_type || !boundary_geojson) {
      return res.status(400).json({ success: false, error: 'name, zone_type, dan boundary wajib diisi' });
    }

    let boundary;
    if (typeof boundary_geojson === 'string') {
      boundary = JSON.parse(boundary_geojson);
    } else {
      boundary = boundary_geojson;
    }

    const result = await pool.query(`
      INSERT INTO threat_zones (name, zone_type, risk_level, description, boundary, created_by)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)::geography, $6)
      RETURNING id, name, zone_type, risk_level, description, created_at
    `, [name, zone_type, risk_level || 1, description || '', JSON.stringify(boundary), req.user.id]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST zone error:', err);
    res.status(500).json({ success: false, error: 'Gagal menyimpan zona' });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM threat_zones WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Zona tidak ditemukan' });
    }
    res.json({ success: true, message: 'Zona berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal menghapus zona' });
  }
});

router.put('/:id', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, zone_type, risk_level, description, boundary_geojson } = req.body;

    const existing = await pool.query('SELECT id FROM threat_zones WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Zona tidak ditemukan' });
    }

    let query = `UPDATE threat_zones SET name=COALESCE($1, name), zone_type=COALESCE($2, zone_type),
      risk_level=COALESCE($3, risk_level), description=COALESCE($4, description)`;
    const params = [name || null, zone_type || null, risk_level || null, description || null];
    let idx = 5;

    if (boundary_geojson) {
      let boundary = typeof boundary_geojson === 'string' ? JSON.parse(boundary_geojson) : boundary_geojson;
      query += `, boundary = ST_SetSRID(ST_GeomFromGeoJSON($${idx++}), 4326)::geography`;
      params.push(JSON.stringify(boundary));
    }

    query += ` WHERE id = $${idx} RETURNING id, name, zone_type, risk_level, description, created_at`;
    params.push(id);

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT zone error:', err);
    res.status(500).json({ success: false, error: 'Gagal update zona' });
  }
});

module.exports = router;
