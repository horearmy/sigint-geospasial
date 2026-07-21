import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import { useToast } from '../App'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function TrackingMap({ positions, pathCoords }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => [p.latitude, p.longitude]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [positions, map])
  return null
}

export default function LiveTracking({ onClose }) {
  const addToast = useToast()
  const [activeUsers, setActiveUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [pathCoords, setPathCoords] = useState([])
  const [loading, setLoading] = useState(true)
  const [tracking, setTracking] = useState(false)
  const watchId = useRef(null)

  useEffect(() => { fetchActive() }, [])

  const fetchActive = async () => {
    try {
      const res = await axios.get('/api/tracking/active')
      setActiveUsers(res.data.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchPath = async (userId) => {
    try {
      const res = await axios.get(`/api/tracking/path/${userId}?hours=24`)
      if (res.data.data && res.data.data.path) {
        const geojson = JSON.parse(res.data.data.path)
        setPathCoords(geojson.coordinates.map(c => [c[1], c[0]]))
      }
    } catch (err) { console.error(err) }
  }

  const handleSelectUser = (u) => {
    setSelectedUser(u)
    fetchPath(u.user_id)
  }

  const startTracking = () => {
    if (!navigator.geolocation) { addToast('Geolocation tidak didukung', 'error'); return }
    setTracking(true)
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await axios.post('/api/tracking/position', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed: pos.coords.speed || 0,
            heading: pos.coords.heading || 0,
            accuracy: pos.coords.accuracy || 0,
          })
        } catch (err) {}
      },
      (err) => { addToast('Gagal mendapatkan lokasi', 'error'); setTracking(false) },
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
  }

  const stopTracking = () => {
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
    setTracking(false)
  }

  useEffect(() => () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current) }, [])

  const userIcon = L.divIcon({
    className: 'tracking-marker',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16], iconAnchor: [8, 8],
  })

  const selectedIcon = L.divIcon({
    className: 'tracking-marker-selected',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10],
  })

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel"
        style={{ maxWidth: '900px', height: '80vh', display: 'flex', flexDirection: 'column' }}
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
          <div style={{ width: '250px', borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '8px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, padding: '8px', color: '#64748b' }}>
              Pengguna Aktif ({activeUsers.length})
            </div>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Memuat...</div>
            ) : activeUsers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Tidak ada pengguna aktif</div>
            ) : (
              activeUsers.map(u => (
                <div key={u.user_id}
                  onClick={() => handleSelectUser(u)}
                  style={{
                    padding: '10px', borderRadius: '8px', marginBottom: '4px', cursor: 'pointer',
                    background: selectedUser?.user_id === u.user_id ? '#eff6ff' : 'transparent',
                    border: selectedUser?.user_id === u.user_id ? '1px solid #1b4332' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.full_name || u.username}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    🟢 {new Date(u.recorded_at).toLocaleTimeString('id-ID')}
                  </div>
                  {u.speed > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      🚗 {Math.round(u.speed * 3.6)} km/h
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer center={[-2.5, 118]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
              <TrackingMap positions={activeUsers} pathCoords={pathCoords} />
              {activeUsers.map(u => (
                <Marker key={u.user_id}
                  position={[u.latitude, u.longitude]}
                  icon={selectedUser?.user_id === u.user_id ? selectedIcon : userIcon}
                  eventHandlers={{ click: () => handleSelectUser(u) }} />
              ))}
              {pathCoords.length > 0 && (
                <Polyline positions={pathCoords} pathOptions={{ color: '#1b4332', weight: 3, dashArray: '8 4' }} />
              )}
            </MapContainer>

            {tracking && (
              <div style={{
                position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
                background: '#22c55e', color: 'white', padding: '6px 16px', borderRadius: '20px',
                fontSize: '0.82rem', fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 1000,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white', animation: 'pulse 2s infinite' }} />
                Tracking Aktif
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
