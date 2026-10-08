import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { getPublicStoragePath } from '@/lib/storage-path'

export async function DELETE(request: Request) {
  const requestOrigin = new URL(request.url).origin
  const originHeader = request.headers.get('origin')

  if (originHeader && new URL(originHeader).origin !== requestOrigin) {
    return Response.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return Response.json({ error: 'You must be signed in to delete your account.' }, { status: 401 })
  }

  const [profileResult, postsResult, businessesResult] = await Promise.all([
    supabase.from('profiles').select('profile_photo_url').eq('id', user.id).maybeSingle(),
    supabase.from('posts').select('photo_url').eq('user_id', user.id),
    supabase.from('businesses').select('id, photo_url').eq('owner_id', user.id),
  ])

  const dataError = profileResult.error || postsResult.error || businessesResult.error
  if (dataError) {
    return Response.json({ error: 'Could not collect your uploaded files. No account data was deleted.' }, { status: 500 })
  }

  const businessIds = (businessesResult.data ?? []).map((business) => business.id)
  const businessPhotosResult = businessIds.length
    ? await supabase.from('business_photos').select('photo_url').in('business_id', businessIds)
    : { data: [], error: null }

  if (businessPhotosResult.error) {
    return Response.json({ error: 'Could not collect your business photos. No account data was deleted.' }, { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Account deletion is not configured on this server.' }, { status: 503 })
  }

  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const mediaByBucket = new Map<string, Set<string>>([
    ['business-images', new Set<string>()],
    ['community-images', new Set<string>()],
    ['profile-images', new Set<string>()],
  ])
  const addMedia = (bucket: string, url: string | null | undefined) => {
    const path = getPublicStoragePath(url || null, bucket)
    if (path) mediaByBucket.get(bucket)?.add(path)
  }

  addMedia('profile-images', profileResult.data?.profile_photo_url)
  for (const business of businessesResult.data ?? []) addMedia('business-images', business.photo_url)
  for (const photo of businessPhotosResult.data ?? []) addMedia('business-images', photo.photo_url)
  for (const post of postsResult.data ?? []) addMedia('community-images', post.photo_url)

  for (const [bucket, paths] of mediaByBucket) {
    if (paths.size === 0) continue
    const { error: storageError } = await adminClient.storage.from(bucket).remove([...paths])
    if (storageError) {
      return Response.json({ error: 'Could not remove all uploaded files. No account data was deleted.' }, { status: 500 })
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return Response.json({ error: 'Account deletion failed. Please try again.' }, { status: 500 })
  }

  return Response.json({ success: true })
}