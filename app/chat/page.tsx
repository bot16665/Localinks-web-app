'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Chat = {
  id: string
  user_one_id: string
  user_two_id: string
  post_id: string
  created_at: string
}

type Profile = {
  name: string
  profile_photo_url: string
}

type Message = {
  content: string
  sent_at: string
}

type Post = {
  title: string
}

type ChatWithDetails = {
  chat: Chat
  otherUser: Profile
  lastMessage: Message | null
  post: Post | null
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
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function ChatInboxPage() {
  const router = useRouter()
  const [chats, setChats] = useState<ChatWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

      const { data: chatsData, error: chatsError } = await supabase
        .from('chats')
        .select('*')
        .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (chatsError) {
        setError('Failed to load chats')
        setLoading(false)
        return
      }

      if (!chatsData || chatsData.length === 0) {
        setChats([])
        setLoading(false)
        return
      }

      const chatsWithDetails = await Promise.all(
        chatsData.map(async (chat) => {
          const otherUserId = chat.user_one_id === user.id ? chat.user_two_id : chat.user_one_id

          const [profileResult, messageResult, postResult] = await Promise.all([
            supabase.from('profiles').select('name, profile_photo_url').eq('id', otherUserId).maybeSingle(),
            supabase
              .from('messages')
              .select('content, sent_at')
              .eq('chat_id', chat.id)
              .order('sent_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase.from('posts').select('title').eq('id', chat.post_id).maybeSingle(),
          ])

          return {
            chat,
            otherUser: (profileResult.data as Profile) || { name: 'Unknown', profile_photo_url: '' },
            lastMessage: (messageResult.data as Message) || null,
            post: (postResult.data as Post) || null,
          }
        })
      )

      setChats(chatsWithDetails)
      setLoading(false)
    }

    load()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-on-surface-variant font-medium">Loading conversations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="material-symbols-outlined text-4xl text-error">error_outline</span>
          <p className="text-sm text-error font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-primary text-on-primary rounded-full font-semibold text-xs hover:brightness-110 transition-all active:scale-95 touch-target"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center gap-2 max-w-2xl mx-auto w-full">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container active:scale-95 transition-colors -ml-2 text-on-surface touch-target"
            aria-label="Back"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="font-semibold text-base sm:text-lg text-on-surface">Messages</h1>
        </div>
      </header>

      {/* Main Inbox */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-2 sm:px-4 py-3">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-3 border border-outline-variant/30">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">chat_bubble_outline</span>
            </div>
            <p className="font-semibold text-base sm:text-lg text-on-surface mb-1">No conversations yet</p>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-xs">Express interest in an activity to start chatting with neighbors!</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-outline-variant/20">
            {chats.map(({ chat, otherUser, lastMessage, post }) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 hover:bg-surface-container-low rounded-2xl active:scale-[0.99] transition-all group"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {otherUser.profile_photo_url ? (
                    <img
                      src={otherUser.profile_photo_url}
                      alt={otherUser.name}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/40 group-hover:ring-primary transition-all"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm ring-2 ring-primary/40">
                      {getInitials(otherUser.name)}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-background"></div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <p className="font-semibold text-sm sm:text-base text-on-surface truncate group-hover:text-primary transition-colors">
                      {otherUser.name}
                    </p>
                    {lastMessage && (
                      <span className="text-xs text-on-surface-variant/70 whitespace-nowrap flex-shrink-0">
                        {getRelativeTime(lastMessage.sent_at)}
                      </span>
                    )}
                  </div>

                  {post && (
                    <p className="text-xs font-medium text-primary truncate mb-0.5">
                      Re: {post.title}
                    </p>
                  )}

                  <p className="text-xs sm:text-sm text-on-surface-variant truncate">
                    {lastMessage ? lastMessage.content : 'Start the conversation...'}
                  </p>
                </div>

                {/* Arrow */}
                <span className="material-symbols-outlined text-base text-on-surface-variant flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
                  chevron_right
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
