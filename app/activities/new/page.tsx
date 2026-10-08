'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { validateImageFile } from '@/lib/image-validation'

type Category = 'Sports' | 'Study' | 'Hangout' | 'Market' | 'Events' | 'Fitness' | 'Other'

const CATEGORIES: Category[] = ['Sports', 'Study', 'Hangout', 'Market', 'Events', 'Fitness', 'Other']

interface FormState {
  title: string
  category: Category | null
  description: string
  eventDate: string
  eventTime: string
  submitting: boolean
  error: string | null
}

export default function CreateActivityPage() {
  const router = useRouter()
  const [state, setState] = useState<FormState>({
    title: '',
    category: null,
    description: '',
    eventDate: '',
    eventTime: '',
    submitting: false,
    error: null,
  })

  const [profileLocation, setProfileLocation] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        .select('home_location')
        .eq('id', user.id)
        .single()

      if (profile?.home_location) {
        setProfileLocation(profile.home_location as string)
      }
      setProfileLoading(false)
    }

    fetchProfile()
  }, [router])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateImageFile(file)
    if (validationError) {
      setState((prev) => ({ ...prev, error: validationError }))
      e.currentTarget.value = ''
      return
    }

    setPhotoUploading(true)
    setState((prev) => ({ ...prev, error: null }))

    try {
      const supabase = createClient()
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
      const fileName = `${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('community-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('community-images').getPublicUrl(fileName)
      setPhotoUrl(data.publicUrl)
      setPhotoPreview(data.publicUrl)
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to upload activity photo',
      }))
    } finally {
      setPhotoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!state.category || !state.title.trim() || !state.eventDate || photoUploading || state.submitting) return
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

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        type: 'individual',
        category: state.category,
        title: state.title.trim(),
        description: state.description.trim() || null,
        photo_url: photoUrl,
        event_date: state.eventDate,
        event_time: state.eventTime || null,
        location: profileLocation,
        status: 'active',
      })

      if (insertError) throw insertError

      router.push('/?tab=nearby')
    } catch (err) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: err instanceof Error ? err.message : 'Failed to create activity',
      }))
    }
  }

  const isFormValid =
    state.title.trim() &&
    state.category &&
    state.eventDate &&
    !state.submitting &&
    !photoUploading &&
    !profileLoading

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col antialiased">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center gap-2 max-w-xl mx-auto w-full">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container active:scale-95 transition-colors -ml-2 text-on-surface touch-target"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="font-semibold text-lg text-on-surface">Create Activity</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-6 pb-32">
        <form id="create-post-form" onSubmit={handleSubmit} className="space-y-6">
          
          {/* Activity Type Chips */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Activity Category
            </label>
            <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1">
              {CATEGORIES.map((category) => {
                const isSelected = state.category === category
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, category }))}
                    className={`flex-shrink-0 text-xs sm:text-sm font-medium px-4 py-2 rounded-full active:scale-95 transition-all touch-target ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-secondary-container text-primary hover:bg-surface-container-high border border-transparent'
                    }`}
                  >
                    {category}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="post-title">
              Title
            </label>
            <input
              id="post-title"
              type="text"
              value={state.title}
              onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Morning Badminton at Court 2"
              className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl py-3.5 px-4 text-base text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="post-date">
                Date
              </label>
              <div className="relative">
                <input
                  id="post-date"
                  type="date"
                  required
                  value={state.eventDate}
                  onChange={(e) => setState((prev) => ({ ...prev, eventDate: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl py-3 px-4 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="post-time">
                Time (Optional)
              </label>
              <div className="relative">
                <input
                  id="post-time"
                  type="time"
                  value={state.eventTime}
                  onChange={(e) => setState((prev) => ({ ...prev, eventTime: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl py-3 px-4 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Description Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="post-desc">
              Details
            </label>
            <textarea
              id="post-desc"
              value={state.description}
              onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Tell your neighbors what to expect, skill levels, what to bring..."
              rows={4}
              className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Activity Photo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            {photoPreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="relative block h-44 w-full overflow-hidden rounded-xl border border-outline-variant/30 text-left"
                aria-label="Change activity photo"
              >
                <img src={photoPreview} alt="Activity photo preview" className="h-full w-full object-cover" />
                {photoUploading && <span className="absolute inset-0 grid place-items-center bg-black/30 text-white">Uploading...</span>}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-outline-variant/50 bg-surface-container-low text-on-surface-variant hover:border-primary/50 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-3xl text-primary">add_a_photo</span>
                <span className="text-xs font-medium">{photoUploading ? 'Uploading photo...' : 'Add a photo'}</span>
              </button>
            )}
          </div>

          {state.error && (
            <div className="bg-error-container/20 border border-error/30 rounded-2xl p-4 text-center">
              <p className="text-error text-xs sm:text-sm font-medium">{state.error}</p>
            </div>
          )}
        </form>
      </main>

      {/* Footer Action */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-background/90 backdrop-blur-md border-t border-outline-variant/30 pb-safe z-40">
        <div className="max-w-xl mx-auto w-full">
          <button
            form="create-post-form"
            type="submit"
            disabled={!isFormValid}
            className="w-full bg-primary-container text-white font-semibold text-base py-3.5 rounded-xl shadow-[0_12px_32px_rgba(14,165,165,0.12)] hover:brightness-105 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:shadow-none touch-target flex items-center justify-center gap-2"
          >
            {state.submitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                <span>Posting...</span>
              </>
            ) : (
              <span>Post Activity</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
