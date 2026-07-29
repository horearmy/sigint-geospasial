import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../utils/api'
import { useToast } from '../contexts/ToastContext'

const KATEGORI = [
  { key: 'gangguan_keamanan', label: 'Gangguan Keamanan', icon: '🚨', color: '#ef4444' },
  { key: 'separatisme', label: 'Separatisme', icon: '🏴', color: '#7c3aed' },
  { key: 'terorisme', label: 'Terorisme', icon: '💣', color: '#dc2626' },
  { key: 'radikalisme', label: 'Radikalisme', icon: '⚔️', color: '#ea580c' },
  { key: 'keamanan_nasional', label: 'Keamanan Nasional', icon: '🛡️', color: '#1b4332' },
  { key: 'politik', label: 'Politik', icon: '🏛️', color: '#0891b2' },
  { key: 'sosial', label: 'Sosial', icon: '👥', color: '#16a34a' },
  { key: 'ekonomi', label: 'Ekonomi', icon: '💰', color: '#ca8a04' },
  { key: 'informasi_lain', label: 'Informasi Lain', icon: '📢', color: '#6366f1' },
];

const SUBKATEGORI = {
  gangguan_keamanan: ['Kriminalitas', 'Konflik Sosial', 'Tawuran', 'Narkotika', 'Senjata Ilegal'],
  separatisme: ['Aktivitas Kelompok Separatis', 'Wilayah Aktivitas', 'Modus', 'Pola Serangan', 'Rekrutmen'],
  terorisme: ['Aktivitas Kelompok Teroris', 'Jaringan', 'Pendanaan', 'Propaganda', 'Perekrutan'],
  radikalisme: ['Organisasi Garis Kiri', 'Organisasi Garis Kanan', 'Penyebaran Ideologi Ekstrem', 'Aktivitas Propaganda'],
  keamanan_nasional: ['Sabotase', 'Spionase', 'Ancaman Siber', 'Infrastruktur Strategis', 'Gangguan Objek Vital'],
  politik: ['Dinamika Politik', 'Demonstrasi', 'Konflik Elit', 'Potensi Kerawanan'],
  sosial: ['Konflik SARA', 'Bencana', 'Kerusuhan', 'Migrasi'],
  ekonomi: ['Penimbunan', 'Inflasi', 'Penyelundupan', 'Gangguan Distribusi'],
  informasi_lain: ['Isu Viral', 'Disinformasi', 'Hoaks', 'Operasi Pengaruh', 'Ancaman Lain'],
};

const LEVEL_LABEL = { 1: { text: 'Rendah', color: '#16a34a' }, 2: { text: 'Sedang', color: '#ca8a04' }, 3: { text: 'Tinggi', color: '#ea580c' }, 4: { text: 'Kritis', color: '#dc2626' } };

