import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import 'leaflet.heat'
import MarkerClusterGroup from 'react-leaflet-cluster'
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

function MapResizeHandler() {
  const map = useMap()
  const containerRef = useRef(null)
  useEffect(() => {
    const container = map.getContainer()
    containerRef.current = container
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          map.invalidateSize()
        }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])
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

const RISK_COLORS = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#7f1d1d' }

function ZoneLayer({ zones }) {
  const map = useMap()
  const layersRef = useRef([])

  useEffect(() => {
    layersRef.current.forEach(l => map.removeLayer(l))
    layersRef.current = []

    zones.forEach(z => {
      if (!z.boundary) return
      const coords = z.boundary.coordinates[0].map(c => [c[1], c[0]])
      const color = RISK_COLORS[z.risk_level] || '#64748b'
      const polygon = L.polygon(coords, {
        color, weight: 2, opacity: 0.8,
        fillColor: color, fillOpacity: 0.15,
      })
      polygon.bindPopup(`
        <div style="min-width:180px">
          <strong style="font-size:0.95rem">🛡️ ${z.name}</strong><br/>
          <span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:0.72rem;background:${color};color:white;font-weight:700;margin-top:4px">Level ${z.risk_level}</span>
          <span style="margin-left:6px;font-size:0.78rem;color:#666">${z.zone_type}</span>
          <div style="font-size:0.78rem;color:#999;margin-top:4px">📍 ${z.insiden_count || 0} insiden di dalam zona</div>
          ${z.description ? `<div style="font-size:0.78rem;color:#999;margin-top:2px">${z.description}</div>` : ''}
        </div>
      `)
      polygon.on('mouseover', () => polygon.setStyle({ fillOpacity: 0.3, weight: 3 }))
      polygon.on('mouseout', () => polygon.setStyle({ fillOpacity: 0.15, weight: 2 }))
      polygon.addTo(map)
      layersRef.current.push(polygon)
    })

    return () => {
      layersRef.current.forEach(l => map.removeLayer(l))
      layersRef.current = []
    }
  }, [map, zones])

  return null
}

