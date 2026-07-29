import { useState } from 'react'
import { motion } from 'framer-motion'
import api from '../utils/api'
import { useToast } from '../contexts/ToastContext'

export default function ReportGenerator({ onClose }) {
  const addToast = useToast()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [kategori, setKategori] = useState('')
  const [loading, setLoading] = useState(false)

  const KATEGORI = ['', 'Gangguan Keamanan', 'Separatisme', 'Terorisme', 'Radikalisme', 'Keamanan Nasional', 'Politik', 'Sosial', 'Ekonomi', 'Informasi Lain']

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (kategori) params.kategori = kategori

      const res = await api.get('/api/reports/generate', {
        params,
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/html' }))
      const w = window.open(url, '_blank')
      if (!w) {
        const a = document.createElement('a')
        a.href = url
        a.download = `laporan-sigint-${Date.now()}.html`
        a.click()
      }
      addToast('Report berhasil digenerate!', 'success')
    } catch (err) {
      addToast(err.response?.data?.error || 'Gagal generate report', 'error')
    } finally {
      setLoading(false)
    }
  }

  const setQuickRange = (days) => {
    const to = new Date()
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    setDateTo(to.toISOString().split('T')[0])
    setDateFrom(from.toISOString().split('T')[0])
  }

  return (
    <div className="form-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <motion.div className="form-panel" style={{ maxWidth: 500 }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="form-panel-header">
          <h2>📑 Generator Laporan</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="form-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: '7 Hari', days: 7 },
              { label: '30 Hari', days: 30 },
              { label: '90 Hari', days: 90 },
              { label: 'Semua', days: 0 },
            ].map(q => (
              <button key={q.label} className="btn btn-sm btn-outline"
                onClick={() => q.days === 0 ? (setDateFrom(''), setDateTo('')) : setQuickRange(q.days)}
                style={{ fontSize: '0.75rem' }}>
                {q.label}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label>Dari Tanggal</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Sampai Tanggal</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Kategori (opsional)</label>
            <select value={kategori} onChange={e => setKategori(e.target.value)}>
              <option value="">Semua Kategori</option>
              {KATEGORI.filter(Boolean).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div style={{
            background: 'rgba(61,220,132,0.06)', borderRadius: 10, padding: '12px 16px', marginBottom: 16,
            border: '1px solid rgba(61,220,132,0.12)', fontSize: '0.78rem', color: '#94A3B8',
          }}>
            <strong style={{ color: '#3DDC84' }}>ℹ️ Informasi</strong>
            <p style={{ marginTop: 4 }}>Report akan terbuka di tab baru. Gunakan <kbd style={{ background: '#1b4332', padding: '2px 6px', borderRadius: 4, color: '#3DDC84' }}>Ctrl+P</kbd> untuk mencetak ke PDF.</p>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}
              style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
              {loading ? '⏳ Mengenerate...' : '📑 Generate Report'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
