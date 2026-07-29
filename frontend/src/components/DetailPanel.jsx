import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../contexts/ToastContext'
import { formatCoordinate } from '../utils/coordinates'
import ExportMenu from './ExportMenu'
import SignaturePad from './SignaturePad'
import { useAuth } from '../contexts/AuthContext'

function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

const KATEGORI_DESCRIPTIONS = {
  'Gangguan Keamanan': 'Laporan terkait gangguan keamanan seperti kriminalitas, konflik sosial, tawuran, dan narkotika.',
  'Separatisme': 'Laporan aktivitas kelompok separatis dan gerakan pembebasan di wilayah Indonesia.',
  'Terorisme': 'Laporan aktivitas terorisme, jaringan teroris, dan ancaman bom.',
  'Radikalisme': 'Laporan penyebaran ideologi ekstrem dan aktivitas propaganda radikal.',
  'Keamanan Nasional': 'Laporan terkait sabotase, spionase, ancaman siber, dan infrastruktur strategis.',
  'Politik': 'Laporan dinamika politik, demonstrasi, konflik elit, dan potensi kerawanan.',
  'Sosial': 'Laporan konflik SARA, bencana, kerusuhan, dan migrasi.',
  'Ekonomi': 'Laporan penimbunan, inflasi, penyelundupan, dan gangguan distribusi.',
  'Informasi Lain': 'Laporan isu viral, disinformasi, hoaks, dan operasi pengaruh.',
}

