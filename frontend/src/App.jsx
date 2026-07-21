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

const API = '/api/laporan'
const REFRESH_INTERVAL = 30000

const KATEGORI_COLORS = {
  'Banjir': '#2563eb', 'Gempa Bumi': '#ef4444', 'Kebakaran': '#f97316',
  'Longsor': '#854d0e', 'Angin Kencang': '#6366f1', 'Kekeringan': '#eab308',
  'Bencana Lainnya': '#a855f7', 'Berita Umum': '#22c55e',
}

const KATEGORI_ICONS = {
  'Banjir': '🌊', 'Gempa Bumi': '🏚️', 'Kebakaran': '🔥', 'Longsor': '⛰️',
  'Angin Kencang': '🌪️', 'Kekeringan': '☀️', 'Bencana Lainnya': '⚠️', 'Berita Umum': '📰',
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
  const { user, loading: authLoading, logout } = useAuth()
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

  const refreshAll = useCallback(() => {
    fetchLaporan()
    fetchStats()
  }, [fetchLaporan, fetchStats])

  useEffect(() => { if (user) { fetchLaporan(); fetchStats() } }, [fetchLaporan, fetchStats, user])

  const handleSave = async (formData) => {
    try {
      if (editingLaporan) {
        await axios.put(`${API}/${editingLaporan.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        await axios.post(API, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      setShowForm(false); setEditingLaporan(null); setPickLocation(null); fetchLaporan(); fetchStats()
    } catch (err) { throw err }
  }

  const handleDelete = async (id) => {
    try { await axios.delete(`${API}/${id}`); setSelectedLaporan(null); fetchLaporan(); fetchStats(); return true } catch { return false }
  }

  const handleEdit = (l) => { setEditingLaporan(l); setShowForm(true); setSelectedLaporan(null) }
  const handleMapClick = (lat, lng) => { if (showForm) setPickLocation({ lat, lng }) }

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
    setShowWorkflow(false); setEditingLaporan(null); setSelectedLaporan(null)
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
    showSatellite || showPredictive || showWorkflow

  return (
    <div className="app">
      <KeyboardShortcutsHandler onAction={handleKeyboardAction} />

      <header className="header">
        <MobileNav currentView={currentView} setCurrentView={setCurrentView}
          onPanel={(p) => handleKeyboardAction({ action: 'panel', value: p })}
          user={user} logout={logout} />

        <div className="header-left">
          <motion.div className="header-logo"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 10 }}>
            🌐
          </motion.div>
          <div>
            <h1>SIGINT</h1>
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
          {user.role === 'admin' && (
            <button className="btn btn-ghost" onClick={() => setShowAuditLog(true)}>📝 Audit</button>
          )}

          {user.role !== 'viewer' && (
            <button className="btn btn-ghost" onClick={() => { setEditingLaporan(null); setPickLocation(null); setShowForm(true); setCurrentView('map') }}>+ Baru</button>
          )}

          {user.role === 'admin' && (
            <button className="btn btn-ghost" onClick={() => setShowUserMgmt(true)}>👥</button>
          )}

          <NotificationBell />
          <ThemeToggle theme={theme} setTheme={setTheme} />

          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              onClick={logout}>
              {user.username} 🚪
            </button>
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
              <div className="map-container">
                <MapView laporan={laporan} selectedId={selectedLaporan?.id} onSelect={setSelectedLaporan}
                  onMapClick={handleMapClick} pickLocation={pickLocation} center={mapCenter} showForm={showForm}
                  getKategoriColor={getKategoriColor} getKategoriIcon={getKategoriIcon} />
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

      <AutoRefreshBar onRefresh={refreshAll} interval={REFRESH_INTERVAL} />

      <AnimatePresence>
        {showForm && <LaporanForm laporan={editingLaporan} pickLocation={pickLocation} onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingLaporan(null); setPickLocation(null) }}
          kategoriList={Object.keys(KATEGORI_COLORS)} getKategoriIcon={getKategoriIcon} />}
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
      </AnimatePresence>
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
