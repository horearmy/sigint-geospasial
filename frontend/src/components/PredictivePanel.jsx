import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Title, Tooltip, Legend, Filler, ArcElement,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import axios from 'axios'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler, ArcElement)

export default function PredictivePanel({ onClose }) {
  const [forecast, setForecast] = useState(null)
  const [riskScores, setRiskScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('forecast')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [f, r] = await Promise.all([
        axios.get('/api/predictive/forecast'),
        axios.get('/api/predictive/risk-score'),
      ])
      setForecast(f.data.data)
      setRiskScores(r.data.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const trendChartData = forecast ? {
    labels: forecast.forecasts.map(f => f.kategori.substring(0, 8)),
    datasets: [
      {
        label: 'Rata-rata/Hari',
        data: forecast.forecasts.map(f => parseFloat(f.avg_daily)),
        backgroundColor: 'rgba(27, 67, 50, 0.7)',
        borderRadius: 4,
      },
      {
        label: '7 Hari Terakhir',
        data: forecast.forecasts.map(f => f.last_7d / 7),
        backgroundColor: 'rgba(27, 67, 50, 0.7)',
        borderRadius: 4,
      },
    ],
  } : null

  const riskDoughnut = riskScores.length > 0 ? {
    labels: riskScores.map(r => r.kategori),
    datasets: [{
      data: riskScores.map(r => r.count),
      backgroundColor: riskScores.map(r => {
        const colors = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }
        return colors[r.risk_level] || '#64748b'
      }),
      borderWidth: 2, borderColor: 'white',
    }],
  } : null

  const riskLevelColors = {
    CRITICAL: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' },
    HIGH: { bg: '#fff7ed', border: '#f97316', text: '#ea580c' },
    MEDIUM: { bg: '#fefce8', border: '#eab308', text: '#ca8a04' },
    LOW: { bg: '#f0fdf4', border: '#22c55e', text: '#16a34a' },
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <motion.div className="form-panel" style={{ maxWidth: '800px' }}
        onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="form-panel-header">
          <h2>🤖 Predictive Analytics (AI)</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '2px', padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          {[['forecast', '📈 Forecast'], ['risk', '🎯 Risk Score'], ['recommend', '💡 Rekomendasi']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === tab ? '#1b4332' : 'transparent',
                color: activeTab === tab ? 'white' : '#64748b',
                fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s',
              }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Menganalisis data...</div>
          ) : (
            <>
              {activeTab === 'forecast' && forecast && (
                <div>
                  {forecast.summary && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                      <div style={{ padding: '14px', borderRadius: '8px', background: '#f0f7ff', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1b4332' }}>{forecast.summary.total_90d || 0}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Total 90 Hari</div>
                      </div>
                      <div style={{ padding: '14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{parseFloat(forecast.summary.avg_per_day || 0).toFixed(1)}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Rata-rata/Hari</div>
                      </div>
                      <div style={{ padding: '14px', borderRadius: '8px', background: '#fefce8', border: '1px solid #fde68a', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ca8a04' }}>{forecast.summary.last_7d || 0}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>7 Hari Terakhir</div>
                      </div>
                    </div>
                  )}

                  {trendChartData && (
                    <div style={{ background: 'white', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Perbandingan Trend per Kategori</h3>
                      <div style={{ height: '220px' }}>
                        <Bar data={trendChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>Detail Forecast per Kategori</div>
                  {forecast.forecasts.map((f, i) => {
                    const trend = parseFloat(f.trend_pct)
                    return (
                      <div key={i} style={{
                        padding: '10px 14px', borderRadius: '8px', marginBottom: '6px',
                        background: '#f8fafc', border: '1px solid #e2e8f0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <div>
                          <strong style={{ fontSize: '0.88rem' }}>{f.kategori}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Avg: {f.avg_daily}/hari</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '0.82rem', fontWeight: 600,
                            color: trend > 0 ? '#ef4444' : trend < 0 ? '#1b4332' : '#64748b',
                          }}>
                            {trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️'} {trend > 0 ? '+' : ''}{f.trend_pct}%
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>7d vs prev 7d</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTab === 'risk' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Risk Distribution</h3>
                      {riskDoughnut && (
                        <div style={{ height: '250px' }}>
                          <Doughnut data={riskDoughnut} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } } }} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Risk Level per Kategori</h3>
                      {riskScores.map((r, i) => {
                        const style = riskLevelColors[r.risk_level] || riskLevelColors.LOW
                        return (
                          <div key={i} style={{
                            padding: '10px 14px', borderRadius: '8px', marginBottom: '6px',
                            background: style.bg, borderLeft: `4px solid ${style.border}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '0.88rem', color: style.text }}>{r.kategori}</strong>
                              <span style={{
                                padding: '2px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                                background: style.border, color: 'white',
                              }}>{r.risk_level}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                              {r.count} insiden ({r.risk_pct}% dari total 30 hari)
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'recommend' && (
                <div>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '16px' }}>💡 Rekomendasi Mitigasi</h3>
                  {riskScores.filter(r => r.risk_level === 'CRITICAL' || r.risk_level === 'HIGH').map((r, i) => (
                    <div key={i} style={{
                      padding: '14px 16px', borderRadius: '8px', marginBottom: '10px',
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{r.risk_level === 'CRITICAL' ? '🚨' : '⚠️'}</span>
                        <strong style={{ fontSize: '0.92rem' }}>{r.kategori}</strong>
                        <span style={{
                          padding: '2px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700,
                          background: r.risk_level === 'CRITICAL' ? '#ef4444' : '#f97316',
                          color: 'white',
                        }}>{r.risk_level}</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>
                        {r.kategori === 'Banjir' && <>
                          <li>Perkuat tanggul dan sistem drainase</li>
                          <li>Siapkan evakuasi di area rawan banjir</li>
                          <li>Pasang sensor ketinggian air</li>
                        </>}
                        {r.kategori === 'Gempa Bumi' && <>
                          <li>Periksa struktur bangunan kritis</li>
                          <li>Siapkan perlengkapan darurat</li>
                          <li>Lakukan simulasi evakuasi berkala</li>
                        </>}
                        {r.kategori === 'Kebakaran' && <>
                          <li>Bersihkan area dari bahan mudah terbakar</li>
                          <li>Siapkan alat pemadam api</li>
                          <li>Buat jalur evakuasi kebakaran</li>
                        </>}
                        {r.kategori === 'Longsor' && <>
                          <li>Pantau area dengan slope curam</li>
                          <li> Tanam vegetasi penahan longsor</li>
                          <li>Evakuasi warga dari zona rawan</li>
                        </>}
                        {!['Banjir', 'Gempa Bumi', 'Kebakaran', 'Longsor'].includes(r.kategori) && <>
                          <li>Tingkatkan pemantauan di area risk tinggi</li>
                          <li>Siapkan tim respons cepat</li>
                          <li>Buat rencana mitigasi khusus</li>
                        </>}
                      </ul>
                    </div>
                  ))}
                  {riskScores.filter(r => r.risk_level === 'CRITICAL' || r.risk_level === 'HIGH').length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#22c55e' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
                      <p style={{ fontWeight: 600 }}>Semua kategori dalam level rendah</p>
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Tidak ada rekomendasi mitigasi khusus saat ini</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
