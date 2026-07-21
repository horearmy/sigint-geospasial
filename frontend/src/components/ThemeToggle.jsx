import { motion } from 'framer-motion'

export default function ThemeToggle({ theme, setTheme }) {
  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      title={theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -90, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </motion.span>
    </button>
  )
}
