import { useState, createContext, useContext, useEffect, useCallback } from 'react'
import axios from 'axios'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    delete axios.defaults.headers.common['Authorization']
  }, [])

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout()
        }
        return Promise.reject(error)
      }
    )
    return () => axios.interceptors.response.eject(interceptor)
  }, [logout])

  const fetchUser = useCallback(async () => {
    if (!token) { setLoading(false); return }
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      const res = await axios.get('/api/auth/me')
      setUser(res.data.data)
    } catch {
      logout()
    } finally {
      setLoading(false)
    }
  }, [token, logout])

  useEffect(() => { fetchUser() }, [fetchUser])

  const login = async (username, password) => {
    const res = await axios.post('/api/auth/login', { username, password })
    const { user: u, token: t } = res.data.data
    localStorage.setItem('token', t)
    setToken(t)
    setUser(u)
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
    return u
  }

  const register = async (data) => {
    const res = await axios.post('/api/auth/register', data)
    const { user: u, token: t } = res.data.data
    localStorage.setItem('token', t)
    setToken(t)
    setUser(u)
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
    return u
  }

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
