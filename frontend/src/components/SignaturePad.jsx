import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import api from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function SignaturePad({ laporanId, onClose, onSigned }) {
  const { user } = useAuth()
  const addToast = useToast()
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = c.offsetWidth * 2
    c.height = c.offsetHeight * 2
    const ctx = c.getContext('2d')
    ctx.scale(2, 2)
    ctx.strokeStyle = '#1b4332'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e) => {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: t.clientX - r.left, y: t.clientY - r.top }
  }

  const startDraw = (e) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = getPos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = getPos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setHasContent(true)
  }

  const endDraw = () => {
    setIsDrawing(false)
  }

  const clear = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    setHasContent(false)
  }

  const saveSignature = async () => {
    if (!hasContent) { addToast('Harap tanda tangan terlebih dahulu', 'error'); return }
    setSaving(true)
    try {
      const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'))
      const fd = new FormData()
      fd.append('signature', blob, 'signature.png')
      const res = await api.post(`/api/laporan/${laporanId}/sign`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      addToast('Laporan berhasil ditandatangani!', 'success')
      onSigned?.(res.data.data)
      onClose()
    } catch (err) {
      addToast(err.response?.data?.error || 'Gagal menyimpan tanda tangan', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="form-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <motion.div className="form-panel" style={{ maxWidth: 500 }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="form-panel-header">
          <h2>✍️ Tanda Tangan Digital</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="form-body" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: 12 }}>
            {user?.full_name || user?.username} — {new Date().toLocaleDateString('id-ID')}
          </p>
          <div style={{
            background: '#fff', borderRadius: 12, overflow: 'hidden',
            border: '2px dashed rgba(61,220,132,0.4)', marginBottom: 12, touchAction: 'none',
          }}>
            <canvas ref={canvasRef}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
              style={{ width: '100%', height: 180, display: 'block', cursor: 'crosshair' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={clear}>🗑️ Hapus</button>
            <button className="btn btn-primary" onClick={saveSignature} disabled={!hasContent || saving}>
              {saving ? '⏳ Menyimpan...' : '✅ Tanda Tangani'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
