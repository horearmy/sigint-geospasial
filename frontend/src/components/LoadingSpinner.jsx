import { motion } from 'framer-motion'

export default function LoadingSpinner({ text = 'Memuat data...' }) {
  return (
    <div className="loading-overlay">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div className="spinner" />
        <span style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>{text}</span>
      </motion.div>
    </div>
  )
}
