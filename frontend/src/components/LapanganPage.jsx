import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { extractGpsFromFiles } from '../utils/exif-gps'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' })

const posIcon = L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#3DDC84;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;border-radius:50%;background:#fff;animation:pulse 1.5s infinite;"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function MapFollower({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo([position.latitude, position.longitude], 15, { duration: 0.8 })
  }, [position, map])
  return null
}

const KATEGORI_COLORS = {
  'Gangguan Keamanan': '#ef4444',
  'Separatisme': '#f97316',
  'Terorisme': '#dc2626',
  'Radikalisme': '#eab308',
  'Keamanan Nasional': '#1d4ed8',
  'Politik': '#8b5cf6',
  'Sosial': '#06b6d4',
  'Ekonomi': '#10b981',
  'Informasi Lain': '#64748b',
}

const KATEGORI_LIST = Object.keys(KATEGORI_COLORS)

export default function LapanganPage() {
  const { user } = useAuth()
  const addToast = useToast()
  const [activeTab, setActiveTab] = useState('new')
  const [position, setPosition] = useState(null)
  const [positionError, setPositionError] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [watchId, setWatchId] = useState(null)
  const [myReports, setMyReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    judul: '', deskripsi: '', kategori: 'Gangguan Keamanan',
    latitude: '', longitude: '', lokasi_nama: '',
  })
  const [formImages, setFormImages] = useState([])
  const [formSaving, setFormSaving] = useState(false)
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

  // Geolocation
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setPositionError('GPS tidak didukung perangkat ini')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy } = pos.coords
        setPosition({ latitude, longitude })
        setPositionError(null)
        setForm(prev => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }))
        // Auto-share position to tracking endpoint every update
        api.post('/api/tracking/position', {
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
          speed: speed || 0,
          heading: heading || 0,
          accuracy: accuracy || 0,
        }).then(() => setLastSync(Date.now()))
          .catch(() => setLastSync(null))
      },
      (err) => {
        if (err.code === 1) setPositionError('Akses lokasi ditolak — klik "Refresh GPS" untuk minta izin')
        else if (err.code === 2) setPositionError('Sinyal GPS tidak tersedia — klik "Refresh GPS" untuk coba lagi')
        else if (err.code === 3) setPositionError('Waktu GPS habis — klik "Refresh GPS" untuk coba lagi')
        else setPositionError('Gagal dapat posisi — klik "Refresh GPS" untuk coba lagi')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    setWatchId(id)
  }, [])

  const retryGps = useCallback(() => {
    if (watchId) navigator.geolocation.clearWatch(watchId)
    setWatchId(null)
    setPosition(null)
    setPositionError(null)
    setTimeout(() => startWatching(), 300)
  }, [watchId, startWatching])

  useEffect(() => {
    startWatching()
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch my reports
  const fetchMyReports = useCallback(async () => {
    setReportsLoading(true)
    try {
      const res = await api.get('/api/laporan')
      setMyReports(res.data.data?.filter(l => l.user_id === user?.id) || [])
    } catch {} finally { setReportsLoading(false) }
  }, [user])

  useEffect(() => {
    if (activeTab === 'list') fetchMyReports()
  }, [activeTab, fetchMyReports])

  // Image picker + auto GPS
  const handleImagePick = async (e) => {
    const files = Array.from(e.target.files || [])
    const newImages = files.slice(0, 4 - formImages.length).map(f => ({
      file: f, preview: URL.createObjectURL(f), name: f.name,
    }))
    setFormImages(prev => [...prev, ...newImages].slice(0, 4))

    // Extract GPS dari EXIF foto
    if (!position) {
      const gps = await extractGpsFromFiles(files)
      if (gps) {
        setForm(prev => ({
          ...prev,
          latitude: gps.latitude.toFixed(6),
          longitude: gps.longitude.toFixed(6),
        }))
        addToast('📍 Lokasi dari foto: ' + gps.latitude.toFixed(5) + ', ' + gps.longitude.toFixed(5), 'info')
      }
    }
    e.target.value = ''
  }

  const removeImage = (idx) => {
    setFormImages(prev => {
      URL.revokeObjectURL(prev[idx]?.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // Submit report
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.judul.trim()) { addToast('Judul laporan wajib diisi', 'error'); return }
    if (!form.latitude || !form.longitude) { addToast('Posisi GPS belum didapatkan', 'error'); return }
    setFormSaving(true)
    try {
      const fd = new FormData()
      fd.append('judul', form.judul)
      fd.append('deskripsi', form.deskripsi)
      fd.append('kategori', form.kategori)
      fd.append('latitude', form.latitude)
      fd.append('longitude', form.longitude)
      fd.append('lokasi_nama', form.lokasi_nama || `Lokasi ${form.latitude},${form.longitude}`)
      formImages.forEach((img) => fd.append('gambar', img.file))
      await api.post('/api/laporan', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      addToast('Laporan berhasil dikirim!', 'success')
      setForm({ judul: '', deskripsi: '', kategori: 'Gangguan Keamanan',
        latitude: position?.latitude?.toFixed(6) || '',
        longitude: position?.longitude?.toFixed(6) || '', lokasi_nama: '' })
      setFormImages([])
      if (activeTab === 'list') fetchMyReports()
    } catch (err) {
      addToast(err.response?.data?.error || 'Gagal mengirim laporan', 'error')
    } finally { setFormSaving(false) }
  }

  // Share location via tracking endpoint
  const shareLocation = async () => {
    if (!position) { addToast('Posisi belum didapatkan', 'error'); return }
    try {
      await api.post('/api/tracking/position', {
        latitude: position.latitude,
        longitude: position.longitude,
      })
      addToast('Posisi berhasil dikirim!', 'success')
    } catch {
      addToast('Gagal mengirim posisi', 'error')
    }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      {/* Header — Profil Petugas */}
      <div style={{
        padding: '20px 16px 14px', flexShrink: 0,
        background: 'linear-gradient(180deg, #041A0D 0%, #0A1A10 100%)',
        borderBottom: '1px solid rgba(61,220,132,0.15)',
        textAlign: 'center',
      }}>
        {/* Avatar */}
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt=""
            style={{
              width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
              border: '3px solid rgba(61,220,132,0.4)', margin: '0 auto 10px',
              display: 'block', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }} />
        ) : (
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 10px',
            background: 'linear-gradient(135deg, #1b4332, #c9a84c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', fontWeight: 700, color: '#F8FAFC',
            border: '3px solid rgba(61,220,132,0.4)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            {user?.username?.[0]?.toUpperCase() || '👤'}
          </div>
        )}

        {/* Nama & Role */}
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#F8FAFC' }}>
          {user?.full_name || user?.username}
        </h2>
        <div style={{ fontSize: '0.72rem', color: '#3DDC84', fontWeight: 600, marginBottom: 10 }}>
          {user?.role === 'lapangan' ? 'Petugas Lapangan' : user?.role}
        </div>

        {/* Identity Card */}
        <div style={{
          display: 'inline-flex', flexWrap: 'wrap', gap: '6px 16px',
          justifyContent: 'center', fontSize: '0.72rem', color: '#94A3B8',
          background: 'rgba(255,255,255,0.04)', borderRadius: 10,
          padding: '8px 16px', margin: '0 auto',
        }}>
          {user?.pangkat && (
            <span><strong style={{ color: '#c9a84c' }}>Pangkat:</strong> {user.pangkat}</span>
          )}
          {user?.nrp && (
            <span><strong style={{ color: '#c9a84c' }}>NRP:</strong> {user.nrp}</span>
          )}
          {user?.jabatan && (
            <span><strong style={{ color: '#c9a84c' }}>Jabatan:</strong> {user.jabatan}</span>
          )}
          {user?.satuan && (
            <span><strong style={{ color: '#c9a84c' }}>Satuan:</strong> {user.satuan}</span>
          )}
          {!user?.pangkat && !user?.nrp && !user?.jabatan && !user?.satuan && (
            <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Identitas belum dilengkapi</span>
          )}
        </div>

        {/* GPS Status */}
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: position ? '#22C55E' : '#EF4444',
            animation: position ? 'securityPulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: '0.7rem', color: position ? '#22C55E' : '#EF4444' }}>
            {position
              ? `GPS Aktif — ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
              : (positionError || 'Tidak Ada Sinyal GPS')}
            {lastSync && (
              <span style={{ color: '#94A8B3', marginLeft: 4 }}>
                · 📡 {Math.floor((Date.now() - lastSync) / 1000)}d
              </span>
            )}
          </span>
          {!position && (
            <button onClick={retryGps} title="Minta akses GPS lagi"
              style={{
                background: 'rgba(61,220,132,0.15)', border: '1px solid rgba(61,220,132,0.3)',
                color: '#3DDC84', borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                fontSize: '0.65rem', fontWeight: 600,
              }}>
              🔄 Refresh GPS
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: '8px 12px', flexShrink: 0,
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
      }}>
        {[
          { key: 'new', icon: '📋', label: 'Laporan Baru' },
          { key: 'location', icon: '📍', label: 'Posisi Saya' },
          { key: 'list', icon: '📄', label: 'Laporan Saya' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '10px 6px', border: 'none', borderRadius: 8,
              background: activeTab === tab.key ? 'rgba(61,220,132,0.12)' : 'transparent',
              color: activeTab === tab.key ? '#3DDC84' : '#94A3B8',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: '0.78rem', cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: activeTab === 'location' ? 0 : '12px 16px',
      }}>
        {activeTab === 'new' && (
          <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Judul Laporan <span className="required">*</span></label>
              <input type="text" value={form.judul}
                onChange={e => setForm({ ...form, judul: e.target.value })}
                placeholder="Contoh: Temuan mencurigakan di..." required />
            </div>
            <div className="form-group">
              <label>Kategori</label>
              <select value={form.kategori}
                onChange={e => setForm({ ...form, kategori: e.target.value })}
                style={{ background: `${KATEGORI_COLORS[form.kategori]}15`, color: KATEGORI_COLORS[form.kategori], fontWeight: 600 }}>
                {KATEGORI_LIST.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Deskripsi</label>
              <textarea rows={3} value={form.deskripsi}
                onChange={e => setForm({ ...form, deskripsi: e.target.value })}
                placeholder="Jelaskan situasi di lapangan..." />
            </div>
            <div className="form-group">
              <label>Lokasi (otomatis dari GPS)</label>
              <input type="text" value={form.lokasi_nama}
                onChange={e => setForm({ ...form, lokasi_nama: e.target.value })}
                placeholder="Nama lokasi (opsional)" />
              {position && (
                <span className="hint" style={{ color: '#22C55E' }}>
                  ✓ Posisi: {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
                </span>
              )}
            </div>

            {/* Image upload */}
            <div className="form-group">
              <label>Foto</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {formImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" onClick={() => removeImage(i)}
                      style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}
                {formImages.length < 4 && (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    style={{ width: 80, height: 80, borderRadius: 8, border: '2px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    +
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" capture={isMobile ? 'environment' : undefined}
                onChange={handleImagePick} multiple style={{ display: 'none' }} />
              <div style={{ fontSize: '0.7rem', color: 'var(--info)', marginTop: 4 }}>📍 GPS otomatis dari EXIF foto</div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={formSaving || !position}
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
                {formSaving ? '⏳ Mengirim...' : '🚀 Kirim Laporan'}
              </button>
            </div>
          </motion.form>
        )}

        {activeTab === 'location' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
            {position ? (
              <>
                <div style={{ flex: 1, minHeight: 300, position: 'relative', borderRadius: 12, overflow: 'hidden', margin: '10px 12px' }}>
                  <MapContainer center={[position.latitude, position.longitude]} zoom={15}
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={false} attributionControl={false}
                    key={`map-${position.latitude.toFixed(3)}-${position.longitude.toFixed(3)}`}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapFollower position={position} />
                    <Marker position={[position.latitude, position.longitude]} icon={posIcon}>
                      <Popup>
                        <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                          <strong>Posisi Saya</strong><br />
                          {position.latitude.toFixed(6)}<br />
                          {position.longitude.toFixed(6)}
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
                <div style={{ textAlign: 'center', padding: '0 12px 14px', flexShrink: 0 }}>
                  <div style={{
                    padding: '10px 16px', borderRadius: 8, marginBottom: 6,
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    textAlign: 'center', fontSize: '0.78rem', color: '#22C55E',
                  }}>
                    📡 Posisi otomatis dikirim — lihat di Live Tracking
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 6 }}>
                    ✅ Akurasi tinggi — posisi diperbarui otomatis
                  </p>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{
                  width: 100, height: 100, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'rgba(239,68,68,0.12)',
                  border: '3px solid #EF4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.5rem',
                }}>
                  📡
                </div>
                <p style={{ fontSize: '0.9rem', color: '#EF4444', marginBottom: 8 }}>
                  {positionError || 'Mendapatkan posisi GPS...'}
                </p>
                <button onClick={startWatching} className="btn btn-outline"
                  style={{ padding: '10px 24px' }}>
                  🔄 Coba Lagi
                </button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'list' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {reportsLoading ? (
              <p style={{ textAlign: 'center', color: '#94A3B8', padding: 40 }}>Memuat laporan...</p>
            ) : myReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                <p style={{ fontSize: '2rem', marginBottom: 8 }}>📄</p>
                <p>Belum ada laporan</p>
              </div>
            ) : (
              myReports.map((report) => (
                <div key={report.id}
                  style={{
                    padding: '12px 16px', marginBottom: 8,
                    background: 'var(--card)', borderRadius: 12,
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${KATEGORI_COLORS[report.kategori] || '#666'}`,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.72rem', color: KATEGORI_COLORS[report.kategori], fontWeight: 600 }}>
                      {report.kategori}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                      {new Date(report.created_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{report.judul}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: 4 }}>
                    {report.deskripsi?.substring(0, 100)}
                  </div>
                  {report.lokasi_nama && (
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      📍 {report.lokasi_nama}
                    </div>
                  )}
                </div>
              ))
            )}
            <button onClick={fetchMyReports} className="btn btn-outline"
              style={{ width: '100%', marginTop: 8 }}>
              🔄 Refresh
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
