import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

export default function LaporanForm({ laporan, pickLocation, onSave, onClose, kategoriList, getKategoriIcon }) {
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
  const fileRef = useRef()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
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
      return
    }
    if (!form.latitude || !form.longitude) {
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
    <div className="form-overlay" onClick={onClose}>
      <motion.div
        className="form-panel"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div className="form-panel-header">
          <h2>{laporan ? '✏️ Edit Laporan' : '📝 Laporan Baru'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
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
                📍 Lokasi dipilih: {pickLocation.lat.toFixed(6)}, {pickLocation.lng.toFixed(6)}
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

            <div className="form-group">
              <label>Nama Lokasi</label>
              <input
                type="text"
                name="lokasi_nama"
                value={form.lokasi_nama}
                onChange={handleChange}
                placeholder="Contoh: Jl. Sudirman, Jakarta"
              />
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
          </div>
        </form>
      </motion.div>
    </div>
  )
}
