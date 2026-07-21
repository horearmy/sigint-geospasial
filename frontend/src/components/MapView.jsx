import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import { motion } from 'framer-motion'
import { formatCoordinate, getDistance, formatDistance, getPolygonArea, formatArea } from '../utils/coordinates'
import MapGrid from './MapGrid'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const TILE_LAYERS = {
  streets: { name: 'Jalan', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  satellite: { name: 'Satelit', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
  terrain: { name: 'Topografi', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap' },
  dark: { name: 'Gelap', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CartoDB' },
}

function createMarkerIcon(color, icon) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position:relative;width:30px;height:30px">
      <div style="width:30px;height:30px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
        <span style="transform:rotate(45deg);font-size:12px;line-height:1">${icon}</span>
      </div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  })
}

const drawControlOptions = {
  position: 'topleft',
  draw: {
    polyline: { shapeOptions: { color: '#c9a84c', weight: 3, opacity: 0.8 } },
    polygon: { shapeOptions: { color: '#1b4332', weight: 2, fillColor: '#2d6a4f', fillOpacity: 0.2 } },
    marker: { icon: L.divIcon({ className: 'draw-marker', html: '<div style="width:24px;height:24px;border-radius:50%;background:#c9a84c;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>', iconSize: [24, 24], iconAnchor: [12, 12] }) },
    circle: false,
    circlemarker: false,
    rectangle: false,
  },
  edit: {
    featureGroup: null,
    remove: true,
  },
}

function DrawingTools({ enabled, onCreated, onEdited, onDeleted, drawLayerRef }) {
  const map = useMap()
  const controlRef = useRef(null)

  useEffect(() => {
    if (!map) return

    if (enabled && !controlRef.current) {
      const drawnItems = new L.FeatureGroup()
      drawLayerRef.current = drawnItems
      map.addLayer(drawnItems)

      const ctrl = new L.Control.Draw({
        ...drawControlOptions,
        edit: { featureGroup: drawnItems, remove: true },
      })
      map.addControl(ctrl)
      controlRef.current = ctrl
    }

    if (!enabled && controlRef.current) {
      map.removeControl(controlRef.current)
      controlRef.current = null
      if (drawLayerRef.current) {
        map.removeLayer(drawLayerRef.current)
        drawLayerRef.current = null
      }
    }

    return () => {
      if (controlRef.current) {
        map.removeControl(controlRef.current)
        controlRef.current = null
      }
    }
  }, [map, enabled, drawLayerRef])

  useEffect(() => {
    if (!map || !enabled) return

    const handleCreated = (e) => {
      const layer = e.layer
      if (drawLayerRef.current) {
        drawLayerRef.current.addLayer(layer)
      }
      if (onCreated) onCreated(e)
    }

    const handleEdited = (e) => {
      if (onEdited) onEdited(e)
    }

    const handleDeleted = (e) => {
      if (onDeleted) onDeleted(e)
    }

    map.on(L.Draw.Event.CREATED, handleCreated)
    map.on(L.Draw.Event.EDITED, handleEdited)
    map.on(L.Draw.Event.DELETED, handleDeleted)

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated)
      map.off(L.Draw.Event.EDITED, handleEdited)
      map.off(L.Draw.Event.DELETED, handleDeleted)
    }
  }, [map, enabled, onCreated, onEdited, onDeleted, drawLayerRef])

  return null
}

