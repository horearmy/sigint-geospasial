import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../App'

const ZONE_TYPES = ['Bahaya Tinggi', 'Bahaya Sedang', 'Bahaya Rendah', 'Aman', 'Zona Monitor']
const RISK_COLORS = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#7f1d1d' }

export default function ThreatZonesPanel({ onClose, onZoneCreated }) {
  const { user } = useAuth()
  const addToast = useToast()
  const [zones, setZones] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: '', zone_type: ZONE_TYPES[0], risk_level: 1, description: '',
    lat1: '', lng1: '', lat2: '', lng2: '', lat3: '', lng3: '', lat4: '', lng4: '',
  })

  useEffect(() => { fetchZones() }, [])

  const fetchZones = async () => {
    try {
      const res = await axios.get('/api/zones')
      setZones(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const coords = [
        [parseFloat(form.lng1), parseFloat(form.lat1)],
        [parseFloat(form.lng2), parseFloat(form.lat2)],
        [parseFloat(form.lng3), parseFloat(form.lat3)],
        [parseFloat(form.lng4), parseFloat(form.lat4)],
        [parseFloat(form.lng1), parseFloat(form.lat1)],
      ]

      for (const [lng, lat] of coords.slice(0, 4)) {
        if (isNaN(lat) || isNaN(lng)) {
          addToast('Koordinat tidak valid', 'error')
          return
        }
      }

      await axios.post('/api/zones', {
        name: form.name,
        zone_type: form.zone_type,
        risk_level: parseInt(form.risk_level),
        description: form.description,
        boundary_geojson: {
          type: 'Polygon',
          coordinates: [coords],
        },
      })

      addToast('Zona berhasil dibuat', 'success')
      setShowCreate(false)
      setForm({ name: '', zone_type: ZONE_TYPES[0], risk_level: 1, description: '', lat1: '', lng1: '', lat2: '', lng2: '', lat3: '', lng3: '', lat4: '', lng4: '' })
      fetchZones()
      if (onZoneCreated) onZoneCreated()
    } catch (err) {
      addToast(err.response?.data?.error || 'Gagal membuat zona', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus zona ini?')) return
    try {
      await axios.delete(`/api/zones/${id}`)
      setZones(prev => prev.filter(z => z.id !== id))
      addToast('Zona dihapus', 'success')
    } catch (err) {
      addToast('Gagal menghapus zona', 'error')
    }
  }

  const canEdit = user && ['admin', 'analis'].includes(user.role)

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div
        className="form-panel"
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <div className="form-panel-header">
          <h2>🛡️ Threat Zones & Geofencing</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {canEdit && !showCreate && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              + Buat Zona Baru
            </button>
          </div>
        )}

        <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
          {showCreate && (
            <form onSubmit={handleCreate} style={{
              padding: '16px', borderRadius: '8px', background: '#f8fafc',
              border: '1px solid #e2e8f0', marginBottom: '16px',
            }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Buat Zona Baru</h3>
              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Nama Zona</label>
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Tipe Zona</label>
                  <select value={form.zone_type} onChange={(e) => setForm({...form, zone_type: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                    {ZONE_TYPES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Level Risiko (1-5)</label>
                  <select value={form.risk_level} onChange={(e) => setForm({...form, risk_level: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                    {[1,2,3,4,5].map(r => <option key={r} value={r}>Level {r}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Deskripsi</label>
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', minHeight: '60px', boxSizing: 'border-box' }} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Koordinat Polygon (4 titik)</label>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', width: '40px', paddingTop: '6px' }}>P{i}</span>
                    <input placeholder="Lat" value={form[`lat${i}`]} onChange={(e) => setForm({...form, [`lat${i}`]: e.target.value})}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem' }} />
                    <input placeholder="Lng" value={form[`lng${i}`]} onChange={(e) => setForm({...form, [`lng${i}`]: e.target.value})}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-outline btn-sm">Batal</button>
                <button type="submit" className="btn btn-primary btn-sm">Simpan Zona</button>
              </div>
            </form>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Memuat zona...</div>
          ) : zones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛡️</div>
              <p>Belum ada zona terdefinisi</p>
            </div>
          ) : (
            zones.map((z) => (
              <div key={z.id} style={{
                padding: '12px 16px', borderRadius: '8px', marginBottom: '8px',
                background: (RISK_COLORS[z.risk_level] || '#64748b') + '10',
                borderLeft: `4px solid ${RISK_COLORS[z.risk_level] || '#64748b'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{z.name}</strong>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600,
                      background: RISK_COLORS[z.risk_level], color: 'white',
                    }}>Level {z.risk_level}</span>
                    {canEdit && (
                      <button onClick={() => handleDelete(z.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem' }}>
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  🏷️ {z.zone_type} · {z.insiden_count || 0} insiden di dalam zona
                </div>
                {z.description && (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>{z.description}</div>
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}
