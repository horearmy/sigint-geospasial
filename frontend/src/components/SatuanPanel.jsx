import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { formatCoordinate } from '../utils/coordinates'

const MAIN_UNITS = ['MAKOSTRAD', 'DIVISI 1 KOSTRAD', 'DIVISI 2 KOSTRAD', 'DIVISI 3 KOSTRAD']

export default function SatuanPanel({ onClose, onSatuanSelect, satuanPickLocation, onSatuanPickLocation, onFlyTo }) {
  const { user } = useAuth()
  const addToast = useToast()
  const [satuans, setSatuans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedSatuan, setSelectedSatuan] = useState(null)
  const [expandedParents, setExpandedParents] = useState(() => {
    const saved = localStorage.getItem('satuan_expanded')
    return saved ? JSON.parse(saved) : ['all']
  })
  const [form, setForm] = useState({
    nama_satuan: '', deskripsi: '', lokasi_nama: '', latitude: '', longitude: '', parent_id: '',
  })
  const [lambangFile, setLambangFile] = useState(null)
  const [lambangPreview, setLambangPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const [searchResults, setSearchResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const searchTimeout = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => { fetchSatuans() }, [])

  useEffect(() => {
    if (!satuanPickLocation) return
    setForm(prev => ({
      ...prev,
      latitude: satuanPickLocation.lat.toFixed(6),
      longitude: satuanPickLocation.lng.toFixed(6),
    }))
    reverseGeocode(satuanPickLocation.lat, satuanPickLocation.lng)
  }, [satuanPickLocation])

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchSatuans = async () => {
    try {
      const res = await api.get('/api/units')
      setSatuans(res.data.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const canEdit = user && ['admin', 'analis', 'operator'].includes(user.role)

  const parentUnits = useMemo(() =>
    satuans.filter(s => !s.parent_id && MAIN_UNITS.includes(s.nama_satuan)),
    [satuans]
  )

  const childUnits = useMemo(() =>
    satuans.filter(s => s.parent_id),
    [satuans]
  )

  const getChildren = useCallback((parentId) =>
    childUnits.filter(c => c.parent_id === parentId),
    [childUnits]
  )

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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
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
    if (onSatuanPickLocation) onSatuanPickLocation({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) })
  }

  const handleMyLocation = () => {
    if (!navigator.geolocation) { addToast('Browser tidak mendukung GPS', 'error'); return }
    setLocating(true)
    addToast('Mencari lokasi Anda...', 'info')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude
        setForm(prev => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
        if (onFlyTo) onFlyTo({ lat, lng, zoom: 15 })
        if (onSatuanPickLocation) onSatuanPickLocation({ lat, lng })
        reverseGeocode(lat, lng)
        addToast('Lokasi ditemukan', 'success')
        setLocating(false)
      },
      () => { addToast('Gagal mendapatkan lokasi', 'error'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setForm({ nama_satuan: '', deskripsi: '', lokasi_nama: '', latitude: '', longitude: '', parent_id: '' })
    setLambangFile(null)
    setLambangPreview(null)
    setShowForm(true)
  }

  const handleEdit = (s) => {
    setEditingId(s.id)
    setForm({
      nama_satuan: s.nama_satuan,
      deskripsi: s.deskripsi || '',
      lokasi_nama: s.lokasi_nama || '',
      latitude: s.latitude?.toString() || '',
      longitude: s.longitude?.toString() || '',
      parent_id: s.parent_id?.toString() || '',
    })
    setLambangPreview(s.lambang_url ? s.lambang_url : null)
    setLambangFile(null)
    setShowForm(true)
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ nama_satuan: '', deskripsi: '', lokasi_nama: '', latitude: '', longitude: '', parent_id: '' })
    setLambangFile(null)
    setLambangPreview(null)
    if (onSatuanPickLocation) onSatuanPickLocation(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.nama_satuan) { addToast('Nama satuan wajib diisi', 'warning'); return }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('nama_satuan', form.nama_satuan)
      fd.append('deskripsi', form.deskripsi)
      fd.append('latitude', form.latitude)
      fd.append('longitude', form.longitude)
      fd.append('lokasi_nama', form.lokasi_nama)
      if (form.parent_id) fd.append('parent_id', form.parent_id)
      if (lambangFile) fd.append('lambang', lambangFile)

      if (editingId) {
        await api.put(`/api/units/${editingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        addToast('Satuan diperbarui', 'success')
      } else {
        await api.post('/api/units', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        addToast('Satuan baru ditambahkan', 'success')
      }
      handleCancelForm()
      fetchSatuans()
    } catch (err) {
      addToast(err.response?.data?.error || 'Gagal menyimpan satuan', 'error')
    } finally { setSaving(false) }
  }

  const handleDelete = async (s) => {
    const children = getChildren(s.id)
    if (children.length > 0) {
      addToast(`Tidak bisa menghapus "${s.nama_satuan}" karena memiliki ${children.length} sub-satuan`, 'warning')
      return
    }
    if (!confirm(`Hapus ${s.parent_id ? 'sub-satuan' : 'satuan'} "${s.nama_satuan}"?`)) return
    try {
      await api.delete(`/api/units/${s.id}`)
      setSatuans(prev => prev.filter(u => u.id !== s.id))
      addToast('Satuan dihapus', 'success')
    } catch (err) {
      addToast('Gagal menghapus satuan', 'error')
    }
  }

  const handleSelect = (s) => {
    setSelectedSatuan(s)
    if (onSatuanSelect && s.latitude && s.longitude) {
      onSatuanSelect({ lat: parseFloat(s.latitude), lng: parseFloat(s.longitude), id: s.id })
    }
  }

  const toggleExpand = (parentId) => {
    setExpandedParents(prev => {
      const next = prev.includes(parentId)
        ? prev.filter(id => id !== parentId)
        : [...prev, parentId]
      localStorage.setItem('satuan_expanded', JSON.stringify(next))
      return next
    })
  }

  const renderUnitCard = (s, isChild = false) => (
    <div key={s.id} onClick={() => handleSelect(s)}
      style={{
        padding: '10px 12px', borderRadius: 'var(--radius)', marginBottom: isChild ? 4 : 8, cursor: 'pointer',
        background: selectedSatuan?.id === s.id ? 'rgba(59,130,246,0.12)' : 'var(--card)',
        border: selectedSatuan?.id === s.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border)',
        transition: 'all 0.2s', display: 'flex', gap: 10, alignItems: 'center',
        marginLeft: isChild ? 24 : 0,
        borderLeft: isChild ? '3px solid rgba(61,220,132,0.3)' : '1px solid var(--border)',
      }}>
      <div style={{
        width: isChild ? 32 : 40, height: isChild ? 32 : 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isChild ? '0.9rem' : '1.1rem',
      }}>
        {s.lambang_url ? (
          <img src={s.lambang_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : isChild ? '🔹' : '🏛️'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: isChild ? 500 : 600, fontSize: isChild ? '0.82rem' : '0.88rem', color: 'var(--text)' }}>
          {s.nama_satuan}
          {isChild && <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginLeft: 6 }}>sub-satuan</span>}
        </div>
        {s.deskripsi && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 1, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.deskripsi}</div>
        )}
        <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: 2 }}>
          {s.latitude && s.longitude ? `📍 ${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)}` : '📍 Lokasi belum diatur'}
        </div>
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={(e) => { e.stopPropagation(); handleEdit(s) }}
            style={{ background: 'none', border: 'none', color: 'var(--info)', cursor: 'pointer', fontSize: '0.72rem' }}>✏️</button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(s) }}
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.72rem' }}>🗑️</button>
        </div>
      )}
    </div>
  )

  return (
    <motion.div className="form-side-panel"
      initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ width: 420, maxWidth: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <div className="panel-header" style={{ flexShrink: 0 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '1rem' }}>
          <span>🏛️</span> Data Satuan
        </h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {canEdit && !showForm && (
          <button className="btn btn-primary btn-sm" onClick={handleOpenCreate} style={{ width: '100%', padding: '10px', marginBottom: 12 }}>
            + Tambah Satuan
          </button>
        )}

        <AnimatePresence>
          {showForm && (
            <motion.form onSubmit={handleSave}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginBottom: 14 }}
            >
              <div style={{ padding: 14, borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: 12, color: 'var(--text)' }}>
                  {editingId ? '✏️ Edit Satuan' : '🏛️ Tambah Satuan Baru'}
                </h4>

                <div className="form-group">
                  <label>Nama Satuan *</label>
                  <input value={form.nama_satuan} onChange={(e) => setForm({...form, nama_satuan: e.target.value})}
                    placeholder={form.parent_id ? 'Misal: Sub-satuan Yonif' : 'Misal: MAKOSTRAD'} required />
                </div>

                <div className="form-group">
                  <label>Induk Satuan</label>
                  <select value={form.parent_id} onChange={(e) => setForm({...form, parent_id: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }}>
                    <option value="">Unit Utama (Tingkat Atas)</option>
                    {parentUnits.map(p => (
                      <option key={p.id} value={p.id}>{p.nama_satuan}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: 4 }}>
                    Kosongkan jika ini adalah unit utama (MAKOSTRAD / DIVISI)
                  </div>
                </div>

                <div className="form-group" style={{ position: 'relative' }} ref={dropdownRef}>
                  <label>Nama Lokasi</label>
                  <input type="text" name="lokasi_nama" value={form.lokasi_nama}
                    onChange={handleChange}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    placeholder="Ketik nama lokasi..." autoComplete="off" />
                  {searching && <div style={{ position: 'absolute', right: '10px', top: '32px', fontSize: '0.7rem', color: 'var(--text-light)' }}>Mencari...</div>}
                  <AnimatePresence>
                    {showDropdown && searchResults.length > 0 && (
                      <motion.div className="location-dropdown"
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
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

                <div className="form-group">
                  <label>Koordinat</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={form.latitude} onChange={(e) => setForm({...form, latitude: e.target.value})}
                      placeholder="Latitude" style={{ flex: 1, fontSize: '0.82rem' }} />
                    <input value={form.longitude} onChange={(e) => setForm({...form, longitude: e.target.value})}
                      placeholder="Longitude" style={{ flex: 1, fontSize: '0.82rem' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button type="button" onClick={() => {
                      addToast('Klik pada peta untuk memilih lokasi', 'info')
                      if (onSatuanPickLocation) onSatuanPickLocation(null)
                    }} className="btn btn-outline btn-xs" style={{ flex: 1 }}>
                      📍 Klik Peta
                    </button>
                    <button type="button" onClick={handleMyLocation} disabled={locating}
                      className="btn btn-outline btn-xs" style={{ flex: 1 }}>
                      {locating ? '⌛' : '📡'} Lokasi Saya
                    </button>
                  </div>
                  {satuanPickLocation && (
                    <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#3DDC84', fontFamily: 'monospace' }}>
                      🏛️ {formatCoordinate(satuanPickLocation.lat, satuanPickLocation.lng, 'mgrs')}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Tentang Satuan</label>
                  <textarea value={form.deskripsi} onChange={(e) => setForm({...form, deskripsi: e.target.value})}
                    placeholder="Deskripsi singkat..." rows={3} />
                </div>

                <div className="form-group">
                  <label>Lambang / Logo</label>
                  <div onClick={() => fileRef.current?.click()} style={{
                    padding: '16px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    border: '2px dashed var(--border)', textAlign: 'center',
                    background: 'var(--bg-secondary)', marginBottom: 6,
                  }}>
                    {lambangPreview ? (
                      <img src={lambangPreview.startsWith('blob:') ? lambangPreview : lambangPreview}
                        alt="Lambang" style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div>
                        <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🏴</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Klik untuk upload lambang satuan</div>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files[0]
                      if (f) { setLambangFile(f); setLambangPreview(URL.createObjectURL(f)) }
                      e.target.value = ''
                    }} />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="button" onClick={handleCancelForm} className="btn btn-outline btn-sm">Batal</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? 'Menyimpan...' : (editingId ? 'Simpan' : 'Tambah')}
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 10px' }} />
            Memuat data satuan...
          </div>
        ) : satuans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🏛️</div>
            <p style={{ fontSize: '0.9rem' }}>Belum ada data satuan</p>
            {canEdit && <p style={{ fontSize: '0.8rem', marginTop: 6 }}>Klik "Tambah Satuan" untuk mulai</p>}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              {parentUnits.length} unit utama · {childUnits.length} sub-satuan
            </div>

            <div style={{ marginBottom: 14, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
              <strong>Struktur:</strong> Unit Utama (MAKOSTRAD/DIVISI) → Sub-satuan di bawahnya
            </div>

            {parentUnits.map(parent => {
              const children = getChildren(parent.id)
              const isExpanded = expandedParents.includes('all') || expandedParents.includes(parent.id)
              return (
                <div key={parent.id} style={{ marginBottom: 6 }}>
                  {renderUnitCard(parent, false)}
                  {children.length > 0 && (
                    <div style={{ marginTop: 2, marginBottom: 6 }}>
                      <button onClick={() => toggleExpand(parent.id)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-light)',
                          cursor: 'pointer', fontSize: '0.72rem', marginLeft: 36,
                          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0',
                        }}>
                        {isExpanded ? '▼' : '▶'} {children.length} sub-satuan
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            {children.map(child => renderUnitCard(child, true))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  {children.length === 0 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginLeft: 48, marginBottom: 6 }}>
                      <em>Belum ada sub-satuan</em>
                    </div>
                  )}
                </div>
              )
            })}

            {childUnits.filter(c => !parentUnits.some(p => p.id === c.parent_id)).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
                  Sub-satuan tanpa induk
                </div>
                {childUnits.filter(c => !parentUnits.some(p => p.id === c.parent_id)).map(c => renderUnitCard(c, true))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}