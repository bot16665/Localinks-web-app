'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import LocationPicker from '@/components/LocationPicker'
import { searchLocalities, type LocationSelection } from '@/lib/location-geocoding'

interface LocationModalProps {
  isOpen: boolean
  onClose: () => void
  currentLocationName: string
  userId?: string
  onLocationUpdated: (newLocationName: string, lat: number, lng: number, societyId?: string) => void
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
  const [selectedLocation, setSelectedLocation] = useState<LocationSelection | null>(null)
  const [selectedSocietyId, setSelectedSocietyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectingSocietyId, setSelectingSocietyId] = useState<string | null>(null)
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

  const handleLocationChange = (location: LocationSelection) => {
    setSelectedLocation(location)
    setSelectedSocietyId(null)
    setError(null)
  }

  const handleSelectSociety = async (society: SocietyItem) => {
    setSelectingSocietyId(society.id)
    setError(null)
    try {
      const query = [society.name, society.address].filter(Boolean).join(', ')
      const locations = await searchLocalities(query)
      if (locations.length === 0) throw new Error('Could not find map coordinates for this area.')
      setSelectedLocation({ ...locations[0], locality: society.name })
      setSelectedSocietyId(society.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select location')
    } finally {
      setSelectingSocietyId(null)
    }
  }

  const handleSaveLocation = async () => {
    if (!selectedLocation?.locality || saving) return
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const currentUid = userId || user?.id
      if (!currentUid) throw new Error('Not authenticated')

      const point = `SRID=4326;POINT(${selectedLocation.longitude} ${selectedLocation.latitude})`
      let societyId = selectedSocietyId

      if (!societyId) {
        const { data: existingSociety, error: lookupError } = await supabase
          .from('societies')
          .select('id')
          .ilike('name', selectedLocation.locality)
          .maybeSingle()
        if (lookupError) throw lookupError
        societyId = existingSociety?.id || null
      }

      if (!societyId) {
        const { data: newSociety, error: insertError } = await supabase
          .from('societies')
          .insert({
            name: selectedLocation.locality,
            address: selectedLocation.displayName,
            location: point,
          })
          .select('id')
          .single()

        if (insertError || !newSociety) throw insertError || new Error('Failed to create society')
        societyId = newSociety.id
      }

      if (!societyId) throw new Error('Could not resolve this society.')

      const { error: societyError } = await supabase.rpc('set_my_society', {
        target_society_id: societyId,
      })
      if (societyError) throw societyError

      const { error: locationError } = await supabase
        .from('profiles')
        .update({ current_location: point })
        .eq('id', currentUid)
      if (locationError) throw locationError

      onLocationUpdated(selectedLocation.locality, selectedLocation.latitude, selectedLocation.longitude, societyId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set location')
    } finally {
      setSaving(false)
    }
  }

  const filteredSocieties = societies

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-outline-variant/30 shadow-2xl p-5 sm:p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        
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

        <LocationPicker value={selectedLocation} onChange={handleLocationChange} disabled={saving} />

        {error && (
          <div className="bg-error-container/20 border border-error/30 rounded-xl p-3 text-center">
            <p className="text-error text-xs font-medium">{error}</p>
          </div>
        )}

        {/* Societies List */}
        <div className="space-y-1.5 pt-1">
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
                disabled={saving || selectingSocietyId !== null}
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
                <span className="text-xs text-primary font-medium">
                  {selectingSocietyId === society.id ? 'Finding...' : selectedSocietyId === society.id ? 'Selected' : 'Select'}
                </span>
              </button>
            ))
          ) : <p className="py-3 text-center text-xs text-on-surface-variant">No saved areas available.</p>}
        </div>

        <button
          type="button"
          onClick={handleSaveLocation}
          disabled={saving || !selectedLocation?.locality}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary shadow-md transition-all hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'Saving location...' : 'Save selected location'}
        </button>

      </div>
    </div>
  )
}