function ZoneDrawingTools({ enabled, onZoneDrawn }) {
  const map = useMap()
  const controlRef = useRef(null)
  const drawLayerRef = useRef(null)

  useEffect(() => {
    if (!map) return

    if (enabled && !controlRef.current) {
      const drawnItems = new L.FeatureGroup()
      drawLayerRef.current = drawnItems
      map.addLayer(drawnItems)

      const ctrl = new L.Control.Draw({
        position: 'topright',
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: { color: '#ef4444', weight: 2, fillOpacity: 0.15 },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
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
  }, [map, enabled])

  useEffect(() => {
    if (!map || !enabled) return

    const handleCreated = (e) => {
      if (e.layerType === 'polygon') {
        if (drawLayerRef.current) drawLayerRef.current.addLayer(e.layer)
        if (onZoneDrawn) onZoneDrawn(e)
      }
    }

    map.on(L.Draw.Event.CREATED, handleCreated)
    return () => map.off(L.Draw.Event.CREATED, handleCreated)
  }, [map, enabled, onZoneDrawn])

  return null
}

function RadarEffect({ center, radius = 5000 }) {
  const map = useMap()

  useEffect(() => {
    if (!center) return
    const circles = []
    for (let i = 0; i < 3; i++) {
      const c = L.circle(center, {
        radius: radius * (0.25 + i * 0.4),
        color: '#3DDC84',
        fillColor: '#3DDC84',
        fillOpacity: 0.06 - i * 0.015,
        weight: 1.5 - i * 0.3,
        opacity: 0.5 - i * 0.12,
        dashArray: '6, 10',
      }).addTo(map)
      circles.push(c)
    }

    let growing = true
    const interval = setInterval(() => {
      growing = !growing
      circles.forEach((c, i) => {
        const base = radius * (0.25 + i * 0.4)
        const offset = growing ? radius * 0.08 : -radius * 0.08
        c.setRadius(base + offset * (i + 1) * 0.5)
      })
    }, 800)

    return () => {
      clearInterval(interval)
      circles.forEach(c => map.removeLayer(c))
    }
  }, [center?.[0], center?.[1], radius, map])

  return null
}

export default function MapView({
  laporan, selectedId, onSelect, onMapClick, pickLocation, center, showForm,
  getKategoriColor, getKategoriIcon, drawingEnabled, onShapeCreated,
  onShapeEdited, onShapeDeleted, coordFormat = 'mgrs', drawings = [], selectedKategori,
  flyToTarget, onFlyToDone, onEdit, zones = [], zoneDrawingMode, onZoneDrawn, satuans = [],
  satuanPickLocation,
}) {
  const [tileLayer, setTileLayer] = useState('streets')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const [showCluster, setShowCluster] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [showZones, setShowZones] = useState(true)
  const [cursorCoords, setCursorCoords] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [shapeInfo, setShapeInfo] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [hoveredUnit, setHoveredUnit] = useState(null)
  const mapRef = useRef(null)
  const drawLayerRef = useRef(null)
  const contextMenuRef = useRef(null)

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

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [contextMenu])

  return (
    <>
      <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true} zoomControl={false}>
        <TileLayer key={tileLayer} attribution={TILE_LAYERS[tileLayer].attribution} url={TILE_LAYERS[tileLayer].url} />
        <MapEvents onMapClick={onMapClick} showForm={showForm} coordFormat={coordFormat} onCoordHover={(lat, lng) => setCursorCoords({ lat, lng })} onMouseMove={setMousePos} />
        <MapRef mapRef={mapRef} />
        <MapResizeHandler />

        {drawingEnabled && (
          <DrawingTools
            enabled={drawingEnabled}
            onCreated={handleShapeCreated}
            onEdited={handleShapeEdited}
            onDeleted={handleShapeDeleted}
            drawLayerRef={drawLayerRef}
          />
        )}

        {zoneDrawingMode && (
          <ZoneDrawingTools enabled={zoneDrawingMode} onZoneDrawn={onZoneDrawn} />
        )}

        {showZones && <ZoneLayer zones={zones} />}
        <SavedDrawings drawings={drawings} />
        <MapGrid enabled={showGrid} format={coordFormat} />

        <MarkerClusterGroup chunkedLoading>
          {laporan.map((l) => (
            <Marker
              key={l.id}
              position={[parseFloat(l.latitude), parseFloat(l.longitude)]}
              icon={createMarkerIcon(selectedId === l.id ? '#ef4444' : getKategoriColor(l.kategori), getKategoriIcon(l.kategori))}
              eventHandlers={{
                click: () => onSelect(l),
                contextmenu: (e) => {
                  L.DomEvent.stopPropagation(e.originalEvent)
                  setContextMenu({ x: e.originalEvent.clientX, y: e.originalEvent.clientY, laporan: l })
                },
              }}
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
        </MarkerClusterGroup>

        <MarkerClusterGroup chunkedLoading>
          {satuans.filter(s => s.latitude && s.longitude).map(s => (
            <Marker key={'unit-' + s.id}
              position={[parseFloat(s.latitude), parseFloat(s.longitude)]}
              icon={L.divIcon({
                className: `unit-marker${hoveredUnit?.id === s.id ? ' unit-marker-hovered' : ''}`,
                html: `<div style="width:36px;height:36px;border-radius:8px;border:2px solid ${hoveredUnit?.id === s.id ? '#5AE89A' : '#3DDC84'};overflow:hidden;background:#041A0D;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
                  ${s.lambang_url ? `<img src="${escapeHtml(s.lambang_url)}" style="width:100%;height:100%;object-fit:contain;padding:2px" />` : '<span style="font-size:16px">🏴</span>'}
                </div>`,
                iconSize: [hoveredUnit?.id === s.id ? 44 : 36, hoveredUnit?.id === s.id ? 44 : 36],
                iconAnchor: [hoveredUnit?.id === s.id ? 22 : 18, hoveredUnit?.id === s.id ? 22 : 18],
              })}
              eventHandlers={{
                mouseover: () => setHoveredUnit(s),
                mouseout: () => setHoveredUnit(prev => prev?.id === s.id ? null : prev),
                click: () => { if (mapRef.current) mapRef.current.flyTo([parseFloat(s.latitude), parseFloat(s.longitude)], 14, { duration: 1 }) },
              }}>
              <Popup>
                <div style={{ minWidth: '160px', textAlign: 'center' }}>
                  {s.lambang_url && <img src={s.lambang_url} alt="" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 6 }} />}
                  <br /><strong style={{ fontSize: '0.9rem' }}>{s.nama_satuan}</strong>
                  {s.deskripsi && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>{s.deskripsi}</div>}
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4, fontFamily: 'monospace' }}>
                    {formatCoordinate(s.latitude, s.longitude, coordFormat)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {hoveredUnit && (
          <RadarEffect center={[parseFloat(hoveredUnit.latitude), parseFloat(hoveredUnit.longitude)]} radius={5000} />
        )}

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
        {satuanPickLocation && (
          <Marker position={[satuanPickLocation.lat, satuanPickLocation.lng]} icon={L.divIcon({
            className: 'pick-marker',
            html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#3DDC84,#2a9d5c);border:3px solid white;box-shadow:0 3px 14px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;animation:pulse 2s infinite">
              <span style="font-size:18px;line-height:1">🏛️</span>
            </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })}>
            <Popup>
              <strong>Lokasi Satuan</strong><br />
              <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#3DDC84', fontWeight: 600 }}>
                🔷 {formatCoordinate(satuanPickLocation.lat, satuanPickLocation.lng, coordFormat)}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#999' }}>
                {formatDecimalSplit(satuanPickLocation.lat)}, {formatDecimalSplit(satuanPickLocation.lng)}
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
          {zones.length > 0 && (
            <button className={`map-control-btn ${showZones ? 'active' : ''}`} onClick={() => setShowZones(!showZones)} title="Zona Ancaman">
              🛡️
            </button>
          )}
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

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="map-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="map-context-menu-item"
            onClick={() => { onSelect(contextMenu.laporan); setContextMenu(null) }}
          >
            👁️ Lihat Detail
          </button>
          <button
            className="map-context-menu-item"
            onClick={() => { onEdit(contextMenu.laporan); setContextMenu(null) }}
          >
            ✏️ Edit Laporan
          </button>
        </div>
      )}
    </>
  )
}
