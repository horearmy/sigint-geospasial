import { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function useSocket(token) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!token) return

    let s
    try {
      s = getSocket()
      socketRef.current = s
      s.auth = { token }
      s.connect()

      s.on('connect', () => setConnected(true))
      s.on('disconnect', () => setConnected(false))
      s.on('connect_error', () => setConnected(false))
    } catch (err) {
      console.warn('Socket connection failed:', err)
    }

    return () => {
      if (s) {
        s.off('connect')
        s.off('disconnect')
        s.off('connect_error')
      }
    }
  }, [token])

  const on = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler)
      return () => { if (socketRef.current) socketRef.current.off(event, handler) }
    }
    return () => {}
  }, [])

  const emit = useCallback((event, data) => {
    if (socketRef.current) socketRef.current.emit(event, data)
  }, [])

  return { connected, on, emit }
}

export function useRealtimeLaporan(token, onNewLaporan, onUpdateLaporan, onDeleteLaporan) {
  const { connected, on } = useSocket(token)

  useEffect(() => {
    if (!connected) return
    const unsubs = []
    if (onNewLaporan) unsubs.push(on('laporan:created', onNewLaporan))
    if (onUpdateLaporan) unsubs.push(on('laporan:updated', onUpdateLaporan))
    if (onDeleteLaporan) unsubs.push(on('laporan:deleted', onDeleteLaporan))
    return () => unsubs.forEach(fn => fn())
  }, [connected, on, onNewLaporan, onUpdateLaporan, onDeleteLaporan])

  return connected
}

export function useRealtimeNotifications(token, onNotification) {
  const { connected, on } = useSocket(token)

  useEffect(() => {
    if (!connected || !onNotification) return
    return on('notification:new', onNotification)
  }, [connected, on, onNotification])

  return connected
}
