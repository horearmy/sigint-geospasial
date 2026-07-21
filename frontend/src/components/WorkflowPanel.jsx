import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../App'

export default function WorkflowPanel({ laporanList, onClose }) {
  const { user } = useAuth()
  const addToast = useToast()
  const [workflows, setWorkflows] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', kategori: 'Berita Umum', fields: '', description: '' })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [w, t] = await Promise.all([
        axios.get('/api/workflow/workflow'),
        axios.get('/api/workflow/templates'),
      ])
      setWorkflows(w.data.data)
      setTemplates(t.data.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSubmitWorkflow = async (laporanId) => {
    try {
      await axios.post('/api/workflow/workflow', { laporan_id: laporanId })
      addToast('Laporan disubmit untuk review', 'success')
      fetchData()
    } catch (err) { addToast('Gagal submit', 'error') }
  }

  const handleReview = async (id, status) => {
    try {
      await axios.put(`/api/workflow/workflow/${id}/review`, { status, reviewer_note: '' })
      addToast(`Laporan ${status}`, 'success')
      fetchData()
    } catch (err) { addToast('Gagal review', 'error') }
  }

  const handleCreateTemplate = async (e) => {
    e.preventDefault()
    try {
      const fields = templateForm.fields.split(',').map(f => ({
        name: f.trim(), type: 'text', required: false,
      })).filter(f => f.name)
      await axios.post('/api/workflow/templates', {
        name: templateForm.name,
        kategori: templateForm.kategori,
        fields, description: templateForm.description,
      })
      addToast('Template berhasil dibuat', 'success')
      setShowNewTemplate(false)
      setTemplateForm({ name: '', kategori: 'Berita Umum', fields: '', description: '' })
      fetchData()
    } catch (err) { addToast('Gagal membuat template', 'error') }
  }

  const statusColors = {
    pending: { bg: '#fefce8', border: '#eab308', text: '#ca8a04', label: '⏳ Pending' },
    approved: { bg: '#f0fdf4', border: '#22c55e', text: '#16a34a', label: '✅ Approved' },
    rejected: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', label: '❌ Rejected' },
  }

  const canReview = user && ['admin', 'analis'].includes(user.role)

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel" style={{ maxWidth: '800px' }}
        onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="form-panel-header">
          <h2>📝 Workflow & Templates</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '2px', padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          {[['pending', '⏳ Pending'], ['all', '📋 Semua'], ['templates', '📄 Templates']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === tab ? '#2563eb' : 'transparent',
                color: activeTab === tab ? 'white' : '#64748b',
                fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s',
              }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Memuat...</div>
          ) : (
            <>
              {activeTab === 'templates' ? (
                <div>
                  {canReview && (
                    <button className="btn btn-primary btn-sm" onClick={() => setShowNewTemplate(!showNewTemplate)} style={{ marginBottom: '12px' }}>
                      + Template Baru
                    </button>
                  )}
                  {showNewTemplate && (
                    <form onSubmit={handleCreateTemplate} style={{ padding: '14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                      <div className="form-group">
                        <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Nama Template</label>
                        <input value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} required
                          style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Kategori</label>
                        <select value={templateForm.kategori} onChange={e => setTemplateForm({...templateForm, kategori: e.target.value})}
                          style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                          {['Banjir', 'Gempa Bumi', 'Kebakaran', 'Longsor', 'Angin Kencang', 'Kekeringan', 'Bencana Lainnya', 'Berita Umum'].map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Fields (koma dipisah)</label>
                        <input value={templateForm.fields} onChange={e => setTemplateForm({...templateForm, fields: e.target.value})}
                          placeholder="Korban Jiwa, Kerusakan, Penyebab"
                          style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setShowNewTemplate(false)} className="btn btn-outline btn-sm">Batal</button>
                        <button type="submit" className="btn btn-primary btn-sm">Simpan</button>
                      </div>
                    </form>
                  )}
                  {templates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Belum ada template</div>
                  ) : templates.map(t => (
                    <div key={t.id} style={{ padding: '12px', borderRadius: '8px', marginBottom: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{t.name}</strong>
                      <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '8px', fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb' }}>{t.kategori}</span>
                      {t.description && <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>{t.description}</p>}
                      {t.fields && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {(Array.isArray(t.fields) ? t.fields : JSON.parse(t.fields)).map((f, i) => (
                            <span key={i} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b' }}>
                              {f.name || f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {activeTab === 'pending' && canReview && laporanList.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Submit Laporan untuk Review:</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {laporanList.filter(l => !workflows.find(w => w.laporan_id === l.id)).slice(0, 5).map(l => (
                          <button key={l.id} onClick={() => handleSubmitWorkflow(l.id)}
                            className="btn btn-outline btn-sm" style={{ fontSize: '0.78rem' }}>
                            {l.judul.substring(0, 20)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {workflows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Belum ada workflow</div>
                  ) : workflows
                    .filter(w => activeTab === 'pending' ? w.status === 'pending' : true)
                    .map(w => {
                      const style = statusColors[w.status] || statusColors.pending
                      return (
                        <div key={w.id} style={{
                          padding: '12px 16px', borderRadius: '8px', marginBottom: '8px',
                          background: style.bg, borderLeft: `4px solid ${style.border}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '0.88rem' }}>{w.laporan_judul || `Laporan #${w.laporan_id}`}</strong>
                              <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '8px', fontSize: '0.72rem', background: style.border + '20', color: style.text, fontWeight: 600 }}>{style.label}</span>
                            </div>
                            {canReview && w.status === 'pending' && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => handleReview(w.id, 'approved')} className="btn btn-sm" style={{ background: '#22c55e', color: 'white', border: 'none' }}>✓</button>
                                <button onClick={() => handleReview(w.id, 'rejected')} className="btn btn-sm" style={{ background: '#ef4444', color: 'white', border: 'none' }}>✕</button>
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                            {new Date(w.created_at).toLocaleDateString('id-ID')} · {w.reviewer_name ? `Review oleh ${w.reviewer_name}` : 'Menunggu review'}
                          </div>
                        </div>
                      )
                    })}
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
