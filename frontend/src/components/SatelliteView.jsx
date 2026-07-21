import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import { useToast } from '../App'

const IMAGERY_LAYERS = [
  { id: 'standard', name: 'Peta Standar', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OSM' },
  { id: 'satellite', name: 'Citra Satelit', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  { id: 'terrain', name: 'Topografi', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap' },
  { id: 'dark', name: 'Mode Gelap', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '© CartoDB' },
]

const OVERLAY_LAYERS = [
  { id: 'heat', name: '🔥 Heatmap Insiden', color: '#ef4444' },
  { id: 'ndvi', name: '🌿 NDVI Vegetation', color: '#22c55e' },
  { id: 'water', name: '💧 NDWI Air', color: '#1b4332' },
  { id: 'zones', name: '🛡️ Threat Zones', color: '#f59e0b' },
]

export default function SatelliteView({ laporan, onClose }) {
  const addToast = useToast()
  const [baseLayer, setBaseLayer] = useState('satellite')
  const [activeOverlays, setActiveOverlays] = useState(new Set())
  const [imageryInfo, setImageryInfo] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [center, setCenter] = useState([-2.5, 118])

  useEffect(() => {
    if (laporan.length > 0) {
      const avgLat = laporan.reduce((s, l) => s + parseFloat(l.latitude), 0) / laporan.length
      const avgLng = laporan.reduce((s, l) => s + parseFloat(l.longitude), 0) / laporan.length
      setCenter([avgLat, avgLng])
    }
  }, [laporan])

  useEffect(() => {
    if (center[0] && center[1]) {
      axios.get(`/api/imagery/imagery?lat=${center[0]}&lng=${center[1]}`)
        .then(r => setImageryInfo(r.data.data))
        .catch(() => {})
    }
  }, [center])

  const toggleOverlay = (id) => {
    setActiveOverlays(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectedLayer = IMAGERY_LAYERS.find(l => l.id === baseLayer)

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel" style={{ maxWidth: '950px', height: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="form-panel-header">
          <h2>🛰️ Satellite & Imagery View</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '220px', borderRight: '1px solid #e2e8f0', padding: '12px', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>Base Layer</div>
            {IMAGERY_LAYERS.map(l => (
              <div key={l.id} onClick={() => setBaseLayer(l.id)}
                style={{
                  padding: '8px 10px', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer',
                  background: baseLayer === l.id ? '#eff6ff' : 'transparent',
                  border: baseLayer === l.id ? '1px solid #1b4332' : '1px solid transparent',
                  fontSize: '0.82rem', fontWeight: baseLayer === l.id ? 600 : 400,
                  transition: 'all 0.2s',
                }}>{l.name}</div>
            ))}

            <div style={{ fontSize: '0.82rem', fontWeight: 700, margin: '16px 0 8px', color: '#1e293b' }}>Overlays</div>
            {OVERLAY_LAYERS.map(l => (
              <div key={l.id} onClick={() => toggleOverlay(l.id)}
                style={{
                  padding: '8px 10px', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer',
                  background: activeOverlays.has(l.id) ? l.color + '15' : 'transparent',
                  border: activeOverlays.has(l.id) ? `1px solid ${l.color}` : '1px solid transparent',
                  fontSize: '0.82rem', fontWeight: activeOverlays.has(l.id) ? 600 : 400,
                  transition: 'all 0.2s',
                }}>{l.name}</div>
            ))}

            {imageryInfo && (
              <>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, margin: '16px 0 8px', color: '#1e293b' }}>Info Citra</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
                  <div>📍 Center: {imageryInfo.center.lat.toFixed(4)}, {imageryInfo.center.lng.toFixed(4)}</div>
                  <div>🔍 Zoom: {imageryInfo.zoom}</div>
                  <div>📅 {imageryInfo.availableDates?.length || 0} tanggal tersedia</div>
                </div>
                {imageryInfo.availableDates && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Tanggal:</div>
                    <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                      style={{ width: '100%', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.78rem' }}>
                      <option value="">Pilih tanggal</option>
                      {imageryInfo.availableDates.slice(0, 14).map(d => (
                        <option key={d} value={d}>{new Date(d).toLocaleDateString('id-ID')}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
              <TileLayer key={baseLayer} url={selectedLayer.url} attribution={selectedLayer.attribution} />
              {laporan.map(l => (
                <Marker key={l.id} position={[parseFloat(l.latitude), parseFloat(l.longitude)]}>
                  <Popup><strong>{l.judul}</strong><br />{l.kategori}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
