import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import L from 'leaflet'
import api from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const ZONE_TYPES = ['Bahaya Tinggi', 'Bahaya Sedang', 'Bahaya Rendah', 'Aman', 'Zona Monitor']
const RISK_COLORS = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#7f1d1d' }
const RISK_LEVELS = [
  { value: 1, label: 'Level 1 — Aman', color: '#22c55e' },
  { value: 2, label: 'Level 2 — Waspada', color: '#eab308' },
  { value: 3, label: 'Level 3 — Siaga', color: '#f97316' },
  { value: 4, label: 'Level 4 — Bahaya', color: '#ef4444' },
  { value: 5, label: 'Level 5 — Kritis', color: '#7f1d1d' },
]

export default function ThreatZonesPanel({ onClose, onZoneDrawStart, onZoneDrawCancel, pendingZoneGeoJson, onZoneSaved }) {
  const { user } = useAuth()
  const addToast = useToast()
  const [zones, setZones] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '', zone_type: ZONE_TYPES[0], risk_level: 3, description: '',
  })

  useEffect(() => { fetchZones() }, [])

  const fetchZones = async () => {
    try {
      const res = await api.get('/api/zones')
      setZones(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const canEdit = user && ['admin', 'analis'].includes(user.role)

  const handleStartDraw = () => {
    setShowCreate(true)
    if (onZoneDrawStart) onZoneDrawStart()
  }

  const handleCancelDraw = () => {
    setShowCreate(false)
    setForm({ name: '', zone_type: ZONE_TYPES[0], risk_level: 3, description: '' })
    if (onZoneDrawCancel) onZoneDrawCancel()
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name) { addToast('Nama zona wajib diisi', 'warning'); return }
    if (!pendingZoneGeoJson) { addToast('Gambar zona di peta terlebih dahulu', 'warning'); return }

    try {
      const payload = {
        name: form.name,
        zone_type: form.zone_type,
        risk_level: parseInt(form.risk_level),
        description: form.description,
        boundary_geojson: {
          type: 'Polygon',
          coordinates: pendingZoneGeoJson.coordinates,
        },
      }
      await api.post('/api/zones', payload)
      addToast('Zona berhasil dibuat', 'success')
      setShowCreate(false)
      setForm({ name: '', zone_type: ZONE_TYPES[0], risk_level: 3, description: '' })
      fetchZones()
      if (onZoneSaved) onZoneSaved()
      if (onZoneDrawCancel) onZoneDrawCancel()
    } catch (err) {
      addToast(err.response?.data?.error || 'Gagal menyimpan zona', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus zona ini?')) return
    try {
      await api.delete(`/api/zones/${id}`)
      setZones(prev => prev.filter(z => z.id !== id))
      addToast('Zona dihapus', 'success')
    } catch (err) {
      addToast('Gagal menghapus zona', 'error')
    }
  }

  const handleUpdate = async (id) => {
    if (!form.name) { addToast('Nama zona wajib diisi', 'warning'); return }
    try {
      await api.put(`/api/zones/${id}`, {
        name: form.name,
        zone_type: form.zone_type,
        risk_level: parseInt(form.risk_level),
        description: form.description,
      })
      addToast('Zona diperbarui', 'success')
      setEditingId(null)
      setForm({ name: '', zone_type: ZONE_TYPES[0], risk_level: 3, description: '' })
      fetchZones()
    } catch (err) {
      addToast('Gagal update zona', 'error')
    }
  }

  const startEdit = (z) => {
    setEditingId(z.id)
    setForm({
      name: z.name,
      zone_type: z.zone_type,
      risk_level: z.risk_level,
      description: z.description || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm({ name: '', zone_type: ZONE_TYPES[0], risk_level: 3, description: '' })
  }

  const riskBg = (level) => {
    const c = RISK_COLORS[level] || '#64748b'
    return `${c}18`
  }

  return (
    <motion.div className="form-side-panel"
      initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ width: 420, maxWidth: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <div className="panel-header" style={{ flexShrink: 0 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '1rem' }}>
          <span>🛡️</span> Zona Ancaman
        </h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {canEdit && (
          <div style={{ marginBottom: 12 }}>
            {!showCreate ? (
              <button className="btn btn-primary btn-sm" onClick={handleStartDraw} style={{ width: '100%', padding: '10px' }}>
                + Buat Zona Baru (Gambar di Peta)
              </button>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={handleCancelDraw} style={{ width: '100%', padding: '10px' }}>
                ← Batal Buat Zona
              </button>
            )}
          </div>
        )}

        <AnimatePresence>
          {showCreate && (
            <motion.form onSubmit={handleSave}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginBottom: 14 }}
            >
              <div style={{
                padding: 14, borderRadius: 'var(--radius)', background: 'var(--card)',
                border: '1px solid var(--border)', marginBottom: 10,
              }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--info)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📍</span> Gambar polygon zona di peta, lalu isi detail di bawah
                </div>

                <div className="form-group">
                  <label>Nama Zona</label>
                  <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required
                    placeholder="Misal: Zona Terorisme Jakarta" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Tipe Zona</label>
                    <select value={form.zone_type} onChange={(e) => setForm({...form, zone_type: e.target.value})}>
                      {ZONE_TYPES.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Level Risiko</label>
                    <select value={form.risk_level} onChange={(e) => setForm({...form, risk_level: Number(e.target.value)})}>
                      {RISK_LEVELS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Deskripsi</label>
                  <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}
                    placeholder="Deskripsi zona ancaman..." rows={3} />
                </div>

                {!pendingZoneGeoJson && (
                  <div style={{
                    padding: '20px', textAlign: 'center', borderRadius: 'var(--radius)',
                    background: 'rgba(6, 182, 212, 0.08)', border: '2px dashed var(--info)', marginBottom: 10,
                  }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>🗺️</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Klik tombol alat gambar di peta, lalu klik untuk menambahkan titik-titik polygon
                    </div>
                  </div>
                )}

                {pendingZoneGeoJson && (
                  <div style={{
                    padding: 10, borderRadius: 'var(--radius)', background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid var(--success)', marginBottom: 10, fontSize: '0.82rem', color: 'var(--success)',
                  }}>
                    ✅ Polygon tergambar ({pendingZoneGeoJson.coordinates[0]?.length || 0} titik)
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={handleCancelDraw} className="btn btn-outline btn-sm">Batal</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!pendingZoneGeoJson}>Simpan Zona</button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 10px' }} />
            Memuat zona...
          </div>
        ) : zones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🛡️</div>
            <p style={{ fontSize: '0.9rem' }}>Belum ada zona ancaman</p>
            {canEdit && <p style={{ fontSize: '0.8rem', marginTop: 6 }}>Klik "Buat Zona Baru" untuk membuat zona pertama</p>}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              {zones.length} zona terdefinisi
            </div>
            {zones.map((z) => (
              <div key={z.id} style={{
                padding: '12px 14px', borderRadius: 'var(--radius)', marginBottom: 8,
                background: riskBg(z.risk_level),
                borderLeft: `4px solid ${RISK_COLORS[z.risk_level] || '#64748b'}`,
                border: `1px solid ${RISK_COLORS[z.risk_level] || '#64748b'}33`,
              }}>
                {editingId === z.id ? (
                  <div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Nama</label>
                      <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} style={{ fontSize: '0.82rem' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem' }}>Tipe</label>
                        <select value={form.zone_type} onChange={(e) => setForm({...form, zone_type: e.target.value})} style={{ fontSize: '0.82rem' }}>
                          {ZONE_TYPES.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem' }}>Level</label>
                        <select value={form.risk_level} onChange={(e) => setForm({...form, risk_level: Number(e.target.value)})} style={{ fontSize: '0.82rem' }}>
                          {RISK_LEVELS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                      <button onClick={cancelEdit} className="btn btn-outline btn-sm">Batal</button>
                      <button onClick={() => handleUpdate(z.id)} className="btn btn-primary btn-sm">Simpan</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{z.name}</strong>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 700,
                          background: RISK_COLORS[z.risk_level], color: 'white',
                        }}>Lv.{z.risk_level}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6, display: 'flex', gap: 12 }}>
                      <span>🏷️ {z.zone_type}</span>
                      <span>📍 {z.insiden_count || 0} insiden</span>
                      {z.created_by_name && <span>👤 {z.created_by_name}</span>}
                    </div>
                    {z.description && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>{z.description}</div>
                    )}
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => startEdit(z)} style={{ background: 'none', border: 'none', color: 'var(--info)', cursor: 'pointer', fontSize: '0.75rem' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDelete(z.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem' }}>
                          🗑️ Hapus
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: '0.72rem',
        color: 'var(--text-light)', display: 'flex', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span>Warna zona berdasarkan level risiko</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[1,2,3,4,5].map(l => (
            <span key={l} style={{
              width: 12, height: 12, borderRadius: 3, background: RISK_COLORS[l],
              display: 'inline-block',
            }} title={`Level ${l}`} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
