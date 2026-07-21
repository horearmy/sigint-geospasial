import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SHORTCUTS = [
  { key: 'D', label: 'Dashboard', action: 'view', value: 'dashboard' },
  { key: 'M', label: 'Peta', action: 'view', value: 'map' },
  { key: 'N', label: 'Laporan Baru', action: 'newReport' },
  { key: 'T', label: 'Timeline', action: 'panel', value: 'timeline' },
  { key: 'A', label: 'Analisis', action: 'panel', value: 'analysis' },
  { key: 'Z', label: 'Threat Zones', action: 'panel', value: 'zones' },
  { key: 'O', label: 'OSINT Feed', action: 'panel', value: 'osint' },
  { key: 'W', label: 'Workflow', action: 'panel', value: 'workflow' },
  { key: 'L', label: 'Live Tracking', action: 'panel', value: 'tracking' },
  { key: 'S', label: 'Satelit', action: 'panel', value: 'satellite' },
  { key: 'P', label: 'Prediktif', action: 'panel', value: 'predictive' },
  { key: 'K', label: 'Mode Gelap', action: 'theme' },
  { key: '/', label: 'Cari', action: 'search' },
  { key: '?', label: 'Shortcuts', action: 'help' },
  { key: 'Esc', label: 'Tutup Panel', action: 'close' },
]

export default function KeyboardShortcutsHandler({ onAction }) {
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      const key = e.key.toUpperCase()

      if (key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowHelp(prev => !prev)
        return
      }

      if (key === 'ESCAPE') {
        setShowHelp(false)
        onAction({ action: 'close' })
        return
      }

      const shortcut = SHORTCUTS.find(s => s.key === key)
      if (shortcut && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        onAction(shortcut)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onAction])

  return (
    <AnimatePresence>
      {showHelp && (
        <motion.div className="shortcut-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowHelp(false)}>
          <motion.div className="shortcut-panel"
            initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={e => e.stopPropagation()}>
            <h3>⌨️ Keyboard Shortcuts</h3>
            <div className="shortcut-grid">
              {SHORTCUTS.filter(s => s.action !== 'help').map((s) => (
                <div key={s.key} className="shortcut-row">
                  <kbd>{s.key}</kbd>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
