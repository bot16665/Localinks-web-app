'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Category = 'Cafes' | 'Restaurants' | 'Groceries' | 'Salon' | 'Services' | 'Retail' | 'Wellness' | 'Other'

const CATEGORIES: Category[] = ['Cafes', 'Restaurants', 'Groceries', 'Salon', 'Services', 'Retail', 'Wellness', 'Other']

interface FormState {
  name: string
  category: Category | null
  description: string
  openTime: string
  closeTime: string
  address: string
  gstNumber: string
  submitting: boolean
  error: string | null
  gstError: string | null
}

export default function CreateBusinessPage() {
  const router = useRouter()
  const [state, setState] = useState<FormState>({
    name: '',
    category: null,
    description: '',
    openTime: '',
    closeTime: '',
    address: '',
    gstNumber: '',
    submitting: false,
    error: null,
    gstError: null,
  })

  const [profileLocation, setProfileLocation] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('location')
        .eq('id', user.id)
        .single()

      if (profile?.location) {
        setProfileLocation(profile.location as string)
      }
      setProfileLoading(false)
    }

    fetchProfile()
  }, [router])

  const validateGst = (value: string): boolean => {
    const cleaned = value.trim().toUpperCase()
    if (cleaned.length !== 15) {
      setState((prev) => ({ ...prev, gstError: 'GST number must be exactly 15 characters' }))
      return false
    }
    if (!/^[A-Z0-9]+$/.test(cleaned)) {
      setState((prev) => ({ ...prev, gstError: 'GST number must be alphanumeric (A-Z, 0-9)' }))
      return false
    }
    setState((prev) => ({ ...prev, gstError: null }))
    return true
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoUploading(true)

    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('business-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('business-images').getPublicUrl(fileName)
      const publicUrl = publicUrlData?.publicUrl || null

      if (publicUrl) {
        setPhotoUrl(publicUrl)
        setPhotoPreview(publicUrl)
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to upload photo',
      }))
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!state.category || !state.name.trim()) return
    if (!validateGst(state.gstNumber)) return
    if (!profileLocation) {
      setState((prev) => ({ ...prev, error: 'Profile location not found. Please complete onboarding first.' }))
      return
    }

    setState((prev) => ({ ...prev, submitting: true, error: null }))

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { error: insertError } = await supabase.from('businesses').insert({
        owner_id: user.id,
        name: state.name.trim(),
        category: state.category,
        description: state.description.trim() || null,
        open_time: state.openTime || null,
        close_time: state.closeTime || null,
        address: state.address.trim() || null,
        location: profileLocation,
        is_open: true,
        gst_number: state.gstNumber.trim().toUpperCase(),
        photo_url: photoUrl,
      })

      if (insertError) throw insertError

      router.push('/business')
    } catch (err) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: err instanceof Error ? err.message : 'Failed to create business',
      }))
    }
  }

  const isFormValid =
    state.name.trim() &&
    state.category &&
    !state.submitting &&
    !profileLoading &&
    !state.gstError &&
    state.gstNumber.trim().length === 15

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col antialiased">
      {/* App Bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center gap-2 max-w-xl mx-auto w-full">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container active:scale-95 transition-colors -ml-2 text-on-surface touch-target"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
          <h1 className="font-semibold text-lg text-on-surface">Add Business</h1>
        </div>
      </header>

      {/* Form Area */}
      <main className="flex-1 px-4 sm:px-6 py-6 pb-32 max-w-xl mx-auto w-full flex flex-col gap-6">
        
        {/* Name and Description */}
        <section className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Business Name
            </label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Artisan Roast Cafe"
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-2xl py-3.5 px-4 text-base text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Description
            </label>
            <textarea
              value={state.description}
              onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what makes your business special..."
              rows={3}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-2xl py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
            />
          </div>
        </section>

        {/* Category Pills */}
        <section className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Category
          </label>
          <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1">
            {CATEGORIES.map((cat) => {
              const isSelected = state.category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, category: cat }))}
                  className={`flex-shrink-0 text-xs sm:text-sm font-medium px-4 py-2 rounded-full active:scale-95 transition-all touch-target ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-outline-variant/30'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </section>

        {/* Details Grid */}
        <section className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Business Details
          </label>
          
          <div className="bg-surface-container-low rounded-2xl p-4 sm:p-5 border border-outline-variant/30 space-y-4">
            
            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-medium">Street Address</label>
              <input
                type="text"
                value={state.address}
                onChange={(e) => setState((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="e.g. Unit 4, Commercial Complex, Sector 5"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-all"
              />
            </div>

            {/* Operating Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-on-surface-variant font-medium">Opens At</label>
                <input
                  type="time"
                  value={state.openTime}
                  onChange={(e) => setState((prev) => ({ ...prev, openTime: e.target.value }))}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-on-surface-variant font-medium">Closes At</label>
                <input
                  type="time"
                  value={state.closeTime}
                  onChange={(e) => setState((prev) => ({ ...prev, closeTime: e.target.value }))}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* GST Number */}
            <div className="space-y-1.5">
              <label className="text-xs text-on-surface-variant font-medium">
                GST Number <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={state.gstNumber}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase()
                  setState((prev) => ({ ...prev, gstNumber: value }))
                  if (value.length > 0) {
                    validateGst(value)
                  } else {
                    setState((prev) => ({ ...prev, gstError: null }))
                  }
                }}
                placeholder="15-character GST number (e.g. 27AAAAA0000A1Z5)"
                className={`w-full bg-surface-container border rounded-xl px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none transition-all uppercase ${
                  state.gstError ? 'border-error/60 focus:border-error' : 'border-outline-variant/30 focus:border-primary'
                }`}
              />
              {state.gstError && <p className="text-xs text-error font-medium">{state.gstError}</p>}
            </div>
          </div>
        </section>

        {/* Photo Upload */}
        <section className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Cover Photo
          </label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={photoUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            {photoPreview ? (
              <div className="w-full h-44 rounded-2xl overflow-hidden relative border border-outline-variant/30">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white text-3xl">edit</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-36 rounded-2xl border-2 border-dashed border-outline-variant/40 hover:border-primary/40 flex flex-col items-center justify-center bg-surface-container-low text-on-surface-variant transition-colors">
                {photoUploading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-3xl text-primary mb-1">add_a_photo</span>
                    <span className="text-xs font-medium">Tap to upload storefront photo</span>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {state.error && (
          <div className="bg-error-container/20 border border-error/30 rounded-2xl p-4 text-center">
            <p className="text-error text-xs sm:text-sm font-medium">{state.error}</p>
          </div>
        )}
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-background/90 backdrop-blur-md p-4 border-t border-outline-variant/30 z-40 pb-safe">
        <div className="max-w-xl mx-auto w-full">
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="w-full bg-primary text-on-primary py-3.5 rounded-2xl font-semibold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 flex justify-center items-center gap-2 touch-target"
          >
            {state.submitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                <span>Publishing...</span>
              </>
            ) : (
              <span>Publish Business</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
