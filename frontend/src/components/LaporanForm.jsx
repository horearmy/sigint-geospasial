import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../contexts/ToastContext'
import { formatCoordinate } from '../utils/coordinates'
import api from '../utils/api'
import { extractGpsFromFiles } from '../utils/exif-gps'

const KATEGORI_MAP = {
  gangguan_keamanan: 'Gangguan Keamanan',
  separatisme: 'Separatisme',
  terorisme: 'Terorisme',
  radikalisme: 'Radikalisme',
  keamanan_nasional: 'Keamanan Nasional',
  politik: 'Politik',
  sosial: 'Sosial',
  ekonomi: 'Ekonomi',
  informasi_lain: 'Informasi Lain',
}

const CITIES = ['Jakarta','Bandung','Surabaya','Medan','Semarang','Yogyakarta','Makassar','Palembang','Manado','Banjarmasin','Pontianak','Batam','Bogor','Bekasi','Tangerang','Depok','Solo','Malang','Padang','Lampung','Banten','Aceh','Papua','Bali','NTT','NTB','Sulawesi','Jepara','Cirebon','Tasikmalaya','Sukabumi','Purwakarta','Karawang','Subang','Indramayu','Kuningan','Garut','Ciamis','Cimahi','Cianjur','Pandeglang','Lebak','Serang','Cilegon','Tangerang Selatan','Sragen','Klaten','Boyolali','Sleman','Bantul','Gunung Kidul','Kulon Progo','Magelang','Purworejo','Kebumen','Wonosobo','Temanggung','Batang','Pekalongan','Pemalang','Tegal','Brebes','Cilacap','Banyumas','Purbalingga','Banjarnegara','Wonogiri','Karanganyar','Kudus','Jepara','Demak','Grobogan','Blora','Rembang','Pati','Purwodadi','Lasem','Tuban','Lamongan','Gresik','Sidoarjo','Mojokerto','Jombang','Kediri','Blitar','Tulungagung','Trenggalek','Nganjuk','Madiun','Ponorogo','Pacitan','Magetan','Ngawi','Bojonegoro','Batu','Pasuruan','Probolinggo','Lumajang','Jember','Banyuwangi','Bondowoso','Situbondo','Pamekasan','Sumenep','Sampang','Bangkalan','Buleleng','Singaraja','Gianyar','Tabanan','Badung','Denpasar','Karangasem','Klungkung','Bangli','Jembrana','Tabanan']

function extractLocationFromText(text) {
  if (!text) return null
  const EXCLUDE = new Set(['yang','untuk','dari','dengan','oleh','akan','belum','sudah','dalam','ini','itu','dan','juga','agar','lebih','bisa','telah','sedang','kini','masih','baru','lain','antara','selama','hingga','setelah','sebelum','atas','bawah','dekat'])
  for (const city of CITIES) {
    const re = new RegExp(`\\b${city}\\b`, 'i')
    if (re.test(text)) return city
  }
  const diMatch = text.match(/\bdi\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/)
  if (diMatch) {
    const loc = diMatch[1].trim()
    if (loc.length >= 3 && !EXCLUDE.has(loc.toLowerCase())) return loc
  }
  const kabMatch = text.match(/(?:Kab\.?|Kabupaten|Kota)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/)
  if (kabMatch) return kabMatch[1].trim()
  const repMatch = text.match(/REPUBLIKA\.CO\.ID,\s*([A-Z][A-Za-z\s]{2,20})\s*[-–—]/)
  if (repMatch) return repMatch[1].trim()
  return null
}

