export function getPublicStoragePath(url: string | null, bucket: string): string | null {
  if (!url) return null

  try {
    const pathname = new URL(url).pathname
    const marker = `/storage/v1/object/public/${bucket}/`
    const markerIndex = pathname.indexOf(marker)
    if (markerIndex < 0) return null

    return decodeURIComponent(pathname.slice(markerIndex + marker.length)) || null
  } catch {
    return null
  }
}