const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

router.get('/pdf', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date, kategori } = req.query;
    let query = `
      SELECT id, judul, deskripsi, kategori, lokasi_nama,
        ST_X(koordinat::geometry) AS longitude,
        ST_Y(koordinat::geometry) AS latitude,
        gambar, created_at
      FROM laporan WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (start_date) { query += ` AND created_at >= $${idx++}`; params.push(start_date); }
    if (end_date) { query += ` AND created_at <= $${idx++}`; params.push(end_date); }
    if (kategori) { query += ` AND kategori = $${idx++}`; params.push(kategori); }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);

    let statsQuery = `
      SELECT COUNT(*) AS total,
        COUNT(DISTINCT kategori) AS kategori_count
      FROM laporan WHERE 1=1
    `;
    const statsParams = [];
    let statsIdx = 1;
    if (start_date) { statsQuery += ` AND created_at >= $${statsIdx++}`; statsParams.push(start_date); }
    if (end_date) { statsQuery += ` AND created_at <= $${statsIdx++}`; statsParams.push(end_date); }
    if (kategori) { statsQuery += ` AND kategori = $${statsIdx++}`; statsParams.push(kategori); }
    const stats = await pool.query(statsQuery, statsParams);

    const html = generateReportHTML(result.rows, stats.rows[0], { start_date, end_date, kategori });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'inline; filename=laporan.html');
    res.send(html);
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ success: false, error: 'Gagal generate laporan' });
  }
});

function generateReportHTML(laporan, stats, filters) {
  const rows = laporan.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(l.judul)}</strong></td>
      <td><span class="badge">${escapeHtml(l.kategori)}</span></td>
      <td>${escapeHtml(l.lokasi_nama) || '-'}</td>
      <td>${parseFloat(l.latitude).toFixed(4)}, ${parseFloat(l.longitude).toFixed(4)}</td>
      <td>${new Date(l.created_at).toLocaleDateString('id-ID')}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan Intelijen Geospasial</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
  .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
  .header h1 { color: #1e3a5f; margin: 0; }
  .header p { color: #666; margin-top: 5px; }
  .stats { display: flex; gap: 20px; margin-bottom: 30px; }
  .stat-card { flex: 1; background: #f5f7fa; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: bold; color: #2563eb; }
  .stat-label { font-size: 13px; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #1e3a5f; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  tr:hover { background: #f5f7fa; }
  .badge { background: #2563eb; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
  .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <h1>LAPORAN INTELIJEN GEOSPASIAL</h1>
  <p>SIGINT - Sistem Intelijen Geospasial</p>
  <p style="font-size:12px;">Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
</div>
<div class="stats">
  <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">Total Laporan</div></div>
  <div class="stat-card"><div class="stat-value">${stats.kategori_count}</div><div class="stat-label">Kategori</div></div>
  <div class="stat-card"><div class="stat-value">${laporan.length}</div><div class="stat-label">Data Ditampilkan</div></div>
</div>
<table>
  <thead><tr><th>No</th><th>Judul</th><th>Kategori</th><th>Lokasi</th><th>Koordinat</th><th>Tanggal</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center;">Tidak ada data</td></tr>'}</tbody>
</table>
<div class="footer">
  <p>Dokumen ini dibuat secara otomatis oleh SIGINT - Sistem Intelijen Geospasial</p>
  <p>Hanya untuk penggunaan internal</p>
</div>
</body></html>`;
}

module.exports = router;
