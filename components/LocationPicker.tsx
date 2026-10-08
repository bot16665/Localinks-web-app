'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { reverseGeocode, searchLocalities, type LocationSelection } from '@/lib/location-geocoding'

const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-2xl bg-surface-container" />,
})

interface LocationPickerProps {
  value: LocationSelection | null
  onChange: (location: LocationSelection) => void
  disabled?: boolean
}

export default function LocationPicker({ value, onChange, disabled = false }: LocationPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationSelection[]>([])
  const [searching, setSearching] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reverseRequestId = useRef(0)

  const resolvePosition = async (latitude: number, longitude: number) => {
    const requestId = ++reverseRequestId.current
    onChange({ latitude, longitude, locality: '', displayName: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` })
    setResolving(true)
    setError(null)

    try {
      const location = await reverseGeocode(latitude, longitude)
      if (requestId === reverseRequestId.current) onChange(location)
    } catch (lookupError) {
      if (requestId === reverseRequestId.current) {
        setError(lookupError instanceof Error ? lookupError.message : 'Could not identify this locality.')
      }
    } finally {
      if (requestId === reverseRequestId.current) setResolving(false)
    }
  }

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (query.trim().length < 3 || searching) return

    setSearching(true)
    setError(null)
    setResults([])
    try {
      const locations = await searchLocalities(query.trim())
      setResults(locations)
      if (locations.length === 0) setError('No matching locations found.')
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Location search failed.')
    } finally {
      setSearching(false)
    }
  }

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }

    setError(null)
    setResolving(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void resolvePosition(coords.latitude, coords.longitude),
      (geoError) => {
        setResolving(false)
        setError(geoError.code === geoError.PERMISSION_DENIED
          ? 'Location access was denied. Allow it in your browser settings to continue.'
          : 'Could not detect your current location.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  }

  const selectResult = (location: LocationSelection) => {
    reverseRequestId.current += 1
    setResolving(false)
    onChange(location)
    setResults([])
    setQuery(location.locality)
    setError(null)
  }

  const handleMapPositionChange = (latitude: number, longitude: number) => {
    void resolvePosition(latitude, longitude)
  }

  return (
    <div className="space-y-3">
      <div className="relative flex gap-2">
        <form onSubmit={handleSearch} className="relative flex min-w-0 flex-1 items-center">
          <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-on-surface-variant">search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search city, neighborhood, or address"
            disabled={disabled || searching}
            className="h-11 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low pl-10 pr-20 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled || searching || query.trim().length < 3}
            className="absolute right-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {searching ? '...' : 'Search'}
          </button>
        </form>
        <button
          type="button"
          onClick={handleCurrentLocation}
          disabled={disabled || resolving}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          aria-label="Use current location"
          title="Use current location"
        >
          <span className={`material-symbols-outlined ${resolving ? 'animate-spin' : ''}`}>
            {resolving ? 'progress_activity' : 'my_location'}
          </span>
        </button>
      </div>

      {results.length > 0 && (
        <div className="absolute left-0 right-12 top-12 z-[1000] max-h-36 space-y-1 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-1 shadow-xl">
          {results.map((location, index) => (
            <button
              key={`${location.latitude}-${location.longitude}-${index}`}
              type="button"
              onClick={() => selectResult(location)}
              className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-surface-container"
            >
              <span className="material-symbols-outlined mt-0.5 text-base text-primary">location_on</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-on-surface">{location.locality}</span>
                <span className="block truncate text-xs text-on-surface-variant">{location.displayName}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-outline-variant/30">
        <LocationPickerMap
          latitude={value?.latitude ?? null}
          longitude={value?.longitude ?? null}
          onPositionChange={handleMapPositionChange}
        />
      </div>

      {value && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="truncate text-sm font-semibold text-on-surface">
            {resolving ? 'Finding locality...' : value.locality || 'Locality unavailable'}
          </p>
          <p className="truncate text-xs text-on-surface-variant">
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            {value.displayName ? ` · ${value.displayName}` : ''}
          </p>
        </div>
      )}

      {error && <p role="alert" className="text-xs font-medium text-error">{error}</p>}
    </div>
  )
}