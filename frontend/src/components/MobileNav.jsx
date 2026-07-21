import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function MobileNav({ currentView, setCurrentView, onPanel, user, logout }) {
  const [open, setOpen] = useState(false)

  const navItems = [
    { icon: '📊', label: 'Dashboard', onClick: () => { setCurrentView('dashboard'); setOpen(false) } },
    { icon: '🗺️', label: 'Peta', onClick: () => { setCurrentView('map'); setOpen(false) } },
    { icon: '⏱️', label: 'Timeline', onClick: () => { onPanel('timeline'); setOpen(false) } },
    { icon: '🧠', label: 'Analisis', onClick: () => { onPanel('analysis'); setOpen(false) } },
    { icon: '🛡️', label: 'Threat Zones', onClick: () => { onPanel('zones'); setOpen(false) } },
    { icon: '🔍', label: 'OSINT Feed', onClick: () => { onPanel('osint'); setOpen(false) } },
    { icon: '📋', label: 'Workflow', onClick: () => { onPanel('workflow'); setOpen(false) } },
    { icon: '📡', label: 'Live Tracking', onClick: () => { onPanel('tracking'); setOpen(false) } },
    { icon: '🛰️', label: 'Satelit', onClick: () => { onPanel('satellite'); setOpen(false) } },
    { icon: '🔮', label: 'Prediktif', onClick: () => { onPanel('predictive'); setOpen(false) } },
    { icon: '📝', label: 'Audit Log', onClick: () => { onPanel('audit'); setOpen(false) }, adminOnly: true },
  ]

  return (
    <>
      <button className="mobile-hamburger" onClick={() => setOpen(!open)}>
        <motion.span animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }} />
        <motion.span animate={open ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }} />
        <motion.span animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="mobile-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)} />
            <motion.div className="mobile-menu"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <div className="mobile-menu-header">
                <div className="mobile-menu-user">
                  <div className="mobile-menu-avatar">{user?.username?.[0]?.toUpperCase()}</div>
                  <div>
                    <div className="mobile-menu-name">{user?.username}</div>
                    <div className="mobile-menu-role">{user?.role}</div>
                  </div>
                </div>
              </div>
              <div className="mobile-menu-items">
                {navItems
                  .filter(item => !item.adminOnly || user?.role === 'admin')
                  .map((item, i) => (
                    <motion.button key={i} className="mobile-menu-item"
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={item.onClick}>
                      <span className="mobile-menu-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </motion.button>
                  ))}
              </div>
              <div className="mobile-menu-footer">
                <button className="mobile-menu-item mobile-menu-logout" onClick={() => { logout(); setOpen(false) }}>
                  <span className="mobile-menu-icon">🚪</span>
                  <span>Keluar</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
