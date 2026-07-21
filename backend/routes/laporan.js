const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware, optionalAuth } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan (jpg, png, gif, webp)'));
    }
  },
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { kategori, search, lat, lng, radius } = req.query;
    let query = `
      SELECT id, judul, deskripsi, kategori, lokasi_nama,
        ST_X(koordinat::geometry) AS longitude,
        ST_Y(koordinat::geometry) AS latitude,
        gambar, created_at, updated_at
      FROM laporan
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (kategori) {
      query += ` AND kategori = $${paramIndex++}`;
      params.push(kategori);
    }

    if (search) {
      query += ` AND (judul ILIKE $${paramIndex} OR deskripsi ILIKE $${paramIndex} OR lokasi_nama ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (lat && lng && radius) {
      query += ` AND ST_DWithin(koordinat::geography, ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography, $${paramIndex + 2})`;
      params.push(parseFloat(lng), parseFloat(lat), parseFloat(radius));
      paramIndex += 3;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('GET /laporan error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil data laporan' });
  }
});

router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { format } = req.query;
    const result = await pool.query(`
      SELECT id, judul, deskripsi, kategori, lokasi_nama,
        ST_X(koordinat::geometry) AS longitude,
        ST_Y(koordinat::geometry) AS latitude,
        gambar, created_at, updated_at
      FROM laporan ORDER BY created_at DESC
    `);

    if (format === 'geojson') {
      const geojson = {
        type: 'FeatureCollection',
        features: result.rows.map((row) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)],
          },
          properties: {
            id: row.id,
            judul: row.judul,
            deskripsi: row.deskripsi,
            kategori: row.kategori,
            lokasi_nama: row.lokasi_nama,
            gambar: row.gambar,
            created_at: row.created_at,
          },
        })),
      };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=laporan.geojson');
      return res.json(geojson);
    }

    const csvHeader = 'ID,Judul,Deskripsi,Kategori,Lokasi,Longitude,Latitude,Gambar,Tanggal\n';
    const csvRows = result.rows.map((row) =>
      `${row.id},"${(row.judul || '').replace(/"/g, '""')}","${(row.deskripsi || '').replace(/"/g, '""')}","${row.kategori}","${(row.lokasi_nama || '').replace(/"/g, '""')}",${row.longitude},${row.latitude},"${row.gambar || ''}","${row.created_at}"`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan.csv');
    res.send(csvHeader + csvRows);
  } catch (err) {
    console.error('GET /laporan/export error:', err);
    res.status(500).json({ success: false, error: 'Gagal export data' });
  }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(DISTINCT kategori) AS kategori_count,
        MIN(created_at) AS earliest,
        MAX(created_at) AS latest
      FROM laporan
    `);
    const kategori = await pool.query(`
      SELECT kategori, COUNT(*) AS jumlah 
      FROM laporan GROUP BY kategori ORDER BY jumlah DESC
    `);
    res.json({
      success: true,
      data: { ...result.rows[0], by_kategori: kategori.rows },
    });
  } catch (err) {
    console.error('GET /laporan/stats error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil statistik' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, judul, deskripsi, kategori, lokasi_nama,
        ST_X(koordinat::geometry) AS longitude,
        ST_Y(koordinat::geometry) AS latitude,
        gambar, created_at, updated_at
       FROM laporan WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Laporan tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('GET /laporan/:id error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengambil data laporan' });
  }
});

router.post('/', authMiddleware, upload.single('gambar'), async (req, res) => {
  try {
    const { judul, deskripsi, kategori, lokasi_nama, latitude, longitude } = req.body;

    if (!judul || !kategori || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Judul, kategori, latitude, dan longitude wajib diisi',
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Koordinat tidak valid',
      });
    }

    const gambar = req.file ? req.file.filename : null;

    const result = await pool.query(
      `INSERT INTO laporan (judul, deskripsi, kategori, lokasi_nama, koordinat, gambar)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7)
       RETURNING id, judul, deskripsi, kategori, lokasi_nama,
         ST_X(koordinat::geometry) AS longitude,
         ST_Y(koordinat::geometry) AS latitude,
         gambar, created_at`,
      [judul, deskripsi || '', kategori, lokasi_nama || '', lng, lat, gambar]
    );

    const newLaporan = result.rows[0];

    if (req.io) {
      req.io.emit('laporan:created', newLaporan);
    }

    res.status(201).json({ success: true, data: newLaporan });
  } catch (err) {
    console.error('POST /laporan error:', err);
    res.status(500).json({ success: false, error: 'Gagal menyimpan laporan' });
  }
});

router.put('/:id', authMiddleware, roleMiddleware('admin', 'analis', 'operator'), upload.single('gambar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, deskripsi, kategori, lokasi_nama, latitude, longitude } = req.body;

    const existing = await pool.query('SELECT id FROM laporan WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Laporan tidak ditemukan' });
    }

    let query = `UPDATE laporan SET judul=$1, deskripsi=$2, kategori=$3, lokasi_nama=$4, updated_at=NOW()`;
    const params = [judul, deskripsi || '', kategori, lokasi_nama || ''];
    let paramIndex = 5;

    if (latitude && longitude) {
      query += `, koordinat = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`;
      params.push(parseFloat(longitude), parseFloat(latitude));
      paramIndex += 2;
    }

    if (req.file) {
      query += `, gambar = $${paramIndex++}`;
      params.push(req.file.filename);
    }

    query += ` WHERE id = $${paramIndex}`;
    params.push(id);

    const result = await pool.query(
      query + ` RETURNING id, judul, deskripsi, kategori, lokasi_nama,
        ST_X(koordinat::geometry) AS longitude,
        ST_Y(koordinat::geometry) AS latitude,
        gambar, created_at, updated_at`,
      params
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /laporan/:id error:', err);
    res.status(500).json({ success: false, error: 'Gagal memperbarui laporan' });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM laporan WHERE id = $1 RETURNING id, gambar',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Laporan tidak ditemukan' });
    }
    if (req.io) {
      req.io.emit('laporan:deleted', { id: parseInt(id) });
    }

    res.json({ success: true, message: 'Laporan berhasil dihapus' });
  } catch (err) {
    console.error('DELETE /laporan/:id error:', err);
    res.status(500).json({ success: false, error: 'Gagal menghapus laporan' });
  }
});

module.exports = router;
