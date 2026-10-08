'use client'

import { useEffect, useState, useCallback, useEffectEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export interface AppNotification {
  id: string
  type: 'nearby' | 'business' | 'community'
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
  unreadCount: number
  setUnreadCount: (count: number | ((prev: number) => number)) => void
  userId: string
  societyId: string | null
  radiusKm: number
  enabled: boolean
}

interface NearbyActivity {
  id: string
  user_id: string
  title: string
  description: string | null
  created_at: string
  author_name: string | null
  author_photo_url: string | null
}

interface NearbyBusiness {
  id: string
  owner_id: string
  name: string
  category: string | null
}

interface FeedPost {
  id: string
  user_id: string
  title: string
  description: string | null
  created_at: string
  business_id?: string | null
}

function getRelativeTime(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

function getReadIds(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('locallink_read_notifications') || '[]')
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

export default function NotificationDrawer({
  isOpen,
  onClose,
  unreadCount,
  setUnreadCount,
  userId,
  societyId,
  radiusKm,
  enabled,
}: NotificationDrawerProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'nearby' | 'business' | 'community'>('all')
  const seenNotificationIds = useRef(new Set<string>())

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    if (!enabled || !userId) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    const supabase = createClient()

    try {
      const { data: activityData, error: activityError } = await supabase.rpc('nearby_posts', {
        radius_km: radiusKm,
        post_type: 'individual',
      })
      if (activityError) throw activityError

      const { data: businessData, error: businessError } = await supabase.rpc('nearby_businesses', {
        radius_km: radiusKm,
        filter_category: null,
      })
      if (businessError) throw businessError

      const nearbyActivities = (activityData ?? []) as NearbyActivity[]
      const nearbyBusinesses = (businessData ?? []) as NearbyBusiness[]
      const otherBusinesses = nearbyBusinesses.filter((business) => business.owner_id !== userId)
      const businessIds = otherBusinesses.map((business) => business.id)

      let communityPosts: FeedPost[] = []
      if (societyId) {
        const { data, error } = await supabase
          .from('posts')
          .select('id, user_id, title, description, created_at')
          .eq('type', 'local')
          .eq('status', 'active')
          .eq('society_id', societyId)
          .neq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)
        if (error) throw error
        communityPosts = (data ?? []) as FeedPost[]
      }

      let businessDates = new Map<string, string>()
      let businessPromos: FeedPost[] = []
      if (businessIds.length > 0) {
        const [businessRows, promoRows] = await Promise.all([
          supabase.from('public_businesses').select('id, created_at').in('id', businessIds),
          supabase
            .from('posts')
            .select('id, user_id, title, description, created_at, business_id')
            .eq('type', 'business')
            .eq('status', 'active')
            .in('business_id', businessIds)
            .neq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20),
        ])
        if (businessRows.error) throw businessRows.error
        if (promoRows.error) throw promoRows.error
        businessDates = new Map((businessRows.data ?? []).map((business) => [business.id, business.created_at]))
        businessPromos = (promoRows.data ?? []) as FeedPost[]
      }

      const businessById = new Map(nearbyBusinesses.map((business) => [business.id, business]))
      const authorIds = [...new Set([...communityPosts, ...businessPromos].map((post) => post.user_id))]
      const { data: authorProfiles } = authorIds.length > 0
        ? await supabase.from('public_profiles').select('id, name, profile_photo_url').in('id', authorIds)
        : { data: [] }
      const authorById = new Map((authorProfiles ?? []).map((profile) => [profile.id, profile]))

      const items: AppNotification[] = []
      for (const post of nearbyActivities) {
        if (post.user_id === userId) continue
        items.push({
          id: `post-${post.id}`,
          type: 'nearby',
          title: `New Nearby Activity: ${post.title}`,
          description: post.description || `${post.author_name || 'A neighbor'} posted a nearby activity.`,
          link: `/activities/${post.id}`,
          created_at: post.created_at,
          is_read: false,
          author_name: post.author_name || undefined,
          author_photo_url: post.author_photo_url,
        })
      }

      for (const post of communityPosts) {
        const author = authorById.get(post.user_id)
        items.push({
          id: `post-${post.id}`,
          type: 'community',
          title: `Community Post: ${post.title}`,
          description: post.description || `${author?.name || 'A neighbor'} shared a community post.`,
          link: `/community/${post.id}`,
          created_at: post.created_at,
          is_read: false,
          author_name: author?.name,
          author_photo_url: author?.profile_photo_url,
        })
      }

      for (const business of otherBusinesses) {
        const createdAt = businessDates.get(business.id)
        if (!createdAt) continue
        items.push({
          id: `biz-${business.id}`,
          type: 'business',
          title: `New Nearby Business: ${business.name}`,
          description: `A new ${business.category || 'local business'} was added nearby.`,
          link: `/business/${business.id}`,
          created_at: createdAt,
          is_read: false,
        })
      }

      for (const post of businessPromos) {
        if (!post.business_id) continue
        const author = authorById.get(post.user_id)
        const business = businessById.get(post.business_id)
        if (!business) continue
        items.push({
          id: `post-${post.id}`,
          type: 'business',
          title: `Business Update: ${post.title}`,
          description: post.description || `${author?.name || business.name} shared a business update.`,
          link: `/business/${business.id}`,
          created_at: post.created_at,
          is_read: false,
          author_name: author?.name,
          author_photo_url: author?.profile_photo_url,
        })
      }

      const initialized = localStorage.getItem('locallink_notifications_initialized') === 'true'
      const readIds = getReadIds()
      for (const item of items) item.is_read = !initialized || readIds.has(item.id)
      if (!initialized) {
        localStorage.setItem('locallink_notifications_initialized', 'true')
        localStorage.setItem('locallink_read_notifications', JSON.stringify(items.map((item) => item.id)))
      }

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const recentItems = items.slice(0, 50)
      seenNotificationIds.current = new Set(recentItems.map((item) => item.id))
      setNotifications(recentItems)
      setUnreadCount(recentItems.filter((item) => !item.is_read).length)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [enabled, radiusKm, setUnreadCount, societyId, userId])

  const addLiveNotification = useCallback((notification: AppNotification) => {
    if (seenNotificationIds.current.has(notification.id)) return
    seenNotificationIds.current.add(notification.id)

    const isRead = getReadIds().has(notification.id)
    setNotifications((previous) => [
      { ...notification, is_read: isRead },
      ...previous.filter((item) => item.id !== notification.id),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    if (!isRead) setUnreadCount((count) => count + 1)
  }, [setUnreadCount])

  const refreshNotifications = useEffectEvent(() => fetchNotifications())

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshNotifications(), 0)
    return () => window.clearTimeout(timer)
  }, [enabled, isOpen, radiusKm, societyId, userId])

  useEffect(() => {
    if (!enabled || !userId) return

    const supabase = createClient()
    const channel = supabase
      .channel('realtime-feed-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
        const post = payload.new as {
          id: string
          user_id: string
          type: string
          title: string
          description: string | null
          business_id: string | null
          society_id: string | null
          status: string
          created_at: string
        }
        if (post.user_id === userId || post.status !== 'active') return

        if (post.type === 'local' && societyId && post.society_id === societyId) {
          addLiveNotification({
            id: `post-${post.id}`,
            type: 'community',
            title: `Community Post: ${post.title}`,
            description: post.description || 'A neighbor shared a community post.',
            link: `/community/${post.id}`,
            created_at: post.created_at || new Date().toISOString(),
            is_read: false,
          })
          return
        }

        if (post.type === 'individual') {
          const { data } = await supabase.rpc('nearby_posts', {
            radius_km: radiusKm,
            post_type: 'individual',
          })
          const nearbyPost = ((data ?? []) as NearbyActivity[]).find((item) => item.id === post.id)
          if (!nearbyPost) return

          addLiveNotification({
            id: `post-${post.id}`,
            type: 'nearby',
            title: `New Nearby Activity: ${post.title}`,
            description: post.description || `${nearbyPost.author_name || 'A neighbor'} posted a nearby activity.`,
            link: `/activities/${post.id}`,
            created_at: post.created_at || new Date().toISOString(),
            is_read: false,
            author_name: nearbyPost.author_name || undefined,
            author_photo_url: nearbyPost.author_photo_url,
          })
          return
        }

        if (post.type === 'business' && post.business_id) {
          const { data } = await supabase.rpc('nearby_businesses', {
            radius_km: radiusKm,
            filter_category: null,
          })
          const business = ((data ?? []) as NearbyBusiness[]).find((item) => item.id === post.business_id)
          if (!business) return

          addLiveNotification({
            id: `post-${post.id}`,
            type: 'business',
            title: `Business Update: ${post.title}`,
            description: post.description || `${business.name} shared a business update.`,
            link: `/business/${business.id}`,
            created_at: post.created_at || new Date().toISOString(),
            is_read: false,
          })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'businesses' }, async (payload) => {
        const business = payload.new as {
          id: string
          owner_id: string
          name: string
          category: string | null
          created_at: string
        }
        if (business.owner_id === userId) return

        const { data } = await supabase.rpc('nearby_businesses', {
          radius_km: radiusKm,
          filter_category: null,
        })
        if (!((data ?? []) as NearbyBusiness[]).some((item) => item.id === business.id)) return

        addLiveNotification({
          id: `biz-${business.id}`,
          type: 'business',
          title: `New Nearby Business: ${business.name}`,
          description: `A new ${business.category || 'local business'} was added nearby.`,
          link: `/business/${business.id}`,
          created_at: business.created_at || new Date().toISOString(),
          is_read: false,
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [addLiveNotification, enabled, radiusKm, societyId, userId])

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map((notification) => notification.id)
    localStorage.setItem('locallink_read_notifications', JSON.stringify([...getReadIds(), ...allIds]))
    setNotifications((previous) => previous.map((notification) => ({ ...notification, is_read: true })))
    setUnreadCount(0)
  }

  const handleNotificationClick = (notification: AppNotification) => {
    const readIds = getReadIds()
    readIds.add(notification.id)
    localStorage.setItem('locallink_read_notifications', JSON.stringify(Array.from(readIds)))
    setNotifications((previous) =>
      previous.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
    )
    setUnreadCount((previous) => Math.max(0, previous - (notification.is_read ? 0 : 1)))
    onClose()
    router.push(notification.link)
  }

  if (!isOpen) return null

  const filteredNotifications = notifications.filter((notification) =>
    filter === 'all' || notification.type === filter
  )
  const iconByType: Record<AppNotification['type'], string> = {
    nearby: 'directions_run',
    business: 'storefront',
    community: 'forum',
  }
  const iconBgByType: Record<AppNotification['type'], string> = {
    nearby: 'bg-primary/20 text-primary',
    business: 'bg-amber-500/20 text-amber-700',
    community: 'bg-blue-500/20 text-blue-700',
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-outline-variant/30 shadow-2xl p-5 sm:p-6 flex flex-col gap-4 max-h-[85vh] overflow-hidden">
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
              <button type="button" onClick={handleMarkAllAsRead} className="text-xs font-semibold text-primary hover:underline">
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

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {(['all', 'nearby', 'business', 'community'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap capitalize active:scale-95 transition-all ${
                filter === tab
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

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
              <p className="text-xs text-on-surface-variant">Nearby activities, businesses, and community posts will appear here.</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.99] flex items-start gap-3 group ${
                  notification.is_read
                    ? 'bg-surface-container/50 border-outline-variant/20 hover:bg-surface-container'
                    : 'bg-surface-container-high/60 border-primary/40 hover:bg-surface-container-high shadow-sm'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBgByType[notification.type]}`}>
                  <span className="material-symbols-outlined text-xl icon-fill">{iconByType[notification.type]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <h4 className={`text-xs sm:text-sm truncate group-hover:text-primary transition-colors ${notification.is_read ? 'font-semibold text-on-surface' : 'font-bold text-on-surface'}`}>
                      {notification.title}
                    </h4>
                    <span className="text-[10px] text-on-surface-variant/70 shrink-0">{getRelativeTime(notification.created_at)}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{notification.description}</p>
                </div>
                {!notification.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5 animate-pulse" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}