import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import HomeShell from '@/components/HomeShell'

// Server Component: validates session and loads the user's profile.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const requestedTab = (await searchParams).tab
  const initialTab =
    requestedTab === 'business' || requestedTab === 'community' || requestedTab === 'chat' || requestedTab === 'profile'
      ? requestedTab
      : 'nearby'

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  let { data: profile } = await supabase
    .from('profiles')
    .select('id, name, profile_photo_url, society_id, current_location, home_location, discovery_radius_km, in_app_notifications_enabled')
    .eq('id', user.id)
    .maybeSingle()

  // If profile doesn't exist yet in database, create it now
  if (!profile) {
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Neighbor'
    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null

    const { data: newProfile } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          name: displayName,
          profile_photo_url: avatarUrl,
          phone_number: user.phone || null,
        },
        { onConflict: 'id' }
      )
      .select('id, name, profile_photo_url, society_id, current_location, home_location, discovery_radius_km, in_app_notifications_enabled')
      .single()

    profile = newProfile
  }

  if (!profile?.current_location || !profile?.home_location) {
    redirect('/onboarding')
  }

  let initialSocietyName = 'Your Neighborhood'
  if (profile.society_id) {
    const { data: society } = await supabase
      .from('societies')
      .select('name')
      .eq('id', profile.society_id)
      .maybeSingle()

    if (society?.name) {
      initialSocietyName = society.name
    }
  }

  return (
    <HomeShell
      profile={profile}
      initialTab={initialTab}
      initialSocietyName={initialSocietyName}
      initialDiscoveryRadius={profile.discovery_radius_km ?? 5}
      initialNotificationsEnabled={profile.in_app_notifications_enabled ?? true}
    />
  )
}
