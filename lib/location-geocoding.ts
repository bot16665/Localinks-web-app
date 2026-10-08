export interface LocationSelection {
  latitude: number
  longitude: number
  locality: string
  displayName: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string>
}

let lastRequestAt = 0

async function waitForNominatimSlot() {
  const waitMs = Math.max(0, 1100 - (Date.now() - lastRequestAt))
  if (waitMs) await new Promise((resolve) => window.setTimeout(resolve, waitMs))
  lastRequestAt = Date.now()
}

function toLocation(result: NominatimResult): LocationSelection {
  const address = result.address || {}
  const locality =
    address.neighbourhood ||
    address.suburb ||
    address.residential ||
    address.city_district ||
    address.village ||
    address.town ||
    address.city ||
    address.county ||
    result.display_name.split(',')[0]

  return {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    locality,
    displayName: result.display_name,
  }
}

async function requestGeocoding<T>(params: URLSearchParams): Promise<T> {
  await waitForNominatimSlot()
  const response = await fetch(`/api/geocode?${params.toString()}`)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Location lookup failed.')
  return result as T
}

export async function searchLocalities(query: string): Promise<LocationSelection[]> {
  const params = new URLSearchParams({ mode: 'search', q: query })
  const results = await requestGeocoding<NominatimResult[]>(params)
  return results.map(toLocation).filter((location) =>
    Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Boolean(location.locality)
  )
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<LocationSelection> {
  const params = new URLSearchParams({ mode: 'reverse', lat: String(latitude), lon: String(longitude) })
  const result = await requestGeocoding<NominatimResult>(params)
  return toLocation(result)
}