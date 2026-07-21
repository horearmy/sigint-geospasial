import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('pwa-dismissed') === 'true'
  })

  useEffect(() => {
    if (dismissed) return
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShowPrompt(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [dismissed])

  useEffect(() => {
    const handler = () => { setShowPrompt(false); setDeferredPrompt(null) }
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log('PWA install outcome:', outcome)
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', 'true')
  }

  if (!showPrompt || dismissed) return null

  return (
    <AnimatePresence>
      <motion.div className="pwa-prompt-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={handleDismiss}>
        <motion.div className="pwa-prompt"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={e => e.stopPropagation()}>
          <div className="pwa-prompt-icon">🌐</div>
          <h3>Install SIGINT KOSTRAD</h3>
          <p>Install aplikasi ini di perangkat kamu untuk akses lebih cepat dan pengalaman terbaik.</p>
          <div className="pwa-prompt-actions">
            <button className="btn btn-primary" onClick={handleInstall}>
              📲 Install
            </button>
            <button className="btn btn-outline" onClick={handleDismiss}>
              Nanti saja
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
