import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'

export default function AnalysisPanel({ onClose }) {
  const [hotspots, setHotspots] = useState([])
  const [anomalies, setAnomalies] = useState(null)
  const [spatial, setSpatial] = useState([])
  const [activeTab, setActiveTab] = useState('hotspots')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [h, a, s] = await Promise.all([
        axios.get('/api/analysis/hotspots'),
        axios.get('/api/analysis/anomalies'),
        axios.get('/api/analysis/spatial'),
      ])
      setHotspots(h.data.data)
      setAnomalies(a.data.data)
      setSpatial(s.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

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
          <h2>🧠 Auto Analysis Engine</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '2px', padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          {[['hotspots', '🔥 Hotspots'], ['anomalies', '⚠️ Anomali'], ['spatial', '📊 Spatial']].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === tab ? '#2563eb' : 'transparent',
                color: activeTab === tab ? 'white' : '#64748b',
                fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
              }}
            >{label}</button>
          ))}
        </div>

        <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Menganalisis data...</div>
          ) : (
            <>
              {activeTab === 'hotspots' && (
                <div>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
                    Area dengan konsentrasi insiden tinggi (clustering otomatis)
                  </p>
                  {hotspots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Belum ada hotspot terdeteksi</div>
                  ) : (
                    hotspots.map((h, i) => (
                      <div key={i} style={{
                        padding: '12px 16px', borderRadius: '8px', marginBottom: '8px',
                        background: '#fef2f2', border: '1px solid #fecaca',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: '0.9rem' }}>Hotspot #{i + 1}</strong>
                          <span style={{
                            background: '#dc2626', color: 'white', padding: '2px 10px',
                            borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                          }}>{h.cluster_size} insiden</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                          📍 {parseFloat(h.avg_lat).toFixed(4)}, {parseFloat(h.avg_lng).toFixed(4)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                          Kategori: {h.kategori_types.join(', ')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'anomalies' && anomalies && (
                <div>
                  {anomalies.summary && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                      {[
                        ['📊', 'Total', anomalies.summary.total],
                        ['🏷️', 'Kategori', anomalies.summary.kategori_count],
                        ['📅', 'Hari Aktif', anomalies.summary.days_active],
                      ].map(([icon, label, val]) => (
                        <div key={label} style={{
                          padding: '14px', borderRadius: '8px', background: '#f8fafc',
                          border: '1px solid #e2e8f0', textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>{val || 0}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{icon} {label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '12px' }}>
                    Hari dengan lonjakan tidak normal (z-score {'>'} 2)
                  </p>
                  {anomalies.anomalies.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Tidak ada anomali terdeteksi</div>
                  ) : (
                    anomalies.anomalies.map((a, i) => (
                      <div key={i} style={{
                        padding: '10px 14px', borderRadius: '8px', marginBottom: '6px',
                        background: '#fffbeb', border: '1px solid #fde68a',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: '0.88rem' }}>
                          📅 {new Date(a.day).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#d97706' }}>{a.count} insiden</span>
                          <span style={{
                            background: '#f59e0b', color: 'white', padding: '2px 8px',
                            borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600,
                          }}>z: {a.z_score}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'spatial' && (
                <div>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
                    Distribusi spasial per kategori
                  </p>
                  {spatial.map((s, i) => {
                    const colors = { 'Banjir': '#2563eb', 'Gempa Bumi': '#ef4444', 'Kebakaran': '#f97316', 'Longsor': '#854d0e', 'Angin Kencang': '#6366f1', 'Kekeringan': '#eab308', 'Bencana Lainnya': '#a855f7', 'Berita Umum': '#22c55e' }
                    return (
                      <div key={i} style={{
                        padding: '14px', borderRadius: '8px', marginBottom: '8px',
                        background: (colors[s.kategori] || '#64748b') + '10',
                        borderLeft: `4px solid ${colors[s.kategori] || '#64748b'}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{s.kategori}</strong>
                          <span style={{ fontWeight: 700, color: colors[s.kategori] }}>{s.total} insiden</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                          Centroid: {parseFloat(s.avg_lat).toFixed(4)}, {parseFloat(s.avg_lng).toFixed(4)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
