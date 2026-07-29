import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { getMGRSGridLines } from '../utils/mgrs-grid'

const MGRSGridLayer = L.Layer.extend({
  options: { maxZoom: 18, minZoom: 3, format: 'mgrs' },

  onAdd(map) {
    this._map = map
    this._canvas = document.createElement('canvas')
    this._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:450'
    map.getPane('overlayPane').appendChild(this._canvas)
    this._ctx = this._canvas.getContext('2d')
    map.on('moveend zoomend resize', this._update, this)
    map.on('move', this._followMove, this)
    this._update()
  },

  onRemove(map) {
    map.off('moveend zoomend resize', this._update, this)
    map.off('move', this._followMove, this)
    this._canvas?.parentNode?.removeChild(this._canvas)
  },

  _followMove() {
    if (!this._map) return
    const s = this._map.getSize()
    const tl = this._map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this._canvas, tl)
    this._canvas.width = s.x
    this._canvas.height = s.y
  },

  _update() {
    if (!this._map) return
    const z = this._map.getZoom()
    if (z < this.options.minZoom || z > this.options.maxZoom) { this._clearCanvas(); return }
    const s = this._map.getSize()
    this._canvas.width = s.x
    this._canvas.height = s.y
    L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0]))
    this._draw(this._map.getBounds(), z)
  },

  _clearCanvas() { this._ctx?.clearRect(0, 0, this._canvas.width, this._canvas.height) },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  },

  _draw(bounds, zoom) {
    const ctx = this._ctx
    const map = this._map
    const W = this._canvas.width
    const H = this._canvas.height
    ctx.clearRect(0, 0, W, H)

    const format = this.options.format || 'mgrs'
    const { lines, numLabels, edgeLabels } = getMGRSGridLines(bounds, zoom, format)

    const pTL = map.latLngToContainerPoint([bounds.getNorth(), bounds.getWest()])
    const pBR = map.latLngToContainerPoint([bounds.getSouth(), bounds.getEast()])
    const sTop = Math.min(pTL.y, pBR.y)
    const sBot = Math.max(pTL.y, pBR.y)
    const sLeft = Math.min(pTL.x, pBR.x)
    const sRight = Math.max(pTL.x, pBR.x)

    const minorA = 0.2 + (zoom - 3) * 0.025
    const majorA = 0.4 + (zoom - 3) * 0.025

    // ── Draw grid lines ──
    lines.forEach(line => {
      if (line.type === 'vertical') {
        const x = map.latLngToContainerPoint([bounds.getNorth(), line.lng]).x
        if (x < sLeft - 2 || x > sRight + 2) return
        ctx.beginPath(); ctx.moveTo(x, sTop); ctx.lineTo(x, sBot)
        if (line.isUTM) {
          ctx.strokeStyle = `rgba(201,168,76,${Math.min(majorA + 0.15, 0.7)})`
          ctx.lineWidth = 1.6; ctx.setLineDash([])
        } else if (line.isMajor) {
          ctx.strokeStyle = `rgba(255,255,255,${majorA})`
          ctx.lineWidth = 0.8; ctx.setLineDash([])
        } else {
          ctx.strokeStyle = `rgba(255,255,255,${minorA})`
          ctx.lineWidth = 0.4; ctx.setLineDash([4, 6])
        }
        ctx.stroke(); ctx.setLineDash([])
      } else {
        const y = map.latLngToContainerPoint([line.lat, bounds.getWest()]).y
        if (y < sTop - 2 || y > sBot + 2) return
        ctx.beginPath(); ctx.moveTo(sLeft, y); ctx.lineTo(sRight, y)
        if (line.isMajor) {
          ctx.strokeStyle = `rgba(255,255,255,${majorA})`
          ctx.lineWidth = 0.8; ctx.setLineDash([])
        } else {
          ctx.strokeStyle = `rgba(255,255,255,${minorA})`
          ctx.lineWidth = 0.4; ctx.setLineDash([4, 6])
        }
        ctx.stroke(); ctx.setLineDash([])
      }
    })

    // ── Draw number labels ON the grid lines ──
    const fontSize = zoom >= 12 ? 9 : 8
    ctx.font = `600 ${fontSize}px 'Courier New', monospace`

    numLabels.forEach(label => {
      const pt = map.latLngToContainerPoint([label.lat, label.lng])
      let x = pt.x
      let y = pt.y

      const tw = ctx.measureText(label.text).width
      const pad = 3
      const bw = tw + pad * 2
      const bh = fontSize + pad * 2 - 1
      let bx, by

      if (label.anchor === 'top') {
        x = Math.max(sLeft + 10, Math.min(sRight - 10, x))
        bx = x - bw / 2
        by = sTop + 2
      } else if (label.anchor === 'bottom') {
        x = Math.max(sLeft + 10, Math.min(sRight - 10, x))
        bx = x - bw / 2
        by = sBot - bh - 2
      } else if (label.anchor === 'left') {
        y = Math.max(sTop + 10, Math.min(sBot - 10, y))
        bx = sLeft + 2
        by = y - bh / 2
      } else if (label.anchor === 'right') {
        y = Math.max(sTop + 10, Math.min(sBot - 10, y))
        bx = sRight - bw - 2
        by = y - bh / 2
      }

      if (bx < -120 || bx > W + 120 || by < -30 || by > H + 30) return

      this._roundRect(ctx, bx, by, bw, bh, 2)
      ctx.fillStyle = label.type === 'easting'
        ? 'rgba(11,42,27,0.88)'
        : 'rgba(11,42,27,0.88)'
      ctx.fill()

      ctx.strokeStyle = label.type === 'easting'
        ? 'rgba(134,239,172,0.4)'
        : 'rgba(134,239,172,0.4)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      ctx.fillStyle = label.type === 'easting'
        ? 'rgba(134,239,172,0.95)'
        : 'rgba(134,239,172,0.95)'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(label.text, bx + pad, by + fontSize + pad - 1)
    })

    // ── Draw edge labels (zone/band) ──
    edgeLabels.forEach(label => {
      const pt = map.latLngToContainerPoint([label.lat, label.lng])
      let x = pt.x
      let y = pt.y

      const isH = label.anchor === 'top' || label.anchor === 'bottom'
      const isV = label.anchor === 'left' || label.anchor === 'right'

      if (isH) x = Math.max(sLeft + 10, Math.min(sRight - 10, x))
      if (isV) y = Math.max(sTop + 10, Math.min(sBot - 10, y))

      if (x < -100 || x > W + 100 || y < -30 || y > H + 30) return

      const fSize = label.type === 'zone' ? 11 : label.type === 'zone-minor' ? 9 : 10
      ctx.font = `bold ${fSize}px 'Courier New', monospace`
      const tw = ctx.measureText(label.text).width
      const p = 4
      const bw = tw + p * 2
      const bh = fSize + p * 2

      let bx, by, tx, ty
      const cR = 3

      switch (label.anchor) {
        case 'top':
          bx = x - bw / 2; by = sTop; tx = x - tw / 2; ty = sTop + fSize + p - 1; break
        case 'bottom':
          bx = x - bw / 2; by = sBot - bh; tx = x - tw / 2; ty = sBot - p - 1; break
        case 'left':
          bx = sLeft; by = y - bh / 2; tx = sLeft + p; ty = y + fSize / 2; break
        case 'right':
          bx = sRight - bw; by = y - bh / 2; tx = sRight - p - tw; ty = y + fSize / 2; break
      }

      this._roundRect(ctx, bx, by, bw, bh, cR)
      ctx.fillStyle = label.type === 'zone' ? 'rgba(11,42,27,0.92)'
        : label.type === 'band' ? 'rgba(11,42,27,0.85)'
        : 'rgba(11,42,27,0.8)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(201,168,76,0.3)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      ctx.fillStyle = label.type === 'zone' ? 'rgba(201,168,76,1)'
        : label.type === 'band' ? 'rgba(201,168,76,0.9)'
        : 'rgba(201,168,76,0.75)'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(label.text, tx, ty)
    })
  },
})

export default function MapGrid({ enabled, format }) {
  const map = useMap()
  const layerRef = useRef(null)

  useEffect(() => {
    if (!map) return
    if (enabled && !layerRef.current) { layerRef.current = new MGRSGridLayer({ format: format || 'mgrs' }).addTo(map) }
    if (!enabled && layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null } }
  }, [map, enabled])

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.options.format = format || 'mgrs'
      layerRef.current._update()
    }
  }, [format])

  return null
}
