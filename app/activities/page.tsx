'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Category = 'Sports' | 'Study' | 'Hangout' | 'Market' | 'Events' | 'Fitness' | 'Other'

const CATEGORIES: Category[] = ['Sports', 'Study', 'Hangout', 'Market', 'Events', 'Fitness', 'Other']

interface Post {
  id: string
  user_id: string
  type: string
  category: Category
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  location?: string
  status: string
  distance_km: number
  author_name: string
  author_photo_url: string | null
}

interface ActivitiesPageProps {
  embedded?: boolean
}

export default function ActivitiesPage({ embedded = false }: ActivitiesPageProps) {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [interestedPostIds, setInterestedPostIds] = useState<Set<string>>(new Set())
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null)

  const fetchNearbyPosts = async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    try {
      const { data, error: rpcError } = await supabase.rpc('nearby_posts', {
        radius_km: 10,
        post_type: 'individual',
      })

      if (!rpcError && data && data.length > 0) {
        setPosts(data as Post[])
        setLoading(false)
        return
      }
    } catch {
      // Fall through to direct query
    }

    // Direct query fallback
    const { data: directPosts, error: directError } = await supabase
      .from('posts')
      .select('*, profiles(name, profile_photo_url)')
      .eq('type', 'individual')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (directError) {
      setError('Failed to load activities')
    } else if (directPosts) {
      const mapped = directPosts.map((p: any) => {
        const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
        return {
          id: p.id,
          user_id: p.user_id,
          type: p.type,
          category: p.category,
          title: p.title,
          description: p.description,
          photo_url: p.photo_url,
          event_date: p.event_date,
          event_time: p.event_time,
          status: p.status,
          created_at: p.created_at,
          distance_km: 0.5,
          author_name: prof?.name || 'Neighbor',
          author_photo_url: prof?.profile_photo_url || null,
        } as Post
      })
      setPosts(mapped)
    }

    setLoading(false)
  }

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
      await fetchNearbyPosts()
    }

    load()
  }, [router])

  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'All') return posts
    return posts.filter((post) => post.category === selectedCategory)
  }, [posts, selectedCategory])

  const formatEventDate = (date: string, time: string | null) => {
    const dateObj = new Date(`${date}T${time ?? '00:00'}`)
    return {
      date: dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      time: time
        ? new Date(`1970-01-01T${time}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : null,
    }
  }

  const handleInterested = async (postId: string, postAuthorId: string) => {
    if (!currentUserId) return

    setLoadingPostId(postId)

    try {
      const supabase = createClient()

      const { error: interestError } = await supabase.from('interests').insert({
        post_id: postId,
        user_id: currentUserId,
      })

      if (interestError && interestError.code !== '23505') {
        throw interestError
      }

      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .eq('post_id', postId)
        .or(`and(user_one_id.eq.${currentUserId},user_two_id.eq.${postAuthorId}),and(user_one_id.eq.${postAuthorId},user_two_id.eq.${currentUserId})`)
        .maybeSingle()

      let chatId: string

      if (existingChat) {
        chatId = existingChat.id
      } else {
        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({
            post_id: postId,
            user_one_id: currentUserId,
            user_two_id: postAuthorId,
          })
          .select('id')
          .single()

        if (chatError || !newChat) throw chatError || new Error('Failed to create chat')
        chatId = newChat.id
      }

      setInterestedPostIds((prev) => new Set(prev).add(postId))
      router.push(`/chat/${chatId}`)
    } catch (err) {
      console.error('Failed to express interest:', err)
      setLoadingPostId(null)
    }
  }

  const mainContent = (
    <div className="w-full flex flex-col">
      {/* Category Filter Bar */}
      <div className={`w-full py-2 sticky ${embedded ? 'top-0' : 'top-0'} z-30 bg-background/95 backdrop-blur-md border-b border-outline-variant/30`}>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-1 pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className={`px-4 py-2 rounded-full font-medium text-xs sm:text-sm whitespace-nowrap active:scale-95 transition-all flex-shrink-0 touch-target ${
              selectedCategory === 'All'
                ? 'bg-primary-container text-on-primary-container shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full font-medium text-xs sm:text-sm whitespace-nowrap active:scale-95 transition-all flex-shrink-0 touch-target ${
                selectedCategory === category
                  ? 'bg-primary-container text-on-primary-container shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {error && (
          <div className="sm:col-span-full rounded-2xl border border-error/30 bg-error-container/20 p-4 text-center font-medium text-error text-sm">
            {error}
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
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-3">explore_off</span>
            <p className="text-lg sm:text-xl font-semibold text-on-surface mb-1">No activities nearby yet</p>
            <p className="text-xs sm:text-sm text-on-surface-variant">Be the first to create one for your neighbors!</p>
          </div>
        )}

        {!error && !loading && filteredPosts.length > 0 &&
          filteredPosts.map((post) => {
            const formattedDate = formatEventDate(post.event_date, post.event_time)
            const isOwnPost = currentUserId === post.user_id
            const isInterested = interestedPostIds.has(post.id)
            const isLoading = loadingPostId === post.id

            return (
              <article
                key={post.id}
                className="bg-surface-container-low rounded-2xl p-4 sm:p-5 border border-outline-variant/30 flex flex-col justify-between gap-3 hover:border-primary/40 hover:shadow-lg transition-all duration-200 group"
              >
                <Link href={`/activities/${post.id}`} className="flex items-start gap-3 group/link">
                  {post.author_photo_url ? (
                    <img
                      src={post.author_photo_url}
                      alt={post.author_name}
                      className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-primary/40 group-hover/link:ring-primary transition-all"
                    />
                  ) : (
                    <div className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary font-bold text-sm ring-2 ring-primary/40">
                      {post.author_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium text-xs">
                        {post.category}
                      </span>
                      <span className="text-xs text-on-surface-variant/70">
                        {post.distance_km.toFixed(1)} km away
                      </span>
                    </div>

                    <h3 className="font-semibold text-base leading-snug text-on-surface line-clamp-2 group-hover/link:text-primary transition-colors">
                      {post.title}
                    </h3>
                  </div>
                </Link>

                <div className="flex items-center gap-2 text-xs sm:text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-base">event</span>
                  <span>{formattedDate.date}{formattedDate.time ? ` • ${formattedDate.time}` : ''}</span>
                </div>

                {post.description && (
                  <p className="text-on-surface-variant text-xs sm:text-sm line-clamp-2 leading-relaxed">
                    {post.description}
                  </p>
                )}

                <div className="pt-2 mt-auto border-t border-outline-variant/20 flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant truncate max-w-[120px]">
                    By {post.author_name}
                  </span>

                  {isOwnPost ? (
                    <span className="text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full font-medium">
                      Your post
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleInterested(post.id, post.user_id)
                      }}
                      disabled={isInterested || isLoading}
                      className="bg-primary text-on-primary px-3.5 py-1.5 rounded-xl font-medium text-xs shadow hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 touch-target"
                    >
                      {isLoading && (
                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      )}
                      <span>{isInterested ? 'Interested ✓' : 'Interested'}</span>
                    </button>
                  )}
                </div>
              </article>
            )
          })}
      </div>

      {/* FAB - Add Activity */}
      <button
        type="button"
        onClick={() => router.push('/activities/new')}
        className={`fixed ${embedded ? 'bottom-20 md:bottom-6' : 'bottom-6'} right-5 sm:right-8 w-13 h-13 sm:w-14 sm:h-14 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-xl z-40 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 touch-target`}
        aria-label="Add new activity"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </div>
  )

  if (embedded) {
    return <div className="w-full flex flex-col">{mainContent}</div>
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <header className="bg-surface/95 flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16 w-full sticky top-0 z-40 backdrop-blur-sm border-b border-outline-variant/30 md:hidden">
        <h1 className="font-semibold text-base sm:text-lg text-on-surface">Activities</h1>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-24 md:pb-8 max-w-7xl mx-auto w-full flex flex-col">
        {mainContent}
      </main>
    </div>
  )
}