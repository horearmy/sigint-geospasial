import * as mgrs from 'mgrs'

function toDegreesMinutesSeconds(decimal, isLat) {
  const absolute = Math.abs(decimal)
  const degrees = Math.floor(absolute)
  const minutesDecimal = (absolute - degrees) * 60
  const minutes = Math.floor(minutesDecimal)
  const seconds = ((minutesDecimal - minutes) * 60).toFixed(2)
  const direction = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W')
  return `${degrees}°${minutes}'${seconds}"${direction}`
}

export function toMGRS(lat, lng) {
  try {
    return mgrs.forward([lng, lat], 5)
  } catch {
    return 'N/A'
  }
}

export function toUTM(lat, lng) {
  const zone = Math.floor((lng + 180) / 6) + 1
  const isNorth = lat >= 0
  const band = isNorth ? 'N' : 'S'

  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180

  const k0 = 0.9996
  const e = 0.0818191908426
  const e2 = e * e
  const e4 = e2 * e2
  const e6 = e4 * e2

  const N = 6378137 / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad))
  const T = Math.tan(latRad) * Math.tan(latRad)
  const C = e2 * Math.cos(latRad) * Math.cos(latRad) / (1 - e2)
  const A = Math.cos(latRad) * (lngRad - ((zone - 1) * 6 - 180) * Math.PI / 180)

  const M = 6378137 * (
    (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * latRad -
    (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * latRad) +
    (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * latRad) -
    (35 * e6 / 3072) * Math.sin(6 * latRad)
  )

  const easting = k0 * N * (A + (1 - T + C) * A * A * A / 6 + (5 - 18 * T + T * T + 72 * C - 58 * e2) * A * A * A * A * A / 120) + 500000
  const northing = k0 * (M + N * Math.tan(latRad) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24 + (61 - 58 * T + T * T + 600 * C - 330 * e2) * A * A * A * A * A * A / 720))

  const adjustedNorthing = isNorth ? northing : northing + 10000000

  return {
    zone,
    band,
    easting: Math.round(easting),
    northing: Math.round(adjustedNorthing),
    format: `${zone}${band} ${Math.round(easting)}E ${Math.round(adjustedNorthing)}N`
  }
}

export function formatCoordinate(lat, lng, format = 'mgrs') {
  const latitude = parseFloat(lat)
  const lngitude = parseFloat(lng)

  if (isNaN(latitude) || isNaN(lngitude)) return 'N/A'

  switch (format) {
    case 'mgrs':
      return toMGRS(latitude, lngitude)
    case 'utm':
      return toUTM(latitude, lngitude).format
    case 'dms':
      return `${toDegreesMinutesSeconds(latitude, true)} ${toDegreesMinutesSeconds(lngitude, false)}`
    case 'dd':
      return `${latitude.toFixed(6)}, ${lngitude.toFixed(6)}`
    default:
      return toMGRS(latitude, lngitude)
  }
}

export function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function getPolygonArea(points) {
  if (points.length < 3) return 0
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i][0] * points[j][1]
    area -= points[j][0] * points[i][1]
  }
  return Math.abs(area / 2)
}

export function formatArea(sqMeters) {
  if (sqMeters >= 1000000) return `${(sqMeters / 1000000).toFixed(2)} km²`
  if (sqMeters >= 10000) return `${(sqMeters / 10000).toFixed(2)} ha`
  return `${sqMeters.toFixed(0)} m²`
}

export function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters.toFixed(0)} m`
}
