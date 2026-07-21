import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../App'
import { formatCoordinate } from '../utils/coordinates'

export default function LaporanForm({ laporan, pickLocation, onSave, onClose, kategoriList, getKategoriIcon, onKategoriChange, onFlyTo, onPickLocation }) {
  const addToast = useToast()
  const [form, setForm] = useState({
    judul: laporan?.judul || '',
    deskripsi: laporan?.deskripsi || '',
    kategori: laporan?.kategori || '',
    lokasi_nama: laporan?.lokasi_nama || '',
    latitude: laporan?.latitude?.toString() || '',
    longitude: laporan?.longitude?.toString() || '',
  })
  const [gambar, setGambar] = useState(null)
  const [preview, setPreview] = useState(
    laporan?.gambar ? `/uploads/${laporan.gambar}` : null
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
  }, [])

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

  const handleFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      setGambar(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleFileChange = (e) => {
    handleFile(e.target.files[0])
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.judul || !form.kategori) {
      addToast('Judul dan kategori wajib diisi', 'warning')
      return
    }
    if (!form.latitude || !form.longitude) {
      addToast('Klik pada peta untuk memilih lokasi', 'warning')
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (value) formData.append(key, value)
      })
      if (gambar) formData.append('gambar', gambar)
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
              <label>Gambar</label>
              <div
                className={`drop-zone ${dragActive ? 'active' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {preview ? (
                  <div>
                    <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '8px', objectFit: 'cover' }} />
                    <p className="drop-zone-hint" style={{ marginTop: '8px' }}>Klik atau seret untuk mengganti gambar</p>
                  </div>
                ) : (
                  <div>
                    <div className="drop-zone-icon">📷</div>
                    <div className="drop-zone-text">Seret & lepas gambar di sini</div>
                    <div className="drop-zone-hint">atau klik untuk memilih file</div>
                    <div className="drop-zone-hint">JPG, PNG, GIF, WebP - Maks 5MB</div>
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
