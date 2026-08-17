'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type PostItem = {
  id: string
  type: 'individual' | 'business' | 'local'
  category: string | null
  title: string
  description: string | null
  event_date: string | null
  event_time: string | null
  status: string
  created_at: string
  location: string | null
  society_id: string | null
  business_id: string | null
}

type BusinessItem = {
  id: string
  name: string
  category: string | null
  description: string | null
  photo_url: string | null
  created_at: string
}

type Tab = 'all' | 'individual' | 'business' | 'local'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'individual', label: 'Activities' },
  { key: 'business', label: 'Businesses' },
  { key: 'local', label: 'Community' },
]

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

function formatEventDate(date: string | null, time: string | null): string | null {
  if (!date) return null
  const dateObj = new Date(`${date}T${time ?? '00:00'}`)
  const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (!time) return dateStr
  const timeObj = new Date(`1970-01-01T${time}`)
  const timeStr = timeObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} at ${timeStr}`
}

export default function MyPostsPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<PostItem[]>([])
  const [businesses, setBusinesses] = useState<BusinessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, type, category, title, description, event_date, event_time, status, created_at, location, society_id, business_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (postsError) {
        setError('Failed to load posts')
        setLoading(false)
        return
      }

      const { data: businessesData, error: businessesError } = await supabase
        .from('businesses')
        .select('id, name, category, description, photo_url, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (businessesError) {
        setError('Failed to load businesses')
        setLoading(false)
        return
      }

      setPosts((postsData ?? []) as PostItem[])
      setBusinesses((businessesData ?? []) as BusinessItem[])
      setLoading(false)
    }

    load()
  }, [router])

  const filteredPosts = useMemo(() => {
    if (activeTab === 'all') return posts
    return posts.filter((post) => post.type === activeTab)
  }, [posts, activeTab])

  const filteredBusinesses = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'business') return businesses
    return []
  }, [businesses, activeTab])

  const isEmpty = !loading && filteredPosts.length === 0 && filteredBusinesses.length === 0

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id)
    setShowDeleteDialog(true)
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!deleteTargetId || deleting) return
    setDeleting(true)
    setDeleteError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', deleteTargetId)

      if (error) throw error

      setPosts((prev) => prev.filter((p) => p.id !== deleteTargetId))
      setShowDeleteDialog(false)
      setDeleteTargetId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const getPostLink = (post: PostItem) => {
    if (post.type === 'individual') return `/activities/${post.id}`
    if (post.type === 'business') return `/business/${post.business_id || post.id}`
    if (post.type === 'local') return `/community/${post.id}`
    return '#'
  }

  const getPostCategory = (post: PostItem) => {
    if (post.type === 'individual') return post.category
    if (post.type === 'business') return 'Business'
    if (post.type === 'local') return 'Community'
    return null
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-outline-variant/30">
        <div className="flex justify-between items-center px-4 sm:px-6 h-14 sm:h-16 max-w-2xl mx-auto w-full">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors active:scale-95 touch-target"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="font-semibold text-base sm:text-lg text-on-surface truncate">My Posts</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-16">
        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full font-medium text-xs sm:text-sm whitespace-nowrap active:scale-95 transition-all touch-target ${
                activeTab === tab.key
                  ? 'bg-primary-container text-on-primary-container shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl border border-error/30 bg-error-container/20 p-4 text-center text-xs sm:text-sm text-error font-medium mb-4">
            {error}
          </div>
        )}

        {/* Posts List */}
        {activeTab !== 'business' && (
          <div className="space-y-3">
            {filteredPosts.map((post) => {
              const eventDisplay = formatEventDate(post.event_date, post.event_time)
              const isDeletable = post.type === 'individual' || post.type === 'local'

              return (
                <article
                  key={post.id}
                  className="bg-surface-container-low rounded-2xl p-4 sm:p-5 border border-outline-variant/30 flex flex-col gap-2 hover:border-primary/40 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getPostCategory(post) && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium text-xs">
                            {getPostCategory(post)}
                          </span>
                        )}
                        <span className="text-xs text-on-surface-variant/70">
                          {getRelativeTime(post.created_at)}
                        </span>
                      </div>
                      <Link href={getPostLink(post)} className="block">
                        <h3 className="font-semibold text-base leading-snug text-on-surface truncate group-hover:text-primary transition-colors">
                          {post.title}
                        </h3>
                      </Link>
                      {post.description && (
                        <p className="text-xs sm:text-sm text-on-surface-variant line-clamp-2 mt-1">
                          {post.description}
                        </p>
                      )}
                      {eventDisplay && (
                        <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">event</span>
                          <span>{eventDisplay}</span>
                        </p>
                      )}
                    </div>
                    {isDeletable && (
                      <button
                        type="button"
                        onClick={() => confirmDelete(post.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/20 hover:text-error transition-colors shrink-0 touch-target"
                        aria-label="Delete"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Businesses List */}
        {activeTab !== 'individual' && activeTab !== 'local' && (
          <div className="space-y-3 mt-3">
            {filteredBusinesses.map((business) => (
              <article
                key={business.id}
                className="bg-surface-container-low rounded-2xl p-4 sm:p-5 border border-outline-variant/30 flex items-center gap-3.5 hover:border-primary/40 transition-colors group"
              >
                <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center shrink-0 overflow-hidden">
                  {business.photo_url ? (
                    <img src={business.photo_url} alt={business.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-primary/40">storefront</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/business/${business.id}`} className="block">
                    <h3 className="font-semibold text-base text-on-surface truncate group-hover:text-primary transition-colors">
                      {business.name}
                    </h3>
                  </Link>
                  {business.category && (
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium text-xs">
                      {business.category}
                    </span>
                  )}
                  {business.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-1 mt-1">
                      {business.description}
                    </p>
                  )}
                  <p className="text-[11px] text-on-surface-variant/60 mt-0.5">
                    {getRelativeTime(business.created_at)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Empty State */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-3">inbox</span>
            <p className="font-semibold text-lg text-on-surface">No posts found</p>
            <p className="mt-1 text-xs sm:text-sm text-on-surface-variant">
              {activeTab === 'all'
                ? "You haven't created anything yet."
                : `No ${activeTab === 'individual' ? 'activities' : activeTab === 'business' ? 'businesses' : 'community posts'} created.`}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {activeTab === 'all' || activeTab === 'individual' ? (
                <Link
                  href="/activities/new"
                  className="px-4 py-2 rounded-full bg-primary text-on-primary font-semibold text-xs sm:text-sm shadow hover:brightness-110 active:scale-95 transition-all"
                >
                  Create Activity
                </Link>
              ) : null}
              {activeTab === 'all' || activeTab === 'business' ? (
                <Link
                  href="/business/new"
                  className="px-4 py-2 rounded-full bg-primary text-on-primary font-semibold text-xs sm:text-sm shadow hover:brightness-110 active:scale-95 transition-all"
                >
                  Create Business
                </Link>
              ) : null}
              {activeTab === 'all' || activeTab === 'local' ? (
                <Link
                  href="/community/new"
                  className="px-4 py-2 rounded-full bg-primary text-on-primary font-semibold text-xs sm:text-sm shadow hover:brightness-110 active:scale-95 transition-all"
                >
                  Create Post
                </Link>
              ) : null}
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface-container-low rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/30 space-y-4">
              <h3 className="font-bold text-lg text-on-surface">Delete Post</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Are you sure you want to delete this post? This action cannot be undone.
              </p>
              {deleteError && <p className="text-xs text-error font-medium">{deleteError}</p>}
              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeleteTargetId(null)
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
      </main>
    </div>
  )
}
