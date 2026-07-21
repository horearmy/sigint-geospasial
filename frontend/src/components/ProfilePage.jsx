import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../App'

export default function ProfilePage({ onClose }) {
  const { user, setUser } = useAuth()
  const addToast = useToast()
  const [form, setForm] = useState({
    full_name: '', email: '', avatar_url: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: '', new_password: '', confirm_password: '',
  })
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        avatar_url: user.avatar_url || '',
      })
    }
  }, [user])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('/api/laporan/stats')
        setStats(res.data.data)
      } catch (err) { console.error(err) }
    }
    fetchStats()
  }, [])

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await axios.put('/api/auth/profile', form)
      setUser(res.data.data)
      addToast('Profile berhasil diupdate!', 'success')
    } catch (err) {
      addToast(err.response?.data?.error || 'Gagal update profile', 'error')
    } finally { setLoading(false) }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      addToast('Password baru tidak cocok', 'error')
      return
    }
    if (passwordForm.new_password.length < 6) {
      addToast('Password baru minimal 6 karakter', 'error')
      return
    }
    setPwLoading(true)
    try {
      await axios.put('/api/auth/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      addToast('Password berhasil diubah!', 'success')
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      addToast(err.response?.data?.error || 'Gagal mengubah password', 'error')
    } finally { setPwLoading(false) }
  }

  const getInitials = (name) => {
    if (!name) return user?.username?.[0]?.toUpperCase() || '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getRoleBadge = (role) => {
    const colors = { admin: '#ef4444', analis: '#8b5cf6', operator: '#1b4332', viewer: '#1b4332' }
    const labels = { admin: 'Admin', analis: 'Analis', operator: 'Operator', viewer: 'Viewer' }
    return (
      <span style={{
        background: `${colors[role]}20`, color: colors[role],
        padding: '3px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
      }}>
        {labels[role] || role}
      </span>
    )
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel" style={{ maxWidth: '600px' }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}>

        <div className="form-panel-header">
          <h2>👤 Profile Saya</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px 24px 0' }}>
          <button className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('profile')}>Profile</button>
          <button className={`btn btn-sm ${activeTab === 'password' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('password')}>Ubah Password</button>
          <button className={`btn btn-sm ${activeTab === 'info' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('info')}>Info Akun</button>
        </div>

        <div className="form-body">
          {activeTab === 'profile' && (
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1b4332, #c9a84c)',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.8rem', fontWeight: 700, margin: '0 auto 12px',
                  boxShadow: '0 4px 20px rgba(27, 67, 50, 0.3)',
                }}>
                {getInitials(form.full_name)}
              </motion.div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{user?.username}</h3>
              {getRoleBadge(user?.role)}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate}>
              <div className="form-group">
                <label>Nama Lengkap</label>
                <input type="text" value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Masukkan nama lengkap" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="Masukkan email" />
              </div>
              <div className="form-group">
                <label>Avatar URL</label>
                <input type="url" value={form.avatar_url}
                  onChange={e => setForm({ ...form, avatar_url: e.target.value })}
                  placeholder="https://example.com/avatar.jpg" />
                <span className="hint">Link ke foto profil (opsional)</span>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Menyimpan...' : '💾 Simpan'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Password Lama <span className="required">*</span></label>
                <input type="password" value={passwordForm.current_password}
                  onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  placeholder="Masukkan password lama" required />
              </div>
              <div className="form-group">
                <label>Password Baru <span className="required">*</span></label>
                <input type="password" value={passwordForm.new_password}
                  onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="Masukkan password baru (min 6 karakter)" required />
              </div>
              <div className="form-group">
                <label>Konfirmasi Password Baru <span className="required">*</span></label>
                <input type="password" value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="Ulangi password baru" required />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={pwLoading}>
                  {pwLoading ? 'Mengubah...' : '🔒 Ubah Password'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'info' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <InfoItem label="Username" value={user?.username} />
                <InfoItem label="Role" value={user?.role} />
                <InfoItem label="Email" value={user?.email} />
                <InfoItem label="Status" value={user?.is_active ? 'Aktif' : 'Nonaktif'} />
                <InfoItem label="Terdaftar" value={user?.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : '-'} />
                <InfoItem label="Login Terakhir" value={user?.last_login ? new Date(user.last_login).toLocaleDateString('id-ID') : '-'} />
              </div>

              {stats && (
                <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>📊 Statistik Platform</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>Total Laporan: <strong>{stats.total || 0}</strong></div>
                    <div style={{ color: 'var(--text-secondary)' }}>Kategori: <strong>{stats.kategori_count || 0}</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '4px', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{value || '-'}</div>
    </div>
  )
}
