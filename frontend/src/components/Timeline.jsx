import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'

const KATEGORI_COLORS = {
  'Banjir': '#2563eb', 'Gempa Bumi': '#ef4444', 'Kebakaran': '#f97316',
  'Longsor': '#854d0e', 'Angin Kencang': '#6366f1', 'Kekeringan': '#eab308',
  'Bencana Lainnya': '#a855f7', 'Berita Umum': '#22c55e',
}

export default function Timeline({ onClose }) {
  const [events, setEvents] = useState([])
  const [period, setPeriod] = useState('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTimeline()
  }, [period])

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/timeline?period=${period}`)
      setEvents(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const grouped = events.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div
        className="form-panel"
        style={{ maxWidth: '700px' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <div className="form-panel-header">
          <h2>⏱️ Timeline Kronologi</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', gap: '6px', borderBottom: '1px solid #e2e8f0' }}>
          {[['week', '7 Hari'], ['month', '30 Hari'], ['year', '1 Tahun'], ['all', 'Semua']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPeriod(val)}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: period === val ? '#2563eb' : '#f1f5f9',
                color: period === val ? 'white' : '#64748b',
                fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s',
              }}
            >{label}</button>
          ))}
        </div>

        <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Memuat timeline...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏱️</div>
              <p>Belum ada data</p>
            </div>
          ) : (
            Object.entries(grouped).map(([date, items], gi) => (
              <div key={date} style={{ marginBottom: '24px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px',
                }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%', background: '#2563eb',
                    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.2)',
                  }} />
                  <div style={{
                    flex: 1, height: '1px', background: '#e2e8f0',
                  }} />
                  <span style={{
                    fontSize: '0.85rem', fontWeight: 700, color: '#1e293b',
                    background: '#f1f5f9', padding: '4px 12px', borderRadius: '6px',
                  }}>{date}</span>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                </div>

                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      display: 'flex', gap: '12px', marginBottom: '8px',
                      paddingLeft: '18px',
                    }}
                  >
                    <div style={{
                      width: '2px', background: KATEGORI_COLORS[item.kategori] || '#e2e8f0',
                      borderRadius: '1px', flexShrink: 0,
                    }} />
                    <div style={{
                      background: 'white', borderRadius: '8px', padding: '10px 14px',
                      border: '1px solid #e2e8f0', flex: 1, transition: 'all 0.2s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '0.88rem' }}>{item.judul}</strong>
                          <div style={{
                            display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
                            fontSize: '0.72rem', fontWeight: 600, color: 'white',
                            background: KATEGORI_COLORS[item.kategori] || '#64748b',
                            marginLeft: '8px',
                          }}>{item.kategori}</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {item.time}
                        </span>
                      </div>
                      {item.lokasi_nama && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                          📍 {item.lokasi_nama}
                        </div>
                      )}
                      {item.deskripsi && (
                        <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                          {item.deskripsi.length > 120 ? item.deskripsi.substring(0, 120) + '...' : item.deskripsi}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}
