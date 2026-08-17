'use client'

import { useState, useEffect } from 'react'
import ActivitiesPage from '@/app/activities/page'
import BusinessFeedPage from '@/app/business/page'
import CommunityFeedPage from '@/app/community/page'
import ProfileTab from '@/components/ProfileTab'
import LocationModal from '@/components/LocationModal'
import NotificationDrawer from '@/components/NotificationDrawer'
import { createClient } from '@/lib/supabase'

type Profile = {
  id?: string
  name: string
  profile_photo_url: string
  society_id?: string
  location?: any
}

type TabKey = 'nearby' | 'business' | 'community' | 'profile'

interface HomeShellProps {
  profile: Profile
  initialSocietyName?: string
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'nearby', label: 'Nearby', icon: 'home' },
  { key: 'business', label: 'Business', icon: 'group' },
  { key: 'community', label: 'Community', icon: 'distance' },
  { key: 'profile', label: 'Profile', icon: 'person' },
]

export default function HomeShell({ profile, initialSocietyName }: HomeShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('nearby')
  const [locationName, setLocationName] = useState<string>(initialSocietyName || 'Detecting Area...')
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [feedRefreshKey, setFeedRefreshKey] = useState(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Fetch initial society name if not provided
  useEffect(() => {
    const fetchCurrentSociety = async () => {
      if (initialSocietyName) {
        setLocationName(initialSocietyName)
        return
      }

      const supabase = createClient()
      if (profile.society_id) {
        const { data } = await supabase
          .from('societies')
          .select('name')
          .eq('id', profile.society_id)
          .maybeSingle()

        if (data?.name) {
          setLocationName(data.name)
          return
        }
      }

      // Check society_members
      if (profile.id) {
        const { data: member } = await supabase
          .from('society_members')
          .select('societies(name)')
          .eq('user_id', profile.id)
          .limit(1)
          .maybeSingle()

        const soc = Array.isArray((member as any)?.societies)
          ? (member as any)?.societies[0]
          : (member as any)?.societies

        if (soc?.name) {
          setLocationName(soc.name)
          return
        }
      }

      setLocationName('Your Neighborhood')
    }

    fetchCurrentSociety()
  }, [profile, initialSocietyName])

  // Real-time live toast alerts for new posts & businesses
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('live-app-toasts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload: any) => {
          const post = payload.new
          const msg = post.type === 'individual'
            ? `🏃 New Activity: "${post.title}"`
            : `💬 New Community Query: "${post.title}"`
          setToastMessage(msg)
          setTimeout(() => setToastMessage(null), 5000)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'businesses' },
        (payload: any) => {
          const biz = payload.new
          setToastMessage(`🏪 New Business Added: "${biz.name}"`)
          setTimeout(() => setToastMessage(null), 5000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleTabClick = (tabKey: TabKey) => {
    setActiveTab(tabKey)
  }

  const handleLocationUpdated = (newName: string) => {
    setLocationName(newName)
    setFeedRefreshKey((prev) => prev + 1)
    setToastMessage(`📍 Location updated to ${newName}`)
    setTimeout(() => setToastMessage(null), 4000)
  }

  return (
    <div className="bg-background text-on-surface antialiased font-sans selection:bg-primary-container selection:text-on-primary-container min-h-screen pb-24 sm:pb-28 md:pb-0 flex flex-col">
      
      {/* Live Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300 px-4 w-full max-w-md">
          <div className="bg-surface-container-high border border-primary/40 shadow-2xl rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-on-surface backdrop-blur-md">
            <span className="truncate">{toastMessage}</span>
            <button
              type="button"
              onClick={() => setShowNotificationDrawer(true)}
              className="text-primary hover:underline shrink-0 text-xs font-bold uppercase"
            >
              View
            </button>
          </div>
        </div>
      )}

      {/* TopAppBar */}
      <header className="bg-background/95 w-full sticky top-0 z-40 backdrop-blur-md border-b border-outline-variant/30 shadow-sm transition-colors duration-200">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 h-14 sm:h-16 w-full">
          
          {/* Interactive Location Dropdown Button */}
          <button
            type="button"
            onClick={() => setShowLocationModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 text-primary hover:bg-surface-container-low px-2.5 sm:px-3 py-1.5 rounded-full transition-all active:scale-95 group min-w-0 border border-primary/20 hover:border-primary/40"
            aria-label="Change location"
            title="Click to detect or change your location"
          >
            <span className="material-symbols-outlined icon-fill text-lg sm:text-xl shrink-0 group-hover:scale-110 transition-transform">
              location_on
            </span>
            <h1 className="font-semibold text-xs sm:text-sm tracking-tight text-primary truncate max-w-[120px] sm:max-w-[200px]">
              {locationName}
            </h1>
            <span className="material-symbols-outlined text-base sm:text-lg text-primary/70 shrink-0 group-hover:translate-y-0.5 transition-transform">
              keyboard_arrow_down
            </span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 shrink-0">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabClick(tab.key)}
                  className={`flex items-center gap-2 rounded-full px-4 lg:px-5 py-2 transition-all duration-200 whitespace-nowrap font-medium text-sm ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container shadow-md'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  } active:scale-95`}
                >
                  <span className={`material-symbols-outlined text-lg ${isActive ? 'icon-fill' : ''}`}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Top Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            
            {/* Real-time Notification Bell Button */}
            <button
              type="button"
              onClick={() => setShowNotificationDrawer(true)}
              aria-label="Notifications"
              className="p-2 sm:p-2.5 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant active:scale-90 duration-150 relative touch-target"
            >
              <span className={`material-symbols-outlined text-xl ${unreadCount > 0 ? 'text-primary icon-fill' : ''}`}>
                notifications
              </span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 bg-primary text-on-primary text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-background animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Profile Avatar */}
            <button
              type="button"
              onClick={() => handleTabClick('profile')}
              className="ml-1 active:scale-90 duration-150 shrink-0 touch-target"
              aria-label="Profile"
            >
              {profile.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt={profile.name}
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover ring-2 ring-primary/40 hover:ring-primary transition-all"
                />
              ) : (
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-primary text-on-primary font-bold text-xs ring-2 ring-primary/40">
                  <span className="material-symbols-outlined text-base sm:text-lg">person</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full bg-background" key={feedRefreshKey}>
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
          {activeTab === 'nearby' && <ActivitiesPage embedded />}
          {activeTab === 'business' && <BusinessFeedPage embedded />}
          {activeTab === 'community' && <CommunityFeedPage embedded />}
          {activeTab === 'profile' && <ProfileTab />}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bg-background/95 border-t border-outline-variant/30 fixed bottom-0 left-0 right-0 w-full z-40 backdrop-blur-md pb-safe md:hidden">
        <div className="grid grid-cols-4 gap-1 px-2 py-1.5 sm:px-3 sm:py-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabClick(tab.key)}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-all duration-200 touch-target ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={`material-symbols-outlined text-2xl ${isActive ? 'icon-fill' : ''}`}>
                  {tab.icon}
                </span>
                <span className="text-[11px] font-medium leading-tight truncate w-full px-1">
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Dynamic Location Switcher Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        currentLocationName={locationName}
        userId={profile.id}
        onLocationUpdated={handleLocationUpdated}
      />

      {/* Real-time Notification Drawer */}
      <NotificationDrawer
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        userId={profile.id}
        unreadCount={unreadCount}
        setUnreadCount={setUnreadCount}
      />
    </div>
  )
}