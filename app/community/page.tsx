'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Category = 'All' | 'Help Request' | 'Notice' | 'General'

const CATEGORIES: Category[] = ['All', 'Help Request', 'Notice', 'General']

interface CommunityPost {
  id: string
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
  const [societyName, setSocietyName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category>('All')

  const fetchPosts = async (societyId: string) => {
    const supabase = createClient()
    setLoading(true)
    setError(null)

    let query = supabase
      .from('posts')
      .select('id, title, description, category, photo_url, created_at, user_id, profiles(name, profile_photo_url)')
      .eq('type', 'local')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (societyId) {
      query = query.eq('society_id', societyId)
    }

    let { data: postsData, error: postsError } = await query

    // Fallback if no posts in this specific society
    if (!postsData || postsData.length === 0) {
      const { data: allLocalPosts } = await supabase
        .from('posts')
        .select('id, title, description, category, photo_url, created_at, user_id, profiles(name, profile_photo_url)')
        .eq('type', 'local')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20)

      postsData = allLocalPosts
    }

    if (postsError && !postsData) {
      setError('Failed to load posts')
      setLoading(false)
      return
    }

    if (!postsData || postsData.length === 0) {
      setPosts([])
      setLoading(false)
      return
    }

    const mappedPosts: CommunityPost[] = postsData.map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return {
        id: row.id,
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('society_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.society_id) {
        const { data: society } = await supabase
          .from('societies')
          .select('name')
          .eq('id', profile.society_id)
          .maybeSingle()

        if (society) {
          setSocietyName((society as Society).name)
        }
      }

      await fetchPosts(profile?.society_id || '')
    }

    load()
  }, [router])

  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'All') return posts
    return posts.filter((post) => post.category === selectedCategory)
  }, [posts, selectedCategory])

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
            <p className="text-xs sm:text-sm text-on-surface-variant">Be the first to share something with your society!</p>
          </div>
        )}

        {!error && !loading && filteredPosts.length > 0 &&
          filteredPosts.map((post) => (
            <Link key={post.id} href={`/community/${post.id}`} className="group">
              <article className="bg-surface-container-low rounded-2xl border border-outline-variant/30 p-4 sm:p-5 active:scale-[0.98] hover:border-primary/40 hover:shadow-lg transition-all duration-200 h-full flex flex-col justify-between gap-3">
                {/* Top info */}
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 font-medium text-xs rounded-full ${
                      post.category === 'Help Request' 
                        ? 'bg-error/15 text-error border border-error/30' 
                        : post.category === 'Notice'
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-surface-container text-on-surface-variant border border-outline-variant/30'
                    }`}>
                      {post.category}
                    </span>
                    <span className="text-on-surface-variant/70 text-xs whitespace-nowrap">
                      {getRelativeTime(post.created_at)}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="font-semibold text-base leading-snug text-on-surface mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>

                  {/* Description */}
                  {post.description && (
                    <p className="text-on-surface-variant text-xs sm:text-sm line-clamp-2 leading-relaxed">
                      {post.description}
                    </p>
                  )}
                </div>

                {/* Optional Image */}
                {post.photo_url && (
                  <div className="w-full h-32 rounded-xl overflow-hidden shrink-0 bg-surface-container">
                    <img
                      src={post.photo_url}
                      alt="Attachment"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                {/* Footer */}
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
            </Link>
          ))}
      </div>

      {/* FAB - Create Post */}
      <button
        aria-label="Create new community post"
        onClick={() => router.push('/community/new')}
        className={`fixed ${embedded ? 'bottom-20 md:bottom-6' : 'bottom-6'} right-5 sm:right-8 w-13 h-13 sm:w-14 sm:h-14 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-xl z-40 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 touch-target`}
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
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
