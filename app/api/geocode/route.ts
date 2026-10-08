const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const mode = requestUrl.searchParams.get('mode')
  const siteOrigin = request.headers.get('origin') || requestUrl.origin
  const language = request.headers.get('accept-language') || 'en'

  let endpoint: URL
  if (mode === 'search') {
    const query = requestUrl.searchParams.get('q')?.trim()
    if (!query || query.length < 3 || query.length > 160) {
      return Response.json({ error: 'Enter at least 3 characters to search.' }, { status: 400 })
    }

    endpoint = new URL('/search', NOMINATIM_URL)
    endpoint.searchParams.set('q', query)
    endpoint.searchParams.set('format', 'jsonv2')
    endpoint.searchParams.set('addressdetails', '1')
    endpoint.searchParams.set('limit', '5')
  } else if (mode === 'reverse') {
    const latitude = Number(requestUrl.searchParams.get('lat'))
    const longitude = Number(requestUrl.searchParams.get('lon'))
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return Response.json({ error: 'A valid latitude and longitude are required.' }, { status: 400 })
    }

    endpoint = new URL('/reverse', NOMINATIM_URL)
    endpoint.searchParams.set('lat', String(latitude))
    endpoint.searchParams.set('lon', String(longitude))
    endpoint.searchParams.set('zoom', '18')
    endpoint.searchParams.set('addressdetails', '1')
    endpoint.searchParams.set('format', 'jsonv2')
  } else {
    return Response.json({ error: 'Unsupported geocoding mode.' }, { status: 400 })
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': `LocalLink/1.0 (${siteOrigin})`,
        'Accept-Language': language,
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return Response.json({ error: 'The locality service is temporarily unavailable.' }, { status: 502 })
    }

    return Response.json(await response.json(), {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch {
    return Response.json({ error: 'Could not reach the locality service. Please try again.' }, { status: 502 })
  }
}