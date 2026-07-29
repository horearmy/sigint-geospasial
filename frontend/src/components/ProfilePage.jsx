import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import api from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function ProfilePage({ onClose }) {
  const { user, setUser } = useAuth()
  const addToast = useToast()
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    full_name: '', email: '', avatar_url: '',
    pangkat: '', nrp: '', jabatan: '', satuan: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: '', new_password: '', confirm_password: '',
  })
  const [loading, setLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const [stats, setStats] = useState(null)
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        avatar_url: user.avatar_url || '',
        pangkat: user.pangkat || '',
        nrp: user.nrp || '',
        jabatan: user.jabatan || '',
        satuan: user.satuan || '',
      })
    }
  }, [user])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/laporan/stats')
        setStats(res.data.data)
      } catch (err) { console.error(err) }
    }
    fetchStats()
  }, [])

  const handleAvatarUpload = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      addToast('Hanya file gambar yang diizinkan', 'error')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      addToast('Ukuran maksimal 2MB', 'error')
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setAvatarLoading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await api.post('/api/auth/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUser(res.data.data)
      setForm(prev => ({ ...prev, avatar_url: res.data.data.avatar_url }))
      setAvatarPreview(null)
      addToast('Foto profil berhasil diupload!', 'success')
    } catch (err) {
      setAvatarPreview(null)
      addToast(err.response?.data?.error || 'Gagal upload foto', 'error')
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleAvatarUpload(file)
    e.target.value = ''
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.put('/api/auth/profile', form)
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
    if (passwordForm.new_password.length < 8) {
      addToast('Password baru minimal 8 karakter', 'error')
      return
    }
    if (!/[A-Z]/.test(passwordForm.new_password) || !/[a-z]/.test(passwordForm.new_password) || !/[0-9]/.test(passwordForm.new_password)) {
      addToast('Password harus mengandung huruf besar, huruf kecil, dan angka', 'error')
      return
    }
    setPwLoading(true)
    try {
      await api.put('/api/auth/password', {
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
const colors = { admin: '#ef4444', analis: '#8b5cf6', operator: '#1b4332', lapangan: '#0ea5e9', viewer: '#1b4332' }
const labels = { admin: 'Admin', analis: 'Analis', operator: 'Operator', lapangan: 'Lapangan', viewer: 'Viewer' }
    return (
      <span style={{
        background: `${colors[role]}20`, color: colors[role],
        padding: '3px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
      }}>
        {labels[role] || role}
      </span>
    )
  }

  const avatarSrc = avatarPreview || form.avatar_url || null

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel" style={{ maxWidth: '600px' }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 0.9 }}
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
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  style={{
                    width: 100, height: 100, borderRadius: '50%',
                    background: avatarSrc ? 'transparent' : 'linear-gradient(135deg, #1b4332, #c9a84c)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.8rem', fontWeight: 700, margin: '0 auto 12px',
                    boxShadow: '0 4px 20px rgba(27, 67, 50, 0.3)',
                    overflow: 'hidden', cursor: 'pointer',
                    border: '3px solid rgba(61, 220, 132, 0.3)',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="avatar"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.style.background = 'linear-gradient(135deg, #1b4332, #c9a84c)' }}
                    />
                  ) : (
                    getInitials(form.full_name)
                  )}
                </motion.div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    position: 'absolute', bottom: '8px', right: '4px',
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#3DDC84', border: '2px solid #041A0D',
                    color: '#041A0D', fontSize: '1rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                  title={isMobile ? 'Buka Kamera/Galeri' : 'Upload Foto'}
                >
                  {avatarLoading ? '⏳' : '📷'}
                </button>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{user?.username}</h3>
              {getRoleBadge(user?.role)}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture={isMobile ? 'environment' : undefined}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
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
                <label>Pangkat</label>
                <input type="text" value={form.pangkat}
                  onChange={e => setForm({ ...form, pangkat: e.target.value })}
                  placeholder="Contoh: Serma" />
              </div>
              <div className="form-group">
                <label>NRP</label>
                <input type="text" value={form.nrp}
                  onChange={e => setForm({ ...form, nrp: e.target.value })}
                  placeholder="Nomor Registrasi Pokok" />
              </div>
              <div className="form-group">
                <label>Jabatan</label>
                <input type="text" value={form.jabatan}
                  onChange={e => setForm({ ...form, jabatan: e.target.value })}
                  placeholder="Contoh: Danru Intel" />
              </div>
              <div className="form-group">
                <label>Satuan</label>
                <input type="text" value={form.satuan}
                  onChange={e => setForm({ ...form, satuan: e.target.value })}
                  placeholder="Contoh: Yonif 101/Brajamusti" />
              </div>
              <input type="hidden" value={form.avatar_url} />
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
                  placeholder="Masukkan password baru (min 8 karakter)" required />
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
                <InfoItem label="Pangkat" value={user?.pangkat} />
                <InfoItem label="NRP" value={user?.nrp} />
                <InfoItem label="Jabatan" value={user?.jabatan} />
                <InfoItem label="Satuan" value={user?.satuan} />
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
