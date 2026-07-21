import { useEffect, useRef, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { motion } from 'framer-motion'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const TILE_LAYERS = {
  streets: {
    name: 'Jalan',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  satellite: {
    name: 'Satelit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  terrain: {
    name: 'Topografi',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
  },
  dark: {
    name: 'Gelap',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB',
  },
}

function createMarkerIcon(color, icon) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      position: relative;
      width: 30px;
      height: 30px;
    ">
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        background: ${color};
        transform: rotate(-45deg);
        border: 2.5px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: 12px;
          line-height: 1;
        ">${icon}</span>
      </div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  })
}

function MapEvents({ onMapClick, showForm }) {
  useMapEvents({
    click(e) {
      if (showForm && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng)
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

export default function MapView({
  laporan,
  selectedId,
  onSelect,
  onMapClick,
  pickLocation,
  center,
  showForm,
  getKategoriColor,
  getKategoriIcon,
}) {
  const [tileLayer, setTileLayer] = useState('streets')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const [showCluster, setShowCluster] = useState(true)
  const mapRef = useRef(null)

  const pickIcon = L.divIcon({
    className: 'pick-marker',
    html: `<div style="
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #0ea5e9);
      border: 3px solid white;
      box-shadow: 0 3px 12px rgba(37, 99, 235, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    "><div style="width: 10px; height: 10px; border-radius: 50%; background: white;"></div></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })

  const heatmapData = useMemo(() => {
    return laporan.map((l) => [parseFloat(l.latitude), parseFloat(l.longitude), 1])
  }, [laporan])

  useEffect(() => {
    if (!mapRef.current || !showHeatmap) return
    const map = mapRef.current

    let heatLayer = map._heatLayer
    if (heatLayer) {
      map.removeLayer(heatLayer)
    }

    if (showHeatmap && heatmapData.length > 0) {
      heatLayer = L.heatLayer(heatmapData, {
        radius: 30,
        blur: 20,
        maxZoom: 10,
        gradient: {
          0.2: '#2563eb',
          0.4: '#06b6d4',
          0.6: '#22c55e',
          0.8: '#f59e0b',
          1.0: '#ef4444',
        },
      }).addTo(map)
      map._heatLayer = heatLayer
    }
  }, [showHeatmap, heatmapData])

  const uniqueKategori = useMemo(() => {
    const seen = new Set()
    return laporan
      .filter((l) => {
        if (seen.has(l.kategori)) return false
        seen.add(l.kategori)
        return true
      })
      .map((l) => ({ kategori: l.kategori, color: getKategoriColor(l.kategori), icon: getKategoriIcon(l.kategori) }))
  }, [laporan, getKategoriColor, getKategoriIcon])

  return (
    <>
      <MapContainer
        center={center}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          key={tileLayer}
          attribution={TILE_LAYERS[tileLayer].attribution}
          url={TILE_LAYERS[tileLayer].url}
        />
        <MapEvents onMapClick={onMapClick} showForm={showForm} />
        <MapRef mapRef={mapRef} />

        {laporan.map((l) => (
          <Marker
            key={l.id}
            position={[parseFloat(l.latitude), parseFloat(l.longitude)]}
            icon={createMarkerIcon(
              selectedId === l.id ? '#ef4444' : getKategoriColor(l.kategori),
              getKategoriIcon(l.kategori)
            )}
            eventHandlers={{ click: () => onSelect(l) }}
          >
            <Popup>
              <div style={{ minWidth: '150px' }}>
                <strong style={{ fontSize: '0.95rem' }}>{l.judul}</strong>
                <br />
                <span style={{ color: getKategoriColor(l.kategori), fontWeight: 600, fontSize: '0.85rem' }}>
                  {getKategoriIcon(l.kategori)} {l.kategori}
                </span>
                {l.lokasi_nama && (
                  <div style={{ fontSize: '0.82rem', color: '#666', marginTop: '4px' }}>
                    📍 {l.lokasi_nama}
                  </div>
                )}
                <div style={{ fontSize: '0.78rem', color: '#999', marginTop: '4px' }}>
                  {new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {pickLocation && (
          <Marker position={[pickLocation.lat, pickLocation.lng]} icon={pickIcon}>
            <Popup>
              <strong>Lokasi Dipilih</strong>
              <br />
              <span style={{ fontSize: '0.85rem' }}>
                {pickLocation.lat.toFixed(6)}, {pickLocation.lng.toFixed(6)}
              </span>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Map Controls */}
      <div className="map-controls">
        <div className="map-control-group">
          {Object.entries(TILE_LAYERS).map(([key, layer]) => (
            <button
              key={key}
              className={`map-control-btn ${tileLayer === key ? 'active' : ''}`}
              onClick={() => setTileLayer(key)}
              title={layer.name}
            >
              {key === 'streets' && '🗺️'}
              {key === 'satellite' && '🛰️'}
              {key === 'terrain' && '⛰️'}
              {key === 'dark' && '🌙'}
            </button>
          ))}
        </div>
        <div className="map-control-group">
          <button
            className={`map-control-btn ${showHeatmap ? 'active' : ''}`}
            onClick={() => setShowHeatmap(!showHeatmap)}
            title="Heatmap"
          >
            🔥
          </button>
          <button
            className={`map-control-btn ${showLegend ? 'active' : ''}`}
            onClick={() => setShowLegend(!showLegend)}
            title="Legenda"
          >
            📋
          </button>
        </div>
      </div>

      {/* Legend */}
      {showLegend && uniqueKategori.length > 0 && (
        <motion.div
          className="map-legend"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
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
