import { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
      timeout: 15000,
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function useSocket(token) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)
  const tokenRef = useRef(token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    if (!token) return

    let mounted = true
    let s
    try {
      s = getSocket()
      socketRef.current = s
      s.auth = { token }
      if (!s.connected) {
        s.connect()
      }
      const onConnect = () => { if (mounted) setConnected(true) }
      const onDisconnect = () => { if (mounted) setConnected(false) }
      const onError = () => { if (mounted) setConnected(false) }
      s.on('connect', onConnect)
      s.on('disconnect', onDisconnect)
      s.on('connect_error', onError)
      if (s.connected) setConnected(true)
    } catch (err) {
      console.warn('Socket connection failed:', err)
    }

    return () => {
      mounted = false
      if (s) {
        s.off('connect')
        s.off('disconnect')
        s.off('connect_error')
        if (s.connected) {
          s.disconnect()
        }
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
  const handlersRef = useRef({ onNewLaporan, onUpdateLaporan, onDeleteLaporan })

  useEffect(() => {
    handlersRef.current = { onNewLaporan, onUpdateLaporan, onDeleteLaporan }
  }, [onNewLaporan, onUpdateLaporan, onDeleteLaporan])

  useEffect(() => {
    if (!connected) return
    const unsubs = []
    if (handlersRef.current.onNewLaporan) {
      unsubs.push(on('laporan:created', (data) => handlersRef.current.onNewLaporan(data)))
    }
    if (handlersRef.current.onUpdateLaporan) {
      unsubs.push(on('laporan:updated', (data) => handlersRef.current.onUpdateLaporan(data)))
    }
    if (handlersRef.current.onDeleteLaporan) {
      unsubs.push(on('laporan:deleted', (data) => handlersRef.current.onDeleteLaporan(data)))
    }
    return () => unsubs.forEach(fn => fn())
  }, [connected, on])

  return connected
}

export function useRealtimeNotifications(token, onNotification) {
  const { connected, on } = useSocket(token)
  const handlerRef = useRef(onNotification)

  useEffect(() => {
    handlerRef.current = onNotification
  }, [onNotification])

  useEffect(() => {
    if (!connected || !handlerRef.current) return
    return on('notification:new', (data) => handlerRef.current(data))
  }, [connected, on])

  return connected
}