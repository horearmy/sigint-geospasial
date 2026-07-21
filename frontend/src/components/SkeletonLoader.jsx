import { motion } from 'framer-motion'

export function SkeletonCard() {
  return (
    <div className="skeleton-card skeleton" />
  )
}

export function SkeletonKpi() {
  return (
    <div className="skeleton-kpi skeleton" />
  )
}

export function SkeletonLine({ width = '100%', height = 16 }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius: 6, marginBottom: 8 }} />
  )
}

export function SkeletonCircle({ size = 40 }) {
  return (
    <div className="skeleton" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />
  )
}

export function DashboardSkeleton() {
  return (
    <motion.div className="dashboard"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="dashboard-header">
        <SkeletonLine width="240px" height={28} />
        <SkeletonLine width="320px" height={16} />
      </div>
      <div className="kpi-grid">
        {[1, 2, 3, 4].map(i => <SkeletonKpi key={i} />)}
      </div>
      <div className="chart-grid">
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      </div>
    </motion.div>
  )
}

export function ListSkeleton({ count = 5 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card skeleton" style={{
          height: 90, marginBottom: 8, borderRadius: 10,
          animationDelay: `${i * 0.1}s`
        }} />
      ))}
    </div>
  )
}
