'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

interface FormState {
  title: string
  description: string
  submitting: boolean
  error: string | null
}

export default function PostPromoPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const businessId = params.id

  const [state, setState] = useState<FormState>({
    title: '',
    description: '',
    submitting: false,
    error: null,
  })

  const [businessLocation, setBusinessLocation] = useState<string | null>(null)
  const [businessLoading, setBusinessLoading] = useState(true)

  useEffect(() => {
    const fetchBusiness = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: business } = await supabase
        .from('businesses')
        .select('location')
        .eq('id', businessId)
        .single()

      if (business?.location) {
        setBusinessLocation(business.location as string)
      }
      setBusinessLoading(false)
    }

    fetchBusiness()
  }, [businessId, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!state.title.trim() || !businessId) return
    if (!businessLocation) {
      setState((prev) => ({ ...prev, error: 'Business location not found.' }))
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
        type: 'business',
        business_id: businessId,
        title: state.title.trim(),
        description: state.description.trim() || null,
        location: businessLocation,
        status: 'active',
      })

      if (insertError) throw insertError

      router.push(`/business/${businessId}`)
    } catch (err) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: err instanceof Error ? err.message : 'Failed to post promo',
      }))
    }
  }

  const isFormValid = state.title.trim() && !state.submitting && !businessLoading

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
          <h1 className="font-semibold text-lg text-on-surface">Post Promo</h1>
        </div>
      </header>

      {/* Form Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 pb-32 max-w-xl mx-auto w-full flex flex-col gap-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Promo Title
            </label>
            <input
              id="title"
              type="text"
              value={state.title}
              onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. 20% off all drinks today"
              className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3.5 text-sm sm:text-base text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={state.description}
              onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Add terms, timings, or discount details..."
              rows={4}
              className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
            />
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
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="w-full bg-primary text-on-primary py-3.5 rounded-2xl font-semibold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 flex justify-center items-center gap-2 touch-target"
          >
            {state.submitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                <span>Publishing Promo...</span>
              </>
            ) : (
              <span>Publish Promo</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
