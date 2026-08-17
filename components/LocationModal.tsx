'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface LocationModalProps {
  isOpen: boolean
  onClose: () => void
  currentLocationName: string
  userId?: string
  onLocationUpdated: (newLocationName: string, lat: number, lng: number) => void
}

interface SocietyItem {
  id: string
  name: string
  address: string | null
}

export default function LocationModal({
  isOpen,
  onClose,
  currentLocationName,
  userId,
  onLocationUpdated,
}: LocationModalProps) {
  const [detectingGps, setDetectingGps] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [societies, setSocieties] = useState<SocietyItem[]>([])
  const [loadingSocieties, setLoadingSocieties] = useState(false)

  // Fetch available societies for quick selection
  useEffect(() => {
    if (!isOpen) return

    const fetchSocieties = async () => {
      setLoadingSocieties(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('societies')
        .select('id, name, address')
        .order('created_at', { ascending: false })
        .limit(10)

      if (data) {
        setSocieties(data as SocietyItem[])
      }
      setLoadingSocieties(false)
    }

    fetchSocieties()
  }, [isOpen])

  if (!isOpen) return null

  // GPS Auto-detect location & Reverse Geocode
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }

    setDetectingGps(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        try {
          // Reverse geocode to get neighborhood / area name
          let detectedName = 'Nearby Area'
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            )
            const json = await res.json()
            if (json && json.address) {
              detectedName =
                json.address.suburb ||
                json.address.neighbourhood ||
                json.address.residential ||
                json.address.village ||
                json.address.town ||
                json.address.city_district ||
                json.address.city ||
                'Current Location'
            }
          } catch {
            detectedName = `Area (${lat.toFixed(2)}, ${lng.toFixed(2)})`
          }

          // Save to Supabase
          await saveUserLocation(lat, lng, detectedName)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to update location')
          setDetectingGps(false)
        }
      },
      (err) => {
        setDetectingGps(false)
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission denied. Please allow location access in your browser.')
        } else {
          setError('Unable to detect your location. Please try entering your neighborhood name.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Select an existing society
  const handleSelectSociety = async (society: SocietyItem) => {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const currentUid = userId || user?.id
      if (!currentUid) throw new Error('Not authenticated')

      // Get society location point if available
      const { data: societyData } = await supabase
        .from('societies')
        .select('location')
        .eq('id', society.id)
        .single()

      const updates: any = {
        society_id: society.id,
      }

      if (societyData?.location) {
        updates.location = societyData.location
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUid)

      if (updateError) throw updateError

      onLocationUpdated(society.name, 0, 0)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select location')
    } finally {
      setSaving(false)
    }
  }

  // Save custom entered neighborhood / society
  const handleSaveCustomLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = searchQuery.trim()
    if (!name) return

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const currentUid = userId || user?.id
      if (!currentUid) throw new Error('Not authenticated')

      // Check if society exists
      const { data: existingSociety } = await supabase
        .from('societies')
        .select('id, name')
        .ilike('name', name)
        .maybeSingle()

      let societyId = existingSociety?.id

      if (!societyId) {
        // Create new society
        const { data: newSociety, error: insertError } = await supabase
          .from('societies')
          .insert({ name })
          .select('id')
          .single()

        if (insertError || !newSociety) throw insertError || new Error('Failed to create society')
        societyId = newSociety.id
      }

      // Update user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ society_id: societyId })
        .eq('id', currentUid)

      if (profileError) throw profileError

      onLocationUpdated(name, 0, 0)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set location')
    } finally {
      setSaving(false)
    }
  }

  const saveUserLocation = async (lat: number, lng: number, name: string) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const currentUid = userId || user?.id
    if (!currentUid) throw new Error('Not authenticated')

    const point = `SRID=4326;POINT(${lng} ${lat})`

    // Check or create society for this area
    const { data: existingSociety } = await supabase
      .from('societies')
      .select('id')
      .ilike('name', name)
      .maybeSingle()

    let societyId = existingSociety?.id

    if (!societyId) {
      const { data: newSociety } = await supabase
        .from('societies')
        .insert({
          name,
          location: point,
        })
        .select('id')
        .single()

      societyId = newSociety?.id
    }

    const updates: any = {
      location: point,
    }
    if (societyId) {
      updates.society_id = societyId
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', currentUid)

    if (updateError) throw updateError

    setDetectingGps(false)
    onLocationUpdated(name, lat, lng)
    onClose()
  }

  const filteredSocieties = societies.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-low w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-outline-variant/40 shadow-2xl p-5 sm:p-6 flex flex-col gap-4 max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl icon-fill">location_on</span>
            <h2 className="font-bold text-lg sm:text-xl text-on-surface">Change Location</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Current Active Location Banner */}
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0"></span>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">Active Location</span>
              <p className="font-bold text-sm sm:text-base text-on-surface truncate">{currentLocationName}</p>
            </div>
          </div>
          <span className="text-xs bg-primary text-on-primary px-2.5 py-1 rounded-full font-semibold">Active</span>
        </div>

        {/* GPS Auto-detection Button */}
        <button
          type="button"
          onClick={handleDetectGps}
          disabled={detectingGps || saving}
          className="w-full bg-surface-container hover:bg-surface-container-high border border-primary/40 rounded-2xl p-3.5 flex items-center gap-3.5 transition-all text-left group active:scale-[0.98] disabled:opacity-50 touch-target"
        >
          <div className="w-11 h-11 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-md">
            {detectingGps ? (
              <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-2xl icon-fill group-hover:scale-110 transition-transform">my_location</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm sm:text-base text-on-surface block leading-tight">
              {detectingGps ? 'Detecting GPS location...' : 'Use Current GPS Location'}
            </span>
            <span className="text-xs text-on-surface-variant mt-0.5 block">
              {detectingGps ? 'Finding your neighborhood...' : 'Automatically detects your precise area'}
            </span>
          </div>
          <span className="material-symbols-outlined text-primary text-xl shrink-0 group-hover:translate-x-1 transition-transform">
            chevron_right
          </span>
        </button>

        {/* Search / Enter Custom Location */}
        <form onSubmit={handleSaveCustomLocation} className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Or Search / Enter Neighborhood or Society
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., Greenwood Estates, Indiranagar..."
                className="w-full bg-surface-container border border-outline-variant/40 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            {searchQuery.trim() && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 bg-primary text-on-primary rounded-2xl font-semibold text-xs sm:text-sm hover:brightness-110 active:scale-95 transition-all shadow-md shrink-0 touch-target"
              >
                {saving ? 'Setting...' : 'Set'}
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="bg-error-container/20 border border-error/30 rounded-xl p-3 text-center">
            <p className="text-error text-xs font-medium">{error}</p>
          </div>
        )}

        {/* Societies List */}
        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-1.5 max-h-48 pt-1">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
            Available Societies & Areas
          </span>

          {loadingSocieties ? (
            <div className="py-4 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-1" />
              <span className="text-xs text-on-surface-variant">Loading areas...</span>
            </div>
          ) : filteredSocieties.length > 0 ? (
            filteredSocieties.map((society) => (
              <button
                key={society.id}
                type="button"
                onClick={() => handleSelectSociety(society)}
                disabled={saving}
                className="w-full bg-surface-container/60 hover:bg-surface-container border border-outline-variant/20 rounded-xl p-3 flex items-center justify-between text-left transition-all active:scale-[0.99] group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-primary text-lg">apartment</span>
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-on-surface block truncate group-hover:text-primary transition-colors">
                      {society.name}
                    </span>
                    {society.address && (
                      <span className="text-[11px] text-on-surface-variant truncate block">{society.address}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Select
                </span>
              </button>
            ))
          ) : (
            searchQuery.trim() && (
              <button
                type="button"
                onClick={handleSaveCustomLocation}
                className="w-full bg-primary/10 border border-primary/30 rounded-xl p-3 text-center hover:bg-primary/20 transition-colors"
              >
                <span className="text-xs font-semibold text-primary">
                  Set &ldquo;{searchQuery.trim()}&rdquo; as your location
                </span>
              </button>
            )
          )}
        </div>

      </div>
    </div>
  )
}
