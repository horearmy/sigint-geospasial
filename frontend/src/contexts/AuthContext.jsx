import { useState, createContext, useContext, useEffect, useCallback, useRef } from 'react'
import api, { setAuthToken } from '../utils/api'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const justLoggedIn = useRef(false)
  const isRefreshing = useRef(false)
  const isLoggingOut = useRef(false)

  const logout = useCallback(async () => {
    if (isLoggingOut.current) return
    isLoggingOut.current = true
    try {
      await api.post('/api/auth/logout').catch(() => {})
    } catch {}
    localStorage.removeItem('access_token')
    setToken(null)
    setUser(null)
    setAuthToken(null)
    isLoggingOut.current = false
  }, [])

  const tryRefresh = useCallback(async () => {
    if (isRefreshing.current) return null
    isRefreshing.current = true
    try {
      const res = await api.post('/api/auth/refresh')
      const newToken = res.data.data.token
      localStorage.setItem('access_token', newToken)
      setAuthToken(newToken)
      setToken(newToken)
      isRefreshing.current = false
      return newToken
    } catch {
      localStorage.removeItem('access_token')
      setToken(null)
      setUser(null)
      setAuthToken(null)
      isRefreshing.current = false
      return null
    }
  }, [])

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const url = error.config?.url || ''
        const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/register') || url.includes('/api/auth/refresh') || url.includes('/api/auth/logout')
        if (error.response?.status === 401 && !isAuthEndpoint && !error.config._retry) {
          error.config._retry = true
          const newToken = await tryRefresh()
          if (newToken) {
            error.config.headers['Authorization'] = `Bearer ${newToken}`
            return api(error.config)
          }
          if (!error.config._logoutCalled) {
            error.config._logoutCalled = true
            logout()
          }
        }
        return Promise.reject(error)
      }
    )
    return () => api.interceptors.response.eject(interceptor)
  }, [tryRefresh, logout])

  const fetchUser = useCallback(async () => {
    if (justLoggedIn.current) {
      justLoggedIn.current = false
      setLoading(false)
      return
    }
    const savedToken = localStorage.getItem('access_token')
    if (savedToken) {
      setAuthToken(savedToken)
      setToken(savedToken)
    }
    try {
      const res = await api.get('/api/auth/me')
      setUser(res.data.data)
    } catch {
      const newToken = await tryRefresh()
      if (newToken) {
        try {
          const res = await api.get('/api/auth/me')
          setUser(res.data.data)
        } catch {
          logout()
        }
      }
    } finally {
      setLoading(false)
    }
  }, [tryRefresh, logout])

  useEffect(() => { fetchUser() }, [fetchUser])

  const login = async (username, password) => {
    try {
      const res = await api.post('/api/auth/login', { username, password })
      const { user: u, token: t } = res.data.data
      localStorage.setItem('access_token', t)
      justLoggedIn.current = true
      setToken(t)
      setAuthToken(t)
      setUser(u)
      setLoading(false)
      return u
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  const register = async (data) => {
    try {
      const res = await api.post('/api/auth/register', data)
      const { user: u, token: t } = res.data.data
      localStorage.setItem('access_token', t)
      justLoggedIn.current = true
      setToken(t)
      setAuthToken(t)
      setUser(u)
      setLoading(false)
      return u
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}