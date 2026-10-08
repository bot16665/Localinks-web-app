'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import LocationPicker from '@/components/LocationPicker'
import type { LocationSelection } from '@/lib/location-geocoding'

type Step = 1 | 2

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message)
  }
  return String(error)
}

interface OnboardingState {
  step: Step
  location: LocationSelection | null
  societyName: string
  saving: boolean
  error: string | null
}

export default function OnboardingPage() {
  const router = useRouter()
  const [state, setState] = useState<OnboardingState>({
    step: 1,
    location: null,
    societyName: '',
    saving: false,
    error: null,
  })

  const handleContinue = () => {
    if (!state.location?.locality) return
    setState((prev) => ({ ...prev, step: 2 }))
  }

  const handleFinish = async () => {
    const { location, societyName } = state
    if (!location?.locality || !societyName.trim() || state.saving) return

    setState((prev) => ({ ...prev, saving: true, error: null }))
    let currentOperation = 'check your account'
    const point = `SRID=4326;POINT(${location.longitude} ${location.latitude})`

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      currentOperation = 'find your society'
      const { data: existingSociety, error: societyQueryError } = await supabase
        .from('societies')
        .select('id')
        .ilike('name', societyName.trim())
        .maybeSingle()

      if (societyQueryError) throw societyQueryError

      let societyId: string

      if (existingSociety) {
        societyId = existingSociety.id
      } else {
        currentOperation = 'create your society'
        const { data: newSociety, error: insertError } = await supabase
          .from('societies')
          .insert({
            name: societyName.trim(),
            address: location.displayName,
            location: point,
          })
          .select('id')
          .single()

        if (insertError || !newSociety) throw insertError || new Error('Failed to create society')
        societyId = newSociety.id
      }

      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Neighbor'
      const avatarUrl =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null

      currentOperation = 'save your profile and locations'
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            name: displayName,
            profile_photo_url: avatarUrl,
            phone_number: user.phone || null,
            current_location: point,
            home_location: point,
            society_id: societyId,
          },
          { onConflict: 'id' }
        )

      if (profileUpdateError) throw profileUpdateError

      currentOperation = 'join your society'
      const { data: existingMember } = await supabase
        .from('society_members')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('society_id', societyId)
        .maybeSingle()

      if (!existingMember) {
        const { error: memberError } = await supabase.from('society_members').insert({
          user_id: user.id,
          society_id: societyId,
        })

        if (memberError) throw memberError
      }

      router.push('/')
    } catch (err) {
      setState((prev) => ({
        ...prev,
        saving: false,
        error: `Could not ${currentOperation}: ${getErrorMessage(err)}`,
      }))
    }
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* Top Navigation */}
      <header className="flex items-center px-4 sm:px-6 h-14 sm:h-16 w-full max-w-xl mx-auto flex-none bg-background">
        {state.step === 2 && (
          <button
            aria-label="Go back"
            onClick={() => setState((prev) => ({ ...prev, step: 1 }))}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container transition-colors active:scale-90 text-on-surface touch-target -ml-2"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-4 sm:px-6 pt-2 sm:pt-4 pb-8 max-w-xl mx-auto w-full">
        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-8 sm:mb-10">
          <div className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${state.step >= 1 ? 'bg-primary' : 'bg-surface-container-high'}`}></div>
          <div className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${state.step >= 2 ? 'bg-primary' : 'bg-surface-container-high'}`}></div>
        </div>

        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <h1 className="font-bold text-2xl sm:text-3xl text-on-surface mb-2 tracking-tight">
            {state.step === 1 ? 'Set your location' : 'Join your society'}
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
            {state.step === 1
              ? 'We need your location to connect you with your neighborhood and local activities.'
              : 'Enter the name of your society, gated community, or apartment complex.'}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1">
          {state.step === 1 && (
            <div className="flex flex-col gap-4">
              {/* Location Capture Card */}
              <LocationPicker
                value={state.location}
                onChange={(location) => setState((prev) => ({
                  ...prev,
                  location,
                  societyName: location.locality || prev.societyName,
                  error: null,
                }))}
                disabled={state.saving}
              />

              {state.error && (
                <div className="bg-error-container/20 border border-error/30 rounded-2xl p-4 text-center">
                  <p className="text-error text-xs sm:text-sm font-medium">{state.error}</p>
                </div>
              )}
            </div>
          )}

          {state.step === 2 && (
            <div className="flex flex-col gap-4">
              {/* Society Input */}
              <div className="space-y-2">
                <div className="flex items-center bg-surface-container-low rounded-2xl h-12 sm:h-14 px-4 border border-outline-variant/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                  <span className="material-symbols-outlined text-on-surface-variant text-xl mr-3 flex-shrink-0">apartment</span>
                  <input
                    type="text"
                    value={state.societyName}
                    onChange={(e) => setState((prev) => ({ ...prev, societyName: e.target.value, error: null }))}
                    placeholder="e.g., Greenwood Estates"
                    autoFocus
                    className="flex-1 bg-transparent border-none text-sm sm:text-base text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                  />
                </div>
                <p className="text-xs text-on-surface-variant/70 px-1">
                  If your society doesn&apos;t exist yet, we&apos;ll automatically create it for your area.
                </p>
                {state.location && (
                  <p className="text-xs text-on-surface-variant px-1">
                    {state.location.latitude.toFixed(5)}, {state.location.longitude.toFixed(5)} · {state.location.displayName}
                  </p>
                )}
              </div>

              {state.error && (
                <div className="bg-error-container/20 border border-error/30 rounded-2xl p-4 text-center">
                  <p className="text-error text-xs sm:text-sm font-medium">{state.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Action */}
      <footer className="px-4 sm:px-6 py-4 pb-safe max-w-xl mx-auto w-full flex-none bg-background">
        {state.step === 1 ? (
          <button
            onClick={handleContinue}
            disabled={!state.location?.locality || state.saving}
            className="w-full bg-primary text-on-primary font-semibold text-base h-12 sm:h-14 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 touch-target"
          >
            <span>Continue</span>
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={!state.societyName.trim() || state.saving}
            className="w-full bg-primary text-on-primary font-semibold text-base h-12 sm:h-14 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 touch-target"
          >
            {state.saving ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>Get Started</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </>
            )}
          </button>
        )}
      </footer>
    </div>
  )
}
