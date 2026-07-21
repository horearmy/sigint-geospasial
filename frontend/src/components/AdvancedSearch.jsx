import { useState } from 'react'
import { motion } from 'framer-motion'

const KATEGORI_LIST = ['Banjir', 'Gempa Bumi', 'Kebakaran', 'Longsor', 'Angin Kencang', 'Kekeringan', 'Bencana Lainnya', 'Berita Umum']

export default function AdvancedSearch({ onSearch, onClose }) {
  const [filters, setFilters] = useState({
    search: '', kategori: '', date_from: '', date_to: '',
    lat: '', lng: '', radius: '',
  })

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const params = {}
    if (filters.search) params.search = filters.search
    if (filters.kategori) params.kategori = filters.kategori
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to
    if (filters.lat && filters.lng && filters.radius) {
      params.lat = filters.lat
      params.lng = filters.lng
      params.radius = filters.radius
    }
    onSearch(params)
  }

  const handleReset = () => {
    setFilters({ search: '', kategori: '', date_from: '', date_to: '', lat: '', lng: '', radius: '' })
    onSearch({})
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div
        className="form-panel"
        style={{ maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <div className="form-panel-header">
          <h2>🔍 Pencarian Lanjutan</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-body">
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Kata Kunci</label>
              <input name="search" value={filters.search} onChange={handleChange}
                placeholder="Cari judul, deskripsi, lokasi..."
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Kategori</label>
              <select name="kategori" value={filters.kategori} onChange={handleChange}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }}>
                <option value="">Semua Kategori</option>
                {KATEGORI_LIST.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Dari Tanggal</label>
                <input name="date_from" type="date" value={filters.date_from} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sampai Tanggal</label>
                <input name="date_to" type="date" value={filters.date_to} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pencarian Berdasarkan Lokasi (meter)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input name="lat" value={filters.lat} onChange={handleChange} placeholder="Lat"
                  style={{ flex: 1, padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }} />
                <input name="lng" value={filters.lng} onChange={handleChange} placeholder="Lng"
                  style={{ flex: 1, padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }} />
                <input name="radius" value={filters.radius} onChange={handleChange} placeholder="Radius (m)"
                  style={{ flex: 1, padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }} />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleReset} className="btn btn-outline" style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
                Reset
              </button>
              <button type="submit" className="btn btn-primary">
                🔍 Cari
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