export default function DetailPanel({ laporan, onEdit, onDelete, onClose, getKategoriColor, getKategoriIcon, onComment }) {
  const { user } = useAuth()
  const addToast = useToast()
  const [expandedDesc, setExpandedDesc] = useState(false)
  const [showAllCoords, setShowAllCoords] = useState(false)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [signed, setSigned] = useState(!!laporan.signature_url)

  const handleDelete = async () => {
    if (!confirm('Yakin ingin menghapus laporan ini?')) return
    const success = await onDelete(laporan.id)
    if (success) addToast('Laporan berhasil dihapus', 'success')
    else addToast('Gagal menghapus laporan', 'error')
  }

  const handleCopyCoords = () => {
    const text = `${laporan.judul}\nLokasi: ${laporan.lokasi_nama || '-'}\nDD: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nMGRS: ${formatCoordinate(lat, lng, 'mgrs')}\nUTM: ${formatCoordinate(lat, lng, 'utm')}\nDMS: ${formatCoordinate(lat, lng, 'dms')}`
    navigator.clipboard.writeText(text).then(() => {
      addToast('Koordinat berhasil disalin', 'success')
    }).catch(() => {
      addToast('Gagal menyalin koordinat', 'error')
    })
  }

  const handleExportJSON = () => {
    const data = {
      id: laporan.id,
      judul: laporan.judul,
      kategori: laporan.kategori,
      deskripsi: laporan.deskripsi,
      lokasi_nama: laporan.lokasi_nama,
      koordinat: { latitude: lat, longitude: lng },
      mgrs: formatCoordinate(lat, lng, 'mgrs'),
      utm: formatCoordinate(lat, lng, 'utm'),
      dms: formatCoordinate(lat, lng, 'dms'),
      gambar: laporan.gambar,
      created_at: laporan.created_at,
      updated_at: laporan.updated_at
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-${laporan.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    addToast('Export JSON berhasil', 'success')
  }

  const handleExportCSV = () => {
    const headers = ['ID', 'Judul', 'Kategori', 'Deskripsi', 'Lokasi', 'Latitude', 'Longitude', 'MGRS', 'UTM', 'DMS', 'Gambar', 'Tanggal Dibuat']
    const values = [
      laporan.id,
      `"${(laporan.judul || '').replace(/"/g, '""')}"`,
      `"${(laporan.kategori || '').replace(/"/g, '""')}"`,
      `"${(laporan.deskripsi || '').replace(/"/g, '""')}"`,
      `"${(laporan.lokasi_nama || '').replace(/"/g, '""')}"`,
      lat.toFixed(6),
      lng.toFixed(6),
      `"${formatCoordinate(lat, lng, 'mgrs')}"`,
      `"${formatCoordinate(lat, lng, 'utm')}"`,
      `"${formatCoordinate(lat, lng, 'dms')}"`,
      `"${laporan.gambar || ''}"`,
      `"${new Date(laporan.created_at).toLocaleDateString('id-ID')}"`
    ]
    const csv = [headers.join(','), values.join(',')].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-${laporan.id}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    addToast('Export CSV berhasil', 'success')
  }

  const handlePrint = () => {
    const imgs = [laporan.gambar, ...((() => {
      try { return typeof laporan.gambar_lain === 'string' ? JSON.parse(laporan.gambar_lain) : (laporan.gambar_lain || []) } catch { return [] }
    })())].filter(Boolean)

    const printWindow = window.open('', '_blank', 'noopener,noreferrer')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Laporan - ${escapeHtml(laporan.judul)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 3px solid #1e40af; padding-bottom: 15px; }
          .header h1 { color: #1e3a5f; font-size: 20px; margin: 0; }
          .header p { color: #666; font-size: 12px; margin-top: 5px; }
          .badge { background: #1e40af; color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; display: inline-block; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
          .info-label { font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .info-value { font-size: 14px; font-weight: 600; color: #1e293b; }
          .coords-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .coords-table th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 12px; border: 1px solid #e2e8f0; }
          .coords-table td { padding: 8px; font-size: 12px; border: 1px solid #e2e8f0; font-family: monospace; }
          .desc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-top: 15px; }
          .desc h3 { margin: 0 0 8px 0; font-size: 14px; color: #475569; }
          .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          .img-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
          .img-grid img { width: 100%; max-height: 250px; object-fit: cover; border: 1px solid #ddd; border-radius: 8px; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="badge">${escapeHtml(laporan.kategori)}</span>
          <h1>${escapeHtml(laporan.judul)}</h1>
          <p>SIGINT - Sistem Intelijen Geospasial | Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        ${imgs.length > 0 ? `<div class="img-grid">${imgs.map(img => `<img src="${window.location.origin}/uploads/${escapeHtml(img)}" />`).join('')}</div>` : ''}
        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">ID LAPORAN</div>
            <div class="info-value">#${escapeHtml(String(laporan.id))}</div>
          </div>
          <div class="info-box">
            <div class="info-label">TANGGAL DIBUAT</div>
            <div class="info-value">${new Date(laporan.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <div class="info-box">
            <div class="info-label">LOKASI</div>
            <div class="info-value">${escapeHtml(laporan.lokasi_nama) || '-'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">KOORDINAT (DD)</div>
            <div class="info-value">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
          </div>
        </div>
        <table class="coords-table">
          <tr><th>Sistem</th><th>Nilai</th></tr>
          <tr><td>DD</td><td>${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr>
          <tr><td>MGRS</td><td>${escapeHtml(formatCoordinate(lat, lng, 'mgrs'))}</td></tr>
          <tr><td>UTM</td><td>${escapeHtml(formatCoordinate(lat, lng, 'utm'))}</td></tr>
          <tr><td>DMS</td><td>${escapeHtml(formatCoordinate(lat, lng, 'dms'))}</td></tr>
        </table>
        ${laporan.deskripsi ? `
        <div class="desc">
          <h3>DESKRIPSI</h3>
          <p>${escapeHtml(laporan.deskripsi)}</p>
        </div>` : ''}
        <div class="footer">
          <p>Dokumen ini dibuat secara otomatis oleh SIGINT - Sistem Intelijen Geospasial</p>
          <p>Hanya untuk penggunaan internal</p>
        </div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExportPDF = () => {
    const imgs = [laporan.gambar, ...((() => {
      try { return typeof laporan.gambar_lain === 'string' ? JSON.parse(laporan.gambar_lain) : (laporan.gambar_lain || []) } catch { return [] }
    })())].filter(Boolean)

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan - ${escapeHtml(laporan.judul)}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #000; line-height: 1.5; padding: 0; font-size: 12px; }
  .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { font-size: 18px; color: #000; margin-top: 8px; }
  .header .subtitle { font-size: 11px; color: #666; }
  .badge { background: #1e40af; color: #fff; padding: 3px 12px; border-radius: 12px; font-size: 11px; display: inline-block; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .info-box { border: 1px solid #ccc; border-radius: 6px; padding: 10px; }
  .info-label { font-size: 9px; color: #666; text-transform: uppercase; margin-bottom: 3px; }
  .info-value { font-size: 13px; font-weight: 600; color: #000; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #1e40af; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
  td { padding: 7px 10px; border: 1px solid #ccc; font-size: 11px; font-family: monospace; color: #000; }
  tr:nth-child(even) td { background: #f5f5f5; }
  .section-title { font-size: 13px; font-weight: 700; color: #000; border-bottom: 2px solid #1e40af; padding-bottom: 5px; margin-bottom: 10px; margin-top: 20px; }
  .desc { border: 1px solid #ccc; border-radius: 6px; padding: 12px; margin-bottom: 20px; color: #000; font-size: 12px; }
  .footer { text-align: center; margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9px; color: #666; }
  .img-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
  .img-grid img { width: 100%; max-height: 250px; object-fit: cover; border: 1px solid #ccc; border-radius: 8px; }
</style>
</head>
<body>
  <div class="header">
    <span class="badge">${escapeHtml(laporan.kategori)}</span>
    <h1>${escapeHtml(laporan.judul)}</h1>
    <div class="subtitle">SIGINT - Sistem Intelijen Geospasial | Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>

  ${imgs.length > 0 ? `<div class="img-grid">${imgs.map(img => `<img src="${window.location.origin}/uploads/${escapeHtml(img)}" alt="${escapeHtml(laporan.judul)}" />`).join('')}</div>` : ''}

  <div class="info-grid">
    <div class="info-box"><div class="info-label">ID Laporan</div><div class="info-value">#${escapeHtml(String(laporan.id))}</div></div>
    <div class="info-box"><div class="info-label">Tanggal Dibuat</div><div class="info-value">${new Date(laporan.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
    <div class="info-box"><div class="info-label">Lokasi</div><div class="info-value">${escapeHtml(laporan.lokasi_nama) || '-'}</div></div>
    <div class="info-box"><div class="info-label">Koordinat (DD)</div><div class="info-value">${lat.toFixed(6)}, ${lng.toFixed(6)}</div></div>
  </div>

  <div class="section-title">KOORDINAT</div>
  <table>
    <tr><th style="width:25%">Sistem</th><th>Nilai</th></tr>
    <tr><td>DD</td><td>${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr>
    <tr><td>MGRS</td><td>${escapeHtml(formatCoordinate(lat, lng, 'mgrs'))}</td></tr>
    <tr><td>UTM</td><td>${escapeHtml(formatCoordinate(lat, lng, 'utm'))}</td></tr>
    <tr><td>DMS</td><td>${escapeHtml(formatCoordinate(lat, lng, 'dms'))}</td></tr>
  </table>

  ${laporan.deskripsi ? `
  <div class="section-title">DESKRIPSI</div>
  <div class="desc">${escapeHtml(laporan.deskripsi)}</div>` : ''}

  <div class="footer">
    <p>Dokumen ini dibuat secara otomatis oleh SIGINT - Sistem Intelijen Geospasial</p>
    <p>Hanya untuk penggunaan internal</p>
  </div>
</body></html>`

    const printWindow = window.open('', '_blank', 'noopener,noreferrer')
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
    addToast('PDF siap dicetak (pilih Save as PDF di dialog print)', 'success')
  }

  const handleExportDOC = async () => {
    try {
      const docxModule = await import('docx')
      const fileSaverModule = await import('file-saver')

      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, ImageRun } = docxModule
      const { saveAs } = fileSaverModule

      const imgs = [laporan.gambar, ...((() => {
        try { return typeof laporan.gambar_lain === 'string' ? JSON.parse(laporan.gambar_lain) : (laporan.gambar_lain || []) } catch { return [] }
      })())].filter(Boolean)

      let imageParagraphs = []
      for (const img of imgs) {
        try {
          const res = await fetch(`/uploads/${img}`)
          const blob = await res.blob()
          const buffer = await blob.arrayBuffer()
          const uint8 = new Uint8Array(buffer)
          imageParagraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [
                new ImageRun({
                  data: uint8,
                  transformation: { width: 450, height: 300 },
                  type: 'png'
                })
              ]
            })
          )
        } catch (imgErr) {
          console.warn('Gagal embed gambar ke DOCX:', imgErr)
        }
      }

      const labelStyle = { bold: true, size: 10, color: '64748B' }
      const valueStyle = { size: 11, color: '000000' }

      const makeRow = (label, value) => new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ ...labelStyle, text: label })] })],
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' } }
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ ...valueStyle, text: String(value || '-') })] })],
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' } }
          })
        ]
      })

      const coordRow = (sistem, nilai) => new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ bold: true, size: 10, text: sistem, font: 'Courier New', color: '000000' })] })],
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' } }
          }),
          new TableCell({
            width: { size: 75, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ size: 10, text: nilai, font: 'Courier New', color: '000000' })] })],
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' } }
          })
        ]
      })

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new TextRun({ bold: true, size: 14, color: '64748B', text: 'SIGINT - Sistem Intelijen Geospasial' })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 100 },
              children: [new TextRun({ bold: true, size: 28, color: '000000', text: laporan.judul })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
              children: [new TextRun({ size: 11, color: '64748B', text: `Kategori: ${laporan.kategori} | Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` })]
            }),
            ...imageParagraphs,
            new Paragraph({
              spacing: { before: 200, after: 100 },
              children: [new TextRun({ bold: true, size: 13, color: '000000', text: 'Informasi Laporan' })]
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                makeRow('ID Laporan', `#${laporan.id}`),
                makeRow('Tanggal Dibuat', new Date(laporan.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })),
                makeRow('Lokasi', laporan.lokasi_nama),
                makeRow('Latitude', lat.toFixed(6)),
                makeRow('Longitude', lng.toFixed(6))
              ]
            }),
            new Paragraph({
              spacing: { before: 300, after: 100 },
              children: [new TextRun({ bold: true, size: 13, color: '000000', text: 'Koordinat' })]
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                coordRow('DD', `${lat.toFixed(6)}, ${lng.toFixed(6)}`),
                coordRow('MGRS', formatCoordinate(lat, lng, 'mgrs')),
                coordRow('UTM', formatCoordinate(lat, lng, 'utm')),
                coordRow('DMS', formatCoordinate(lat, lng, 'dms'))
              ]
            }),
            ...(laporan.deskripsi ? [
              new Paragraph({
                spacing: { before: 300, after: 100 },
                children: [new TextRun({ bold: true, size: 13, color: '000000', text: 'Deskripsi' })]
              }),
              new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ size: 11, text: laporan.deskripsi, color: '000000' })]
              })
            ] : []),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
              children: [new TextRun({ size: 9, color: '94A3B8', italics: true, text: 'Dokumen ini dibuat secara otomatis oleh SIGINT - Sistem Intelijen Geospasial' })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ size: 9, color: '94A3B8', italics: true, text: 'Hanya untuk penggunaan internal' })]
            })
          ]
        }]
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `Laporan-${laporan.id}-${laporan.judul.replace(/\s+/g, '_')}.docx`)
      addToast('DOCX berhasil diunduh', 'success')
    } catch (err) {
      console.error('DOCX export error:', err)
      addToast('Gagal export DOCX', 'error')
    }
  }

  const allImages = (() => {
    const imgs = [laporan.gambar]
    try {
      const lain = typeof laporan.gambar_lain === 'string' ? JSON.parse(laporan.gambar_lain) : (laporan.gambar_lain || [])
      if (Array.isArray(lain)) imgs.push(...lain)
    } catch {}
    return imgs.filter(Boolean)
  })()

  const lat = parseFloat(laporan.latitude)
  const lng = parseFloat(laporan.longitude)
  const catColor = getKategoriColor(laporan.kategori)
  const catIcon = getKategoriIcon(laporan.kategori)
  const createdDate = new Date(laporan.created_at)
  const updatedDate = laporan.updated_at ? new Date(laporan.updated_at) : null

  return (
    <div className="detail-overlay" onClick={onClose}>
      <motion.div className="detail-form"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}>

        {/* FORM HEADER */}
        <div className="detail-form-header">
          <div className="detail-form-title-row">
            <div className="detail-form-title-left">
              <span className="kategori-badge" style={{ background: catColor }}>
                {catIcon} {laporan.kategori}
              </span>
              <h3 className="detail-form-title">{laporan.judul}</h3>
            </div>
            <button className="detail-form-close" onClick={onClose}>✕</button>
          </div>
          {laporan.lokasi_nama && (
            <div className="detail-form-location">📍 {laporan.lokasi_nama}</div>
          )}
          {KATEGORI_DESCRIPTIONS[laporan.kategori] && (
            <p className="detail-form-cat-desc">{KATEGORI_DESCRIPTIONS[laporan.kategori]}</p>
          )}
        </div>

        {/* FORM BODY */}
        <div className="detail-form-body">

          {/* IMAGES */}
          {allImages.length > 0 && (
            <div className={`detail-form-image-section ${allImages.length > 1 ? 'multi' : ''}`}>
              {allImages.map((img, idx) => (
                <div key={idx} className="detail-form-image-wrapper">
                  <img src={`/uploads/${img}`} alt={`${laporan.judul} ${idx + 1}`} className="detail-form-image" />
                  {allImages.length > 1 && <span className="detail-form-image-badge">{idx + 1}/{allImages.length}</span>}
                </div>
              ))}
            </div>
          )}

          {/* INFO GRID */}
          <div className="detail-form-grid">

            <div className="detail-form-field">
              <label className="detail-form-label">🆔 ID Laporan</label>
              <div className="detail-form-value mono">#{laporan.id}</div>
            </div>

            <div className="detail-form-field">
              <label className="detail-form-label">🕐 Tanggal Dibuat</label>
              <div className="detail-form-value">
                {createdDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                <span className="detail-form-time">{createdDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
              </div>
            </div>

            {updatedDate && (
              <div className="detail-form-field">
                <label className="detail-form-label">🔄 Terakhir Diupdate</label>
                <div className="detail-form-value">
                  {updatedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  <span className="detail-form-time">{updatedDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                </div>
              </div>
            )}

            {/* KOORDINAT */}
            <div className="detail-form-field full-width">
              <label className="detail-form-label">🗺️ Koordinat</label>
              <div className="detail-form-coords">
                <div className="detail-form-coord-item">
                  <span className="coord-tag">DD</span>
                  <span className="coord-val">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
                </div>
                <div className="detail-form-coord-item">
                  <span className="coord-tag mgrs">MGRS</span>
                  <span className="coord-val">{formatCoordinate(lat, lng, 'mgrs')}</span>
                </div>
                <div className="detail-form-coord-item">
                  <span className="coord-tag utm">UTM</span>
                  <span className="coord-val">{formatCoordinate(lat, lng, 'utm')}</span>
                </div>
                <div className="detail-form-coord-item">
                  <span className="coord-tag">DMS</span>
                  <span className="coord-val">{formatCoordinate(lat, lng, 'dms')}</span>
                </div>
              </div>
            </div>

            {/* EXPAND COORDS */}
            <AnimatePresence>
              {showAllCoords && (
                <motion.div className="detail-form-field full-width"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}>
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="detail-form-link"
                  >
                    🌐 Buka di Google Maps →
                  </a>
                </motion.div>
              )}
            </AnimatePresence>

            <button className="detail-form-toggle" onClick={() => setShowAllCoords(!showAllCoords)}>
              {showAllCoords ? '▲ Sembunyikan' : '▼ Tampilkan'} Google Maps
            </button>
          </div>

          {/* SIGNATURE STATUS */}
          <div className="detail-form-meta">
            <label className="detail-form-label">✍️ Status Tanda Tangan</label>
            <div className="detail-form-value">
              {signed ? (
                <span style={{ color: '#22C55E', fontWeight: 600 }}>
                  ✅ Ditandatangani
                  {laporan.signed_at && (
                    <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: '0.72rem', marginLeft: 6 }}>
                      {new Date(laporan.signed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </span>
              ) : (
                <span style={{ color: '#F59E0B' }}>⏳ Belum ditandatangani</span>
              )}
            </div>
            {signed && laporan.signature_url && (
              <div style={{ marginTop: 8 }}>
                <img src={laporan.signature_url} alt="Tanda Tangan"
                  style={{ maxHeight: 60, background: '#fff', borderRadius: 6, padding: '4px 12px' }} />
              </div>
            )}
          </div>

          {/* DESKRIPSI */}
          {laporan.deskripsi && (
            <div className="detail-form-desc-section">
              <label className="detail-form-label">📝 Deskripsi Laporan</label>
              <div className={`detail-form-desc ${expandedDesc ? 'expanded' : ''}`}>
                {laporan.deskripsi}
              </div>
              {laporan.deskripsi.length > 150 && (
                <button className="detail-form-toggle" onClick={() => setExpandedDesc(!expandedDesc)}>
                  {expandedDesc ? '▲ Lebih sedikit' : '▼ Baca selengkapnya'}
                </button>
              )}
            </div>
          )}

          {/* FITUR TAMBAHAN (placeholder untuk fitur baru) */}
          <div className="detail-form-extra" id="detail-extra-section">
            {/* Bagian ini bisa ditambahkan fitur baru */}
          </div>
        </div>

        {/* FORM FOOTER / ACTIONS */}
        <div className="detail-form-footer">
          <div className="detail-form-footer-left">
            <button className="detail-form-btn secondary" onClick={onComment}>
              💬 Komentar
            </button>
            <ExportMenu
              laporan={laporan}
              onExportJSON={handleExportJSON}
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              onExportDOC={handleExportDOC}
              onPrint={handlePrint}
              onCopyCoords={handleCopyCoords}
            />
          </div>
          <div className="detail-form-footer-right">
            {!signed && user?.role !== 'viewer' && (
              <button className="detail-form-btn primary" onClick={() => setShowSignaturePad(true)}
                style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c', borderColor: 'rgba(201,168,76,0.3)' }}>
                ✍️ Tanda Tangan
              </button>
            )}
            <button className="detail-form-btn danger" onClick={handleDelete}>
              🗑️ Hapus
            </button>
            <button className="detail-form-btn primary" onClick={() => onEdit(laporan)}>
              ✏️ Edit
            </button>
          </div>
        </div>
      </motion.div>

      {showSignaturePad && (
        <SignaturePad laporanId={laporan.id} onClose={() => setShowSignaturePad(false)}
          onSigned={(data) => {
            laporan.signature_url = data.signature_url
            laporan.signed_at = data.signed_at
            laporan.signed_by = data.signed_by
            setSigned(true)
          }} />
      )}
    </div>
  )
}
