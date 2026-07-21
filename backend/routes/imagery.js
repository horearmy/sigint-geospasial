const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

router.get('/imagery', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, zoom = 8, date } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat dan lng wajib diisi' });
    }

    const layers = [
      { id: 'sentinel-2', name: 'Sentinel-2 L2A', type: 'satellite', description: 'Citra satelit resolusi 10m', maxZoom: 14 },
      { id: 'landsat-8', name: 'Landsat 8', type: 'satellite', description: 'Citra satelit resolusi 30m', maxZoom: 12 },
      { id: 'ndvi', name: 'NDVI Vegetation', type: 'index', description: 'Indeks vegetasi', maxZoom: 14 },
      { id: 'ndwi', name: 'NDWI Water', type: 'index', description: 'Indeks air', maxZoom: 14 },
    ];

    const tileUrl = `https://tiles.maps.eox.at/wmts/1.0.0/`.

    res.json({
      success: true,
      data: {
        center: { lat: parseFloat(lat), lng: parseFloat(lng) },
        zoom: parseInt(zoom),
        layers,
        tileTemplate: tileUrl,
        availableDates: generateDates(),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil info imagery' });
  }
});

router.get('/ndvi-calc', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT kategori,
        AVG(ST_Y(koordinat::geometry)) AS avg_lat,
        AVG(ST_X(koordinat::geometry)) AS avg_lng,
        COUNT(*) AS total
      FROM laporan
      GROUP BY kategori
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal menghitung NDVI' });
  }
});

function generateDates() {
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

module.exports = router;
