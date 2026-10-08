'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getPublicStoragePath } from '@/lib/storage-path'

type Category = 'All' | 'Help Request' | 'Notice' | 'General'

const CATEGORIES: Category[] = ['All', 'Help Request', 'Notice', 'General']

interface CommunityPost {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string
  photo_url: string | null
  created_at: string
  reply_count: number
  author_name: string
  author_photo_url: string | null
}

interface Society {
  name: string
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

function getInitials(name: string): string {
  const names = name.trim().split(' ')
  if (names.length >= 2) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

interface CommunityFeedPageProps {
  embedded?: boolean
}

export default function CommunityFeedPage({ embedded = false }: CommunityFeedPageProps) {
  const router = useRouter()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [societyId, setSocietyId] = useState<string | null>(null)
  const [societyName, setSocietyName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category>('All')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)

  const fetchPosts = async (currentSocietyId: string | null) => {
    const supabase = createClient()
    setLoading(true)
    setError(null)

    if (!currentSocietyId) {
      setPosts([])
      setLoading(false)
      return
    }

    let query = supabase
      .from('posts')
      .select('id, title, description, category, photo_url, created_at, user_id')
      .eq('type', 'local')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    query = query.eq('society_id', currentSocietyId)

    const { data: postsData, error: postsError } = await query

    if (postsError) {
      setError('Failed to load posts')
      setLoading(false)
      return
    }

    if (!postsData || postsData.length === 0) {
      setPosts([])
      setLoading(false)
      return
    }

    const authorIds = [...new Set(postsData.map((row) => row.user_id))]
    const { data: authorProfiles } = await supabase
      .from('public_profiles')
      .select('id, name, profile_photo_url')
      .in('id', authorIds)
    const authorById = new Map((authorProfiles ?? []).map((profile) => [profile.id, profile]))

    const mappedPosts: CommunityPost[] = postsData.map((row) => {
      const profile = authorById.get(row.user_id)
      return {
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        description: row.description,
        category: row.category,
        photo_url: row.photo_url,
        created_at: row.created_at,
        reply_count: 0,
        author_name: profile?.name || 'Neighbor',
        author_photo_url: profile?.profile_photo_url || null,
      }
    })

    const postIds = mappedPosts.map((p) => p.id)

    const { data: replyCounts } = await supabase
      .from('replies')
      .select('post_id')
      .in('post_id', postIds)

    const replyCountMap = new Map<string, number>()
    if (replyCounts) {
      for (const reply of replyCounts) {
        replyCountMap.set(reply.post_id, (replyCountMap.get(reply.post_id) || 0) + 1)
      }
    }

    const postsWithCounts = mappedPosts.map((post) => ({
      ...post,
      reply_count: replyCountMap.get(post.id) || 0,
    }))

    setPosts(postsWithCounts)
    setLoading(false)
  }

  useEffect(() => {
    if (!embedded) {
      router.replace('/?tab=community')
      return
    }

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('society_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.society_id) {
        setSocietyId(profile.society_id)
        const { data: society } = await supabase
          .from('societies')
          .select('name')
          .eq('id', profile.society_id)
          .maybeSingle()

        if (society) {
          setSocietyName((society as Society).name)
        }
      } else {
        setSocietyId(null)
        setSocietyName(null)
      }

      await fetchPosts(profile?.society_id || null)
    }

    load()
  }, [embedded, router])

  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'All') return posts
    return posts.filter((post) => post.category === selectedCategory)
  }, [posts, selectedCategory])

  const handleDeletePost = async (post: CommunityPost) => {
    if (!currentUserId || deletingPostId) return
    if (!window.confirm(`Delete "${post.title}"? This action cannot be undone.`)) return

    setDeletingPostId(post.id)
    setDeleteMessage(null)

    try {
      const supabase = createClient()
      const { data: postToDelete, error: fetchError } = await supabase
        .from('posts')
        .select('photo_url')
        .eq('id', post.id)
        .eq('user_id', currentUserId)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!postToDelete) throw new Error('You can only delete your own community posts.')

      const { data: deletedPost, error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', currentUserId)
        .select('id')
        .maybeSingle()

      if (deleteError) throw deleteError
      if (!deletedPost) throw new Error('Post could not be deleted.')

      setPosts((currentPosts) => currentPosts.filter((item) => item.id !== post.id))

      const photoPath = getPublicStoragePath(postToDelete.photo_url, 'community-images')
      if (photoPath) {
        const { error: storageError } = await supabase.storage.from('community-images').remove([photoPath])
        if (storageError) setDeleteMessage('Post deleted, but its image could not be removed.')
      }
    } catch (err) {
      setDeleteMessage(err instanceof Error ? err.message : 'Failed to delete post.')
    } finally {
      setDeletingPostId(null)
    }
  }

  const mainContent = (
    <div className="w-full flex flex-col text-on-surface">
      {/* Category Filter */}
      <div className={`w-full py-2 sticky ${embedded ? 'top-0' : 'top-0'} z-30 bg-background/95 backdrop-blur-md border-b border-outline-variant/30`}>
        <div className="flex overflow-x-auto hide-scrollbar gap-2 px-1 pb-1">
          {CATEGORIES.map((category) => {
            const isActive = selectedCategory === category
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full font-medium text-xs sm:text-sm whitespace-nowrap active:scale-95 transition-all flex-shrink-0 touch-target ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {category}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-4 flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {error && (
          <div className="sm:col-span-full rounded-2xl border border-error/30 bg-error-container/20 p-4 text-center font-medium text-error text-sm">
            {error}
          </div>
        )}
        {deleteMessage && (
          <div role="status" className="sm:col-span-full rounded-2xl border border-error/30 bg-error-container/20 p-4 text-center font-medium text-error text-sm">
            {deleteMessage}
          </div>
        )}

        {!error && loading && (
          <>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-surface-container-low border border-outline-variant/20" />
            ))}
          </>
        )}

        {!error && !loading && filteredPosts.length === 0 && (
          <div className="sm:col-span-full flex flex-col items-center justify-center py-16 sm:py-24 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-3">forum</span>
            <p className="text-lg sm:text-xl font-semibold text-on-surface mb-1">No community posts yet</p>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              {societyId
                ? 'Be the first to share something with your society!'
                : 'Choose your neighborhood during onboarding to join its community.'}
            </p>
          </div>
        )}

        {!error && !loading && filteredPosts.length > 0 &&
          filteredPosts.map((post) => {
            const isOwnPost = currentUserId === post.user_id

            return (
              <article
                key={post.id}
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:border-primary/40 hover:shadow-lg transition-all duration-200 h-full flex flex-col justify-between gap-3 group"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className={`px-2.5 py-0.5 font-medium text-xs rounded-full ${
                    post.category === 'Help Request'
                      ? 'bg-error/15 text-error border border-error/30'
                      : post.category === 'Notice'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-surface-container text-on-surface-variant border border-outline-variant/30'
                  }`}>
                    {post.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-on-surface-variant/70 text-xs whitespace-nowrap">
                      {getRelativeTime(post.created_at)}
                    </span>
                    {isOwnPost && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post)}
                        disabled={deletingPostId !== null}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-error disabled:opacity-50"
                        aria-label={`Delete ${post.title}`}
                        title="Delete community post"
                      >
                        {deletingPostId === post.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <span className="material-symbols-outlined text-lg">delete</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <Link href={`/community/${post.id}`} className="flex flex-1 flex-col gap-3">
                  <div>
                    <h2 className="font-semibold text-base leading-snug text-on-surface mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    {post.description && (
                      <p className="text-on-surface-variant text-xs sm:text-sm line-clamp-2 leading-relaxed">
                        {post.description}
                      </p>
                    )}
                  </div>

                  {post.photo_url && (
                    <div className="w-full h-32 rounded-xl overflow-hidden shrink-0 bg-surface-container">
                      <img
                        src={post.photo_url}
                        alt="Attachment"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                </Link>

                <div className="flex items-center justify-between border-t border-outline-variant/20 pt-2.5 mt-auto">
                  <div className="flex items-center gap-2 min-w-0">
                    {post.author_photo_url ? (
                      <img
                        src={post.author_photo_url}
                        alt={post.author_name}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-primary/30"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs ring-1 ring-primary/30">
                        {getInitials(post.author_name)}
                      </div>
                    )}
                    <span className="text-xs text-on-surface truncate max-w-[120px]">
                      {post.author_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-on-surface-variant text-xs font-medium">
                    <span className="material-symbols-outlined text-base">chat_bubble_outline</span>
                    <span>{post.reply_count}</span>
                  </div>
                </div>
              </article>
            )
          })}
      </div>

      {/* FAB - Create Post */}
      {societyId && (
        <button
          aria-label="Create new community post"
          onClick={() => router.push('/community/new')}
          className={`fixed ${embedded ? 'bottom-20 md:bottom-6' : 'bottom-6'} right-5 sm:right-8 w-13 h-13 sm:h-14 sm:w-14 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-xl z-40 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 touch-target`}
        >
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className="w-full flex flex-col">
        {mainContent}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <header className="bg-surface/95 flex flex-col justify-center px-4 sm:px-6 py-3 w-full sticky top-0 z-40 backdrop-blur-sm border-b border-outline-variant/30 md:hidden">
        <h1 className="font-semibold text-base sm:text-lg text-on-surface text-center">Community Board</h1>
        {societyName && (
          <div className="flex items-center justify-center gap-1.5 mt-0.5 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined text-sm text-primary">location_on</span>
            <span className="font-medium">{societyName}</span>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-24 md:pb-8 max-w-7xl mx-auto w-full flex flex-col">
        {mainContent}
      </main>
    </div>
  )
}
