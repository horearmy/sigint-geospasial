import { useState } from 'react'
import { motion } from 'framer-motion'
import { SkeletonCard } from './SkeletonLoader'

const ITEMS_PER_PAGE = 50
const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

export default function LaporanList({ laporan, selectedId, onSelect, getKategoriColor, getKategoriIcon, loading }) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

  if (loading) {
    return (
      <div className="laporan-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (laporan.length === 0) {
    return (
      <motion.div
        className="empty-state"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="icon">📍</div>
        <p style={{ fontWeight: 600 }}>Belum ada laporan</p>
        <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
          Klik "+ Laporan Baru" untuk menambahkan
        </p>
      </motion.div>
    )
  }

  const visibleLaporan = laporan.slice(0, visibleCount)
  const hasMore = visibleCount < laporan.length

  return (
    <motion.div className="laporan-list" variants={listVariants} initial="hidden" animate="show">
      {visibleLaporan.map((l) => (
        <motion.div
          key={l.id}
          className={`laporan-card ${selectedId === l.id ? 'active' : ''}`}
          onClick={() => onSelect(l)}
          variants={cardVariants}
          layout
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          style={{ '--card-color': getKategoriColor(l.kategori) }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 3,
              height: '100%',
              background: getKategoriColor(l.kategori),
              borderRadius: '3px 0 0 3px',
            }}
          />
          <div className="laporan-card-top">
            {l.gambar && (
              <img
                src={`/uploads/${l.gambar}`}
                alt={l.judul}
                className="laporan-card-thumb"
              />
            )}
            <div className="laporan-card-info">
              <h3>{l.judul}</h3>
              <div className="meta">
                <span
                  className="kategori-badge"
                  style={{ background: getKategoriColor(l.kategori) }}
                >
                  {getKategoriIcon(l.kategori)} {l.kategori}
                </span>
              </div>
            </div>
          </div>
          {l.lokasi_nama && (
            <div className="meta" style={{ marginTop: '8px', paddingLeft: l.gambar ? '60px' : '0' }}>
              <span>📍 {l.lokasi_nama}</span>
            </div>
          )}
          {l.deskripsi && (
            <div className="laporan-card-desc" style={{ paddingLeft: l.gambar ? '60px' : '0' }}>
              {l.deskripsi}
            </div>
          )}
          <div className="meta" style={{ marginTop: '6px', paddingLeft: l.gambar ? '60px' : '0' }}>
            <span>🕐 {new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span>🌐 {parseFloat(l.latitude).toFixed(4)}, {parseFloat(l.longitude).toFixed(4)}</span>
            {l.signature_url && <span style={{ color: '#22C55E' }}>✅</span>}
          </div>
        </motion.div>
      ))}
      {hasMore && (
        <motion.div
          className="load-more"
          onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.02 }}
          style={{
            textAlign: 'center', padding: '12px', margin: '8px 0', cursor: 'pointer',
            color: '#3DDC84', fontWeight: 600, fontSize: '0.85rem',
            borderRadius: 8, border: '1px solid rgba(61,220,132,0.3)',
            background: 'rgba(61,220,132,0.08)',
          }}
        >
          + Muat {Math.min(ITEMS_PER_PAGE, laporan.length - visibleCount)} lagi ({laporan.length - visibleCount} tersisa)
        </motion.div>
      )}
    </motion.div>
  )
}
