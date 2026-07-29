import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'

const TIME_LABELS = [
  { ms: 60000, label: 'menit' },
  { ms: 3600000, label: 'jam' },
  { ms: 86400000, label: 'hari' },
]

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60000) return 'Baru saja'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m lalu`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}j lalu`
  return `${Math.floor(diff / 86400000)}h lalu`
}

export default function NewsTicker({ laporan, getKategoriColor, getKategoriIcon, onLaporanClick }) {
  const [intelItems, setIntelItems] = useState([])
  const [paused, setPaused] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    const fetchIntel = async () => {
      try {
        const res = await api.get('/api/intelligence/list', { params: { limit: 10, page: 1 } })
        setIntelItems(res.data.data.items || [])
      } catch {}
    }
    fetchIntel()
    const interval = setInterval(fetchIntel, 30000)
    return () => clearInterval(interval)
  }, [])

  const laporanItems = (laporan || []).slice(0, 10).map(l => ({
    id: l.id,
    type: 'laporan',
    judul: l.judul,
    kategori: l.kategori,
    lokasi_nama: l.lokasi_nama || '',
    created_at: l.created_at,
  }))

  const intelMapped = intelItems.slice(0, 10).map(i => ({
    id: i.id,
    type: 'intel',
    judul: i.judul,
    kategori: i.kategori,
    lokasi_nama: i.lokasi_nama || '',
    created_at: i.created_at,
  }))

  const allItems = [...laporanItems, ...intelMapped].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )

  if (allItems.length === 0) return null

  const tickerContent = allItems.map((item, idx) => {
    const color = getKategoriColor(item.kategori)
    const icon = getKategoriIcon(item.kategori)
    const isIntel = item.type === 'intel'
    return (
      <span
        key={`${item.type}-${item.id}-${idx}`}
        className="news-ticker-item"
        onClick={() => {
          if (item.type === 'laporan' && onLaporanClick) onLaporanClick(item.id)
        }}
        style={{ cursor: item.type === 'laporan' ? 'pointer' : 'default' }}
      >
        {isIntel && <span className="news-ticker-badge-intel">OSINT</span>}
        <span className="news-ticker-dot" style={{ background: color }} />
        <span className="news-ticker-kategori" style={{ color }}>{icon} {item.kategori}</span>
        <span className="news-ticker-judul">{item.judul}</span>
        {item.lokasi_nama && <span className="news-ticker-lokasi">📍 {item.lokasi_nama}</span>}
        <span className="news-ticker-waktu">{getTimeAgo(item.created_at)}</span>
      </span>
    )
  })

  return (
    <div
      className="news-ticker"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="news-ticker-label">
        <span className="news-ticker-live-dot" />
        LIVE
      </div>
      <div className="news-ticker-scroll">
        <div
          ref={scrollRef}
          className={`news-ticker-track ${paused ? 'paused' : ''}`}
        >
          {tickerContent}
          {tickerContent}
        </div>
      </div>
    </div>
  )
}
