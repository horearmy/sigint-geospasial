import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import { useAnimatedCounter } from '../hooks/useAnimatedCounter'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler
)

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } },
}

function AnimatedKpiCard({ icon, iconBg, iconColor, value, label, trend, trendDir = 'up', trendColor, delay = 0 }) {
  const animatedValue = useAnimatedCounter(typeof value === 'number' ? value : 0, 1200)
  const displayValue = typeof value === 'number' ? animatedValue : value

  return (
    <motion.div className="kpi-card" variants={item}
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <motion.div className="kpi-icon"
        style={{ background: iconBg, color: iconColor }}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', delay: delay * 0.1, stiffness: 300, damping: 15 }}>
        {icon}
      </motion.div>
      <div className="kpi-value">{displayValue}</div>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-trend ${trendDir}`} style={{ color: trendColor }}>
        {trend}
      </div>
    </motion.div>
  )
}

export default function Dashboard({ laporan, stats, getKategoriColor, getKategoriIcon }) {
  const chartData = useMemo(() => {
    if (!laporan.length) return null

    const now = new Date()
    const days = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
      days[key] = 0
    }

    laporan.forEach((l) => {
      const d = new Date(l.created_at)
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24))
      if (diff <= 6) {
        const key = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
        if (days[key] !== undefined) days[key]++
      }
    })

    const lineData = {
      labels: Object.keys(days),
      datasets: [
        {
          label: 'Laporan per Hari',
          data: Object.values(days),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: 'white',
          pointBorderWidth: 2,
          borderWidth: 2.5,
          pointHoverRadius: 8,
          pointHoverBorderWidth: 3,
        },
      ],
    }

    const kategoriCount = {}
    laporan.forEach((l) => {
      kategoriCount[l.kategori] = (kategoriCount[l.kategori] || 0) + 1
    })

    const sortedKategori = Object.entries(kategoriCount)
      .sort((a, b) => b[1] - a[1])

    const doughnutData = {
      labels: sortedKategori.map(([k]) => k),
      datasets: [
        {
          data: sortedKategori.map(([, v]) => v),
          backgroundColor: sortedKategori.map(([k]) => getKategoriColor(k)),
          borderWidth: 3,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#ffffff',
          hoverOffset: 10,
        },
      ],
    }

    const hours = Array(24).fill(0)
    laporan.forEach((l) => {
      const h = new Date(l.created_at).getHours()
      hours[h]++
    })

    const barData = {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [
        {
          label: 'Laporan per Jam',
          data: hours,
          backgroundColor: (ctx) => {
            const chart = ctx.chart
            const { ctx: c, chartArea } = chart
            if (!chartArea) return 'rgba(99, 102, 241, 0.7)'
            const gradient = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)')
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0.8)')
            return gradient
          },
          borderColor: '#6366f1',
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 10,
        },
      ],
    }

    return { lineData, doughnutData, barData, kategoriCount, sortedKategori }
  }, [laporan, getKategoriColor])

  const recentActivity = useMemo(() => {
    return laporan.slice(0, 8).map((l) => ({
      ...l,
      timeAgo: getTimeAgo(l.created_at),
    }))
  }, [laporan])

  const highestKategori = stats?.by_kategori?.[0]

  const last24hCount = useMemo(() => {
    return laporan.filter((l) => {
      const diff = (Date.now() - new Date(l.created_at)) / (1000 * 60 * 60)
      return diff < 24
    }).length
  }, [laporan])

  if (!stats) return null

  return (
    <div className="dashboard">
      <motion.div className="dashboard-header" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2>Dashboard Analitik</h2>
        <p>Ringkasan data intelijen geospasial terkini</p>
      </motion.div>

      <motion.div className="kpi-grid" variants={container} initial="hidden" animate="show">
        <AnimatedKpiCard
          icon="📊" iconBg="rgba(37, 99, 235, 0.1)" iconColor="#2563eb"
          value={stats.total} label="Total Laporan"
          trend="📈 Semua data" trendDir="up" delay={0} />

        <AnimatedKpiCard
          icon="🏷️" iconBg="rgba(239, 68, 68, 0.1)" iconColor="#ef4444"
          value={stats.kategori_count} label="Kategori Aktif"
          trend={highestKategori ? `${getKategoriIcon(highestKategori.kategori)} ${highestKategori.kategori}` : '-'}
          trendDir="up" delay={1} />

        <AnimatedKpiCard
          icon="📅" iconBg="rgba(16, 185, 129, 0.1)" iconColor="#10b981"
          value={stats.latest ? new Date(stats.latest).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
          label="Laporan Terbaru"
          trend="🟢 Aktif" trendDir="up" trendColor="#10b981" delay={2} />

        <AnimatedKpiCard
          icon="⏱️" iconBg="rgba(245, 158, 11, 0.1)" iconColor="#f59e0b"
          value={last24hCount} label="24 Jam Terakhir"
          trend="🔴 Real-time" trendDir="up" trendColor="#f59e0b" delay={3} />
      </motion.div>

      {chartData && (
        <>
          <div className="chart-grid">
            <motion.div className="chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: 'spring' }}>
              <h3>📈 Tren Laporan 7 Hari</h3>
              <div className="chart-wrapper">
                <Line
                  data={chartData.lineData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                    scales: {
                      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
                      x: { grid: { display: false } },
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false },
                    animation: { duration: 1000, easing: 'easeOutQuart' },
                  }}
                />
              </div>
            </motion.div>

            <motion.div className="chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, type: 'spring' }}>
              <h3>🎯 Distribusi Kategori</h3>
              <div className="chart-wrapper">
                <Doughnut
                  data={chartData.doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8 } },
                    },
                    cutout: '60%',
                    animation: { animateRotate: true, duration: 1200 },
                  }}
                />
              </div>
            </motion.div>
          </div>

          <div className="chart-grid">
            <motion.div className="chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, type: 'spring' }}>
              <h3>🕐 Aktivitas per Jam</h3>
              <div className="chart-wrapper">
                <Bar
                  data={chartData.barData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
                      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
                    },
                    animation: { duration: 800, easing: 'easeOutQuart' },
                  }}
                />
              </div>
            </motion.div>

            <motion.div className="chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, type: 'spring' }}>
              <h3>📋 Aktivitas Terbaru</h3>
              <div className="activity-feed">
                {recentActivity.map((a, i) => (
                  <motion.div
                    key={a.id}
                    className="activity-item"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i, type: 'spring', stiffness: 200 }}>
                    <div className="activity-dot" style={{ background: getKategoriColor(a.kategori) }} />
                    <div>
                      <div className="activity-text">
                        <strong>{a.judul}</strong>
                        {a.lokasi_nama && ` - ${a.lokasi_nama}`}
                      </div>
                      <div className="activity-time">{a.timeAgo}</div>
                    </div>
                  </motion.div>
                ))}
                {recentActivity.length === 0 && (
                  <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>
                    Belum ada aktivitas
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}

      {!chartData && (
        <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="icon">📊</div>
          <p>Belum ada data untuk ditampilkan di dashboard</p>
          <p style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--text-light)' }}>
            Tambahkan laporan untuk melihat analitik
          </p>
        </motion.div>
      )}
    </div>
  )
}

function getTimeAgo(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return 'Baru saja'
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