function SavedDrawings({ drawings }) {
  const map = useMap()
  const layersRef = useRef([])

  useEffect(() => {
    if (!map) return
    layersRef.current.forEach(l => map.removeLayer(l))
    layersRef.current = []

    drawings.forEach(d => {
      const coords = d.coordinates
      if (!coords) return

      let layer = null
      const style = {
        color: d.color || '#1b4332',
        weight: d.stroke_width || 3,
        opacity: 0.8,
        fillColor: d.color || '#1b4332',
        fillOpacity: d.fill_opacity ?? 0.2,
      }

      if (d.shape_type === 'marker' && coords.lat && coords.lng) {
        layer = L.marker([coords.lat, coords.lng], {
          icon: L.divIcon({
            className: 'saved-draw-marker',
            html: `<div style="width:20px;height:20px;border-radius:50%;background:${d.color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })
        })
        layer.bindPopup(`<strong>${escapeHtml(d.name) || 'Marker'}</strong><br/>${escapeHtml(d.description) || ''}`)
      } else if (coords.points && coords.points.length > 0) {
        const latlngs = coords.points.map(p => [p.lat, p.lng])
        if (d.shape_type === 'polygon') {
          layer = L.polygon(latlngs, style)
        } else {
          layer = L.polyline(latlngs, style)
        }
        layer.bindPopup(`<strong>${escapeHtml(d.name) || d.shape_type}</strong><br/>${escapeHtml(d.description) || ''}`)
      }

      if (layer) {
        layer.addTo(map)
        layersRef.current.push(layer)
      }
    })

    return () => {
      layersRef.current.forEach(l => map.removeLayer(l))
      layersRef.current = []
    }
  }, [map, drawings])

  return null
}

function MapEvents({ onMapClick, showForm, coordFormat, onCoordHover, onMouseMove }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    },
    mousemove(e) {
      if (onCoordHover) {
        onCoordHover(e.latlng.lat, e.latlng.lng)
      }
      if (onMouseMove) {
        onMouseMove({ x: e.originalEvent.clientX, y: e.originalEvent.clientY })
      }
    },
  })
  return null
}

function FlyToLocation({ center }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, 5, { duration: 1.5 })
  }, [center, map])
  return null
}

function MapRef({ mapRef }) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])
  return null
}

function formatDecimalSplit(value, decimals = 8) {
  const fixed = Math.abs(value).toFixed(decimals)
  const intPart = fixed.split('.')[0]
  const decPart = fixed.split('.')[1] || ''
  const sign = value < 0 ? '-' : ''
  return `${sign}${intPart}.${decPart.slice(0, 4)} ${decPart.slice(4, 8)}`
}

function CursorCoords({ coords, format, mousePos }) {
  if (!coords) return null
  return (
    <div className="cursor-coords" style={{ left: mousePos.x + 16, top: mousePos.y - 80, bottom: 'auto' }}>
      <span className="coord-format-label">MGRS/UTM</span>
      <span className="coord-value">{formatCoordinate(coords.lat, coords.lng, format)}</span>
      <span className="coord-dd">{formatDecimalSplit(coords.lat)}, {formatDecimalSplit(coords.lng)}</span>
    </div>
  )
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

export default function MapView({
  laporan, selectedId, onSelect, onMapClick, pickLocation, center, showForm,
  getKategoriColor, getKategoriIcon, drawingEnabled, onShapeCreated,
  onShapeEdited, onShapeDeleted, coordFormat = 'mgrs', drawings = [], selectedKategori,
  flyToTarget, onFlyToDone,
}) {
  const [tileLayer, setTileLayer] = useState('streets')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const [showCluster, setShowCluster] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [cursorCoords, setCursorCoords] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [shapeInfo, setShapeInfo] = useState(null)
  const mapRef = useRef(null)
  const drawLayerRef = useRef(null)

  const pickColor = selectedKategori ? getKategoriColor(selectedKategori) : '#1b4332'
  const pickEmoji = selectedKategori ? getKategoriIcon(selectedKategori) : '📍'

  const pickIcon = L.divIcon({
    className: 'pick-marker',
    html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,${pickColor},${pickColor}dd);border:3px solid white;box-shadow:0 3px 14px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;animation:pulse 2s infinite">
      <span style="font-size:18px;line-height:1">${pickEmoji}</span>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })

  const heatmapData = useMemo(() => laporan.map((l) => [parseFloat(l.latitude), parseFloat(l.longitude), 1]), [laporan])

  useEffect(() => {
    if (!mapRef.current || !showHeatmap) return
    const map = mapRef.current
    let heatLayer = map._heatLayer
    if (heatLayer) map.removeLayer(heatLayer)
    if (showHeatmap && heatmapData.length > 0) {
      heatLayer = L.heatLayer(heatmapData, {
        radius: 30, blur: 20, maxZoom: 10,
        gradient: { 0.2: '#1b4332', 0.4: '#c9a84c', 0.6: '#22c55e', 0.8: '#f59e0b', 1.0: '#ef4444' },
      }).addTo(map)
      map._heatLayer = heatLayer
    }
  }, [showHeatmap, heatmapData])

  useEffect(() => {
    if (!mapRef.current || !flyToTarget) return
    const map = mapRef.current
    map.flyTo([flyToTarget.lat, flyToTarget.lng], flyToTarget.zoom || 14, { duration: 1.2 })
    if (onFlyToDone) setTimeout(onFlyToDone, 1500)
  }, [flyToTarget, onFlyToDone])

  const uniqueKategori = useMemo(() => {
    const seen = new Set()
    return laporan.filter((l) => {
      if (seen.has(l.kategori)) return false
      seen.add(l.kategori)
      return true
    }).map((l) => ({ kategori: l.kategori, color: getKategoriColor(l.kategori), icon: getKategoriIcon(l.kategori) }))
  }, [laporan, getKategoriColor, getKategoriIcon])

  const handleShapeCreated = useCallback((e) => {
    const layer = e.layer
    const type = e.layerType
    let info = { type }

    if (type === 'marker') {
      const latlng = layer.getLatLng()
      info.coords = { lat: latlng.lat, lng: latlng.lng }
      info.mgrs = formatCoordinate(latlng.lat, latlng.lng, 'mgrs')
      info.utm = formatCoordinate(latlng.lat, latlng.lng, 'utm')
    } else if (type === 'polyline') {
      const latlngs = layer.getLatLngs()
      let totalDist = 0
      for (let i = 1; i < latlngs.length; i++) {
        totalDist += getDistance(latlngs[i-1].lat, latlngs[i-1].lng, latlngs[i].lat, latlngs[i].lng)
      }
      info.points = latlngs.length
      info.distance = formatDistance(totalDist)
    } else if (type === 'polygon') {
      const latlngs = layer.getLatLngs()[0]
      info.points = latlngs.length
      const points = latlngs.map(ll => [ll.lat, ll.lng])
      const area = getPolygonArea(points) * 111319.9 * 111319.9
      info.area = formatArea(area)
    }

    setShapeInfo(info)
    if (onShapeCreated) onShapeCreated(e)
  }, [onShapeCreated])

  const handleShapeEdited = useCallback((e) => {
    if (onShapeEdited) onShapeEdited(e)
  }, [onShapeEdited])

  const handleShapeDeleted = useCallback((e) => {
    setShapeInfo(null)
    if (onShapeDeleted) onShapeDeleted(e)
  }, [onShapeDeleted])

  return (
    <>
      <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true} zoomControl={false}>
        <TileLayer key={tileLayer} attribution={TILE_LAYERS[tileLayer].attribution} url={TILE_LAYERS[tileLayer].url} />
        <MapEvents onMapClick={onMapClick} showForm={showForm} coordFormat={coordFormat} onCoordHover={(lat, lng) => setCursorCoords({ lat, lng })} onMouseMove={setMousePos} />
        <MapRef mapRef={mapRef} />

        {drawingEnabled && (
          <DrawingTools
            enabled={drawingEnabled}
            onCreated={handleShapeCreated}
            onEdited={handleShapeEdited}
            onDeleted={handleShapeDeleted}
            drawLayerRef={drawLayerRef}
          />
        )}

        <SavedDrawings drawings={drawings} />
        <MapGrid enabled={showGrid} />

        {laporan.map((l) => (
          <Marker
            key={l.id}
            position={[parseFloat(l.latitude), parseFloat(l.longitude)]}
            icon={createMarkerIcon(selectedId === l.id ? '#ef4444' : getKategoriColor(l.kategori), getKategoriIcon(l.kategori))}
            eventHandlers={{ click: () => onSelect(l) }}
          >
            <Popup>
              <div style={{ minWidth: '180px' }}>
                <strong style={{ fontSize: '0.95rem' }}>{escapeHtml(l.judul)}</strong><br />
                <span style={{ color: getKategoriColor(l.kategori), fontWeight: 600, fontSize: '0.85rem' }}>
                  {getKategoriIcon(l.kategori)} {escapeHtml(l.kategori)}
                </span>
                {l.lokasi_nama && <div style={{ fontSize: '0.82rem', color: '#666', marginTop: '4px' }}>📍 {escapeHtml(l.lokasi_nama)}</div>}
                <div style={{ fontSize: '0.75rem', color: '#c9a84c', fontFamily: 'monospace', marginTop: '4px', fontWeight: 600 }}>
                  🔷 {formatCoordinate(l.latitude, l.longitude, coordFormat)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>
                  {formatDecimalSplit(parseFloat(l.latitude))}, {formatDecimalSplit(parseFloat(l.longitude))}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>
                  {new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {pickLocation && (
          <Marker position={[pickLocation.lat, pickLocation.lng]} icon={pickIcon}>
            <Popup>
              <strong>Lokasi Dipilih</strong><br />
              <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#c9a84c', fontWeight: 600 }}>
                🔷 {formatCoordinate(pickLocation.lat, pickLocation.lng, coordFormat)}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#999' }}>
                {formatDecimalSplit(pickLocation.lat)}, {formatDecimalSplit(pickLocation.lng)}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <CursorCoords coords={cursorCoords} format={coordFormat} mousePos={mousePos} />

      {shapeInfo && (
        <motion.div className="shape-info-panel"
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}>
          <div className="shape-info-header">
            <span>{shapeInfo.type === 'marker' ? '📍 Marker' : shapeInfo.type === 'polygon' ? '⬡ Polygon' : '〰️ Polyline'}</span>
            <button onClick={() => setShapeInfo(null)}>×</button>
          </div>
          {shapeInfo.coords && (
            <div className="shape-info-body">
              <div><strong>MGRS:</strong> {shapeInfo.mgrs}</div>
              <div><strong>UTM:</strong> {shapeInfo.utm}</div>
            </div>
          )}
          {shapeInfo.points && <div className="shape-info-body"><div><strong>Titik:</strong> {shapeInfo.points}</div></div>}
          {shapeInfo.distance && <div className="shape-info-body"><div><strong>Panjang:</strong> {shapeInfo.distance}</div></div>}
          {shapeInfo.area && <div className="shape-info-body"><div><strong>Luas:</strong> {shapeInfo.area}</div></div>}
        </motion.div>
      )}

      <div className="map-controls">
        <div className="map-control-group">
          {Object.entries(TILE_LAYERS).map(([key, layer]) => (
            <button key={key} className={`map-control-btn ${tileLayer === key ? 'active' : ''}`}
              onClick={() => setTileLayer(key)} title={layer.name}>
              {key === 'streets' && '🗺️'}{key === 'satellite' && '🛰️'}{key === 'terrain' && '⛰️'}{key === 'dark' && '🌙'}
            </button>
          ))}
        </div>
        <div className="map-control-group">
          <button className={`map-control-btn ${showHeatmap ? 'active' : ''}`} onClick={() => setShowHeatmap(!showHeatmap)} title="Heatmap">🔥</button>
          <button className={`map-control-btn ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(!showGrid)} title="Grid MGRS">📐</button>
          <button className={`map-control-btn ${showLegend ? 'active' : ''}`} onClick={() => setShowLegend(!showLegend)} title="Legenda">📋</button>
        </div>
      </div>

      {showLegend && uniqueKategori.length > 0 && (
        <motion.div className={`map-legend ${showForm ? 'legend-shifted' : ''}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}>
          <h4>Legenda</h4>
          {uniqueKategori.map((k) => (
            <div key={k.kategori} className="legend-item">
              <div className="legend-dot" style={{ background: k.color }} />
              <span>{k.icon} {k.kategori}</span>
            </div>
          ))}
        </motion.div>
      )}
    </>
  )
}
