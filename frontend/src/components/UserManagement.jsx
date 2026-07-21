import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../App'

const ROLES = ['admin', 'analis', 'operator', 'viewer']
const ROLE_COLORS = { admin: '#ef4444', analis: '#8b5cf6', operator: '#2563eb', viewer: '#64748b' }

export default function UserManagement({ onClose }) {
  const { user } = useAuth()
  const addToast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/auth/users')
      setUsers(res.data.data)
    } catch (err) {
      addToast('Gagal mengambil data users', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`/api/auth/users/${userId}/role`, { role: newRole })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      addToast('Role berhasil diupdate', 'success')
    } catch (err) {
      addToast('Gagal update role', 'error')
    }
  }

  const handleToggleActive = async (userId) => {
    try {
      const res = await axios.put(`/api/auth/users/${userId}/toggle-active`)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: res.data.data.is_active } : u))
      addToast('Status user diupdate', 'success')
    } catch (err) {
      addToast('Gagal update status', 'error')
    }
  }

  if (user?.role !== 'admin') return null

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div
        className="form-panel"
        style={{ maxWidth: '700px' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <div className="form-panel-header">
          <h2>👥 Manajemen User</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Memuat...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>User</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>Role</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontWeight: 600 }}>{u.full_name || u.username}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>@{u.username}</div>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#64748b' }}>{u.email}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{
                          padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0',
                          fontSize: '0.82rem', background: ROLE_COLORS[u.role] + '15',
                          color: ROLE_COLORS[u.role], fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600,
                        background: u.is_active ? '#dcfce7' : '#fee2e2',
                        color: u.is_active ? '#16a34a' : '#dc2626',
                      }}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleActive(u.id)}
                        disabled={u.id === user.id}
                        className="btn btn-sm"
                        style={{
                          background: u.is_active ? '#fee2e2' : '#dcfce7',
                          color: u.is_active ? '#dc2626' : '#16a34a',
                          border: 'none', cursor: u.id === user.id ? 'not-allowed' : 'pointer',
                          opacity: u.id === user.id ? 0.5 : 1,
                        }}
                      >
                        {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  )
}
