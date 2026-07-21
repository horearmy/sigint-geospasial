import { motion } from 'framer-motion'
import { useToast } from '../App'
import { formatCoordinate } from '../utils/coordinates'

export default function DetailPanel({ laporan, onEdit, onDelete, onClose, getKategoriColor, getKategoriIcon, onComment }) {
  const addToast = useToast()

  const handleDelete = async () => {
    if (!confirm('Yakin ingin menghapus laporan ini?')) return
    const success = await onDelete(laporan.id)
    if (success) addToast('Laporan berhasil dihapus', 'success')
    else addToast('Gagal menghapus laporan', 'error')
  }

  return (
    <motion.div className="detail-panel"
      initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <div className="detail-content">
        {laporan.gambar && <img src={`/uploads/${laporan.gambar}`} alt={laporan.judul} className="detail-image" />}
        <div className="detail-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3>{laporan.judul}</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>×</button>
          </div>
          <div className="detail-meta">
            <span className="kategori-badge" style={{ background: getKategoriColor(laporan.kategori) }}>
              {getKategoriIcon(laporan.kategori)} {laporan.kategori}
            </span>
            {laporan.lokasi_nama && <span className="detail-meta-item">📍 {laporan.lokasi_nama}</span>}
            <span className="detail-meta-item">🌐 {parseFloat(laporan.latitude).toFixed(6)}, {parseFloat(laporan.longitude).toFixed(6)}</span>
            <span className="detail-meta-item" style={{ fontFamily: 'monospace', color: '#c9a84c', fontWeight: 600 }}>🔷 {formatCoordinate(laporan.latitude, laporan.longitude, 'mgrs')}</span>
            <span className="detail-meta-item" style={{ fontFamily: 'monospace', color: '#86efac' }}>🔷 {formatCoordinate(laporan.latitude, laporan.longitude, 'utm')}</span>
            <span className="detail-meta-item">🕐 {new Date(laporan.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {laporan.deskripsi && <p className="detail-desc">{laporan.deskripsi}</p>}
        </div>
        <div className="detail-actions" style={{ flexDirection: 'column', gap: '6px' }}>
          <button className="btn btn-ghost btn-sm" onClick={onComment} style={{ color: '#1b4332', border: '1px solid #1b4332' }}>💬</button>
          <button className="btn btn-primary btn-sm" onClick={() => onEdit(laporan)}>✏️</button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑️</button>
        </div>
      </div>
    </motion.div>
  )
}
