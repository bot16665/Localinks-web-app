'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export interface AppNotification {
  id: string
  type: 'activity' | 'business' | 'community' | 'reply' | 'interest' | 'message'
  title: string
  description: string
  link: string
  created_at: string
  is_read: boolean
  author_name?: string
  author_photo_url?: string | null
}

interface NotificationDrawerProps {
  isOpen: boolean
  onClose: () => void
  userId?: string
  unreadCount: number
  setUnreadCount: (count: number | ((prev: number) => number)) => void
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

export default function NotificationDrawer({
  isOpen,
  onClose,
  userId,
  unreadCount,
  setUnreadCount,
}: NotificationDrawerProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'activity' | 'business' | 'community'>('all')

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // 1. Fetch recent activity posts
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('id, type, category, title, description, created_at, user_id, profiles(name, profile_photo_url)')
        .order('created_at', { ascending: false })
        .limit(15)

      // 2. Fetch recent businesses
      const { data: recentBusinesses } = await supabase
        .from('businesses')
        .select('id, name, category, created_at, owner_id')
        .order('created_at', { ascending: false })
        .limit(10)

      // 3. Fetch recent replies to posts
      const { data: recentReplies } = await supabase
        .from('replies')
        .select('id, post_id, content, created_at, user_id, profiles(name, profile_photo_url), posts(title, user_id)')
        .order('created_at', { ascending: false })
        .limit(10)

      const readIds = new Set<string>(
        JSON.parse(localStorage.getItem('locallink_read_notifications') || '[]')
      )

      const items: AppNotification[] = []

      // Map Posts
      if (recentPosts) {
        for (const post of recentPosts) {
          const profile = Array.isArray((post as any).profiles)
            ? (post as any).profiles[0]
            : (post as any).profiles

          const isActivity = post.type === 'individual'
          const isCommunity = post.type === 'local' || post.type === 'business'
          const notifType = isActivity ? 'activity' : 'community'

          items.push({
            id: `post-${post.id}`,
            type: notifType,
            title: isActivity
              ? `New Activity: ${post.title}`
              : `Community Post: ${post.title}`,
            description: post.description || `${profile?.name || 'A neighbor'} posted a new ${post.category || 'update'}.`,
            link: isActivity ? `/activities/${post.id}` : `/community/${post.id}`,
            created_at: post.created_at,
            is_read: readIds.has(`post-${post.id}`),
            author_name: profile?.name,
            author_photo_url: profile?.profile_photo_url,
          })
        }
      }

      // Map Businesses
      if (recentBusinesses) {
        for (const b of recentBusinesses) {
          items.push({
            id: `biz-${b.id}`,
            type: 'business',
            title: `New Business: ${b.name}`,
            description: `A new ${b.category || 'local store'} was added to your neighborhood.`,
            link: `/business/${b.id}`,
            created_at: b.created_at,
            is_read: readIds.has(`biz-${b.id}`),
          })
        }
      }

      // Map Replies
      if (recentReplies) {
        for (const reply of recentReplies) {
          const profile = Array.isArray((reply as any).profiles)
            ? (reply as any).profiles[0]
            : (reply as any).profiles
          const post = Array.isArray((reply as any).posts)
            ? (reply as any).posts[0]
            : (reply as any).posts

          items.push({
            id: `reply-${reply.id}`,
            type: 'reply',
            title: `${profile?.name || 'Someone'} replied on "${post?.title || 'Community Post'}"`,
            description: reply.content,
            link: `/community/${reply.post_id}`,
            created_at: reply.created_at,
            is_read: readIds.has(`reply-${reply.id}`),
            author_name: profile?.name,
            author_photo_url: profile?.profile_photo_url,
          })
        }
      }

      // Sort by newest
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setNotifications(items)
      const unread = items.filter((n) => !n.is_read).length
      setUnreadCount(unread)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [setUnreadCount])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Real-time listener for new posts, businesses, replies
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          const newPost = payload.new as any
          const notifId = `post-${newPost.id}`
          const notif: AppNotification = {
            id: notifId,
            type: newPost.type === 'individual' ? 'activity' : 'community',
            title: newPost.type === 'individual'
              ? `New Activity: ${newPost.title}`
              : `New Query/Post: ${newPost.title}`,
            description: newPost.description || 'A neighbor just posted an update.',
            link: newPost.type === 'individual' ? `/activities/${newPost.id}` : `/community/${newPost.id}`,
            created_at: newPost.created_at || new Date().toISOString(),
            is_read: false,
          }

