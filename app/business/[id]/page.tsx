'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type Business = {
  id: string
  owner_id: string
  name: string
  category: string
  description: string | null
  open_time: string | null
  close_time: string | null
  address: string | null
  is_open: boolean
}

type PromoPost = {
  title: string
  description: string | null
}

type BusinessPhoto = {
  id: string
  photo_url: string
  created_at: string
}

type BusinessReview = {
  id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_name: string
  reviewer_photo_url: string | null
}

type ReviewFormState = {
  rating: number
  comment: string
  submitting: boolean
  error: string | null
}

function formatTimeRange(openTime: string | null, closeTime: string | null): string {
  if (!openTime && !closeTime) return 'Hours not set'
  const format = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }
  const open = openTime ? format(openTime) : '--'
  const close = closeTime ? format(closeTime) : '--'
  return `${open} - ${close}`
}

function getRelativeTime(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export default function BusinessDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const businessId = params.id

  const [business, setBusiness] = useState<Business | null>(null)
  const [promo, setPromo] = useState<PromoPost | null>(null)
  const [photos, setPhotos] = useState<BusinessPhoto[]>([])
  const [reviews, setReviews] = useState<BusinessReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const [reviewForm, setReviewForm] = useState<ReviewFormState>({
    rating: 0,
    comment: '',
    submitting: false,
    error: null,
  })
  const [userReview, setUserReview] = useState<BusinessReview | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchPhotos = async (supabase: ReturnType<typeof createClient>) => {
    const { data: photosData } = await supabase
      .from('business_photos')
      .select('id, photo_url, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (photosData) {
      setPhotos(photosData as BusinessPhoto[])
    }
  }

  const fetchReviews = async (supabase: ReturnType<typeof createClient>) => {
    const { data: reviewsData } = await supabase
      .from('business_reviews')
      .select('id, user_id, rating, comment, created_at, profiles(name, profile_photo_url)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (reviewsData) {
      const mapped = reviewsData.map((row: any) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          id: row.id,
          user_id: row.user_id,
          rating: row.rating,
          comment: row.comment,
          created_at: row.created_at,
          reviewer_name: profile?.name || 'Anonymous',
          reviewer_photo_url: profile?.profile_photo_url || null,
        } as BusinessReview
      })
      setReviews(mapped)

      if (currentUserId) {
        const existing = mapped.find((r) => r.user_id === currentUserId) || null
        setUserReview(existing)
      }
    }
    setReviewsLoading(false)
  }

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

      setCurrentUserId(user.id)

      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single()

      if (businessError || !businessData) {
        setError('Business not found')
        setLoading(false)
        return
      }

      setBusiness(businessData as Business)

      const { data: promoData } = await supabase
        .from('posts')
        .select('title, description')
        .eq('business_id', businessId)
        .eq('type', 'business')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (promoData) {
        setPromo(promoData as PromoPost)
      }

      await fetchPhotos(supabase)
      await fetchReviews(supabase)

      setLoading(false)
    }

    load()
  }, [businessId, router])

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !businessId) return

    setUploading(true)

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

      if (!publicUrl) throw new Error('Failed to get public URL')

      const { error: insertError } = await supabase.from('business_photos').insert({
        business_id: businessId,
        photo_url: publicUrl,
      })

      if (insertError) throw insertError

      await fetchPhotos(supabase)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeletePhoto = async (photo: BusinessPhoto) => {
    if (!window.confirm('Delete this photo?')) return

    try {
      const supabase = createClient()

      const { error: dbError } = await supabase
        .from('business_photos')
        .delete()
        .eq('id', photo.id)

      if (dbError) throw dbError

      const urlParts = photo.photo_url.split('/business-images/')
      const filePath = urlParts[1] || null

      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('business-images')
          .remove([filePath])

        if (storageError) throw storageError
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photo')
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Delete your review?')) return

    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase
        .from('business_reviews')
        .delete()
        .eq('id', reviewId)

      if (deleteError) throw deleteError

      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
      setUserReview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete review')
    }
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewForm.rating || !currentUserId || !businessId) return

    setReviewForm((prev) => ({ ...prev, submitting: true, error: null }))

    try {
      const supabase = createClient()
      const { error: insertError } = await supabase.from('business_reviews').insert({
        business_id: businessId,
        user_id: currentUserId,
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim() || null,
      })

      if (insertError) throw insertError

      await fetchReviews(supabase)
      setReviewForm({ rating: 0, comment: '', submitting: false, error: null })
    } catch (err) {
      setReviewForm((prev) => ({
        ...prev,
        submitting: false,
        error: err instanceof Error ? err.message : 'Failed to submit review',
      }))
    }
  }

  const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !business) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-on-surface-variant">{error || 'Business not found'}</p>
          <button
            type="button"
            onClick={() => router.push('/business')}
            className="mt-4 text-sm font-semibold text-primary"
          >
            Back to Businesses
          </button>
        </div>
      </div>
    )
  }

  const isOwner = currentUserId === business.owner_id
  const coverPhoto = photos.length > 0 ? photos[0].photo_url : null

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col items-center">
      
      {/* Top Navigation */}
      <header className={`fixed top-0 w-full z-50 transition-colors duration-200 ${scrolled ? 'bg-background/95 backdrop-blur-md shadow-md border-b border-outline-variant/30' : 'bg-transparent'}`}>
        <div className="flex justify-between items-center px-4 sm:px-6 h-14 sm:h-16 max-w-2xl mx-auto w-full">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-10 h-10 rounded-full bg-surface-container/90 backdrop-blur-md flex items-center justify-center shadow-md text-on-surface hover:bg-surface-container active:scale-95 transition-all border border-outline-variant/30 touch-target"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          
          {isOwner && (
            <Link
              href={`/business/${business.id}/edit`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container/90 backdrop-blur-md text-xs font-semibold text-primary border border-outline-variant/30 shadow-md hover:bg-surface-container active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              <span>Edit</span>
            </Link>
          )}
        </div>
      </header>

      {/* Cover Photo */}
      <div className="w-full max-w-2xl h-64 sm:h-72 relative">
        {coverPhoto ? (
          <img src={coverPhoto} alt={`${business.name} Cover`} className="w-full h-full object-cover rounded-b-3xl shadow-lg" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-container to-surface-container-high flex items-center justify-center rounded-b-3xl">
            <span className="material-symbols-outlined text-7xl text-primary/30">storefront</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent rounded-b-3xl pointer-events-none"></div>
      </div>

      {/* Main Content Container */}
      <main className="px-4 sm:px-6 -mt-8 relative z-10 w-full max-w-2xl space-y-4 sm:space-y-6 pb-24">
        
        {/* Header Section */}
        <section className="bg-surface-container-low p-4 sm:p-6 rounded-2xl shadow-xl border border-outline-variant/30 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h1 className="font-bold text-2xl sm:text-3xl text-on-surface leading-tight">{business.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 text-xs sm:text-sm text-on-surface-variant">
                {reviews.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-amber-400 text-base icon-fill">star</span>
                    <span className="font-semibold text-on-surface">{averageRating.toFixed(1)}</span>
                    <span>({reviews.length}) •</span>
                  </div>
                )}
                <span className="font-medium text-primary">{business.category}</span>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
              business.is_open 
                ? 'bg-primary/15 text-primary border border-primary/30' 
                : 'bg-surface-container text-on-surface-variant border border-outline-variant/30'
            }`}>
              {business.is_open ? 'Open Now' : 'Closed'}
            </span>
          </div>
          
          {business.description && (
            <p className="pt-2 border-t border-outline-variant/20 text-sm sm:text-base text-on-surface-variant leading-relaxed">
              {business.description}
            </p>
          )}
        </section>

        {/* Info Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {business.address && (
            <div className="bg-surface-container-low p-4 rounded-2xl shadow-md border border-outline-variant/30 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-xl mt-0.5 shrink-0">location_on</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">Address</span>
                <p className="text-sm font-medium text-on-surface mt-0.5">{business.address}</p>
              </div>
            </div>
          )}

          <div className="bg-surface-container-low p-4 rounded-2xl shadow-md border border-outline-variant/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-xl mt-0.5 shrink-0">schedule</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">Operating Hours</span>
              <p className="text-sm font-medium text-on-surface mt-0.5">{formatTimeRange(business.open_time, business.close_time)}</p>
            </div>
          </div>
        </section>

        {/* Promo Section */}
        {promo && (
          <section className="bg-surface-container-low rounded-2xl p-4 sm:p-5 shadow-md border border-outline-variant/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
            <div className="flex items-center gap-2 mb-1.5">
              <span className="material-symbols-outlined text-primary text-lg icon-fill">campaign</span>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Today&apos;s Promo</span>
            </div>
            <h3 className="font-semibold text-base sm:text-lg text-on-surface">{promo.title}</h3>
            {promo.description && (
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">{promo.description}</p>
            )}
          </section>
        )}

        {/* Owner Controls */}
        {isOwner && (
          <section className="grid grid-cols-2 gap-3">
            <Link
              href={`/business/${business.id}/promo`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-on-primary px-4 py-3 font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg active:scale-95 transition-all touch-target"
            >
              <span className="material-symbols-outlined text-base">campaign</span>
              <span>Post Promo</span>
            </Link>
            <Link
              href={`/business/${business.id}/edit`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-surface-container-low border border-outline-variant/40 px-4 py-3 font-semibold text-xs sm:text-sm text-on-surface hover:bg-surface-container active:scale-95 transition-all touch-target"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              <span>Edit Details</span>
            </Link>
          </section>
        )}

        {/* Photos Section */}
        <section className="bg-surface-container-low p-4 sm:p-5 rounded-2xl shadow-md border border-outline-variant/30 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base sm:text-lg text-on-surface">Photos</h2>
            {isOwner && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50 touch-target"
              >
                {uploading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <span className="material-symbols-outlined text-base">add</span>
                )}
                <span>Add Photo</span>
              </button>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAddPhoto} className="hidden" />

          {photos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {photos.map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group">
                  <img
                    src={photo.photo_url}
                    alt="Business photo"
                    className="h-full w-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                    onClick={() => window.open(photo.photo_url, '_blank')}
                  />
                  {isOwner && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePhoto(photo)
                      }}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-red-600 backdrop-blur-sm"
                      aria-label="Delete photo"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !uploading && (
              <div className="py-6 text-center border border-dashed border-outline-variant/40 rounded-xl">
                <p className="text-xs sm:text-sm text-on-surface-variant">
                  {isOwner ? 'Add photos of your space, menu, or products' : 'No photos uploaded yet'}
                </p>
              </div>
            )
          )}
        </section>

        {/* Reviews Section */}
        <section className="bg-surface-container-low p-4 sm:p-5 rounded-2xl shadow-md border border-outline-variant/30 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base sm:text-lg text-on-surface">Reviews</h2>
            {reviews.length > 0 && (
              <span className="text-xs text-on-surface-variant font-medium">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
            )}
          </div>

          {/* User Review Form */}
          {userReview ? (
            <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-4 space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Your Review</span>
                <button
                  type="button"
                  onClick={() => handleDeleteReview(userReview.id)}
                  className="text-error hover:bg-error/20 p-1 rounded-full transition-colors"
                  aria-label="Delete review"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
              <div className="flex items-center gap-0.5 text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={`material-symbols-outlined text-base ${star <= userReview.rating ? 'icon-fill' : ''}`}>star</span>
                ))}
              </div>
              {userReview.comment && (
                <p className="text-xs sm:text-sm text-on-surface">{userReview.comment}</p>
              )}
            </div>
          ) : (
            !isOwner && (
              <form onSubmit={handleReviewSubmit} className="bg-surface-container rounded-xl border border-outline-variant/30 p-4 space-y-3">
                <p className="text-sm font-semibold text-on-surface">Write a Review</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewForm((prev) => ({ ...prev, rating: star }))}
                      className="p-1 text-amber-400 hover:scale-110 active:scale-95 transition-transform touch-target flex items-center justify-center"
                      aria-label={`Rate ${star} stars`}
                    >
                      <span className={`material-symbols-outlined text-2xl ${star <= reviewForm.rating ? 'icon-fill' : 'opacity-40'}`}>
                        star
                      </span>
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder="Share your experience (optional)..."
                  rows={2}
                  className="w-full rounded-xl bg-surface-container-low border border-outline-variant/40 p-3 text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-all resize-none"
                />
                <button
                  type="submit"
                  disabled={!reviewForm.rating || reviewForm.submitting}
                  className="w-full bg-primary text-on-primary py-2.5 rounded-xl font-semibold text-xs sm:text-sm active:scale-[0.98] transition-all disabled:opacity-50 touch-target"
                >
                  {reviewForm.submitting ? 'Submitting...' : 'Submit Review'}
                </button>
                {reviewForm.error && <p className="text-center text-xs text-error">{reviewForm.error}</p>}
              </form>
            )
          )}

          {/* Review List */}
          {reviews.length > 0 ? (
            <div className="divide-y divide-outline-variant/20">
              {reviews.map((review) => (
                <div key={review.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {review.reviewer_photo_url ? (
                        <img
                          src={review.reviewer_photo_url}
                          alt={review.reviewer_name}
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-primary/30"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                          {review.reviewer_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-semibold text-xs sm:text-sm text-on-surface">{review.reviewer_name}</span>
                    </div>
                    <span className="text-xs text-on-surface-variant/70">{getRelativeTime(review.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={`material-symbols-outlined text-xs ${star <= review.rating ? 'icon-fill' : 'opacity-30'}`}>star</span>
                    ))}
                  </div>
                  {review.comment && (
                    <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !reviewsLoading && (
              <div className="py-6 text-center">
                <p className="text-xs sm:text-sm text-on-surface-variant">No reviews yet. Be the first to review!</p>
              </div>
            )
          )}
        </section>

      </main>
    </div>
  )
}
