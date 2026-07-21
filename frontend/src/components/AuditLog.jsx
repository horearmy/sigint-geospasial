import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../App'

export default function AuditLog({ onClose }) {
  const { user } = useAuth()
  const addToast = useToast()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => { fetchLogs() }, [page])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/audit?page=${page}&limit=30`)
      setLogs(res.data.data)
      setTotal(res.data.total)
    } catch (err) { addToast('Gagal mengambil audit log', 'error') }
    finally { setLoading(false) }
  }

  const handleExport = async () => {
    try {
      const res = await axios.get('/api/audit/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = 'audit_log.csv'; a.click()
      addToast('Audit log berhasil diexport', 'success')
    } catch (err) { addToast('Gagal export', 'error') }
  }

  const actionColors = {
    login: '#22c55e', logout: '#64748b', create: '#1b4332', update: '#f59e0b', delete: '#ef4444',
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel" style={{ maxWidth: '750px' }}
        onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="form-panel-header">
          <h2>📋 Audit Log</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-outline" onClick={handleExport}>📥 Export CSV</button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Memuat...</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Belum ada audit log</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Waktu</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>User</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Aksi</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Resource</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap', color: '#64748b' }}>
                      {new Date(l.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{l.full_name || l.username || '-'}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600,
                        background: (actionColors[l.action] || '#64748b') + '20',
                        color: actionColors[l.action] || '#64748b',
                        textTransform: 'uppercase',
                      }}>{l.action}</span>
                    </td>
                    <td style={{ padding: '8px', color: '#64748b' }}>{l.resource || '-'}</td>
                    <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8' }}>
                      {typeof l.details === 'object' ? JSON.stringify(l.details) : l.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > 30 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-sm btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</button>
              <span style={{ padding: '6px 12px', fontSize: '0.82rem', color: '#64748b' }}>Hal {page} / {Math.ceil(total / 30)}</span>
              <button className="btn btn-sm btn-outline" disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)}>Selanjutnya</button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
