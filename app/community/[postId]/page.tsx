'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient()

type Post = {
  id: string
  user_id: string
  type: string
  category: string
  title: string
  description: string | null
  photo_url: string | null
  society_id: string
  status: string
  created_at: string
  author_name: string
  author_photo_url: string | null
}

type Reply = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  author_name: string
  author_photo_url: string | null
}

type Profile = {
  society_id: string | null
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

export default function CommunityPostDetailPage() {
  const router = useRouter()
  const params = useParams<{ postId: string }>()
  const postId = params.postId

  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
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
        .single()

      const societyId = (profile as Profile | null)?.society_id || null

      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*, profiles(name, profile_photo_url)')
        .eq('id', postId)
        .single()

      if (postError || !postData) {
        setError('Post not found')
        setLoading(false)
        return
      }

      const postWithProfile = postData
      const profileData = Array.isArray(postWithProfile.profiles)
        ? postWithProfile.profiles[0]
        : postWithProfile.profiles

      const mappedPost: Post = {
        id: postWithProfile.id,
        user_id: postWithProfile.user_id,
        type: postWithProfile.type,
        category: postWithProfile.category,
        title: postWithProfile.title,
        description: postWithProfile.description,
        photo_url: postWithProfile.photo_url,
        society_id: postWithProfile.society_id,
        status: postWithProfile.status,
        created_at: postWithProfile.created_at,
        author_name: profileData?.name || 'Neighbor',
        author_photo_url: profileData?.profile_photo_url || null,
      }

      setPost(mappedPost)

      const { data: repliesData } = await supabase
        .from('replies')
        .select('id, post_id, user_id, content, created_at, profiles(name, profile_photo_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (repliesData) {
        const mappedReplies: Reply[] = repliesData.map((row) => {
          const replyProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
          return {
            id: row.id,
            post_id: row.post_id,
            user_id: row.user_id,
            content: row.content,
            created_at: row.created_at,
            author_name: replyProfile?.name || 'Anonymous',
            author_photo_url: replyProfile?.profile_photo_url || null,
          }
        })
        setReplies(mappedReplies)
      }

      setLoading(false)
    }

    load()
  }, [postId, router])

  useEffect(() => {
    if (!postId) return

    const channel = supabase
      .channel(`replies:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'replies',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          const { data: authorProfile } = await supabase
            .from('profiles')
            .select('name, profile_photo_url')
            .eq('id', payload.new.user_id)
            .single()

          const newReply = {
            ...payload.new,
            author_name: authorProfile?.name || 'Anonymous',
            author_photo_url: authorProfile?.profile_photo_url || null,
          } as Reply

          setReplies((prev) => {
            if (prev.some((r) => r.id === newReply.id)) return prev
            return [...prev, newReply]
          })

          setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
          }, 100)
        }
      )
      .subscribe((status) => {
        console.log('Replies realtime status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [postId])

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim() || !currentUserId || !postId) return

    setSubmitting(true)

    try {
      const supabase = createClient()
      const { error: insertError } = await supabase.from('replies').insert({
        post_id: postId,
        user_id: currentUserId,
        content: replyContent.trim(),
      })

      if (insertError) throw insertError

      setReplyContent('')
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePost = async () => {
    if (!window.confirm('Delete this post?')) return

    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)

      if (deleteError) throw deleteError

      router.push('/community')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post')
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
          <p className="text-on-surface-variant">{error || 'Post not found'}</p>
          <button
            type="button"
            onClick={() => router.push('/community')}
            className="mt-4 text-sm font-semibold text-primary"
          >
            Back to Community
          </button>
        </div>
      </div>
    )
  }

  const isAuthor = post.user_id === currentUserId

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 -ml-2 text-on-surface hover:bg-surface-container rounded-full transition-colors active:scale-95 flex items-center justify-center touch-target"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="font-semibold text-base sm:text-lg text-on-surface truncate">Community Post</h1>
          <div className="w-10 flex justify-end">
            {isAuthor && (
              <button
                onClick={handleDeletePost}
                className="w-10 h-10 rounded-full text-error hover:bg-error/20 transition-colors active:scale-90 flex items-center justify-center touch-target"
                title="Delete Post"
                aria-label="Delete"
              >
                <span className="material-symbols-outlined text-xl">delete</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-28 flex flex-col gap-6">
        <article className="bg-surface-container-low rounded-2xl p-4 sm:p-6 border border-outline-variant/30 space-y-4">
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
            <span className="text-on-surface-variant/70 text-xs">
              {getRelativeTime(post.created_at)}
            </span>
          </div>

          <h1 className="font-bold text-xl sm:text-2xl text-on-surface leading-tight">
            {post.title}
          </h1>

          <div className="flex items-center gap-2.5 py-1">
            {post.author_photo_url ? (
              <img
                src={post.author_photo_url}
                alt={post.author_name}
                className="w-9 h-9 rounded-full object-cover ring-1 ring-primary/30"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold ring-1 ring-primary/30">
                {getInitials(post.author_name)}
              </div>
            )}
            <span className="font-semibold text-xs sm:text-sm text-on-surface">
              {post.author_name}
            </span>
          </div>

          {post.description && (
            <p className="text-sm sm:text-base text-on-surface-variant whitespace-pre-wrap leading-relaxed">
              {post.description}
            </p>
          )}

          {post.photo_url && (
            <div className="w-full h-56 sm:h-72 rounded-2xl overflow-hidden bg-surface-container mt-3">
              <img
                src={post.photo_url}
                alt="Attachment"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </article>

        {/* Replies Section */}
        <section className="space-y-4">
          <h2 className="font-semibold text-base sm:text-lg text-on-surface">
            Replies ({replies.length})
          </h2>

          {replies.length === 0 ? (
            <div className="py-10 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-1 block">chat_bubble_outline</span>
              <p className="text-xs sm:text-sm text-on-surface-variant">No replies yet. Join the conversation!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className="bg-surface-container-low rounded-2xl border border-outline-variant/30 p-3.5 sm:p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {reply.author_photo_url ? (
                        <img
                          src={reply.author_photo_url}
                          alt={reply.author_name}
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-primary/30"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                          {getInitials(reply.author_name)}
                        </div>
                      )}
                      <span className="font-semibold text-xs sm:text-sm text-on-surface">
                        {reply.author_name}
                      </span>
                    </div>
                    <span className="text-on-surface-variant/70 text-[11px]">
                      {getRelativeTime(reply.created_at)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">
                    {reply.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Fixed Reply Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-md border-t border-outline-variant/30 z-40 pb-safe">
        <form onSubmit={handleReplySubmit} className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-end gap-2.5">
          <div className="flex-1 bg-surface-container-low rounded-2xl border border-outline-variant/40 px-4 py-2 min-h-[44px] flex items-center focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
              className="w-full bg-transparent border-none p-0 focus:ring-0 resize-none text-sm sm:text-base text-on-surface placeholder:text-on-surface-variant/50 max-h-28 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!replyContent.trim() || submitting}
            className="w-11 h-11 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 touch-target"
            aria-label="Send reply"
          >
            {submitting ? (
              <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-xl icon-fill">send</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
