'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Category = 'Cafes' | 'Restaurants' | 'Groceries' | 'Salon' | 'Services' | 'Retail' | 'Wellness' | 'Other'

const CATEGORIES: Category[] = ['Cafes', 'Restaurants', 'Groceries', 'Salon', 'Services', 'Retail', 'Wellness', 'Other']

type Business = {
  id: string
  owner_id: string
  name: string
  category: string
  description: string | null
  open_time: string | null
  close_time: string | null
  address: string | null
  gst_number: string | null
  photo_url: string | null
}

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

export default function EditBusinessPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const businessId = params.id

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

  const [loading, setLoading] = useState(true)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single()

      if (businessError || !businessData) {
        router.push(`/business/${businessId}`)
        return
      }

      if (businessData.owner_id !== user.id) {
        router.push(`/business/${businessId}`)
        return
      }

      const business = businessData as Business
      setState((prev) => ({
        ...prev,
        name: business.name,
        category: business.category as Category,
        description: business.description || '',
        openTime: business.open_time || '',
        closeTime: business.close_time || '',
        address: business.address || '',
        gstNumber: business.gst_number || '',
      }))
      setPhotoUrl(business.photo_url)
      setPhotoPreview(business.photo_url)
      setLoading(false)
    }

    load()
  }, [businessId, router])

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

    setState((prev) => ({ ...prev, submitting: true, error: null }))

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          name: state.name.trim(),
          category: state.category,
          description: state.description.trim() || null,
          open_time: state.openTime || null,
          close_time: state.closeTime || null,
          address: state.address.trim() || null,
          gst_number: state.gstNumber.trim().toUpperCase(),
          photo_url: photoUrl,
        })
        .eq('id', businessId)

      if (updateError) throw updateError

      router.push(`/business/${businessId}`)
    } catch (err) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: err instanceof Error ? err.message : 'Failed to update business',
      }))
    }
  }

  const isFormValid =
    state.name.trim() &&
    state.category &&
    !state.submitting &&
    !state.gstError &&
    state.gstNumber.trim().length === 15

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

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
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="font-semibold text-lg text-on-surface">Edit Business</h1>
        </div>
      </header>

      {/* Form Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 pb-32 max-w-xl mx-auto w-full flex flex-col gap-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Business Name */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Business Name
            </label>
            <input
              id="name"
              type="text"
              value={state.name}
              onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Corner Cafe"
              className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3.5 text-sm sm:text-base text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {/* Category Chips */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => {
                const isSelected = state.category === category
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, category }))}
                    className={`rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-all active:scale-95 touch-target ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container'
                    }`}
                  >
                    {category}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Description
            </label>
            <textarea
              id="description"
              value={state.description}
              onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Tell neighbors about this business..."
              rows={3}
              className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
            />
          </div>

          {/* Open & Close Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="openTime" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Open Time
              </label>
              <input
                id="openTime"
                type="time"
                value={state.openTime}
                onChange={(e) => setState((prev) => ({ ...prev, openTime: e.target.value }))}
                className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="closeTime" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Close Time
              </label>
              <input
                id="closeTime"
                type="time"
                value={state.closeTime}
                onChange={(e) => setState((prev) => ({ ...prev, closeTime: e.target.value }))}
                className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label htmlFor="address" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Address
            </label>
            <input
              id="address"
              type="text"
              value={state.address}
              onChange={(e) => setState((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="e.g. 123 Main St"
              className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {/* GST Number */}
          <div className="space-y-1.5">
            <label htmlFor="gstNumber" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              GST Number <span className="text-error">*</span>
            </label>
            <input
              id="gstNumber"
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
              placeholder="e.g. 27AAAAA0000A1Z5"
              className={`w-full rounded-2xl border px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none transition-all uppercase ${
                state.gstError 
                  ? 'border-error/60 bg-surface-container-low focus:border-error' 
                  : 'border-outline-variant/40 bg-surface-container-low focus:border-primary'
              }`}
            />
            {state.gstError && <p className="text-xs text-error font-medium">{state.gstError}</p>}
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <label htmlFor="photo" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Cover Photo
            </label>
            <div className="relative">
              <input
                id="photo"
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
                      <span className="text-xs font-medium">Tap to change photo</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {state.error && <p className="rounded-2xl bg-error-container/20 border border-error/30 p-3 text-center text-xs text-error font-medium">{state.error}</p>}
        </form>
      </main>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-0 w-full bg-background/90 backdrop-blur-md p-4 border-t border-outline-variant/30 z-40 pb-safe">
        <div className="max-w-xl mx-auto w-full">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="w-full bg-primary text-on-primary py-3.5 rounded-2xl font-semibold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 flex justify-center items-center gap-2 touch-target"
          >
            {state.submitting ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}