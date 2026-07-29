import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCoordinate } from '../utils/coordinates'

export default function ExportMenu({ laporan, onExportJSON, onExportCSV, onExportPDF, onExportDOC, onPrint, onCopyCoords }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewType, setPreviewType] = useState(null)
  const menuRef = useRef(null)

  const lat = parseFloat(laporan.latitude)
  const lng = parseFloat(laporan.longitude)

  const allImages = [laporan.gambar, ...((() => {
    try { return typeof laporan.gambar_lain === 'string' ? JSON.parse(laporan.gambar_lain) : (laporan.gambar_lain || []) } catch { return [] }
  })())].filter(Boolean)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
        setShowPreview(false)
        setPreviewType(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePreview = (type) => {
    setPreviewType(type)
    setShowPreview(true)
  }

  const handleDownload = () => {
    if (previewType === 'pdf') onExportPDF()
    else if (previewType === 'docx') onExportDOC()
    setShowPreview(false)
    setPreviewType(null)
    setIsOpen(false)
  }

  const handleClosePreview = () => {
    setShowPreview(false)
    setPreviewType(null)
  }

  const PDFPreview = () => (
    <div className="export-preview-content">
      <div className="preview-header" style={{ background: '#1e40af', color: 'white', padding: '20px', textAlign: 'center', borderRadius: '8px 8px 0 0' }}>
        <div style={{ fontSize: '10px', opacity: 0.9 }}>SIGINT - Sistem Intelijen Geospasial</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '8px' }}>{laporan.judul}</div>
        <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.9 }}>{laporan.kategori}</div>
      </div>
      <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none' }}>
        {allImages.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: allImages.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: '8px', marginBottom: '16px' }}>
            {allImages.map((img, idx) => (
              <img key={idx} src={`/uploads/${img}`} alt={`${laporan.judul} ${idx + 1}`} style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>ID Laporan</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#000000' }}>#{laporan.id}</div>
          </div>
          <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Tanggal</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#000000' }}>{new Date(laporan.created_at).toLocaleDateString('id-ID')}</div>
          </div>
          <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Lokasi</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#000000' }}>{laporan.lokasi_nama || '-'}</div>
          </div>
          <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>Koordinat</div>
            <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: '#000000' }}>{lat.toFixed(4)}, {lng.toFixed(4)}</div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#1e40af', color: 'white' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Sistem</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Nilai</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#000000' }}>DD</td><td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#000000' }}>{lat.toFixed(6)}, {lng.toFixed(6)}</td></tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}><td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#000000' }}>MGRS</td><td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#000000' }}>{formatCoordinate(lat, lng, 'mgrs')}</td></tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#000000' }}>UTM</td><td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#000000' }}>{formatCoordinate(lat, lng, 'utm')}</td></tr>
            <tr><td style={{ padding: '6px 8px', fontFamily: 'monospace', background: '#f8fafc', color: '#000000' }}>DMS</td><td style={{ padding: '6px 8px', fontFamily: 'monospace', background: '#f8fafc', color: '#000000' }}>{formatCoordinate(lat, lng, 'dms')}</td></tr>
          </tbody>
        </table>
        {laporan.deskripsi && (
          <div style={{ marginTop: '12px', padding: '10px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Deskripsi</div>
            <div style={{ fontSize: '11px', lineHeight: 1.5, color: '#000000' }}>{laporan.deskripsi}</div>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', padding: '10px', fontSize: '8px', color: '#94a3b8', borderTop: '1px solid #e2e8f0' }}>
        Dokumen ini dibuat secara otomatis oleh SIGINT - Sistem Intelijen Geospasial
      </div>
    </div>
  )

  const DOCXPreview = () => (
    <div className="export-preview-content">
      <div style={{ padding: '20px', background: 'white', fontFamily: 'Cambria, serif' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1e40af', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '1px' }}>SIGINT - SISTEM INTELIJEN GEOSPASIAL</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#000000', marginTop: '8px' }}>{laporan.judul}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Kategori: {laporan.kategori}</div>
        </div>

        {allImages.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: allImages.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: '8px', marginBottom: '16px' }}>
            {allImages.map((img, idx) => (
              <img key={idx} src={`/uploads/${img}`} alt={`${laporan.judul} ${idx + 1}`} style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
            ))}
          </div>
        )}

        <div style={{ fontSize: '13px', color: '#000000', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
          INFORMASI LAPORAN
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11px' }}>
          <tbody>
            <tr><td style={{ padding: '5px 8px', width: '30%', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>ID Laporan</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>#{laporan.id}</td></tr>
            <tr><td style={{ padding: '5px 8px', color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>Tanggal Dibuat</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', color: '#000000' }}>{new Date(laporan.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
            <tr><td style={{ padding: '5px 8px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Lokasi</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>{laporan.lokasi_nama || '-'}</td></tr>
            <tr><td style={{ padding: '5px 8px', color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>Latitude</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', color: '#000000' }}>{lat.toFixed(6)}</td></tr>
            <tr><td style={{ padding: '5px 8px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Longitude</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>{lng.toFixed(6)}</td></tr>
          </tbody>
        </table>

        <div style={{ fontSize: '13px', color: '#000000', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
          KOORDINAT
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '10px', fontFamily: 'Courier New, monospace' }}>
          <tbody>
            <tr><td style={{ padding: '5px 8px', width: '25%', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>DD</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>{lat.toFixed(6)}, {lng.toFixed(6)}</td></tr>
            <tr style={{ background: '#f8fafc' }}><td style={{ padding: '5px 8px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>MGRS</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>{formatCoordinate(lat, lng, 'mgrs')}</td></tr>
            <tr><td style={{ padding: '5px 8px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>UTM</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>{formatCoordinate(lat, lng, 'utm')}</td></tr>
            <tr style={{ background: '#f8fafc' }}><td style={{ padding: '5px 8px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>DMS</td><td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', color: '#000000' }}>{formatCoordinate(lat, lng, 'dms')}</td></tr>
          </tbody>
        </table>

        {laporan.deskripsi && (
          <>
            <div style={{ fontSize: '13px', color: '#000000', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              DESKRIPSI
            </div>
            <div style={{ fontSize: '11px', lineHeight: 1.6, marginBottom: '16px', textAlign: 'justify', color: '#000000' }}>
              {laporan.deskripsi}
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', fontSize: '9px', color: '#94a3b8', fontStyle: 'italic' }}>
          Dokumen ini dibuat secara otomatis oleh SIGINT - Sistem Intelijen Geospasial<br />Hanya untuk penggunaan internal
        </div>
      </div>
    </div>
  )

  return (
    <div className="export-menu-wrapper" ref={menuRef}>
      <button className="detail-form-btn export-trigger" onClick={() => setIsOpen(!isOpen)}>
        📥 Export
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="export-popup"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className="export-popup-header">
              <span>Export Laporan</span>
              <button className="export-popup-close" onClick={() => { setIsOpen(false); setShowPreview(false); setPreviewType(null) }}>✕</button>
            </div>

            <AnimatePresence mode="wait">
              {!showPreview ? (
                <motion.div
                  key="menu"
                  className="export-popup-menu"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button className="export-popup-item" onClick={onCopyCoords}>
                    <span className="export-popup-icon">📋</span>
                    <div>
                      <div className="export-popup-label">Salin Koordinat</div>
                      <div className="export-popup-desc">Salin koordinat ke clipboard</div>
                    </div>
                  </button>
                  <button className="export-popup-item" onClick={() => { onExportJSON(); setIsOpen(false) }}>
                    <span className="export-popup-icon">📄</span>
                    <div>
                      <div className="export-popup-label">Export JSON</div>
                      <div className="export-popup-desc">Format data terstruktur</div>
                    </div>
                  </button>
                  <button className="export-popup-item" onClick={() => { onExportCSV(); setIsOpen(false) }}>
                    <span className="export-popup-icon">📊</span>
                    <div>
                      <div className="export-popup-label">Export CSV</div>
                      <div className="export-popup-desc">Format spreadsheet</div>
                    </div>
                  </button>
                  <button className="export-popup-item" onClick={() => handlePreview('pdf')}>
                    <span className="export-popup-icon">📕</span>
                    <div>
                      <div className="export-popup-label">Export PDF</div>
                      <div className="export-popup-desc">Dokumen PDF dengan format rapi</div>
                    </div>
                  </button>
                  <button className="export-popup-item" onClick={() => handlePreview('docx')}>
                    <span className="export-popup-icon">📝</span>
                    <div>
                      <div className="export-popup-label">Export DOCX</div>
                      <div className="export-popup-desc">Microsoft Word document</div>
                    </div>
                  </button>
                  <button className="export-popup-item" onClick={() => { onPrint(); setIsOpen(false) }}>
                    <span className="export-popup-icon">🖨️</span>
                    <div>
                      <div className="export-popup-label">Cetak</div>
                      <div className="export-popup-desc">Print via browser</div>
                    </div>
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="preview"
                  className="export-preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="export-preview-header">
                    <button className="export-preview-back" onClick={handleClosePreview}>← Kembali</button>
                    <span className="export-preview-title">Preview {previewType === 'pdf' ? 'PDF' : 'DOCX'}</span>
                  </div>
                  <div className="export-preview-scroll">
                    {previewType === 'pdf' ? <PDFPreview /> : <DOCXPreview />}
                  </div>
                  <div className="export-preview-footer">
                    <button className="detail-form-btn secondary" onClick={handleClosePreview}>Batal</button>
                    <button className="detail-form-btn primary" onClick={handleDownload}>
                      📥 Download {previewType === 'pdf' ? 'PDF' : 'DOCX'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