export default function LaporanForm({ laporan, pickLocation, onSave, onClose, kategoriList, getKategoriIcon, onKategoriChange, onFlyTo, onPickLocation, prefillData }) {
  const addToast = useToast()
  const [form, setForm] = useState({
    judul: laporan?.judul || '',
    deskripsi: laporan?.deskripsi || '',
    kategori: laporan?.kategori || '',
    lokasi_nama: laporan?.lokasi_nama || '',
    latitude: laporan?.latitude?.toString() || '',
    longitude: laporan?.longitude?.toString() || '',
  })
  const [gambarFiles, setGambarFiles] = useState([])
  const [gambarPreviews, setGambarPreviews] = useState(
    (() => {
      const existing = []
      if (laporan?.gambar) existing.push(`/uploads/${laporan.gambar}`)
      if (laporan?.gambar_lain) {
        const lain = typeof laporan.gambar_lain === 'string' ? JSON.parse(laporan.gambar_lain) : laporan.gambar_lain
        lain.forEach(f => existing.push(`/uploads/${f}`))
      }
      return existing
    })()
  )
  const [dragActive, setDragActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeout = useRef(null)
  const fileRef = useRef()
  const dropdownRef = useRef()

  useEffect(() => {
    if (laporan?.kategori && onKategoriChange) {
      onKategoriChange(laporan.kategori)
    }
  }, [laporan?.kategori, onKategoriChange])

  useEffect(() => {
    if (pickLocation) {
      setForm(prev => ({
        ...prev,
        latitude: pickLocation.lat.toFixed(6),
        longitude: pickLocation.lng.toFixed(6),
      }))
      reverseGeocode(pickLocation.lat, pickLocation.lng)
    }
  }, [pickLocation])

  useEffect(() => {
    if (!prefillData || laporan) return
    const kategoriDisplay = KATEGORI_MAP[prefillData.kategori] || prefillData.kategori || ''
    const locName = prefillData.lokasi_nama || extractLocationFromText(prefillData.judul + ' ' + (prefillData.deskripsi || ''))
    setForm({
      judul: prefillData.judul || '',
      deskripsi: prefillData.deskripsi || '',
      kategori: kategoriDisplay,
      lokasi_nama: locName || '',
      latitude: prefillData.latitude?.toString() || '',
      longitude: prefillData.longitude?.toString() || '',
    })
    if (kategoriDisplay && onKategoriChange) onKategoriChange(kategoriDisplay)
    const hasCoords = prefillData.latitude && prefillData.longitude
    if (!hasCoords && locName) {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locName + ', Indonesia')}&format=json&limit=1&countrycodes=id`, {
        headers: { 'Accept-Language': 'id', 'User-Agent': 'SIGINT-KOSTRAD/1.0' }
      })
        .then(r => r.json())
        .then(data => {
          if (data?.length > 0) {
            const loc = data[0]
            setForm(prev => ({
              ...prev,
              lokasi_nama: prev.lokasi_nama || loc.display_name.split(',').slice(0, 3).join(','),
              latitude: parseFloat(loc.lat).toFixed(6),
              longitude: parseFloat(loc.lon).toFixed(6),
            }))
            if (onFlyTo) onFlyTo({ lat: parseFloat(loc.lat), lng: parseFloat(loc.lon), zoom: 15 })
            if (onPickLocation) onPickLocation({ lat: parseFloat(loc.lat), lng: parseFloat(loc.lon) })
          }
        })
        .catch(() => {})
    } else if (hasCoords && onFlyTo) {
      onFlyTo({ lat: parseFloat(prefillData.latitude), lng: parseFloat(prefillData.longitude), zoom: 15 })
      if (onPickLocation) onPickLocation({ lat: parseFloat(prefillData.latitude), lng: parseFloat(prefillData.longitude) })
    }
    if (prefillData.sumber_url) {
      api.get('/api/intelligence/fetch-image', { params: { url: prefillData.sumber_url } })
        .then(res => {
          const imageUrl = res.data?.data?.imageUrl
          if (!imageUrl) return
          setGambarPreviews([imageUrl])
          fetch(imageUrl).then(r => r.blob()).then(blob => {
            const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg'
            const file = new File([blob], `crawl_${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' })
            setGambarFiles([file])
          }).catch(() => {})
        })
        .catch(() => {})
    }
  }, [prefillData, laporan])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    if (e.target.name === 'kategori' && onKategoriChange) {
      onKategoriChange(e.target.value || null)
    }
    if (e.target.name === 'lokasi_nama') {
      clearTimeout(searchTimeout.current)
      const val = e.target.value
      if (val.length < 3) { setSearchResults([]); setShowDropdown(false); return }
      setSearching(true)
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=id`, {
            headers: { 'Accept-Language': 'id' }
          })
          const data = await res.json()
          setSearchResults(data)
          setShowDropdown(data.length > 0)
        } catch { setSearchResults([]) }
        setSearching(false)
      }, 500)
    }
  }

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=id`, {
        headers: { 'Accept-Language': 'id' }
      })
      const data = await res.json()
      if (data.display_name) {
        const short = data.display_name.split(',').slice(0, 3).join(',')
        setForm(prev => ({ ...prev, lokasi_nama: short }))
      }
    } catch {}
  }

  const selectSearchResult = (item) => {
    setForm(prev => ({
      ...prev,
      lokasi_nama: item.display_name.split(',').slice(0, 3).join(','),
      latitude: parseFloat(item.lat).toFixed(6),
      longitude: parseFloat(item.lon).toFixed(6),
    }))
    setShowDropdown(false)
    setSearchResults([])
    if (onFlyTo) onFlyTo({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), zoom: 15 })
    if (onPickLocation) onPickLocation({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) })
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      addToast('Browser tidak mendukung GPS', 'error')
      return
    }
    setLocating(true)
    addToast('Mencari lokasi Anda...', 'info')

    const onSuccess = (pos) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      setForm(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }))
      if (onFlyTo) onFlyTo({ lat, lng, zoom: 15 })
      if (onPickLocation) onPickLocation({ lat, lng })
      reverseGeocode(lat, lng)
      addToast('Lokasi ditemukan', 'success')
      setLocating(false)
    }

    const onError = (err) => {
      if (err.code === 1) {
        addToast('Izin lokasi ditolak. Aktifkan GPS di browser.', 'error')
      } else if (err.code === 2) {
        addToast('Lokasi tidak tersedia. Coba lagi.', 'error')
      } else {
        addToast('Timeout. Coba lagi.', 'error')
      }
      setLocating(false)
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    })
  }

  const MAX_PHOTOS = 4

  const handleFile = (file) => {
    if (gambarFiles.length >= MAX_PHOTOS) {
      addToast(`Maksimal ${MAX_PHOTOS} gambar`, 'warning')
      return
    }
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Ukuran gambar maksimal 5MB', 'warning')
        return
      }
      setGambarFiles(prev => [...prev, file])
      setGambarPreviews(prev => [...prev, URL.createObjectURL(file)])
    }
  }

  const handleFilesAdd = async (newFiles) => {
    const remaining = MAX_PHOTOS - gambarFiles.length
    const toAdd = Array.from(newFiles).slice(0, remaining)
    if (newFiles.length > remaining) {
      addToast(`Hanya ${remaining} slot tersisa (maks ${MAX_PHOTOS})`, 'warning')
    }
    toAdd.forEach(f => handleFile(f))

    // Auto-extract GPS dari EXIF foto jika koordinat belum diisi
    if (!form.latitude || !form.longitude) {
      const gps = await extractGpsFromFiles(toAdd)
      if (gps) {
        setForm(prev => ({
          ...prev,
          latitude: gps.latitude.toFixed(6),
          longitude: gps.longitude.toFixed(6),
        }))
        addToast('📍 Koordinat dari foto: ' + gps.latitude.toFixed(5) + ', ' + gps.longitude.toFixed(5), 'info')
      }
    }
  }

  const handleRemoveImage = (index) => {
    setGambarFiles(prev => prev.filter((_, i) => i !== index))
    setGambarPreviews(prev => {
      const url = prev[index]
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleFileChange = (e) => {
    handleFilesAdd(e.target.files)
    e.target.value = ''
  }

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdd(e.dataTransfer.files)
    }
  }, [gambarFiles.length])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.judul || !form.kategori) {
      addToast('Judul dan kategori wajib diisi', 'warning')
      return
    }
    if (!form.latitude || !form.longitude) {
      if (gambarFiles.length === 0) {
        addToast('Pilih lokasi di peta atau upload foto dengan GPS', 'warning')
        return
      }
      // Backend akan coba ekstrak GPS dari EXIF foto
    }

    setSaving(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (value) formData.append(key, value)
      })
      gambarFiles.forEach(file => {
        formData.append('gambar', file)
      })
      await onSave(formData)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      className="form-side-panel"
      onClick={(e) => e.stopPropagation()}
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
        <div className="form-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <motion.span
              key={form.kategori || 'default'}
              className="form-kategori-icon"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              style={{ fontSize: '1.5rem' }}
            >
              {form.kategori ? getKategoriIcon(form.kategori) : '📝'}
            </motion.span>
            <h2>{laporan ? 'Edit Laporan' : 'Laporan Baru'}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        {prefillData && !laporan && (
          <div style={{ padding: '10px 16px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📰</span>
            <span>Data diisi dari hasil crawl: <strong>{prefillData.sumber || 'Sumber'}</strong></span>
            {prefillData.sumber_url && (
              <a href={prefillData.sumber_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', color: '#3b82f6', textDecoration: 'underline', fontSize: '0.78rem' }}>Lihat Berita</a>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="form-body">
            {!pickLocation && !laporan && (
              <motion.div
                className="pick-location-hint"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                🗺️ Klik pada peta untuk memilih lokasi, atau masukkan koordinat di bawah
              </motion.div>
            )}

            {pickLocation && (
              <motion.div
                className="pick-location-hint"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div>📍 Lokasi dipilih: {pickLocation.lat.toFixed(6)}, {pickLocation.lng.toFixed(6)}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#c9a84c', fontWeight: 600, marginTop: '4px' }}>
                  🔷 MGRS: {formatCoordinate(pickLocation.lat, pickLocation.lng, 'mgrs')}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#86efac', marginTop: '2px' }}>
                  🔷 UTM: {formatCoordinate(pickLocation.lat, pickLocation.lng, 'utm')}
                </div>
              </motion.div>
            )}

            <div className="form-group">
              <label>Judul <span className="required">*</span></label>
              <input
                type="text"
                name="judul"
                value={form.judul}
                onChange={handleChange}
                placeholder="Masukkan judul laporan"
                required
              />
            </div>

            <div className="form-group">
              <label>Kategori <span className="required">*</span></label>
              <select name="kategori" value={form.kategori} onChange={handleChange} required>
                <option value="">Pilih kategori...</option>
                {kategoriList.map((k) => (
                  <option key={k} value={k}>{getKategoriIcon(k)} {k}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Deskripsi</label>
              <textarea
                name="deskripsi"
                value={form.deskripsi}
                onChange={handleChange}
                placeholder="Deskripsi detail laporan..."
              />
            </div>

            <div className="form-group" style={{ position: 'relative' }} ref={dropdownRef}>
              <label>Nama Lokasi</label>
              <input
                type="text"
                name="lokasi_nama"
                value={form.lokasi_nama}
                onChange={handleChange}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="Ketik nama lokasi..."
                autoComplete="off"
              />
              {searching && <div style={{ position: 'absolute', right: '10px', top: '32px', fontSize: '0.7rem', color: 'var(--text-light)' }}>Mencari...</div>}
              <AnimatePresence>
                {showDropdown && searchResults.length > 0 && (
                  <motion.div
                    className="location-dropdown"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    {searchResults.map((item, i) => (
                      <div key={i} className="location-dropdown-item" onClick={() => selectSearchResult(item)}>
                        <span style={{ fontSize: '0.85rem' }}>📍</span>
                        <span style={{ fontSize: '0.78rem' }}>{item.display_name.split(',').slice(0, 3).join(',')}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Latitude <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={form.latitude}
                  onChange={handleChange}
                  placeholder="-2.5489"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Longitude <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={form.longitude}
                  onChange={handleChange}
                  placeholder="118.0149"
                  required
                />
              </div>
            </div>

            <button type="button" className="btn btn-outline btn-my-location" onClick={handleMyLocation} disabled={locating} style={{ width: '100%', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {locating ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Mencari lokasi...
                </>
              ) : (
                <>📍 Lokasi Saya Sekarang</>
              )}
            </button>

            {form.latitude && form.longitude && (
              <motion.div
                className="pick-location-hint"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#c9a84c', fontWeight: 600 }}>
                  🔷 MGRS: {formatCoordinate(parseFloat(form.latitude), parseFloat(form.longitude), 'mgrs')}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#86efac', marginTop: '2px' }}>
                  🔷 UTM: {formatCoordinate(parseFloat(form.latitude), parseFloat(form.longitude), 'utm')}
                </div>
              </motion.div>
            )}

            <div className="form-group">
              <label>Gambar {gambarFiles.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 400 }}>({gambarFiles.length}/{MAX_PHOTOS})</span>}</label>
              <div
                className={`drop-zone ${dragActive ? 'active' : ''} ${gambarPreviews.length > 0 ? 'has-images' : ''}`}
                onClick={() => gambarFiles.length < MAX_PHOTOS && fileRef.current?.click()}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileRef}
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {gambarPreviews.length > 0 ? (
                  <div className="multi-image-preview">
                    {gambarPreviews.map((src, idx) => (
                      <div key={idx} className="multi-image-item">
                        <img src={src} alt={`Preview ${idx + 1}`} />
                        <button type="button" className="multi-image-remove" onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx) }}>✕</button>
                        {idx === 0 && <span className="multi-image-badge">Utama</span>}
                      </div>
                    ))}
                    {gambarFiles.length < MAX_PHOTOS && (
                      <div className="multi-image-add">
                        <div className="drop-zone-icon" style={{ fontSize: '1.5rem' }}>+</div>
                        <div className="drop-zone-hint" style={{ fontSize: '0.65rem' }}>Tambah</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="drop-zone-icon">📷</div>
                    <div className="drop-zone-text">Seret & lepas gambar di sini</div>
                    <div className="drop-zone-hint">atau klik untuk memilih file</div>
                    <div className="drop-zone-hint">Maks {MAX_PHOTOS} gambar • JPG, PNG, GIF, WebP • 5MB per file</div>
                    <div className="drop-zone-hint" style={{ color: 'var(--info)' }}>📍 GPS otomatis dari EXIF foto</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Menyimpan...
                </>
              ) : (
                laporan ? '💾 Simpan Perubahan' : '📤 Kirim Laporan'
              )}
            </button>
          </div>
        </form>
    </motion.div>
  )
}