export default function OsintFeed({ onClose, onCreateLaporan }) {
  const addToast = useToast()
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeKategori, setActiveKategori] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [view, setView] = useState('grid')

  useEffect(() => { fetchItems(); fetchStats(); }, [activeKategori, page])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 30 }
      if (activeKategori) params.kategori = activeKategori
      if (search) params.search = search
      const res = await api.get('/api/intelligence/list', { params })
      setItems(res.data.data.items)
      setTotalPages(res.data.data.pages)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchStats = async () => {
    try { const res = await api.get('/api/intelligence/stats'); setStats(res.data.data) } catch (err) { console.error(err) }
  }

  const handleSearch = () => { setPage(1); fetchItems() }

  const handleCrawl = async () => {
    setCrawling(true)
    try {
      await api.post('/api/intelligence/crawl')
      addToast('Crawl dimulai, tunggu beberapa saat', 'info')
      setTimeout(() => { fetchItems(); fetchStats(); }, 15000)
    } catch (err) { addToast('Gagal crawl', 'error') }
    finally { setTimeout(() => setCrawling(false), 5000) }
  }

  const handleAdd = async (form) => {
    try {
      await api.post('/api/intelligence/add', form)
      addToast('Data intelijen berhasil ditambahkan', 'success')
      setShowAdd(false)
      fetchItems(); fetchStats()
    } catch (err) { addToast(err?.response?.data?.error || 'Gagal menyimpan', 'error') }
  }

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.put(`/api/intelligence/update/${id}`, { status })
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
      addToast('Status diperbarui', 'success')
    } catch (err) { addToast('Gagal update', 'error') }
  }

  const getKatInfo = (key) => KATEGORI.find(k => k.key === key) || { icon: '📌', label: key, color: '#666' }

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel intel-panel" onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>

        <div className="form-panel-header">
          <h2>🛡️ Intelijen & OSINT</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? '✕ Tutup' : '+ Input Manual'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleCrawl} disabled={crawling}
              style={{ color: '#1b4332', border: '1px solid #1b4332' }}>
              {crawling ? '⏳ Crawling...' : '🔄 Crawl'}
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <AnimatePresence>
          {showAdd && <IntelForm kategori={KATEGORI} subkategori={SUBKATEGORI} onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />}
        </AnimatePresence>

        <div className="intel-stats-grid">
          {KATEGORI.map(k => {
            const stat = stats?.by_kategori?.find(s => s.kategori === k.key)
            const count = stat?.count || 0
            return (
              <button key={k.key}
                className={`intel-stat-card ${activeKategori === k.key ? 'active' : ''}`}
                onClick={() => { setActiveKategori(activeKategori === k.key ? '' : k.key); setPage(1) }}
                style={{ '--accent': k.color }}>
                <span className="intel-stat-icon">{k.icon}</span>
                <span className="intel-stat-count">{count}</span>
                <span className="intel-stat-label">{k.label}</span>
              </button>
            )
          })}
        </div>

        <div style={{ padding: '8px 16px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="🔍 Cari intelijen..." style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', background: 'var(--bg)', color: 'var(--text)' }} />
          <button className="btn btn-primary btn-sm" onClick={handleSearch}>Cari</button>
          {activeKategori && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setActiveKategori(''); setPage(1) }}>
              ✕ Filter: {getKatInfo(activeKategori).icon} {getKatInfo(activeKategori).label}
            </button>
          )}
        </div>

        <div style={{ padding: '8px 16px', fontSize: '0.78rem', color: 'var(--text-light)' }}>
          Total: {stats?.total || 0} item · Halaman {page}/{totalPages}
        </div>

        <div className="intel-list" style={{ padding: '8px 16px', maxHeight: '50vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>Memuat data...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
              Belum ada data intelijen. Klik <b>🔄 Crawl</b> untuk mengumpulkan data.
            </div>
          ) : (
            items.map((item, i) => {
              const kInfo = getKatInfo(item.kategori)
              const level = LEVEL_LABEL[item.ancaman_level] || LEVEL_LABEL[1]
              return (
                <motion.div key={item.id} className="intel-item"
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                  <div className="intel-item-header">
                    <span className="intel-item-kat" style={{ background: kInfo.color + '18', color: kInfo.color }}>
                      {kInfo.icon} {kInfo.label}
                    </span>
                    {item.subkategori && <span className="intel-item-sub">{item.subkategori}</span>}
                    <span className="intel-item-level" style={{ background: level.color + '18', color: level.color }}>
                      ⚠ {level.text}
                    </span>
                    <span className={`intel-item-status status-${item.status}`}>
                      {item.status === 'baru' ? '🟢 Baru' : item.status === 'diproses' ? '🟡 Diproses' : '⚪ Selesai'}
                    </span>
                  </div>
                  <strong className="intel-item-title" onClick={() => { if (item.sumber_url && item.sumber_url.startsWith('https://')) window.open(item.sumber_url, '_blank', 'noopener,noreferrer') }}>
                    {item.judul}
                  </strong>
                  {item.deskripsi && <p className="intel-item-desc">{item.deskripsi}</p>}
                  <div className="intel-item-footer">
                    <span>{item.sumber} · {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <div className="intel-item-actions">
                      {item.status === 'baru' && (
                        <button className="btn btn-ghost btn-xs" onClick={() => handleUpdateStatus(item.id, 'diproses')}>📋 Proses</button>
                      )}
                      {item.status === 'diproses' && (
                        <button className="btn btn-ghost btn-xs" onClick={() => handleUpdateStatus(item.id, 'selesai')}>✓ Selesai</button>
                      )}
                      {item.sumber_url && (
                        <button className="btn btn-ghost btn-xs" onClick={() => { if (item.sumber_url && item.sumber_url.startsWith('https://')) window.open(item.sumber_url, '_blank', 'noopener,noreferrer') }}>🔗 Buka</button>
                      )}
                      <button className="btn btn-primary btn-xs" onClick={() => onCreateLaporan && onCreateLaporan(item)}>📝 Buat Laporan</button>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'center', gap: '8px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ padding: '4px 12px', fontSize: '0.85rem', color: 'var(--text-light)' }}>{page} / {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function IntelForm({ kategori, subkategori, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    kategori: 'gangguan_keamanan', subkategori: '', judul: '', deskripsi: '',
    sumber: '', sumber_url: '', ancaman_level: 1, lokasi_nama: '', latitude: '', longitude: '',
  })

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.judul) return
    onSubmit(form)
  }

  return (
    <motion.div className="intel-form"
      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      style={{ overflow: 'hidden', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
      <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>Kategori *</label>
            <select name="kategori" value={form.kategori} onChange={handleChange}>
              {kategori.map(k => <option key={k.key} value={k.key}>{k.icon} {k.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sub Kategori</label>
            <select name="subkategori" value={form.subkategori} onChange={handleChange}>
              <option value="">Pilih sub kategori...</option>
              {(subkategori[form.kategori] || []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Judul *</label>
            <input type="text" name="judul" value={form.judul} onChange={handleChange} placeholder="Judul laporan intelijen" required />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Deskripsi</label>
            <textarea name="deskripsi" value={form.deskripsi} onChange={handleChange} placeholder="Detail kejadian..." rows="3" />
          </div>
          <div className="form-group">
            <label>Sumber</label>
            <input type="text" name="sumber" value={form.sumber} onChange={handleChange} placeholder="Contoh: Media Online" />
          </div>
          <div className="form-group">
            <label>URL Sumber</label>
            <input type="text" name="sumber_url" value={form.sumber_url} onChange={handleChange} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>Ancaman Level</label>
            <select name="ancaman_level" value={form.ancaman_level} onChange={handleChange}>
              <option value={1}>1 - Rendah</option>
              <option value={2}>2 - Sedang</option>
              <option value={3}>3 - Tinggi</option>
              <option value={4}>4 - Kritis</option>
            </select>
          </div>
          <div className="form-group">
            <label>Lokasi</label>
            <input type="text" name="lokasi_nama" value={form.lokasi_nama} onChange={handleChange} placeholder="Nama lokasi" />
          </div>
          <div className="form-group">
            <label>Latitude</label>
            <input type="number" step="any" name="latitude" value={form.latitude} onChange={handleChange} placeholder="-2.5489" />
          </div>
          <div className="form-group">
            <label>Longitude</label>
            <input type="number" step="any" name="longitude" value={form.longitude} onChange={handleChange} placeholder="118.0149" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Batal</button>
          <button type="submit" className="btn btn-primary btn-sm">💾 Simpan</button>
        </div>
      </form>
    </motion.div>
  )
}
