import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState({ username: '', password: '', email: '', full_name: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isLogin) {
        await login(form.username, form.password)
      } else {
        if (!form.email) { setError('Email wajib diisi'); setSaving(false); return }
        await register(form)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #2563eb 100%)',
      padding: '20px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'white',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
          padding: '30px',
          textAlign: 'center',
          color: 'white',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🌐</div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>SIGINT</h1>
          <p style={{ fontSize: '0.82rem', opacity: 0.8, margin: '4px 0 0' }}>Sistem Intelijen Geospasial</p>
        </div>

        <div style={{ padding: '30px' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
            <button
              onClick={() => { setIsLogin(true); setError('') }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                background: isLogin ? 'white' : 'transparent',
                color: isLogin ? '#2563eb' : '#64748b',
                fontWeight: 600, fontSize: '0.85rem',
                boxShadow: isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >Login</button>
            <button
              onClick={() => { setIsLogin(false); setError('') }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                background: !isLogin ? 'white' : 'transparent',
                color: !isLogin ? '#2563eb' : '#64748b',
                fontWeight: 600, fontSize: '0.85rem',
                boxShadow: !isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >Register</button>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', background: '#fef2f2', color: '#dc2626',
              borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px',
              border: '1px solid #fecaca',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>Username</label>
              <input
                name="username" value={form.username} onChange={handleChange} required
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
                  borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box',
                  outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {!isLogin && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>Email</label>
                  <input
                    name="email" type="email" value={form.email} onChange={handleChange} required
                    style={{
                      width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
                      borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>Nama Lengkap</label>
                  <input
                    name="full_name" value={form.full_name} onChange={handleChange}
                    style={{
                      width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
                      borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              </>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>Password</label>
              <input
                name="password" type="password" value={form.password} onChange={handleChange} required
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
                  borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box',
                  outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <button
              type="submit" disabled={saving}
              style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: 'white', fontWeight: 600, fontSize: '0.95rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s',
              }}
            >
              {saving ? 'Memproses...' : isLogin ? '🔐 Login' : '📝 Daftar'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
