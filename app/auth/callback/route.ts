import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const user = data.user
      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Neighbor'

      const avatarUrl =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null

      // Upsert profile reliably so row always exists
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          name: displayName,
          profile_photo_url: avatarUrl,
          phone_number: user.phone || null,
        },
        { onConflict: 'id' }
      )

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — send back to login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
