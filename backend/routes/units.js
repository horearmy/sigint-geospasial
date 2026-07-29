const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `lambang_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Hanya file gambar yang diizinkan'));
  },
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.nama_satuan, u.deskripsi, u.lokasi_nama, u.lambang_url, u.created_at,
        u.parent_id, p.nama_satuan AS parent_name,
        ST_Y(u.koordinat::geometry) AS latitude,
        ST_X(u.koordinat::geometry) AS longitude,
        us.username AS created_by_name
      FROM units u
      LEFT JOIN units p ON u.parent_id = p.id
      LEFT JOIN users us ON u.created_by = us.id
      ORDER BY COALESCE(p.nama_satuan, u.nama_satuan) ASC, u.parent_id NULLS FIRST, u.nama_satuan ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET units error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil data satuan' });
  }
});

router.post('/', authMiddleware, roleMiddleware('admin', 'analis', 'operator'), upload.single('lambang'), async (req, res) => {
  try {
    const { nama_satuan, deskripsi, lokasi_nama, latitude, longitude, parent_id } = req.body;
    if (!nama_satuan) {
      return res.status(400).json({ success: false, error: 'Nama satuan wajib diisi' });
    }

    const lambang_url = req.file ? `/uploads/${req.file.filename}` : null;
    const pId = parent_id ? parseInt(parent_id) : null;

    let result;
    if (latitude && longitude) {
      result = await pool.query(`
        INSERT INTO units (nama_satuan, deskripsi, lokasi_nama, koordinat, lambang_url, created_by, parent_id)
        VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8)
        RETURNING id, nama_satuan, deskripsi, lokasi_nama, lambang_url, created_at, parent_id,
          ST_X(koordinat::geometry) AS longitude,
          ST_Y(koordinat::geometry) AS latitude
      `, [nama_satuan, deskripsi || '', lokasi_nama || '', parseFloat(longitude), parseFloat(latitude), lambang_url, req.user.id, pId]);
    } else {
      result = await pool.query(`
        INSERT INTO units (nama_satuan, deskripsi, lokasi_nama, lambang_url, created_by, parent_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, nama_satuan, deskripsi, lokasi_nama, lambang_url, created_at, parent_id
      `, [nama_satuan, deskripsi || '', lokasi_nama || '', lambang_url, req.user.id, pId]);
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST unit error:', err);
    res.status(500).json({ success: false, error: 'Gagal menyimpan satuan' });
  }
});

router.put('/:id', authMiddleware, roleMiddleware('admin', 'analis', 'operator'), upload.single('lambang'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_satuan, deskripsi, lokasi_nama, latitude, longitude, parent_id } = req.body;

    const existing = await pool.query('SELECT id, lambang_url FROM units WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Satuan tidak ditemukan' });
    }

    let lambang_url = existing.rows[0].lambang_url;
    if (req.file) lambang_url = `/uploads/${req.file.filename}`;
    const pId = parent_id ? parseInt(parent_id) : null;

    let query, params;
    if (latitude && longitude) {
      query = `UPDATE units SET nama_satuan=$1, deskripsi=$2, lokasi_nama=$3, koordinat=ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, lambang_url=$6, parent_id=$7 WHERE id=$8
        RETURNING id, nama_satuan, deskripsi, lokasi_nama, lambang_url, created_at, parent_id,
          ST_X(koordinat::geometry) AS longitude, ST_Y(koordinat::geometry) AS latitude`;
      params = [nama_satuan, deskripsi || '', lokasi_nama || '', parseFloat(longitude), parseFloat(latitude), lambang_url, pId, id];
    } else {
      query = `UPDATE units SET nama_satuan=$1, deskripsi=$2, lokasi_nama=$3, lambang_url=$4, parent_id=$5 WHERE id=$6
        RETURNING id, nama_satuan, deskripsi, lokasi_nama, lambang_url, created_at, parent_id`;
      params = [nama_satuan, deskripsi || '', lokasi_nama || '', lambang_url, pId, id];
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT unit error:', err);
    res.status(500).json({ success: false, error: 'Gagal update satuan' });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM units WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Satuan tidak ditemukan' });
    }
    res.json({ success: true, message: 'Satuan berhasil dihapus' });
  } catch (err) {
    console.error('DELETE unit error:', err);
    res.status(500).json({ success: false, error: 'Gagal menghapus satuan' });
  }
});

module.exports = router;
