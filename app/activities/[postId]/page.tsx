'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type PostDetail = {
  id: string
  user_id: string
  type: string
  category: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  location: string | null
  status: string
  created_at: string
  author_name: string
  author_photo_url: string | null
}

type InterestUser = {
  user_id: string
  name: string
  profile_photo_url: string | null
}

function formatEventDateTime(date: string, time: string | null): string {
  const dateObj = new Date(`${date}T${time ?? '00:00'}`)
  const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (!time) return dateStr
  const timeObj = new Date(`1970-01-01T${time}`)
  const timeStr = timeObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} at ${timeStr}`
}

export default function ActivityDetailPage() {
  const router = useRouter()
  const params = useParams<{ postId: string }>()
  const postId = params.postId

  const [post, setPost] = useState<PostDetail | null>(null)
  const [interestCount, setInterestCount] = useState(0)
  const [interestedUsers, setInterestedUsers] = useState<InterestUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isInterested, setIsInterested] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchPost = useCallback(async (supabase: ReturnType<typeof createClient>) => {
    const { data, error: postError } = await supabase
      .from('posts')
      .select('id, user_id, type, category, title, description, event_date, event_time, location, status, created_at, profiles(name, profile_photo_url)')
      .eq('id', postId)
      .eq('type', 'individual')
      .single()

    if (postError || !data) {
      setError('Activity not found')
      setLoading(false)
      return
    }

    const profile = Array.isArray((data as any).profiles) ? (data as any).profiles[0] : (data as any).profiles

    const mapped: PostDetail = {
      id: (data as any).id,
      user_id: (data as any).user_id,
      type: (data as any).type,
      category: (data as any).category,
      title: (data as any).title,
      description: (data as any).description,
      event_date: (data as any).event_date,
      event_time: (data as any).event_time,
      location: (data as any).location,
      status: (data as any).status,
      created_at: (data as any).created_at,
      author_name: profile?.name || 'Unknown',
      author_photo_url: profile?.profile_photo_url || null,
    }

    setPost(mapped)
  }, [postId])

  const fetchInterestData = useCallback(async (supabase: ReturnType<typeof createClient>) => {
    const { count } = await supabase
      .from('interests')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId)

    setInterestCount(count || 0)

    const { data: interests } = await supabase
      .from('interests')
      .select('user_id, profiles(name, profile_photo_url)')
      .eq('post_id', postId)

    if (interests) {
      const mapped = interests.map((row: any) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          user_id: row.user_id,
          name: profile?.name || 'Anonymous',
          profile_photo_url: profile?.profile_photo_url || null,
        }
      })
      setInterestedUsers(mapped)
    }
  }, [postId])

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

      await fetchPost(supabase)
      await fetchInterestData(supabase)

      if (postId) {
        const { data: existingInterest } = await supabase
          .from('interests')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle()

        setIsInterested(!!existingInterest)
      }

      setLoading(false)
    }

    if (postId) {
      load()
    }
  }, [postId, router, fetchPost, fetchInterestData])

  const handleInterested = async () => {
    if (!currentUserId || !post || isInterested || actionLoading) return

    setActionLoading(true)

    try {
      const supabase = createClient()

      const { error: interestError } = await supabase.from('interests').insert({
        post_id: post.id,
        user_id: currentUserId,
      })

      if (interestError && interestError.code !== '23505') {
        throw interestError
      }

      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .eq('post_id', post.id)
        .or(`and(user_one_id.eq.${currentUserId},user_two_id.eq.${post.user_id}),and(user_one_id.eq.${post.user_id},user_two_id.eq.${currentUserId})`)
        .maybeSingle()

      let chatId: string

      if (existingChat) {
        chatId = existingChat.id
      } else {
        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({
            post_id: post.id,
            user_one_id: currentUserId,
            user_two_id: post.user_id,
          })
          .select('id')
          .single()

        if (chatError || !newChat) throw chatError || new Error('Failed to create chat')
        chatId = newChat.id
      }

      setIsInterested(true)
      setInterestCount((prev) => prev + 1)
      router.push(`/chat/${chatId}`)
    } catch (err) {
      console.error('Failed to express interest:', err)
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!postId || deleting) return
    setDeleting(true)
    setDeleteError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)

      if (error) throw error

      router.push('/activities')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete activity')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-on-surface-variant">{error || 'Activity not found'}</p>
          <button
            type="button"
            onClick={() => router.push('/activities')}
            className="mt-4 text-sm font-semibold text-primary"
          >
            Back to Activities
          </button>
        </div>
      </div>
    )
  }

  const isOwner = currentUserId === post.user_id
  const isExpired = post.status !== 'active'

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-outline-variant/30">
        <div className="flex justify-between items-center px-4 sm:px-6 h-14 sm:h-16 max-w-2xl mx-auto w-full">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full hover:bg-surface-container transition-colors active:scale-90 flex items-center justify-center text-on-surface touch-target -ml-2"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="font-semibold text-base sm:text-lg text-on-surface truncate">Activity Details</h1>
          <div className="flex gap-1">
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                className="w-10 h-10 rounded-full hover:bg-error/20 transition-colors active:scale-90 flex items-center justify-center text-error touch-target"
                aria-label="Delete"
              >
                <span className="material-symbols-outlined text-xl">delete</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
        {/* Author & Category */}
        <section className="flex items-center gap-3.5">
          {post.author_photo_url ? (
            <img
              src={post.author_photo_url}
              alt={post.author_name}
              className="w-12 h-12 rounded-full object-cover shadow-sm ring-2 ring-primary/40"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-lg shadow-sm ring-2 ring-primary/40">
              {post.author_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <p className="font-semibold text-base text-on-surface">{post.author_name}</p>
            <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium text-xs">
              {post.category}
            </span>
          </div>
        </section>

        {/* Title & Description */}
        <section className="space-y-3">
          <h1 className="font-bold text-2xl sm:text-3xl text-on-surface leading-tight">
            {post.title}
          </h1>
          {post.description && (
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {post.description}
            </p>
          )}
        </section>

        {/* Event Info Card */}
        <section className="bg-surface-container-low rounded-2xl p-4 sm:p-5 shadow-md border border-outline-variant/30 space-y-2.5">
          <div className="flex items-center gap-3 text-on-surface">
            <span className="material-symbols-outlined text-primary text-xl icon-fill">event</span>
            <span className="font-medium text-sm sm:text-base">{formatEventDateTime(post.event_date, post.event_time)}</span>
          </div>
          {post.location && (
            <div className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-xl">location_on</span>
              <span className="text-sm sm:text-base">{post.location}</span>
            </div>
          )}
        </section>

        {/* Interested Users List */}
        {interestCount > 0 && (
          <section className="bg-surface-container-low rounded-2xl shadow-md border border-outline-variant/30 p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-base sm:text-lg text-on-surface">
              {interestCount} {interestCount === 1 ? 'Person' : 'People'} Interested
            </h2>
            <div className="divide-y divide-outline-variant/20">
              {interestedUsers.map((user) => (
                <div key={user.user_id} className="flex items-center gap-3 py-2.5">
                  {user.profile_photo_url ? (
                    <img
                      src={user.profile_photo_url}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-primary/30"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-semibold text-xs ring-1 ring-primary/30">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-sm text-on-surface">{user.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action Button Section */}
        {isExpired ? (
          <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/30 text-center">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-1 block">event_busy</span>
            <p className="font-medium text-sm text-on-surface-variant">This activity has ended</p>
          </div>
        ) : isOwner ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full bg-error/15 text-error py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-error/25 active:scale-[0.98] transition-all border border-error/30 touch-target"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              <span>Delete Activity</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {isInterested ? (
              <div className="bg-primary/10 border border-primary/30 rounded-2xl py-4 px-6 text-center">
                <span className="font-semibold text-sm sm:text-base text-primary block">You&apos;re interested in this activity</span>
                <p className="text-xs text-on-surface-variant mt-1">
                  You can chat with the host in your Messages.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleInterested}
                disabled={actionLoading}
                className="w-full bg-primary text-on-primary py-3.5 sm:py-4 rounded-2xl font-semibold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 touch-target"
              >
                {actionLoading && (
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                )}
                <span>I&apos;m Interested</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-low rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/30 space-y-4">
            <h3 className="font-bold text-lg text-on-surface">Delete Activity</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Are you sure you want to delete this activity? This action cannot be undone.
            </p>
            {deleteError && <p className="text-xs text-error font-medium">{deleteError}</p>}
            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setDeleteError(null)
                }}
                disabled={deleting}
                className="px-4 py-2 rounded-full border border-outline-variant/40 text-on-surface hover:bg-surface-container text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-full bg-error text-on-error hover:bg-error/90 active:scale-95 text-sm font-semibold transition-all disabled:opacity-50 touch-target"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
