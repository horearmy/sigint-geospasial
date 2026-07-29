import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Map as MaplibreMap, Popup, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { formatCoordinate } from '../utils/coordinates'

const KATEGORI_COLORS = {
  'Gangguan Keamanan': '#ef4444', 'Separatisme': '#7c3aed', 'Terorisme': '#dc2626',
  'Radikalisme': '#ea580c', 'Keamanan Nasional': '#1b4332', 'Politik': '#0891b2',
  'Sosial': '#16a34a', 'Ekonomi': '#ca8a04', 'Informasi Lain': '#c9a84c',
}
const KATEGORI_ICONS = {
  'Gangguan Keamanan': '🚨', 'Separatisme': '🏴', 'Terorisme': '💣',
  'Radikalisme': '⚔️', 'Keamanan Nasional': '🛡️', 'Politik': '🏛️',
  'Sosial': '👥', 'Ekonomi': '💰', 'Informasi Lain': '📢',
}
const RISK_COLORS = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#7f1d1d' }
const RISK_NAMES = { 1: 'Rendah', 2: 'Waspada', 3: 'Sedang', 4: 'Tinggi', 5: 'Kritis' }

function makeLaporanFC(laporan) {
  return {
    type: 'FeatureCollection',
    features: (laporan || []).map(l => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [parseFloat(l.longitude), parseFloat(l.latitude)] },
      properties: {
        id: l.id, type: 'laporan',
        judul: l.judul || '', kategori: l.kategori || '',
        lokasi_nama: l.lokasi_nama || '', deskripsi: l.deskripsi || '',
        kategori_color: KATEGORI_COLORS[l.kategori] || '#666',
        kategori_icon: KATEGORI_ICONS[l.kategori] || '📌',
      },
    })),
  }
}

function makeUnitsFC(satuans) {
  return {
    type: 'FeatureCollection',
    features: (satuans || []).filter(s => s.latitude && s.longitude).map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [parseFloat(s.longitude), parseFloat(s.latitude)] },
      properties: {
        id: s.id, type: 'satuan',
        nama_satuan: s.nama_satuan || '', deskripsi: s.deskripsi || '',
        lambang_url: s.lambang_url || '',
      },
    })),
  }
}

function makeZonesFC(zones) {
  return {
    type: 'FeatureCollection',
    features: (zones || []).filter(z => z.boundary).map(z => ({
      type: 'Feature',
      geometry: z.boundary,
      properties: {
        id: z.id, type: 'zone',
        name: z.name || '', zone_type: z.zone_type || '',
        risk_level: z.risk_level || 1, description: z.description || '',
        risk_color: RISK_COLORS[z.risk_level] || '#64748b',
      },
    })),
  }
}

function makeDrawingsFC(drawings) {
  const features = []
  ;(drawings || []).forEach(d => {
    const coords = d.coordinates
    if (!coords) return
    let geometry = null
    if (d.shape_type === 'marker' && coords.lat && coords.lng) {
      geometry = { type: 'Point', coordinates: [coords.lng, coords.lat] }
    } else if ((d.shape_type === 'polyline' || d.shape_type === 'polygon') && coords.points?.length) {
      const pts = coords.points.map(p => [p.lng, p.lat])
      if (d.shape_type === 'polygon') {
        geometry = { type: 'Polygon', coordinates: [pts] }
      } else {
        geometry = { type: 'LineString', coordinates: pts }
      }
    }
    if (geometry) {
      features.push({
        type: 'Feature',
        geometry,
        properties: {
          id: d.id, type: 'drawing',
          name: d.name || '',
          shape_type: d.shape_type || '',
          color: d.color || '#1b4332',
          stroke_width: d.stroke_width || 3,
          fill_opacity: d.fill_opacity ?? 0.2,
          description: d.description || '',
        },
      })
    }
  })
  return { type: 'FeatureCollection', features }
}

