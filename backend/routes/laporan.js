const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const exifr = require('exifr');
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware, optionalAuth } = require('../middleware/auth');

function sanitizeCsv(val) {
  const s = String(val || '').replace(/"/g, '""');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

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
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
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
    const { kategori, search, lat, lng, radius, page = 1, limit = 50 } = req.query;
    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 1000);
    const safePage = Math.max(parseInt(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    let whereClause = ' WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (kategori) {
      whereClause += ` AND kategori = $${paramIndex++}`;
      params.push(kategori);
    }

    if (search) {
      whereClause += ` AND (judul ILIKE $${paramIndex} OR deskripsi ILIKE $${paramIndex} OR lokasi_nama ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (lat && lng && radius) {
      whereClause += ` AND ST_DWithin(koordinat::geography, ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography, $${paramIndex + 2})`;
      params.push(parseFloat(lng), parseFloat(lat), parseFloat(radius));
      paramIndex += 3;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM laporan${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, judul, deskripsi, kategori, lokasi_nama,
        ST_X(koordinat::geometry) AS longitude,
        ST_Y(koordinat::geometry) AS latitude,
        gambar, gambar_lain, signature_url, signed_by, signed_at,
        created_at, updated_at
      FROM laporan${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(safeLimit, offset);

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows,
      total,
      page: safePage,
      pages: Math.ceil(total / safeLimit),
    });
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
        gambar, gambar_lain, signature_url, signed_by, signed_at,
        created_at, updated_at
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
      `${row.id},"${sanitizeCsv(row.judul)}","${sanitizeCsv(row.deskripsi)}","${sanitizeCsv(row.kategori)}","${sanitizeCsv(row.lokasi_nama)}",${row.longitude},${row.latitude},"${sanitizeCsv(row.gambar)}","${sanitizeCsv(row.created_at)}"`
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
      `SELECT l.id, l.judul, l.deskripsi, l.kategori, l.lokasi_nama,
        ST_X(l.koordinat::geometry) AS longitude,
        ST_Y(l.koordinat::geometry) AS latitude,
        l.gambar, l.gambar_lain, l.signature_url, l.signed_by, l.signed_at,
        l.created_at, l.updated_at,
        u.username AS signed_username, u.full_name AS signed_full_name
       FROM laporan l
       LEFT JOIN users u ON l.signed_by = u.id
       WHERE l.id = $1`,
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

router.post('/', authMiddleware, roleMiddleware('admin', 'analis', 'operator', 'lapangan'), upload.array('gambar', 4), async (req, res) => {
  try {
    let { judul, deskripsi, kategori, lokasi_nama, latitude, longitude } = req.body;

    if (!judul || !kategori) {
      return res.status(400).json({
        success: false,
        error: 'Judul dan kategori wajib diisi',
      });
    }

    // Fallback: ekstrak GPS dari EXIF foto jika koordinat tidak dikirim
    if ((!latitude || !longitude) && req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const gps = await exifr.gps(file.path);
          if (gps && gps.latitude != null && gps.longitude != null) {
            latitude = gps.latitude.toFixed(6);
            longitude = gps.longitude.toFixed(6);
            break;
          }
        } catch { /* skip file */ }
      }
    }

    if (!latitude || !longitude) {
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

    const gambar = req.files && req.files.length > 0 ? req.files[0].filename : null;
    const gambarLain = req.files && req.files.length > 1
      ? JSON.stringify(req.files.slice(1).map(f => f.filename))
      : '[]';

    const result = await pool.query(
      `INSERT INTO laporan (judul, deskripsi, kategori, lokasi_nama, koordinat, gambar, gambar_lain)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8)
       RETURNING id, judul, deskripsi, kategori, lokasi_nama,
         ST_X(koordinat::geometry) AS longitude,
         ST_Y(koordinat::geometry) AS latitude,
         gambar, gambar_lain, signature_url, signed_by, signed_at, created_at`,
      [judul, deskripsi || '', kategori, lokasi_nama || '', lng, lat, gambar, gambarLain]
    );

    const newLaporan = result.rows[0];
    newLaporan.gambar_lain = JSON.parse(newLaporan.gambar_lain || '[]');

    if (req.io) {
      req.io.emit('laporan:created', newLaporan);
    }

    res.status(201).json({ success: true, data: newLaporan });
  } catch (err) {
    console.error('POST /laporan error:', err);
    res.status(500).json({ success: false, error: 'Gagal menyimpan laporan' });
  }
});

router.put('/:id', authMiddleware, roleMiddleware('admin', 'analis', 'operator', 'lapangan'), upload.array('gambar', 4), async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, deskripsi, kategori, lokasi_nama, latitude, longitude, gambar_lain } = req.body;

    const existing = await pool.query('SELECT id, gambar, gambar_lain FROM laporan WHERE id = $1', [id]);
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

    if (req.files && req.files.length > 0) {
      const newPrimary = req.files[0].filename;
      const additional = req.files.length > 1
        ? JSON.stringify(req.files.slice(1).map(f => f.filename))
        : (gambar_lain || existing.rows[0].gambar_lain || '[]');

      query += `, gambar = $${paramIndex++}`;
      params.push(newPrimary);
      query += `, gambar_lain = $${paramIndex++}`;
      params.push(additional);
    } else if (gambar_lain !== undefined) {
      query += `, gambar_lain = $${paramIndex++}`;
      params.push(gambar_lain);
    }

    query += ` WHERE id = $${paramIndex}`;
    params.push(id);

    const result = await pool.query(
      query + ` RETURNING id, judul, deskripsi, kategori, lokasi_nama,
        ST_X(koordinat::geometry) AS longitude,
        ST_Y(koordinat::geometry) AS latitude,
        gambar, gambar_lain, signature_url, signed_by, signed_at, created_at, updated_at`,
      params
    );

    const updated = result.rows[0];
    updated.gambar_lain = JSON.parse(updated.gambar_lain || '[]');

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('PUT /laporan/:id error:', err);
    res.status(500).json({ success: false, error: 'Gagal memperbarui laporan' });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware('admin', 'analis'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM laporan WHERE id = $1 RETURNING id, gambar, gambar_lain',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Laporan tidak ditemukan' });
    }

    const row = result.rows[0];
    const allImages = [row.gambar, ...(JSON.parse(row.gambar_lain || '[]'))].filter(Boolean);
    const uploadsDir = path.resolve(__dirname, '..', 'uploads');
    for (const img of allImages) {
      const safeName = path.basename(img);
      const filePath = path.resolve(uploadsDir, safeName);
      if (filePath.startsWith(uploadsDir) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
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

// ── Digital Signature ──
const signStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'signatures');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `sign_${req.params.id}_${Date.now()}.png`);
  },
});
const signUpload = multer({
  storage: signStorage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Hanya file gambar'));
  },
});

router.post('/:id/sign', authMiddleware, roleMiddleware('admin', 'analis', 'operator', 'lapangan'), signUpload.single('signature'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ success: false, error: 'File signature tidak ditemukan' });

    const exists = await pool.query('SELECT id FROM laporan WHERE id = $1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ success: false, error: 'Laporan tidak ditemukan' });

    const signature_url = `/uploads/signatures/${req.file.filename}`;
    const result = await pool.query(
      `UPDATE laporan SET signature_url = $1, signed_by = $2, signed_at = NOW() WHERE id = $3
       RETURNING id, judul, signature_url, signed_by, signed_at`,
      [signature_url, req.user.id, id]
    );

    const user = await pool.query('SELECT id, username, full_name FROM users WHERE id = $1', [req.user.id]);
    const signed = { ...result.rows[0], signed_by_user: user.rows[0] };

    if (req.io) req.io.emit('laporan:signed', signed);
    res.json({ success: true, data: signed });
  } catch (err) {
    console.error('SIGN error:', err);
    res.status(500).json({ success: false, error: 'Gagal menandatangani laporan' });
  }
});

router.delete('/:id/sign', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const old = await pool.query('SELECT signature_url FROM laporan WHERE id = $1', [id]);
    if (old.rows.length && old.rows[0].signature_url) {
      const oldPath = path.resolve(__dirname, '..', old.rows[0].signature_url.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await pool.query('UPDATE laporan SET signature_url = NULL, signed_by = NULL, signed_at = NULL WHERE id = $1', [id]);
    if (req.io) req.io.emit('laporan:unsigned', { id: parseInt(id) });
    res.json({ success: true, message: 'Signature dihapus' });
  } catch (err) {
    console.error('UNSIGN error:', err);
    res.status(500).json({ success: false, error: 'Gagal menghapus signature' });
  }
});

module.exports = router;