          setNotifications((prev) => [notif, ...prev])
          setUnreadCount((c) => c + 1)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'businesses' },
        (payload) => {
          const newBiz = payload.new as any
          const notifId = `biz-${newBiz.id}`
          const notif: AppNotification = {
            id: notifId,
            type: 'business',
            title: `New Business: ${newBiz.name}`,
            description: `Check out ${newBiz.name} (${newBiz.category || 'Local Shop'})!`,
            link: `/business/${newBiz.id}`,
            created_at: newBiz.created_at || new Date().toISOString(),
            is_read: false,
          }

          setNotifications((prev) => [notif, ...prev])
          setUnreadCount((c) => c + 1)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'replies' },
        (payload) => {
          const newReply = payload.new as any
          const notifId = `reply-${newReply.id}`
          const notif: AppNotification = {
            id: notifId,
            type: 'reply',
            title: 'New Reply on Community Thread',
            description: newReply.content,
            link: `/community/${newReply.post_id}`,
            created_at: newReply.created_at || new Date().toISOString(),
            is_read: false,
          }

          setNotifications((prev) => [notif, ...prev])
          setUnreadCount((c) => c + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [setUnreadCount])

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map((n) => n.id)
    localStorage.setItem('locallink_read_notifications', JSON.stringify(allIds))
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const handleNotificationClick = (notification: AppNotification) => {
    const readIds = new Set<string>(
      JSON.parse(localStorage.getItem('locallink_read_notifications') || '[]')
    )
    readIds.add(notification.id)
    localStorage.setItem('locallink_read_notifications', JSON.stringify(Array.from(readIds)))

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - (notification.is_read ? 0 : 1)))

    onClose()
    router.push(notification.link)
  }

  if (!isOpen) return null

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true
    if (filter === 'activity') return n.type === 'activity' || n.type === 'interest'
    if (filter === 'business') return n.type === 'business'
    if (filter === 'community') return n.type === 'community' || n.type === 'reply'
    return true
  })

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-low w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-outline-variant/40 shadow-2xl p-5 sm:p-6 flex flex-col gap-4 max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl icon-fill">notifications</span>
            <h2 className="font-bold text-lg sm:text-xl text-on-surface">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-primary text-on-primary text-xs px-2 py-0.5 rounded-full font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Mark read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {(['all', 'activity', 'community', 'business'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize whitespace-nowrap active:scale-95 transition-all ${
                filter === tab
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2 max-h-[50vh]">
          {loading ? (
            <div className="py-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
              <p className="text-xs text-on-surface-variant">Loading live notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center px-4">
              <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-3 border border-outline-variant/30">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">notifications_none</span>
              </div>
              <p className="font-semibold text-sm sm:text-base text-on-surface mb-1">No notifications yet</p>
              <p className="text-xs text-on-surface-variant">When neighbors post activities, businesses, or queries, you&apos;ll see them here!</p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const iconMap = {
                activity: 'directions_run',
                business: 'storefront',
                community: 'forum',
                reply: 'chat_bubble',
                interest: 'favorite',
                message: 'mail',
              }

              const iconBgMap = {
                activity: 'bg-primary/20 text-primary',
                business: 'bg-amber-500/20 text-amber-400',
                community: 'bg-blue-500/20 text-blue-400',
                reply: 'bg-emerald-500/20 text-emerald-400',
                interest: 'bg-pink-500/20 text-pink-400',
                message: 'bg-purple-500/20 text-purple-400',
              }

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.99] flex items-start gap-3 group ${
                    n.is_read
                      ? 'bg-surface-container/50 border-outline-variant/20 hover:bg-surface-container'
                      : 'bg-surface-container-high/60 border-primary/40 hover:bg-surface-container-high shadow-sm'
                  }`}
                >
                  {/* Icon or Photo */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBgMap[n.type]}`}>
                    <span className="material-symbols-outlined text-xl icon-fill">
                      {iconMap[n.type]}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <h4 className={`text-xs sm:text-sm font-semibold truncate group-hover:text-primary transition-colors ${
                        n.is_read ? 'text-on-surface' : 'text-on-surface font-bold'
                      }`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-on-surface-variant/70 shrink-0">
                        {getRelativeTime(n.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                      {n.description}
                    </p>
                  </div>

                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5 animate-pulse"></span>
                  )}
                </button>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