export default function Terrain3D({ laporan, satuans, zones, drawings, onClose }) {
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const popupRef = useRef(null)
  const loadedRef = useRef(false)
  const [pitch, setPitch] = useState(55)
  const [bearing, setBearing] = useState(0)
  const [exaggeration] = useState(1.5)
  const [coordFormat, setCoordFormat] = useState('mgrs')
  const [cursorCoords, setCursorCoords] = useState(null)

  useEffect(() => {
    if (mapRef.current) return

    const map = new MaplibreMap({
      container: mapContainer.current,
      center: [118.0149, -2.5489],
      zoom: 5.5,
      pitch: 55,
      bearing: 0,
      maxBounds: [[95, -11], [142, 7]],
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
            maxzoom: 19,
          },
          terrainSource: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 14,
            attribution: '© AWS',
          },
          laporan: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          units: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          zones: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          drawings: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        },
        layers: [
          { id: 'osm-layer', type: 'raster', source: 'osm' },
          { id: 'zone-fill', type: 'fill', source: 'zones',
            paint: { 'fill-color': ['get', 'risk_color'], 'fill-opacity': 0.2 } },
          { id: 'zone-outline', type: 'line', source: 'zones',
            paint: { 'line-color': ['get', 'risk_color'], 'line-width': 2, 'line-opacity': 0.7 } },
          { id: 'drawing-line', type: 'line', source: 'drawings',
            filter: ['!=', ['get', 'shape_type'], 'marker'],
            paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'stroke_width'], 'line-opacity': 0.8 } },
          { id: 'drawing-fill', type: 'fill', source: 'drawings',
            filter: ['==', ['get', 'shape_type'], 'polygon'],
            paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'fill_opacity'] } },
          { id: 'drawing-marker', type: 'circle', source: 'drawings',
            filter: ['==', ['get', 'shape_type'], 'marker'],
            paint: { 'circle-radius': 4, 'circle-color': ['get', 'color'],
              'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-opacity': 0.9 } },
          { id: 'unit-circle', type: 'circle', source: 'units',
            paint: { 'circle-radius': 8, 'circle-color': '#3DDC84',
              'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.95 } },
          { id: 'unit-label', type: 'symbol', source: 'units',
            layout: { 'text-field': '🏛️', 'text-size': 16, 'text-offset': [0, -1.8] },
            paint: { 'text-opacity': 1 } },
          { id: 'laporan-circle', type: 'circle', source: 'laporan',
            paint: { 'circle-radius': 7, 'circle-color': ['get', 'kategori_color'],
              'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9 } },
          { id: 'laporan-label', type: 'symbol', source: 'laporan',
            layout: { 'text-field': ['get', 'kategori_icon'], 'text-size': 14, 'text-offset': [0, -1.5] },
            paint: { 'text-opacity': 1 } },
        ],
        terrain: { source: 'terrainSource', exaggeration: 1.5 },
        sky: { 'sky-color': '#07110A', 'horizon-color': '#1b4332', 'fog-color': '#0b2a1b' },
      },
    })

    map.addControl(new NavigationControl(), 'bottom-right')

    map.on('load', () => {
      loadedRef.current = true

      map.addSource('hillshadeSource', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 14,
      })
      map.addLayer({
        id: 'hillshade', type: 'hillshade', source: 'hillshadeSource',
        paint: { 'hillshade-illumination-direction': 315, 'hillshade-exaggeration': 0.25 },
      }, 'zone-fill')

      map.getSource('laporan').setData(makeLaporanFC(laporan))
      map.getSource('units').setData(makeUnitsFC(satuans))
      map.getSource('zones').setData(makeZonesFC(zones))
      map.getSource('drawings').setData(makeDrawingsFC(drawings))

      function showPopup(e, layerId, html) {
        popupRef.current?.remove()
        popupRef.current = new Popup({ offset: 25 })
          .setLngLat(e.lngLat).setHTML(html).addTo(map)
      }

      const coordHtml = (lat, lng, fmt) => {
        const mgrsC = formatCoordinate(lat, lng, 'mgrs')
        const utmC = formatCoordinate(lat, lng, 'utm')
        const ddC = formatCoordinate(lat, lng, 'dd')
        return `<div style="margin-top:4px;border-top:1px solid #e2e8f0;padding-top:4px">
          <div style="font-size:0.7rem;font-family:monospace;color:#c9a84c;font-weight:600">🔷 ${mgrsC}</div>
          <div style="font-size:0.65rem;font-family:monospace;color:#94a3b8">🔷 ${utmC}</div>
          <div style="font-size:0.65rem;font-family:monospace;color:#64748b">${ddC}</div>
        </div>`
      }

      map.on('click', 'laporan-circle', (e) => {
        const p = e.features[0]?.properties; if (!p) return
        const lat = e.lngLat.lat; const lng = e.lngLat.lng
        showPopup(e, 'laporan-circle', `
          <div style="font-family:Inter,sans-serif;font-size:0.85rem;max-width:240px">
            <strong>📋 ${p.judul}</strong><br/>
            <span style="color:${p.kategori_color};font-weight:600">${p.kategori_icon} ${p.kategori}</span>
            ${p.lokasi_nama ? `<div style="color:#64748b;margin-top:4px">📍 ${p.lokasi_nama}</div>` : ''}
            ${coordHtml(lat, lng)}
          </div>`)
      })
      map.on('click', 'unit-circle', (e) => {
        const p = e.features[0]?.properties; if (!p) return
        const lat = e.lngLat.lat; const lng = e.lngLat.lng
        showPopup(e, 'unit-circle', `
          <div style="font-family:Inter,sans-serif;font-size:0.85rem;max-width:240px">
            <strong>🏛️ ${p.nama_satuan}</strong>
            ${p.deskripsi ? `<div style="color:#64748b;margin-top:4px">${p.deskripsi}</div>` : ''}
            ${coordHtml(lat, lng)}
          </div>`)
      })
      map.on('click', 'zone-fill', (e) => {
        const p = e.features[0]?.properties; if (!p) return
        const lat = e.lngLat.lat; const lng = e.lngLat.lng
        showPopup(e, 'zone-fill', `
          <div style="font-family:Inter,sans-serif;font-size:0.85rem;max-width:240px">
            <strong>🛡️ ${p.name}</strong><br/>
            <span style="color:${p.risk_color};font-weight:600">Level ${p.risk_level} · ${RISK_NAMES[p.risk_level]}</span>
            ${p.description ? `<div style="color:#64748b;margin-top:4px">${p.description}</div>` : ''}
            ${coordHtml(lat, lng)}
          </div>`)
      })
      map.on('click', 'drawing-marker', (e) => {
        const p = e.features[0]?.properties; if (!p) return
        const lat = e.lngLat.lat; const lng = e.lngLat.lng
        showPopup(e, 'drawing-marker', `
          <div style="font-family:Inter,sans-serif;font-size:0.85rem;max-width:240px">
            <strong>✏️ ${p.name || 'Marker'}</strong>
            ${p.description ? `<div style="color:#64748b;margin-top:4px">${p.description}</div>` : ''}
            ${coordHtml(lat, lng)}
          </div>`)
      })
      map.on('click', 'drawing-fill', (e) => {
        const p = e.features[0]?.properties; if (!p) return
        const lat = e.lngLat.lat; const lng = e.lngLat.lng
        showPopup(e, 'drawing-fill', `
          <div style="font-family:Inter,sans-serif;font-size:0.85rem;max-width:240px">
            <strong>✏️ ${p.name || 'Polygon'}</strong>
            ${p.description ? `<div style="color:#64748b;margin-top:4px">${p.description}</div>` : ''}
            ${coordHtml(lat, lng)}
          </div>`)
      })
      map.on('click', 'drawing-line', (e) => {
        const p = e.features[0]?.properties; if (!p) return
        const lat = e.lngLat.lat; const lng = e.lngLat.lng
        showPopup(e, 'drawing-line', `
          <div style="font-family:Inter,sans-serif;font-size:0.85rem;max-width:240px">
            <strong>📏 ${p.name || 'Polyline'}</strong>
            ${p.description ? `<div style="color:#64748b;margin-top:4px">${p.description}</div>` : ''}
            ${coordHtml(lat, lng)}
          </div>`)
      })
    })

    map.on('mousemove', (e) => {
      setCursorCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    map.on('pitch', () => { setPitch(Math.round(map.getPitch())) })
    map.on('rotate', () => { setBearing(Math.round(map.getBearing())) })

    mapRef.current = map

    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return
    try { mapRef.current.getSource('laporan')?.setData(makeLaporanFC(laporan)) } catch {}
  }, [laporan])

  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return
    try { mapRef.current.getSource('units')?.setData(makeUnitsFC(satuans)) } catch {}
  }, [satuans])

  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return
    try { mapRef.current.getSource('zones')?.setData(makeZonesFC(zones)) } catch {}
  }, [zones])

  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return
    try { mapRef.current.getSource('drawings')?.setData(makeDrawingsFC(drawings)) } catch {}
  }, [drawings])

  const resetView = () => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [118.0149, -2.5489], zoom: 5.5, pitch: 55, bearing: 0, duration: 1500 })
  }

  const togglePitch = () => {
    const map = mapRef.current
    if (!map) return
    const newPitch = map.getPitch() > 10 ? 0 : 55
    map.flyTo({ pitch: newPitch, duration: 1000 })
  }

  const totalLaporan = (laporan || []).length
  const totalSatuan = (satuans || []).filter(s => s.latitude && s.longitude).length
  const totalZones = (zones || []).filter(z => z.boundary).length
  const totalDrawings = (drawings || []).length

  return (
    <div className="form-overlay" style={{ background: '#000', zIndex: 2000 }} onClick={onClose}>
      <motion.div style={{ width: '100vw', height: '100vh', position: 'relative' }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

        <div style={{
          position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10,
          display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          <div style={{ background: 'rgba(7,17,10,0.92)', padding: '8px 16px', borderRadius: 8, backdropFilter: 'blur(8px)', border: '1px solid rgba(61,220,132,0.2)' }}>
            <span style={{ color: '#3DDC84', fontWeight: 700, fontSize: '0.9rem' }}>🏔️ 3D Terrain</span>
            <span style={{ color: '#94a3b8', fontSize: '0.72rem', marginLeft: 10 }}>
              Drag=Rotate · Scroll=Zoom · {pitch}° tilt · {bearing}° bearing
            </span>
          </div>

          <div style={{ background: 'rgba(7,17,10,0.92)', padding: '6px 14px', borderRadius: 8, backdropFilter: 'blur(8px)', border: '1px solid rgba(61,220,132,0.15)',
            display: 'flex', gap: 12, fontSize: '0.72rem', color: '#94a3b8' }}>
            <span>📋 {totalLaporan} Laporan</span>
            <span>🏛️ {totalSatuan} Satuan</span>
            <span>🛡️ {totalZones} Zona</span>
            <span>✏️ {totalDrawings} Gambar</span>
          </div>

          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button onClick={resetView}
              style={{ background: 'rgba(7,17,10,0.92)', border: '1px solid rgba(61,220,132,0.3)', color: '#3DDC84', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', backdropFilter: 'blur(8px)' }}>
              🏠 Reset View
            </button>
            <button onClick={togglePitch}
              style={{ background: 'rgba(7,17,10,0.92)', border: '1px solid rgba(61,220,132,0.3)', color: '#3DDC84', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', backdropFilter: 'blur(8px)' }}>
              {pitch > 10 ? '📐 2D' : '🏔️ 3D'}
            </button>
            <select value={coordFormat} onChange={(e) => setCoordFormat(e.target.value)}
              style={{ background: 'rgba(7,17,10,0.92)', border: '1px solid rgba(61,220,132,0.3)', color: '#3DDC84', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem', backdropFilter: 'blur(8px)', outline: 'none' }}>
              <option value="mgrs">MGRS</option>
              <option value="utm">UTM</option>
              <option value="dms">D°M'S"</option>
              <option value="dd">DD</option>
            </select>
            <button onClick={onClose}
              style={{ background: 'rgba(239,68,68,0.9)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', backdropFilter: 'blur(8px)' }}>
              ✕ Tutup
            </button>
          </div>
        </div>

        {cursorCoords && (
          <div style={{
            position: 'absolute', bottom: 60, left: 16, zIndex: 10,
            background: 'rgba(7,17,10,0.9)', padding: '8px 14px', borderRadius: 8,
            border: '1px solid rgba(61,220,132,0.2)', backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontSize: '0.72rem', color: '#c9a84c', fontFamily: 'monospace', fontWeight: 600 }}>
              🔷 {formatCoordinate(cursorCoords.lat, cursorCoords.lng, coordFormat)}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>
              {cursorCoords.lat.toFixed(6)}, {cursorCoords.lng.toFixed(6)}
            </div>
          </div>
        )}

        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
          background: 'rgba(7,17,10,0.85)', padding: '6px 16px', borderRadius: 20,
          border: '1px solid rgba(61,220,132,0.15)', fontSize: '0.72rem', color: '#94a3b8',
        }}>
          🖱️ Seret untuk rotasi · Scroll untuk zoom · {exaggeration.toFixed(1)}x terrain
        </div>
      </motion.div>
    </div>
  )
}
