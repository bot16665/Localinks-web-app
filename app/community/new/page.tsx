'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Category = 'Help Request' | 'Notice' | 'General'

const CATEGORIES: Category[] = ['Help Request', 'Notice', 'General']

interface FormState {
  title: string
  category: Category | null
  description: string
  submitting: boolean
  error: string | null
}

export default function CreateCommunityPostPage() {
  const router = useRouter()
  const [state, setState] = useState<FormState>({
    title: '',
    category: null,
    description: '',
    submitting: false,
    error: null,
  })

  const [societyId, setSocietyId] = useState<string | null>(null)
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
        .select('society_id')
        .eq('id', user.id)
        .single()

      if (profile?.society_id) {
        setSocietyId(profile.society_id as string)
      }
      setProfileLoading(false)
    }

    fetchProfile()
  }, [router])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoUploading(true)

    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('community-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('community-images').getPublicUrl(fileName)
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

    if (!state.category || !state.title.trim() || !societyId) return

    setState((prev) => ({ ...prev, submitting: true, error: null }))

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        type: 'local',
        category: state.category,
        title: state.title.trim(),
        description: state.description.trim() || null,
        photo_url: photoUrl,
        society_id: societyId,
        status: 'active',
      })

      if (insertError) throw insertError

      router.push('/community')
    } catch (err) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: err instanceof Error ? err.message : 'Failed to create post',
      }))
    }
  }

  const isFormValid =
    state.title.trim() &&
    state.category &&
    !state.submitting &&
    !profileLoading &&
    !!societyId

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center gap-2 max-w-xl mx-auto w-full">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container active:scale-95 transition-colors -ml-2 text-on-surface touch-target"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
          <h1 className="font-semibold text-lg text-on-surface">Create Post</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 pb-32 max-w-xl mx-auto w-full flex flex-col gap-6">
        <form id="create-community-form" onSubmit={handleSubmit} className="space-y-6">
          
          {/* Category Chips */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Post Category
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
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="post-title">
              Title
            </label>
            <input
              id="post-title"
              type="text"
              value={state.title}
              onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="What's happening in the neighborhood?"
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-2xl py-3.5 px-4 text-base text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="post-desc">
              Details
            </label>
            <textarea
              id="post-desc"
              value={state.description}
              onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Add more details, requirements, or contact info..."
              rows={4}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-2xl py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Attachment (Optional)
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
                <div className="w-full h-32 rounded-2xl border-2 border-dashed border-outline-variant/40 hover:border-primary/40 flex flex-col items-center justify-center bg-surface-container-low text-on-surface-variant transition-colors">
                  {photoUploading ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-3xl text-primary mb-1">add_photo_alternate</span>
                      <span className="text-xs font-medium">Tap to attach a photo</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {state.error && (
            <div className="bg-error-container/20 border border-error/30 rounded-2xl p-4 text-center">
              <p className="text-error text-xs sm:text-sm font-medium">{state.error}</p>
            </div>
          )}
        </form>
      </main>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-0 w-full bg-background/90 backdrop-blur-md p-4 border-t border-outline-variant/30 z-40 pb-safe">
        <div className="max-w-xl mx-auto w-full">
          <button
            form="create-community-form"
            type="submit"
            disabled={!isFormValid}
            className="w-full bg-primary text-on-primary py-3.5 rounded-2xl font-semibold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 flex justify-center items-center gap-2 touch-target"
          >
            {state.submitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                <span>Posting...</span>
              </>
            ) : (
              <span>Publish Post</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
