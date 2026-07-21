import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import MapView from './components/MapView'
import LaporanForm from './components/LaporanForm'
import LaporanList from './components/LaporanList'
import DetailPanel from './components/DetailPanel'
import Dashboard from './components/Dashboard'
import ThemeToggle from './components/ThemeToggle'
import LoginPage from './components/LoginPage'
import UserManagement from './components/UserManagement'
import CommentPanel from './components/CommentPanel'
import ThreatZonesPanel from './components/ThreatZonesPanel'
import AnalysisPanel from './components/AnalysisPanel'
import Timeline from './components/Timeline'
import AdvancedSearch from './components/AdvancedSearch'
import NotificationBell from './components/NotificationBell'
import LoadingSpinner from './components/LoadingSpinner'
import AuditLog from './components/AuditLog'
import OsintFeed from './components/OsintFeed'
import LiveTracking from './components/LiveTracking'
import SatelliteView from './components/SatelliteView'
import PredictivePanel from './components/PredictivePanel'
import WorkflowPanel from './components/WorkflowPanel'
import KeyboardShortcutsHandler from './components/KeyboardShortcuts'
import MobileNav from './components/MobileNav'
import { DashboardSkeleton, ListSkeleton } from './components/SkeletonLoader'
import PwaInstallPrompt from './components/PwaInstallPrompt'
import ProfilePage from './components/ProfilePage'
import DrawingPanel from './components/DrawingPanel'
import { useRealtimeLaporan, useRealtimeNotifications } from './hooks/useSocket'

const API = '/api/laporan'
const REFRESH_INTERVAL = 30000

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

