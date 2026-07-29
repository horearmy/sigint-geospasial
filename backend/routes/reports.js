const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateReportHtml(data, options) {
  const { laporan, stats, kategoriData, dateRange, generatedAt, user } = data;
  const total = stats?.total || 0;
  const signedCount = laporan.filter(l => l.signature_url).length;

  const kategoriRows = (kategoriData || []).map(k => `
    <tr>
      <td>${escapeHtml(k.kategori)}</td>
      <td>${k.count}</td>
      <td><div class="bar" style="width:${Math.min((k.count / Math.max(...kategoriData.map(x => x.count), 1)) * 100, 100)}%"></div></td>
    </tr>
  `).join('')

  const laporanRows = laporan.slice(0, 50).map(l => `
    <tr>
      <td>#${l.id}</td>
      <td>${escapeHtml(l.judul)}</td>
      <td><span class="badge" style="background:${getKategoriColor(l.kategori)}">${escapeHtml(l.kategori)}</span></td>
      <td>${l.lokasi_nama ? escapeHtml(l.lokasi_nama) : '-'}</td>
      <td>${l.signature_url ? '✅' : '❌'}</td>
      <td>${new Date(l.created_at).toLocaleDateString('id-ID')}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>Laporan SIGINT KOSTRAD</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #07110A; color: #F8FAFC; padding: 30px; }
  .header { text-align: center; padding: 30px; background: linear-gradient(135deg, #041A0D, #0A1A10); border-radius: 16px; margin-bottom: 24px; border: 1px solid rgba(61,220,132,0.2); }
  .header h1 { font-size: 1.6rem; color: #3DDC84; margin-bottom: 4px; }
  .header .meta { font-size: 0.8rem; color: #94A3B8; }
  .section { background: #102114; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #2D5B3A; }
  .section h2 { font-size: 1.1rem; color: #3DDC84; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid rgba(61,220,132,0.15); }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .stat-card { background: rgba(61,220,132,0.06); border-radius: 10px; padding: 16px; text-align: center; border: 1px solid rgba(61,220,132,0.1); }
  .stat-card .value { font-size: 1.6rem; font-weight: 700; color: #3DDC84; }
  .stat-card .label { font-size: 0.75rem; color: #94A3B8; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { text-align: left; padding: 10px 12px; background: rgba(61,220,132,0.08); color: #3DDC84; font-weight: 600; border-bottom: 1px solid #2D5B3A; }
  td { padding: 10px 12px; border-bottom: 1px solid rgba(45,91,58,0.3); }
  tr:hover td { background: rgba(61,220,132,0.04); }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; color: #fff; font-size: 0.72rem; font-weight: 600; }
  .bar { height: 6px; background: #3DDC84; border-radius: 3px; }
  .footer { text-align: center; font-size: 0.72rem; color: #64748B; padding: 20px; }
  @media print { body { background: #fff; color: #000; } .section { background: #fff; border-color: #ddd; } .header { background: #f0fdf4; border-color: #86efac; } .header h1 { color: #166534; } .stat-card { background: #f0fdf4; } .section h2 { color: #166534; } th { background: #f0fdf4; color: #166534; } td { border-color: #e2e8f0; } }
</style></head>
<body>
  <div class="header">
    <h1>🛡️ SIGINT KOSTRAD</h1>
    <p style="color:#94A3B8;margin-bottom:4px">Sistem Intelijen Geospasial — Laporan Resmi</p>
    <div class="meta">
      Periode: ${escapeHtml(dateRange)} | Dicetak: ${generatedAt} | Oleh: ${escapeHtml(user)}
    </div>
  </div>

  <div class="section">
    <h2>📊 Ringkasan</h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="value">${total}</div><div class="label">Total Laporan</div></div>
      <div class="stat-card"><div class="value">${kategoriData?.length || 0}</div><div class="label">Kategori Aktif</div></div>
      <div class="stat-card"><div class="value">${signedCount}</div><div class="label">Telah Ditandatangani</div></div>
      <div class="stat-card"><div class="value">${total - signedCount}</div><div class="label">Belum Ditandatangani</div></div>
    </div>
  </div>

  <div class="section">
    <h2>📈 Distribusi Kategori</h2>
    <table><thead><tr><th>Kategori</th><th>Jumlah</th><th></th></tr></thead><tbody>${kategoriRows}</tbody></table>
  </div>

  <div class="section">
    <h2>📋 Daftar Laporan (${Math.min(laporan.length, 50)} dari ${total})</h2>
    <table>
      <thead><tr><th>ID</th><th>Judul</th><th>Kategori</th><th>Lokasi</th><th>TTD</th><th>Tanggal</th></tr></thead>
      <tbody>${laporanRows}</tbody>
    </table>
    ${laporan.length > 50 ? `<p style="text-align:center;margin-top:12px;color:#94A3B8">Menampilkan 50 dari ${total} laporan</p>` : ''}
  </div>

  <div class="footer">
    <p>Dokumen ini digenerate otomatis oleh SIGINT KOSTRAD — © ${new Date().getFullYear()}</p>
    <p style="margin-top:4px">RAHASIA — Hanya untuk kalangan terbatas</p>
  </div>
</body></html>`
}

function getKategoriColor(k) {
  const colors = {
    'Gangguan Keamanan': '#ef4444', 'Separatisme': '#7c3aed', 'Terorisme': '#dc2626',
    'Radikalisme': '#ea580c', 'Keamanan Nasional': '#1b4332', 'Politik': '#0891b2',
    'Sosial': '#16a34a', 'Ekonomi': '#ca8a04', 'Informasi Lain': '#c9a84c',
  }
  return colors[k] || '#666'
}

router.get('/generate', authMiddleware, async (req, res) => {
  try {
    const { date_from, date_to, kategori } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    let idx = 1;

    if (date_from) { where += ` AND l.created_at >= $${idx++}`; params.push(date_from); }
    if (date_to) { where += ` AND l.created_at <= $${idx++}`; params.push(date_to + 'T23:59:59'); }
    if (kategori) { where += ` AND l.kategori = $${idx++}`; params.push(kategori); }

    const result = await pool.query(`
      SELECT l.id, l.judul, l.kategori, l.lokasi_nama, l.signature_url,
        ST_X(l.koordinat::geometry) AS longitude,
        ST_Y(l.koordinat::geometry) AS latitude,
        l.created_at
      FROM laporan l ${where} ORDER BY l.created_at DESC
    `, params);

    const statsResult = await pool.query(`
      SELECT COUNT(*)::int AS total FROM laporan l ${where}
    `, params);

    const kategoriResult = await pool.query(`
      SELECT l.kategori, COUNT(*)::int AS count FROM laporan l ${where} GROUP BY l.kategori ORDER BY count DESC
    `, params);

    const dateRange = date_from && date_to
      ? `${new Date(date_from).toLocaleDateString('id-ID')} — ${new Date(date_to).toLocaleDateString('id-ID')}`
      : 'Semua waktu';

    const html = generateReportHtml({
      laporan: result.rows,
      stats: statsResult.rows[0],
      kategoriData: kategoriResult.rows,
      dateRange,
      generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      user: req.user?.username || 'System',
    }, req.query);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="laporan-sigint-${Date.now()}.html"`);
    res.send(html);
  } catch (err) {
    console.error('Report generate error:', err);
    res.status(500).json({ success: false, error: 'Gagal generate report' });
  }
});

module.exports = router;
