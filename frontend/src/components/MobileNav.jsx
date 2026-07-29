import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function BottomNavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      flex: 1, border: 'none', background: 'none', cursor: 'pointer',
      padding: '6px 4px', minHeight: 44, color: active ? 'var(--primary)' : 'var(--text-light)',
      fontSize: '0.55rem', fontWeight: active ? 700 : 500, transition: 'color 0.2s',
      WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
    }}>
      <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

export default function MobileNav({ currentView, setCurrentView, onPanel, user, logout }) {
  const [open, setOpen] = useState(false)

  const mainNav = [
    { icon: '📊', label: 'Dashboard', key: 'dashboard' },
    { icon: '🗺️', label: 'Peta', key: 'map' },
    { icon: '📍', label: 'Bapulket', key: 'lapangan' },
    { icon: '📋', label: 'Menu', key: 'menu', isMenu: true },
  ]

  const menuItems = [
    { icon: '⏱️', label: 'Timeline', onClick: () => { onPanel('timeline'); setOpen(false) } },
    { icon: '🧠', label: 'Analisis', onClick: () => { onPanel('analysis'); setOpen(false) } },
    { icon: '🛡️', label: 'Threat Zones', onClick: () => { onPanel('zones'); setOpen(false) } },
    { icon: '🔍', label: 'OSINT Feed', onClick: () => { onPanel('osint'); setOpen(false) } },
    { icon: '📋', label: 'Workflow', onClick: () => { onPanel('workflow'); setOpen(false) } },
    { icon: '📡', label: 'Live Tracking', onClick: () => { onPanel('tracking'); setOpen(false) } },
    { icon: '🛰️', label: 'Satelit', onClick: () => { onPanel('satellite'); setOpen(false) } },
    { icon: '🔮', label: 'Prediktif', onClick: () => { onPanel('predictive'); setOpen(false) } },
    ...(user?.role === 'admin' ? [{ icon: '📝', label: 'Audit Log', onClick: () => { onPanel('audit'); setOpen(false) } }] : []),
  ]

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="mobile-bottom-nav" style={{
        display: 'none',
        position: 'fixed', bottom: 0, left: 0, right: 0,
        paddingBottom: 'var(--safe-bottom)',
        background: 'rgba(7, 17, 10, 0.95)',
        borderTop: '1px solid rgba(61, 220, 132, 0.15)',
        backdropFilter: 'blur(12px)',
        zIndex: 950,
      }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {mainNav.map(item => {
            if (item.isMenu) {
              return (
                <BottomNavItem key={item.key} icon={item.icon} label={item.label}
                  active={open} onClick={() => setOpen(!open)} />
              )
            }
            return (
              <BottomNavItem key={item.key} icon={item.icon} label={item.label}
                active={currentView === item.key}
                onClick={() => setCurrentView(item.key)} />
            )
          })}
        </div>
      </div>

      {/* Hamburger (mobile fallback) */}
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
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <div style={{
                display: 'flex', justifyContent: 'center', padding: '10px 0 4px',
              }}>
                <div style={{
                  width: 36, height: 4, borderRadius: 2,
                  background: 'rgba(255,255,255,0.2)',
                }} />
              </div>
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
                {menuItems.map((item, i) => (
                  <motion.button key={i} className="mobile-menu-item"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
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
