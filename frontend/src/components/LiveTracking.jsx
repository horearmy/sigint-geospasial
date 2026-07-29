import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../utils/api'
import { useToast } from '../contexts/ToastContext'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function TrackingMap({ positions }) {
  const map = useMap()
  useEffect(() => {
    const valid = positions.filter(p => p.latitude && p.longitude)
    if (valid.length > 0) {
      const bounds = L.latLngBounds(valid.map(p => [p.latitude, p.longitude]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [positions, map])
  return null
}

function UserDetailCard({ user, onClose, onShowPath }) {
  if (!user) return null
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
      style={{
        position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 1000,
        background: 'var(--card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', padding: 14, maxWidth: 340, margin: '0 auto',
        boxShadow: 'var(--shadow-lg)', backdropFilter: 'blur(12px)',
      }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 6, right: 10, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          background: 'var(--bg-secondary)', border: '2px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
        }}>
          {user.avatar_url ? (
            <img src={`/uploads/avatars/${user.avatar_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            '👤'
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{user.full_name || user.username}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            @{user.username} · <span style={{
              color: user.is_active ? 'var(--success)' : 'var(--text-light)',
            }}>{user.is_active ? '🟢 Aktif' : '🔴 Offline'}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.78rem' }}>
        <div><span style={{ color: 'var(--text-light)' }}>Pangkat</span><br/><span style={{ color: 'var(--text)', fontWeight: 600 }}>{user.pangkat || '-'}</span></div>
        <div><span style={{ color: 'var(--text-light)' }}>NRP</span><br/><span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'monospace' }}>{user.nrp || '-'}</span></div>
        <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-light)' }}>Jabatan</span><br/><span style={{ color: 'var(--text)', fontWeight: 600 }}>{user.jabatan || '-'}</span></div>
        <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-light)' }}>Satuan</span><br/><span style={{ color: 'var(--text)', fontWeight: 600 }}>{user.satuan || '-'}</span></div>
        {user.recorded_at && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: 'var(--text-light)' }}>Terakhir terlihat</span><br/>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              {new Date(user.recorded_at).toLocaleString('id-ID')}
            </span>
          </div>
        )}
        {user.latitude && user.longitude && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: 'var(--text-light)' }}>Koordinat</span><br/>
            <span style={{ color: 'var(--info)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {parseFloat(user.latitude).toFixed(6)}, {parseFloat(user.longitude).toFixed(6)}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {user.is_active && (
          <button className="btn btn-sm btn-primary" onClick={() => onShowPath(user)} style={{ flex: 1 }}>
            🗺️ Lihat Jalur
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function LiveTracking({ onClose }) {
  const addToast = useToast()
  const [activeUsers, setActiveUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [detailUser, setDetailUser] = useState(null)
  const [pathCoords, setPathCoords] = useState([])
  const [loading, setLoading] = useState(true)
  const [tracking, setTracking] = useState(false)
  const watchId = useRef(null)

  useEffect(() => { fetchActive(); const interval = setInterval(fetchActive, 5000); return () => clearInterval(interval) }, [])

  const fetchActive = async () => {
    try {
      const res = await api.get('/api/tracking/active')
      setActiveUsers(res.data.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchPath = async (userId) => {
    try {
      const res = await api.get(`/api/tracking/path/${userId}?hours=24`)
      if (res.data.data && res.data.data.path) {
        const geojson = JSON.parse(res.data.data.path)
        setPathCoords(geojson.coordinates.map(c => [c[1], c[0]]))
      } else {
        setPathCoords([])
      }
    } catch (err) { console.error(err) }
  }

  const handleSelectUser = (u) => {
    setSelectedUser(u)
    setDetailUser(u)
    if (u.is_active) fetchPath(u.user_id)
    else setPathCoords([])
  }

  const handleMarkerClick = (u) => {
    setSelectedUser(u)
    setDetailUser(u)
    if (u.is_active) fetchPath(u.user_id)
    else setPathCoords([])
  }

  const startTracking = () => {
    if (!navigator.geolocation) { addToast('Geolocation tidak didukung', 'error'); return }
    setTracking(true)
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await api.post('/api/tracking/position', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed: pos.coords.speed || 0,
            heading: pos.coords.heading || 0,
            accuracy: pos.coords.accuracy || 0,
          })
        } catch (err) {
          console.error('Track position error:', err)
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
  }

  const stopTracking = () => {
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
    setTracking(false)
  }

  useEffect(() => () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current) }, [])

  const activeIcon = L.divIcon({
    className: 'tracking-marker',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
    iconSize: [16, 16], iconAnchor: [8, 8],
  })

  const inactiveIcon = L.divIcon({
    className: 'tracking-marker-inactive',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#64748b;border:2px solid #94a3b8;box-shadow:0 2px 6px rgba(0,0,0,0.2);opacity:0.6"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  })

  const selectedIcon = L.divIcon({
    className: 'tracking-marker-selected',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 12px rgba(239,68,68,0.5)"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  })

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel"
        style={{ maxWidth: '1000px', height: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="form-panel-header">
          <h2>📍 Live Tracking</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className={`btn btn-sm ${tracking ? 'btn-danger' : 'btn-success'}`}
              onClick={tracking ? stopTracking : startTracking}>
              {tracking ? '⏹️ Stop' : '▶️ Start Tracking'}
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 280, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '8px', flexShrink: 0 }}>
            <div style={{
              fontSize: '0.78rem', fontWeight: 600, padding: '8px 10px',
              color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Personel</span>
              <span>{activeUsers.filter(u => u.is_active).length} aktif / {activeUsers.length} total</span>
            </div>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 8px' }} />
                Memuat...
              </div>
            ) : activeUsers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                Tidak ada personel
              </div>
            ) : (
              activeUsers.map(u => (
                <div key={u.user_id}
                  onClick={() => handleSelectUser(u)}
                  style={{
                    padding: '10px 12px', borderRadius: 'var(--radius)', marginBottom: 4, cursor: 'pointer',
                    background: selectedUser?.user_id === u.user_id ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: selectedUser?.user_id === u.user_id ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                    transition: 'all 0.2s', opacity: u.is_active ? 1 : 0.6,
                  }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: u.is_active ? 'var(--success)' : 'var(--text-light)',
                      boxShadow: u.is_active ? '0 0 6px var(--success)' : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                        {u.full_name || u.username}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: 1 }}>
                        {u.pangkat && <span>{u.pangkat} · </span>}
                        {u.nrp && <span style={{ fontFamily: 'monospace' }}>{u.nrp} · </span>}
                        @{u.username}
                      </div>
                      {u.role === 'lapangan' && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--info)', marginTop: 1 }}>
                          🏅 {u.satuan || 'Lapangan'}
                        </div>
                      )}
                      {u.is_active && u.recorded_at && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 1 }}>
                          🟢 {new Date(u.recorded_at).toLocaleTimeString('id-ID')}
                          {u.speed > 0 && ` · 🚗 ${Math.round(u.speed * 3.6)} km/h`}
                        </div>
                      )}
                      {!u.is_active && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: 1 }}>
                          🔴 Tidak aktif
                          {u.recorded_at && ` · ${new Date(u.recorded_at).toLocaleTimeString('id-ID')}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer center={[-2.5, 118]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
              <TrackingMap positions={activeUsers} />
              {activeUsers.filter(u => u.latitude && u.longitude).map(u => (
                <Marker key={u.user_id}
                  position={[u.latitude, u.longitude]}
                  icon={selectedUser?.user_id === u.user_id ? selectedIcon : (u.is_active ? activeIcon : inactiveIcon)}
                  eventHandlers={{ click: () => handleMarkerClick(u) }}>
                  <Popup>
                    <div style={{ minWidth: '160px' }}>
                      <strong>{u.full_name || u.username}</strong><br/>
                      <span style={{ fontSize: '0.78rem', color: u.is_active ? '#22c55e' : '#94a3b8' }}>
                        {u.is_active ? '🟢 Aktif' : '🔴 Offline'}
                      </span>
                      {u.pangkat && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.pangkat} · {u.satuan || ''}</div>}
                      {u.recorded_at && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>{new Date(u.recorded_at).toLocaleString('id-ID')}</div>}
                      <button className="btn btn-sm btn-primary" style={{ marginTop: 6, fontSize: '0.7rem', padding: '3px 10px' }}
                        onClick={() => handleMarkerClick(u)}>
                        👤 Detail
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {pathCoords.length > 0 && (
                <Polyline positions={pathCoords} pathOptions={{ color: '#3DDC84', weight: 3, dashArray: '8 4', opacity: 0.8 }} />
              )}
            </MapContainer>

            {tracking && (
              <div style={{
                position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--success)', color: 'white', padding: '6px 18px', borderRadius: '20px',
                fontSize: '0.82rem', fontWeight: 600, boxShadow: '0 2px 12px rgba(0,0,0,0.3)', zIndex: 1000,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', animation: 'pulse 2s infinite' }} />
                Tracking Aktif
              </div>
            )}

            <AnimatePresence>
              {detailUser && (
                <UserDetailCard user={detailUser} onClose={() => setDetailUser(null)} onShowPath={(u) => {
                  setSelectedUser(u)
                  fetchPath(u.user_id)
                }} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
