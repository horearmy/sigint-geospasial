import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { formatCoordinate } from '../utils/coordinates'

const COLORS = ['#1b4332', '#2d6a4f', '#c9a84c', '#ef4444', '#7c3aed', '#0891b2', '#16a34a', '#ea580c', '#dc2626', '#ca8a04', '#6366f1', '#ec4899']
const SHAPE_ICONS = { marker: '📍', polyline: '〰️', polygon: '⬡' }

export default function DrawingPanel({ drawings, onRefresh, onClose, onSelectDrawing }) {
  const addToast = useToast()
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '#1b4332', stroke_width: 3, fill_opacity: 0.2 })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setContextMenu(null)
    }
    if (contextMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contextMenu])

  const filtered = drawings.filter(d =>
    !filter || d.shape_type === filter || (d.name && d.name.toLowerCase().includes(filter.toLowerCase()))
  )

  const startEdit = (drawing) => {
    setEditingId(drawing.id)
    setEditForm({
      name: drawing.name || '',
      description: drawing.description || '',
      color: drawing.color || '#1b4332',
      stroke_width: drawing.stroke_width || 3,
      fill_opacity: drawing.fill_opacity ?? 0.2,
    })
  }

  const saveEdit = async (id) => {
    setSaving(true)
    try {
      await api.put(`/api/drawings/${id}`, editForm)
      addToast('Gambar berhasil diupdate', 'success')
      setEditingId(null)
      onRefresh()
    } catch (err) {
      addToast(err?.response?.data?.error || 'Gagal update', 'error')
    } finally { setSaving(false) }
  }

  const deleteDrawing = async (id) => {
    if (!confirm('Yakin hapus gambar ini?')) return
    try {
      await api.delete(`/api/drawings/${id}`)
      addToast('Gambar dihapus', 'success')
      onRefresh()
    } catch (err) {
      addToast('Gagal menghapus', 'error')
    }
  }

  const handleContextMenu = (e, d) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setContextMenu({ id: d.id, drawing: d, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const getShapeInfo = (drawing) => {
    const coords = drawing.coordinates
    if (!coords) return null
    if (drawing.shape_type === 'marker') {
      return { text: formatCoordinate(coords.lat, coords.lng, 'mgrs'), sub: `${coords.lat?.toFixed(6)}, ${coords.lng?.toFixed(6)}` }
    }
    if (drawing.shape_type === 'polygon' && coords.points) {
      return { text: `${coords.points.length} titik`, sub: coords.area || '' }
    }
    if (drawing.shape_type === 'polyline' && coords.points) {
      return { text: `${coords.points.length} titik`, sub: coords.distance || '' }
    }
    return null
  }

  return (
    <motion.div className="drawing-panel"
      initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <div className="form-panel-header">
        <h2>✏️ Hasil Gambar</h2>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span className="panel-count">{drawings.length}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="drawing-filter">
        <button className={`drawing-filter-btn ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>Semua</button>
        <button className={`drawing-filter-btn ${filter === 'marker' ? 'active' : ''}`} onClick={() => setFilter('marker')}>📍</button>
        <button className={`drawing-filter-btn ${filter === 'polyline' ? 'active' : ''}`} onClick={() => setFilter('polyline')}>〰️</button>
        <button className={`drawing-filter-btn ${filter === 'polygon' ? 'active' : ''}`} onClick={() => setFilter('polygon')}>⬡</button>
      </div>

      <div className="drawing-list">
        <AnimatePresence>
          {filtered.length === 0 && (
            <div className="drawing-empty">
              <span style={{ fontSize: '2rem' }}>🗺️</span>
              <p>Belum ada gambar</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Aktifkan mode Gambar lalu buat di peta</p>
            </div>
          )}
          {filtered.map(d => {
            const info = getShapeInfo(d)
            const isEditing = editingId === d.id
            return (
              <motion.div key={d.id} className={`drawing-item ${isEditing ? 'editing' : ''}`}
                layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {isEditing ? (
                  <div className="drawing-edit-form">
                    <div className="form-group">
                      <label>Nama</label>
                      <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Nama gambar..." />
                    </div>
                    <div className="form-group">
                      <label>Deskripsi</label>
                      <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Deskripsi..." rows={2} />
                    </div>
                    <div className="form-group">
                      <label>Warna</label>
                      <div className="color-picker-row">
                        {COLORS.map(c => (
                          <button key={c} className={`color-swatch ${editForm.color === c ? 'active' : ''}`}
                            style={{ background: c }} onClick={() => setEditForm({ ...editForm, color: c })} />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Garis: {editForm.stroke_width}px</label>
                        <input type="range" min="1" max="10" value={editForm.stroke_width}
                          onChange={e => setEditForm({ ...editForm, stroke_width: parseInt(e.target.value) })} />
                      </div>
                      {d.shape_type !== 'marker' && (
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Isi: {Math.round(editForm.fill_opacity * 100)}%</label>
                          <input type="range" min="0" max="100" value={Math.round(editForm.fill_opacity * 100)}
                            onChange={e => setEditForm({ ...editForm, fill_opacity: parseInt(e.target.value) / 100 })} />
                        </div>
                      )}
                    </div>
                    <div className="drawing-edit-actions">
                      <button className="btn btn-sm btn-outline" onClick={() => setEditingId(null)}>Batal</button>
                      <button className="btn btn-sm btn-primary" onClick={() => saveEdit(d.id)} disabled={saving}>
                        {saving ? '...' : '💾 Simpan'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="drawing-item-header" onClick={(e) => handleContextMenu(e, d)} style={{ cursor: 'context-menu' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="drawing-color-dot" style={{ background: d.color }} />
                        <span className="drawing-shape-icon">{SHAPE_ICONS[d.shape_type]}</span>
                        <div>
                          <div className="drawing-name">{d.name || `${d.shape_type} #${d.id}`}</div>
                          {info && <div className="drawing-coord">{info.text}</div>}
                        </div>
                      </div>
                    </div>
                    {contextMenu?.id === d.id && (
                      <div className="drawing-context-menu" ref={menuRef}
                        style={{ top: '100%', left: '16px' }}>
                        <button onClick={() => { startEdit(d); setContextMenu(null) }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => { onSelectDrawing && onSelectDrawing(d); setContextMenu(null) }}>
                          🗺️ Lihat Detail
                        </button>
                        <button className="danger" onClick={() => { deleteDrawing(d.id); setContextMenu(null) }}>
                          🗑️ Hapus
                        </button>
                      </div>
                    )}
                    {d.description && <div className="drawing-desc">{d.description}</div>}
                    <div className="drawing-meta">
                      <span>{d.created_by_name || 'Anonim'}</span>
                      <span>{new Date(d.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
