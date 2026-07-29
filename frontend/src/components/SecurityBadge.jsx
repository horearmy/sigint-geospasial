import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../utils/api'

function timeAgo(iso) {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} jam lalu`
  return `${Math.floor(hrs / 24)} hari lalu`
}

export default function SecurityBadge({ collapsed, compact }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/security/status')
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useEffect(() => {
    const interval = setInterval(fetchStatus, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const level = data?.level || 'loading'
  const colorMap = {
    secure: '#22C55E',
    warning: '#F59E0B',
    critical: '#EF4444',
    loading: '#64748B',
  }
  const labelMap = {
    secure: 'Aman',
    warning: 'Peringatan',
    critical: 'Bahaya',
    loading: 'Memuat...',
  }
  const iconMap = {
    secure: '🛡️',
    warning: '⚠️',
    critical: '🚨',
    loading: '⏳',
  }

  const color = colorMap[level]
  const label = labelMap[level]
  const icon = iconMap[level]

  return compact ? (
    <div className="security-badge-wrapper" ref={ref} style={{ display: 'inline-flex', position: 'relative' }}>
      <button className="header-security-btn" onClick={() => setOpen(!open)}
        title={`Status: ${label}`}
        style={{ color }}>
        <span className="security-badge-dot" style={{ background: color }} />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em' }}>AMAN</span>
      </button>
      {open && (
        <div className="security-dropdown" style={{ position: 'absolute', top: '100%', right: 0, left: 'auto', width: '300px', marginTop: '6px', bottom: 'auto', marginBottom: 0 }}>
          <div className="security-dropdown-header">
            <span style={{ fontSize: '1rem' }}>🛡️</span>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Status Keamanan</span>
            <span className="security-level-badge" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{label}</span>
          </div>
          <div className="security-dropdown-body">
            {data?.checks?.map((check, i) => (
              <div key={i} className="security-check-item">
                <span className="security-check-icon" style={{ color: check.status === 'ok' ? '#22C55E' : check.status === 'warn' ? '#F59E0B' : '#EF4444' }}>
                  {check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '✗'}
                </span>
                <div className="security-check-info">
                  <span className="security-check-name">{check.name}</span>
                  <span className="security-check-detail">{check.detail}</span>
                </div>
              </div>
            ))}
            {loading && !data && (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Memuat status keamanan...</div>
            )}
          </div>
          <div className="security-dropdown-footer">
            <span>Terakhir diperiksa: {timeAgo(data?.last_check)}</span>
            <button className="security-refresh-btn" onClick={fetchStatus} disabled={loading}>
              {loading ? '⏳' : '🔄'} Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="security-badge-wrapper" ref={ref}>
      <button
        className="security-badge"
        onClick={() => setOpen(!open)}
        style={{
          borderColor: color,
          boxShadow: `0 0 10px ${color}22`,
        }}
      >
        <span className="security-badge-dot" style={{ background: color }} />
        {!collapsed && (
          <>
            <span className="security-badge-icon">{icon}</span>
            <span className="security-badge-label">{label}</span>
          </>
        )}
        {!collapsed && (
          <span className="security-badge-chevron" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
            ▾
          </span>
        )}
      </button>

      {open && !collapsed && (
        <div className="security-dropdown">
          <div className="security-dropdown-header">
            <span style={{ fontSize: '1rem' }}>🛡️</span>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Status Keamanan</span>
            <span
              className="security-level-badge"
              style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
            >
              {label}
            </span>
          </div>

          <div className="security-dropdown-body">
            {data?.checks?.map((check, i) => (
              <div key={i} className="security-check-item">
                <span className="security-check-icon" style={{
                  color: check.status === 'ok' ? '#22C55E' : check.status === 'warn' ? '#F59E0B' : '#EF4444'
                }}>
                  {check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '✗'}
                </span>
                <div className="security-check-info">
                  <span className="security-check-name">{check.name}</span>
                  <span className="security-check-detail">{check.detail}</span>
                </div>
              </div>
            ))}
            {loading && !data && (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Memuat status keamanan...
              </div>
            )}
          </div>

          <div className="security-dropdown-footer">
            <span>Terakhir diperiksa: {timeAgo(data?.last_check)}</span>
            <button className="security-refresh-btn" onClick={fetchStatus} disabled={loading}>
              {loading ? '⏳' : '🔄'} Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
