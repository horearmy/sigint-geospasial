import exifr from 'exifr'

export async function extractGpsFromImage(file) {
  try {
    const gps = await exifr.gps(file)
    if (gps && gps.latitude != null && gps.longitude != null) {
      return { latitude: gps.latitude, longitude: gps.longitude }
    }
    return null
  } catch {
    return null
  }
}

export async function extractGpsFromFiles(files) {
  for (const file of files) {
    const gps = await extractGpsFromImage(file)
    if (gps) return gps
  }
  return null
}
