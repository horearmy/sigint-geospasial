import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../App'

export default function CommentPanel({ laporanId, onClose }) {
  const { user } = useAuth()
  const addToast = useToast()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [laporanId])

  const fetchComments = async () => {
    try {
      const res = await axios.get(`/api/comments/laporan/${laporanId}`)
      setComments(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setSending(true)
    try {
      const res = await axios.post('/api/comments', {
        laporan_id: laporanId,
        content: newComment,
        parent_id: replyTo?.id || null,
      })
      setComments(prev => [...prev, res.data.data])
      setNewComment('')
      setReplyTo(null)
    } catch (err) {
      addToast('Gagal mengirim komentar', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus komentar ini?')) return
    try {
      await axios.delete(`/api/comments/${id}`)
      setComments(prev => prev.filter(c => c.id !== id))
      addToast('Komentar dihapus', 'success')
    } catch (err) {
      addToast('Gagal menghapus komentar', 'error')
    }
  }

  const getRoleBadge = (role) => {
    const colors = { admin: '#ef4444', analis: '#8b5cf6', operator: '#1b4332', viewer: '#64748b' }
    return (
      <span style={{
        padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600,
        background: (colors[role] || '#64748b') + '20',
        color: colors[role] || '#64748b',
        textTransform: 'uppercase', marginLeft: '6px',
      }}>{role}</span>
    )
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div
        className="form-panel"
        style={{ maxWidth: '500px' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <div className="form-panel-header">
          <h2>💬 Komentar</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '16px', maxHeight: '50vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Memuat komentar...</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
              <p>Belum ada komentar</p>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} style={{
                padding: '12px', borderRadius: '8px', marginBottom: '8px',
                background: c.parent_id ? '#f8fafc' : '#f1f5f9',
                marginLeft: c.parent_id ? '20px' : '0',
                borderLeft: c.parent_id ? '3px solid #1b4332' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>{c.full_name || c.username}</strong>
                    {c.role && getRoleBadge(c.role)}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {new Date(c.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', margin: '4px 0', lineHeight: 1.4 }}>{c.content}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {user && (
                    <button
                      onClick={() => setReplyTo(c)}
                      style={{ background: 'none', border: 'none', color: '#1b4332', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                    >Balas</button>
                  )}
                  {user && (c.user_id === user.id || user.role === 'admin') && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                    >Hapus</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {user ? (
          <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0' }}>
            {replyTo && (
              <div style={{
                padding: '6px 10px', background: '#eff6ff', borderRadius: '6px',
                fontSize: '0.8rem', marginBottom: '8px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>Membalas <strong>{replyTo.full_name || replyTo.username}</strong></span>
                <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>×</button>
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Tulis komentar..."
                style={{
                  flex: 1, padding: '10px 12px', border: '1px solid #e2e8f0',
                  borderRadius: '8px', fontSize: '0.85rem', outline: 'none',
                }}
              />
              <button
                type="submit" disabled={sending || !newComment.trim()}
                className="btn btn-primary btn-sm"
                style={{ opacity: sending || !newComment.trim() ? 0.5 : 1 }}
              >
                {sending ? '...' : 'Kirim'}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            Login untuk berkomentar
          </div>
        )}
      </motion.div>
    </div>
  )
}
