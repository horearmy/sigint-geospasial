import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../App'

export default function OsintFeed({ onClose }) {
  const { user } = useAuth()
  const addToast = useToast()
  const [feeds, setFeeds] = useState([])
  const [sources, setSources] = useState([])
  const [lastCrawl, setLastCrawl] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [crawling, setCrawling] = useState(false)
  const [activeSource, setActiveSource] = useState('')

  useEffect(() => { fetchFeeds() }, [])

  const fetchFeeds = async () => {
    try {
      const res = await axios.get('/api/osint/feeds')
      setFeeds(res.data.data.items)
      setSources(res.data.data.sources)
      setLastCrawl(res.data.data.lastCrawl)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleCrawl = async () => {
    setCrawling(true)
    try {
      await axios.post('/api/osint/crawl')
      addToast('Crawl dimulai, tunggu beberapa saat', 'info')
      setTimeout(fetchFeeds, 10000)
    } catch (err) { addToast('Gagal crawl', 'error') }
    finally { setTimeout(() => setCrawling(false), 5000) }
  }

  const handleSearch = async () => {
    try {
      const res = await axios.get(`/api/osint/feeds/search?q=${search}`)
      setFeeds(res.data.data)
    } catch (err) { console.error(err) }
  }

  const filtered = activeSource ? feeds.filter(f => f.source === activeSource) : feeds

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel" style={{ maxWidth: '750px' }}
        onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="form-panel-header">
          <h2>🌐 OSINT Feed</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="🔍 Cari berita..." style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }} />
          <button className="btn btn-primary btn-sm" onClick={handleSearch}>Cari</button>
          <button className="btn btn-ghost btn-sm" onClick={handleCrawl} disabled={crawling}
            style={{ color: '#2563eb', border: '1px solid #2563eb' }}>
            {crawling ? '⏳ Crawling...' : '🔄 Refresh'}
          </button>
        </div>

        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveSource('')}
            style={{
              padding: '4px 12px', borderRadius: '12px', border: 'none', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              background: !activeSource ? '#2563eb' : '#f1f5f9', color: !activeSource ? 'white' : '#64748b',
            }}>Semua ({feeds.length})</button>
          {sources.map(s => (
            <button key={s} onClick={() => setActiveSource(s)}
              style={{
                padding: '4px 12px', borderRadius: '12px', border: 'none', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                background: activeSource === s ? '#2563eb' : '#f1f5f9', color: activeSource === s ? 'white' : '#64748b',
              }}>{s} ({feeds.filter(f => f.source === s).length})</button>
          ))}
        </div>

        {lastCrawl && (
          <div style={{ padding: '6px 16px', fontSize: '0.75rem', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>
            Terakhir crawl: {new Date(lastCrawl).toLocaleString('id-ID')} · Total: {feeds.length} item
          </div>
        )}

        <div style={{ padding: '12px', maxHeight: '55vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Memuat feed...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Tidak ada data</div>
          ) : (
            filtered.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                style={{
                  padding: '12px', borderRadius: '8px', marginBottom: '8px',
                  background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer',
                }}
                onClick={() => item.url && window.open(item.url, '_blank')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{
                        padding: '1px 8px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 600,
                        background: '#eff6ff', color: '#2563eb',
                      }}>{item.source}</span>
                      <span style={{
                        padding: '1px 8px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 600,
                        background: '#f0fdf4', color: '#16a34a',
                      }}>{item.category}</span>
                    </div>
                    <strong style={{ fontSize: '0.88rem', display: 'block', lineHeight: 1.3 }}>{item.title}</strong>
                    {item.snippet && <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>{item.snippet}</p>}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                    {new Date(item.published).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}
