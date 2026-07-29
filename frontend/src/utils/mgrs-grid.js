import * as mgrs from 'mgrs'

const UTM_ZONE_WIDTH_DEG = 6
const LAT_BAND_HEIGHT_DEG = 8
const MGRS_LETTERS = 'CDEFGHJKLMNPQRSTUVWX'

export function getUTMZone(lng) {
  return Math.floor((lng + 180) / 6) + 1
}

export function getMGRSBand(lat) {
  if (lat < -80 || lat > 84) return null
  if (lat >= 72 && lat <= 84) return 'X'
  const idx = Math.floor((lat + 80) / LAT_BAND_HEIGHT_DEG)
  if (idx >= 0 && idx < MGRS_LETTERS.length) return MGRS_LETTERS[idx]
  return null
}

function toEasting(lng, zone) {
  const centralLng = (zone - 1) * 6 - 180 + 3
  const dlng = lng - centralLng
  const lngRad = (lng * Math.PI) / 180
  const midLat = 0
  const cosLat = Math.cos(midLat)
  return 500000 + dlng * 111319.9 * cosLat * 0.9996
}

function toNorthing(lat, zone) {
  const latRad = (lat * Math.PI) / 180
  const e2 = 0.00669438
  const M = 6378137 * (
    (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * latRad -
    (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * latRad) +
    (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * latRad) -
    (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * latRad)
  )
  return lat >= 0 ? M : M + 10000000
}

function getGridConfig(zoom) {
  if (zoom <= 4) return { deg: 2, numInterval: 2, precision: 0, showNum: false }
  if (zoom <= 5) return { deg: 1, numInterval: 1, precision: 0, showNum: false }
  if (zoom <= 6) return { deg: 0.5, numInterval: 0.5, precision: 0, showNum: true }
  if (zoom <= 7) return { deg: 0.25, numInterval: 0.25, precision: 0, showNum: true }
  if (zoom <= 8) return { deg: 0.1, numInterval: 0.1, precision: 0, showNum: true }
  if (zoom <= 9) return { deg: 0.1, numInterval: 0.1, precision: 1, showNum: true }
  if (zoom <= 10) return { deg: 0.05, numInterval: 0.05, precision: 1, showNum: true }
  if (zoom <= 11) return { deg: 0.02, numInterval: 0.02, precision: 2, showNum: true }
  if (zoom <= 12) return { deg: 0.01, numInterval: 0.01, precision: 2, showNum: true }
  if (zoom <= 14) return { deg: 0.005, numInterval: 0.005, precision: 3, showNum: true }
  return { deg: 0.002, numInterval: 0.002, precision: 3, showNum: true }
}

function formatNum(val, precision) {
  if (precision === 0) return Math.round(val).toString()
  return val.toFixed(precision)
}

function dmsLabel(val, isLat) {
  const abs = Math.abs(val)
  const d = Math.floor(abs)
  const m = Math.floor((abs - d) * 60)
  const s = ((abs - d - m / 60) * 3600).toFixed(1)
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W')
  return `${d}°${m}'${s}"${dir}`
}

function ddLabel(val, isLat) {
  return val.toFixed(4) + (isLat ? '°N' : '°E')
}

export function getMGRSGridLines(bounds, zoom, format = 'mgrs') {
  const lines = []
  const numLabels = []
  const edgeLabels = []

  const { deg: step, numInterval, precision, showNum } = getGridConfig(zoom)

  const west = bounds.getWest()
  const east = bounds.getEast()
  const south = bounds.getSouth()
  const north = bounds.getNorth()

  const startLng = Math.floor(west / step) * step
  const endLng = Math.ceil(east / step) * step
  const startLat = Math.floor(south / step) * step
  const endLat = Math.ceil(north / step) * step

  const majorStep = step * (zoom <= 6 ? 6 : zoom <= 9 ? 4 : zoom <= 12 ? 2 : 1)
  const zone = getUTMZone((west + east) / 2)

  const isMGRS = format === 'mgrs'
  const isUTMFmt = format === 'utm'
  const isDMS = format === 'dms'
  const isDD = format === 'dd'

  for (let lng = startLng; lng <= endLng; lng += step) {
    if (lng < west - 0.001 || lng > east + 0.001) continue

    const isMajor = Math.abs(lng % majorStep) < 0.001 || Math.abs(Math.abs(lng % majorStep) - majorStep) < 0.001
    const isUTM = Math.abs(lng % UTM_ZONE_WIDTH_DEG) < 0.001 || Math.abs(Math.abs(lng % UTM_ZONE_WIDTH_DEG) - UTM_ZONE_WIDTH_DEG) < 0.001

    lines.push({ type: 'vertical', lng, south, north, isMajor: isMajor || isUTM, isUTM })

    if (showNum && (isMajor || isUTM)) {
      let numText
      if (isMGRS) {
        numText = formatNum(toEasting(lng, zone), precision) + 'E'
      } else if (isUTMFmt) {
        numText = `${zone} ${formatNum(toEasting(lng, zone), precision)}E`
      } else if (isDMS) {
        numText = dmsLabel(lng, false)
      } else {
        numText = ddLabel(lng, false)
      }

      numLabels.push({ text: numText, lat: north, lng, anchor: 'top', type: 'easting' })
      numLabels.push({ text: numText, lat: south, lng, anchor: 'bottom', type: 'easting' })
    }

    if (isMGRS || isUTMFmt) {
      if (isUTM) {
        const band = getMGRSBand((south + north) / 2)
        edgeLabels.push({ text: `${zone}${band}`, lat: north, lng, anchor: 'top', type: 'zone' })
        edgeLabels.push({ text: `${zone}${band}`, lat: south, lng, anchor: 'bottom', type: 'zone' })
      } else if (isMajor) {
        const band = getMGRSBand((south + north) / 2)
        edgeLabels.push({ text: `${zone}${band}`, lat: north, lng, anchor: 'top', type: 'zone-minor' })
        edgeLabels.push({ text: `${zone}${band}`, lat: south, lng, anchor: 'bottom', type: 'zone-minor' })
      }
    }
  }

  const majorLatStep = majorStep
  for (let lat = startLat; lat <= endLat; lat += step) {
    if (lat < south - 0.001 || lat > north + 0.001) continue

    const isMajor = Math.abs(lat % majorLatStep) < 0.001 || Math.abs(Math.abs(lat % majorLatStep) - majorLatStep) < 0.001

    lines.push({ type: 'horizontal', lat, west, east, isMajor })

    if (showNum && isMajor) {
      let numText
      if (isMGRS) {
        numText = formatNum(toNorthing(lat, zone), precision) + 'N'
      } else if (isUTMFmt) {
        numText = `${zone} ${formatNum(toNorthing(lat, zone), precision)}N`
      } else if (isDMS) {
        numText = dmsLabel(lat, true)
      } else {
        numText = ddLabel(lat, true)
      }

      numLabels.push({ text: numText, lat, lng: west, anchor: 'left', type: 'northing' })
      numLabels.push({ text: numText, lat, lng: east, anchor: 'right', type: 'northing' })
    }

    if (isMGRS || isUTMFmt) {
      if (isMajor) {
        const band = getMGRSBand(lat)
        if (band) {
          edgeLabels.push({ text: `${band}°`, lat, lng: west, anchor: 'left', type: 'band' })
          edgeLabels.push({ text: `${band}°`, lat, lng: east, anchor: 'right', type: 'band' })
        }
      }
    }
  }

  return { lines, numLabels, edgeLabels }
}

export function getMGRSInfo(lat, lng) {
  try {
    const mgrsStr = mgrs.forward([lng, lat], 10)
    const zone = getUTMZone(lng)
    const band = getMGRSBand(lat)
    return { mgrs: mgrsStr, zone: `${zone}${band}`, zoneNumber: zone, bandLetter: band }
  } catch { return null }
}
