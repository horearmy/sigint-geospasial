import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

export default function NotificationBell() {
  const { user, token } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchUnreadCount()
    fetchNotifications()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [user])

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/api/notifications/unread-count')
      setUnreadCount(res.data.data.count)
    } catch (err) {}
  }

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/notifications')
      setNotifications(res.data.data)
    } catch (err) {}
  }

  const handleRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {}
  }

  const handleReadAll = async () => {
    try {
      await api.put('/api/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {}
  }

  if (!user) return null

  const typeIcons = { alert: '🚨', comment: '💬', info: 'ℹ️', warning: '⚠️' }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setShowDropdown(!showDropdown); if (!showDropdown) fetchNotifications() }}
        style={{
          position: 'relative', width: '36px', height: '36px', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
          color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '1rem', backdropFilter: 'blur(10px)',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            width: '18px', height: '18px', borderRadius: '50%',
            background: '#ef4444', color: 'white', fontSize: '0.65rem',
            fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'center',             border: '2px solid #0b2a1b',
          }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: '340px', background: 'white', borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0',
              overflow: 'hidden', zIndex: 1000,
            }}
          >
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>Notifikasi</strong>
              {unreadCount > 0 && (
                <button onClick={handleReadAll} style={{
                  background: 'none', border: 'none',                   color: '#1b4332',
                  fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600,
                }}>Tandai semua dibaca</button>
              )}
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🔔</div>
                  <p style={{ fontSize: '0.85rem' }}>Belum ada notifikasi</p>
                </div>
              ) : (
                notifications.slice(0, 15).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && handleRead(n.id)}
                    style={{
                      padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer', transition: 'background 0.2s',
                      background: n.is_read ? 'white' : '#f0f7ff',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = n.is_read ? 'white' : '#f0f7ff'}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.1rem' }}>{typeIcons[n.type] || '📌'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: '0.85rem' }}>{n.title}</div>
                        {n.message && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{n.message}</div>}
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                          {new Date(n.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {!n.is_read && (
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: '#1b4332', flexShrink: 0, marginTop: '4px',
                        }} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