export const ToastContext = createContext()
export function useToast() { return useContext(ToastContext) }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])
  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div key={toast.id} className={`toast toast-${toast.type}`}
              initial={{ opacity: 0, x: 100, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
              <div className="toast-icon">
                {toast.type === 'success' && '✓'}{toast.type === 'error' && '✕'}
                {toast.type === 'warning' && '⚠'}{toast.type === 'info' && 'ℹ'}
              </div>
              <span className="toast-message">{toast.message}</span>
              <button className="toast-close" onClick={() => removeToast(toast.id)}>×</button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

function AutoRefreshBar({ onRefresh, interval }) {
  const [progress, setProgress] = useState(100)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (paused) return
    setProgress(0)
    const startTime = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const pct = Math.min((elapsed / interval) * 100, 100)
      setProgress(pct)
      if (pct >= 100) {
        onRefresh()
        setProgress(0)
      }
    }, 100)
    return () => clearInterval(timerRef.current)
  }, [onRefresh, interval, paused])

  return (
    <div className="refresh-indicator" onClick={() => setPaused(!paused)}
      data-tooltip={paused ? 'Klik untuk resume auto-refresh' : 'Klik untuk pause auto-refresh'}>
      <span className={`live-pulse`} style={paused ? { background: 'var(--warning)', animation: 'none' } : {}} />
      <span>{paused ? 'Paused' : 'Auto-refresh'}</span>
      <div className="refresh-bar">
        <div className="refresh-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function AppContent() {
  const { user, setUser, loading: authLoading, logout, token } = useAuth()
  const addToast = useToast()
  const [laporan, setLaporan] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingLaporan, setEditingLaporan] = useState(null)
  const [selectedLaporan, setSelectedLaporan] = useState(null)
  const [filter, setFilter] = useState({ kategori: '', search: '' })
  const [pickLocation, setPickLocation] = useState(null)
  const [showExport, setShowExport] = useState(false)
  const [stats, setStats] = useState(null)
  const [mapCenter] = useState([-2.5489, 118.0149])
  const [currentView, setCurrentView] = useState('map')
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [showUserMgmt, setShowUserMgmt] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showThreatZones, setShowThreatZones] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showAdvSearch, setShowAdvSearch] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [showOsintFeed, setShowOsintFeed] = useState(false)
  const [showLiveTracking, setShowLiveTracking] = useState(false)
  const [showSatellite, setShowSatellite] = useState(false)
  const [showPredictive, setShowPredictive] = useState(false)
  const [showWorkflow, setShowWorkflow] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [drawingEnabled, setDrawingEnabled] = useState(false)
  const [coordFormat, setCoordFormat] = useState('mgrs')
  const [drawings, setDrawings] = useState([])
  const [showDrawingPanel, setShowDrawingPanel] = useState(false)
  const [selectedKategori, setSelectedKategori] = useState(null)
  const [flyToTarget, setFlyToTarget] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const fetchLaporan = useCallback(async (customParams) => {
    try {
      const params = { ...filter, ...customParams }
      if (!params.kategori) delete params.kategori
      if (!params.search) delete params.search
      if (!params.date_from) delete params.date_from
      if (!params.date_to) delete params.date_to
      if (!params.radius) { delete params.lat; delete params.lng; delete params.radius; }
      const res = await axios.get(API, { params })
      setLaporan(res.data.data)
    } catch (err) { console.error(err) } finally { setLoading(false); setInitialLoad(false) }
  }, [filter])

  const fetchStats = useCallback(async () => {
    try { const res = await axios.get(`${API}/stats`); setStats(res.data.data) } catch (err) { console.error(err) }
  }, [])

  const fetchDrawings = useCallback(async () => {
    try { const res = await axios.get('/api/drawings'); setDrawings(res.data.data) } catch (err) { console.error(err) }
  }, [])

  const refreshAll = useCallback(() => {
    fetchLaporan()
    fetchStats()
    fetchDrawings()
  }, [fetchLaporan, fetchStats, fetchDrawings])

  useEffect(() => { if (user) { fetchLaporan(); fetchStats(); fetchDrawings() } }, [fetchLaporan, fetchStats, fetchDrawings, user])

  const handleNewLaporan = useCallback((data) => {
    setLaporan(prev => [data, ...prev])
    fetchStats()
  }, [fetchStats])

  const handleUpdateLaporan = useCallback((data) => {
    setLaporan(prev => prev.map(l => l.id === data.id ? data : l))
    fetchStats()
  }, [fetchStats])

  const handleDeleteLaporan = useCallback((data) => {
    setLaporan(prev => prev.filter(l => l.id !== data.id))
    fetchStats()
  }, [fetchStats])

  const rtConnected = useRealtimeLaporan(token, handleNewLaporan, handleUpdateLaporan, handleDeleteLaporan)

  const handleNotification = useCallback((notif) => {
    addToast(notif.message || 'Notifikasi baru', 'info')
  }, [addToast])
  useRealtimeNotifications(token, handleNotification)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  const handleSave = async (formData) => {
    try {
      if (editingLaporan) {
        await axios.put(`${API}/${editingLaporan.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        addToast('Laporan berhasil diperbarui', 'success')
      } else {
        await axios.post(API, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        addToast('Laporan berhasil dikirim', 'success')
      }
      setShowForm(false); setEditingLaporan(null); setPickLocation(null); fetchLaporan(); fetchStats()
    } catch (err) {
      addToast(err?.response?.data?.error || 'Gagal menyimpan laporan', 'error')
      throw err
    }
  }

  const handleDelete = async (id) => {
    try { await axios.delete(`${API}/${id}`); setSelectedLaporan(null); fetchLaporan(); fetchStats(); return true } catch { return false }
  }

  const handleEdit = (l) => { setEditingLaporan(l); setShowForm(true); setSelectedLaporan(null) }
  const handleMapClick = (lat, lng) => {
    if (showForm) {
      setPickLocation({ lat, lng })
    } else {
      setEditingLaporan(null)
      setPickLocation({ lat, lng })
      setSelectedKategori(null)
      setShowForm(true)
      setCurrentView('map')
    }
  }

  const handleExport = async (format) => {
    try {
      const res = await axios.get(`${API}/export`, { params: { format }, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `laporan.${format === 'geojson' ? 'geojson' : 'csv'}`; a.click()
      window.URL.revokeObjectURL(url); setShowExport(false)
    } catch (err) { console.error(err) }
  }

  const handleAdvancedSearch = (params) => { fetchLaporan(params); setShowAdvSearch(false) }

  const closeAllPanels = useCallback(() => {
    setShowForm(false); setShowUserMgmt(false); setShowComments(false)
    setShowThreatZones(false); setShowAnalysis(false); setShowTimeline(false)
    setShowAdvSearch(false); setShowAuditLog(false); setShowOsintFeed(false)
    setShowLiveTracking(false); setShowSatellite(false); setShowPredictive(false)
    setShowWorkflow(false); setShowDrawingPanel(false)
    setEditingLaporan(null); setSelectedLaporan(null)
  }, [])

  const handleShapeCreated = useCallback(async (e) => {
    const layer = e.layer
    const type = e.layerType
    let coordinates = {}
    let name = ''

    if (type === 'marker') {
      const ll = layer.getLatLng()
      coordinates = { lat: ll.lat, lng: ll.lng }
      name = 'Marker'
    } else if (type === 'polyline') {
      const lls = layer.getLatLngs()
      coordinates = { points: lls.map(ll => ({ lat: ll.lat, lng: ll.lng })) }
      name = 'Jalur'
    } else if (type === 'polygon') {
      const lls = layer.getLatLngs()[0]
      coordinates = { points: lls.map(ll => ({ lat: ll.lat, lng: ll.lng })) }
      name = 'Area'
    }

    try {
      await axios.post('/api/drawings', {
        name, shape_type: type, coordinates,
        color: '#1b4332', stroke_width: 3, fill_opacity: 0.2,
      })
      fetchDrawings()
      addToast(`${name} berhasil disimpan`, 'success')
    } catch (err) {
      console.error(err)
    }
  }, [fetchDrawings, addToast])

  const handleSelectDrawing = useCallback((drawing) => {
    if (!drawing?.coordinates) return
    if (drawing.shape_type === 'marker') {
      setFlyToTarget({ lat: drawing.coordinates.lat, lng: drawing.coordinates.lng, zoom: 14 })
    } else if (drawing.shape_type === 'polyline' && drawing.coordinates.points?.length) {
      const pts = drawing.coordinates.points
      const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
      const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
      setFlyToTarget({ lat, lng, zoom: 12 })
    } else if (drawing.shape_type === 'polygon' && drawing.coordinates.points?.length) {
      const pts = drawing.coordinates.points
      const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
      const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
      setFlyToTarget({ lat, lng, zoom: 12 })
    }
  }, [])

  const handleKeyboardAction = useCallback((shortcut) => {
    switch (shortcut.action) {
      case 'view':
        setCurrentView(shortcut.value)
        break
      case 'newReport':
        setEditingLaporan(null); setPickLocation(null); setShowForm(true); setCurrentView('map')
        break
      case 'panel':
        closeAllPanels()
        switch (shortcut.value) {
          case 'timeline': setShowTimeline(true); break
          case 'analysis': setShowAnalysis(true); break
          case 'zones': setShowThreatZones(true); break
          case 'osint': setShowOsintFeed(true); break
          case 'workflow': setShowWorkflow(true); break
          case 'tracking': setShowLiveTracking(true); break
          case 'satellite': setShowSatellite(true); break
          case 'predictive': setShowPredictive(true); break
          default: break
        }
        break
      case 'theme':
        setTheme(prev => prev === 'dark' ? 'light' : 'dark')
        break
      case 'search':
        setCurrentView('map')
        break
      case 'close':
        closeAllPanels()
        break
      default: break
    }
  }, [closeAllPanels])

  const getKategoriColor = (k) => KATEGORI_COLORS[k] || '#666'
  const getKategoriIcon = (k) => KATEGORI_ICONS[k] || '📌'

  if (authLoading) return <LoadingSpinner text="Memuat sesi..." />
  if (!user) return <LoginPage />

  const anyPanelOpen = showForm || showUserMgmt || showComments || showThreatZones || showAnalysis ||
    showTimeline || showAdvSearch || showAuditLog || showOsintFeed || showLiveTracking ||
    showSatellite || showPredictive || showWorkflow || showProfile || showDrawingPanel

  return (
    <div className="app">
      <KeyboardShortcutsHandler onAction={handleKeyboardAction} />
      <PwaInstallPrompt />

      {!isOnline && (
        <div className="offline-banner">📡 Anda sedang offline — data mungkin tidak terbaru</div>
      )}

      <header className="header">
        <MobileNav currentView={currentView} setCurrentView={setCurrentView}
          onPanel={(p) => handleKeyboardAction({ action: 'panel', value: p })}
          user={user} logout={logout} />

        <div className="header-left">
          <div className="header-logo">
            <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          </div>
          <div>
            <h1>SIGINT KOSTRAD</h1>
            <span className="header-subtitle">Sistem Intelijen Geospasial</span>
          </div>
        </div>

        <div className="header-nav">
          <button className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>📊 Dashboard</button>
          <button className={`nav-btn ${currentView === 'map' ? 'active' : ''}`} onClick={() => setCurrentView('map')}>🗺️ Peta</button>
          <button className="nav-btn" onClick={() => setShowLiveTracking(true)}>📡 Tracking</button>
          <button className="nav-btn" onClick={() => setShowSatellite(true)}>🛰️ Satelit</button>
          <button className="nav-btn" onClick={() => setShowPredictive(true)}>🔮 Prediktif</button>
        </div>

        <div className="header-actions">
          {currentView === 'map' && (
            <div style={{ position: 'relative' }}>
              <button className="btn btn-ghost" onClick={() => setShowExport(!showExport)}>📥 Export</button>
              {showExport && (
                <div className="export-menu">
                  <button onClick={() => handleExport('csv')}>📄 CSV</button>
                  <button onClick={() => handleExport('geojson')}>🌐 GeoJSON</button>
                  <button onClick={() => window.open('/api/export/pdf', '_blank')}>📑 PDF Report</button>
                </div>
              )}
            </div>
          )}

          <button className="btn btn-ghost" onClick={() => setShowTimeline(true)}>⏱️</button>
          <button className="btn btn-ghost" onClick={() => setShowAnalysis(true)}>🧠</button>
          <button className="btn btn-ghost" onClick={() => setShowThreatZones(true)}>🛡️</button>
          <button className="btn btn-ghost" onClick={() => setShowOsintFeed(true)}>🔍 OSINT</button>
          <button className="btn btn-ghost" onClick={() => setShowWorkflow(true)}>📋</button>
          <button className="btn btn-ghost" onClick={() => { setShowDrawingPanel(true); fetchDrawings() }}>🗺️ Hasil Gambar</button>
          {user.role === 'admin' && (
            <button className="btn btn-ghost" onClick={() => setShowAuditLog(true)}>📝 Audit</button>
          )}

          {user.role !== 'viewer' && (
            <button className="btn btn-ghost" onClick={() => { setEditingLaporan(null); setPickLocation(null); setShowForm(true); setCurrentView('map') }}>+ Baru</button>
          )}

          {currentView === 'map' && (
            <>
              <button className={`btn btn-ghost ${drawingEnabled ? 'btn-active-gold' : ''}`}
                onClick={() => setDrawingEnabled(!drawingEnabled)}
                title={drawingEnabled ? 'Nonaktifkan alat gambar' : 'Aktifkan alat gambar'}>
                ✏️ Gambar
              </button>
              <select
                className="coord-format-select"
                value={coordFormat}
                onChange={(e) => setCoordFormat(e.target.value)}
                title="Format koordinat"
              >
                <option value="mgrs">MGRS</option>
                <option value="utm">UTM</option>
                <option value="dms">DMS</option>
                <option value="dd">Desimal</option>
              </select>
            </>
          )}

          {user.role === 'admin' && (
            <button className="btn btn-ghost" onClick={() => setShowUserMgmt(true)}>👥</button>
          )}

          <NotificationBell />
          <ThemeToggle theme={theme} setTheme={setTheme} />

          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              onClick={() => setShowUserMenu(!showUserMenu)}>
              {user.username} 👤
            </button>
            {showUserMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowUserMenu(false)} />
                <motion.div className="user-dropdown"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}>
                  <div className="user-dropdown-header">
                    <span style={{ fontWeight: 700 }}>{user.username}</span>
                    <span className="user-dropdown-role">{user.role}</span>
                  </div>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item" onClick={() => { setShowUserMenu(false); setShowProfile(true) }}>
                    👤 Profil
                  </button>
                  <button className="user-dropdown-item danger" onClick={logout}>
                    🚪 Logout
                  </button>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="main-content">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' ? (
            <motion.div key="dashboard" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }} transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              style={{ flex: 1, overflow: 'hidden' }}>
              {initialLoad ? <DashboardSkeleton /> : (
                <Dashboard laporan={laporan} stats={stats} getKategoriColor={getKategoriColor} getKategoriIcon={getKategoriIcon} />
              )}
            </motion.div>
          ) : (
            <motion.div key="map" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="panel-header">
                  {!sidebarCollapsed && <h2>Laporan</h2>}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {!sidebarCollapsed && (
                      <button className="btn btn-sm btn-outline" onClick={() => setShowAdvSearch(true)} style={{ fontSize: '0.78rem' }}>🔍</button>
                    )}
                    {!sidebarCollapsed && <span className="panel-count">{laporan.length}</span>}
                    <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      title={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}>
                      {sidebarCollapsed ? '▶' : '◀'}
                    </button>
                  </div>
                </div>
                {!sidebarCollapsed && (
                  <>
                    <div className="filter-bar">
                      <input type="text" placeholder="🔍 Cari..." value={filter.search}
                        onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
                      <select value={filter.kategori} onChange={(e) => setFilter({ ...filter, kategori: e.target.value })}>
                        <option value="">Semua</option>
                        {Object.keys(KATEGORI_COLORS).map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    {stats && (
                      <div className="stats-bar">
                        <span>📊 {stats.total} total</span>
                        <span>🏷️ {stats.kategori_count} kategori</span>
                      </div>
                    )}
                    {initialLoad ? <ListSkeleton /> : (
                      <LaporanList laporan={laporan} selectedId={selectedLaporan?.id} onSelect={setSelectedLaporan}
                        getKategoriColor={getKategoriColor} getKategoriIcon={getKategoriIcon} loading={loading} />
                    )}
                  </>
                )}
              </aside>
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
                <div className="map-container" style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                  <MapView laporan={laporan} selectedId={selectedLaporan?.id} onSelect={setSelectedLaporan}
                    onMapClick={handleMapClick} pickLocation={pickLocation} center={mapCenter} showForm={showForm}
                    getKategoriColor={getKategoriColor} getKategoriIcon={getKategoriIcon}
                    drawingEnabled={drawingEnabled} coordFormat={coordFormat}
                    drawings={drawings} onShapeCreated={handleShapeCreated}
                    selectedKategori={selectedKategori} flyToTarget={flyToTarget}
                    onFlyToDone={() => setFlyToTarget(null)} />
                </div>
                <AnimatePresence>
                  {showForm && (
                    <LaporanForm laporan={editingLaporan} pickLocation={pickLocation} onSave={handleSave}
                      onClose={() => { setShowForm(false); setEditingLaporan(null); setPickLocation(null); setSelectedKategori(null) }}
                      kategoriList={Object.keys(KATEGORI_COLORS)} getKategoriIcon={getKategoriIcon}
                      onKategoriChange={setSelectedKategori} onFlyTo={setFlyToTarget} onPickLocation={setPickLocation} />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedLaporan && currentView === 'map' && (
          <DetailPanel laporan={selectedLaporan} onEdit={handleEdit} onDelete={handleDelete}
            onClose={() => setSelectedLaporan(null)} getKategoriColor={getKategoriColor}
            getKategoriIcon={getKategoriIcon} onComment={() => setShowComments(true)} />
        )}
      </AnimatePresence>

      {!anyPanelOpen && user.role !== 'viewer' && (
        <motion.button className="fab"
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => { setEditingLaporan(null); setPickLocation(null); setShowForm(true); setCurrentView('map') }}
          title="Laporan Baru (N)">
          +
        </motion.button>
      )}

      {!showForm && <AutoRefreshBar onRefresh={refreshAll} interval={REFRESH_INTERVAL} />}

      <AnimatePresence>
        {showUserMgmt && <UserManagement onClose={() => setShowUserMgmt(false)} />}
        {showComments && selectedLaporan && <CommentPanel laporanId={selectedLaporan.id} onClose={() => setShowComments(false)} />}
        {showThreatZones && <ThreatZonesPanel onClose={() => setShowThreatZones(false)} />}
        {showAnalysis && <AnalysisPanel onClose={() => setShowAnalysis(false)} />}
        {showTimeline && <Timeline onClose={() => setShowTimeline(false)} />}
        {showAdvSearch && <AdvancedSearch onSearch={handleAdvancedSearch} onClose={() => setShowAdvSearch(false)} />}
        {showAuditLog && <AuditLog onClose={() => setShowAuditLog(false)} />}
        {showOsintFeed && <OsintFeed onClose={() => setShowOsintFeed(false)} />}
        {showLiveTracking && <LiveTracking onClose={() => setShowLiveTracking(false)} />}
        {showSatellite && <SatelliteView laporan={laporan} onClose={() => setShowSatellite(false)} />}
        {showPredictive && <PredictivePanel onClose={() => setShowPredictive(false)} />}
        {showWorkflow && <WorkflowPanel laporanList={laporan} onClose={() => setShowWorkflow(false)} />}
        {showProfile && <ProfilePage onClose={() => setShowProfile(false)} />}
        {showDrawingPanel && <DrawingPanel drawings={drawings} onRefresh={fetchDrawings} onClose={() => setShowDrawingPanel(false)} onSelectDrawing={handleSelectDrawing} />}
      </AnimatePresence>

      {rtConnected !== undefined && (
        <div style={{
          position: 'fixed', top: 'calc(var(--header-height) + 4px)', right: 12,
          display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem',
          color: rtConnected ? 'var(--success)' : 'var(--text-light)',
          background: 'var(--card)', padding: '3px 10px', borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', zIndex: 800,
        }}>
          <span className="live-pulse" style={{ width: 6, height: 6 }} />
          {rtConnected ? 'Real-time' : 'Offline'}
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}
