'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type UserProfile = {
  name: string
  profile_photo_url: string | null
  phone: string | null
  phone_number: string | null
  block_flat: string | null
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function EditableRow({
  label,
  value,
  field,
  type = 'text',
  editingField,
  savingField,
  editValue,
  editError,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditValueChange,
}: {
  label: string
  value: string | null
  field: 'name' | 'phone_number' | 'block_flat'
  type?: string
  editingField: string | null
  savingField: string | null
  editValue: string
  editError: string | null
  onStartEdit: (field: string, currentValue: string) => void
  onSaveEdit: (field: string) => void
  onCancelEdit: () => void
  onEditValueChange: (value: string) => void
}) {
  const isEditing = editingField === field
  const isSaving = savingField === field

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-on-surface">{label}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSaveEdit(field)}
              disabled={isSaving}
              className="text-primary hover:bg-primary/20 rounded-full p-1.5 transition-colors disabled:opacity-50 touch-target flex items-center justify-center"
              aria-label="Save"
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined icon-fill text-lg">check</span>
              )}
            </button>
            <button
              onClick={onCancelEdit}
              disabled={isSaving}
              className="text-on-surface-variant hover:bg-surface-container-high rounded-full p-1.5 transition-colors disabled:opacity-50 touch-target flex items-center justify-center"
              aria-label="Cancel"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
        <input
          type={type}
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm sm:text-base transition-all"
          autoFocus
        />
        {editError && <p className="text-xs text-error font-medium">{editError}</p>}
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-between py-3 cursor-pointer group hover:bg-surface-container-high/30 -mx-4 px-4 sm:-mx-6 sm:px-6 rounded-xl transition-colors"
      onClick={() => onStartEdit(field, value || '')}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-on-surface">{label}</span>
        <span className="text-sm text-on-surface-variant">{value || 'Not set'}</span>
      </div>
      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-xl">
        edit
      </span>
    </div>
  )
}

export default function ProfileTab() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [discoveryRadius, setDiscoveryRadius] = useState(5)
  const [postCount, setPostCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Editing states
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingField, setSavingField] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete account states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      let { data: profileData } = await supabase
        .from('profiles')
        .select('name, profile_photo_url, phone_number, block_flat')
        .eq('id', user.id)
        .maybeSingle()

      // If no profile found, create one immediately
      if (!profileData) {
        const defaultName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Neighbor'
        const defaultPhoto =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null

        await supabase.from('profiles').upsert({
          id: user.id,
          name: defaultName,
          profile_photo_url: defaultPhoto,
        })

        profileData = {
          name: defaultName,
          profile_photo_url: defaultPhoto,
          phone_number: user.phone || null,
          block_flat: null,
        }
      }

      setProfile({
        name: profileData?.name || user.email?.split('@')[0] || 'User',
        profile_photo_url: profileData?.profile_photo_url || null,
        phone: user.phone || null,
        phone_number: profileData?.phone_number || null,
        block_flat: profileData?.block_flat || null,
      })

      // Count user's posts
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setPostCount(count || 0)
      setLoading(false)
    }

    load()
  }, [router])

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    setUploadingPhoto(true)
    const supabase = createClient()

    try {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `avatar-${userId}-${Date.now()}.${fileExt}`

      // Try uploading to business-images or profile-images
      const { error: uploadError } = await supabase.storage
        .from('business-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('business-images').getPublicUrl(fileName)
      const photoUrl = publicUrlData?.publicUrl

      if (photoUrl) {
        await supabase
          .from('profiles')
          .upsert({ id: userId, profile_photo_url: photoUrl }, { onConflict: 'id' })

        setProfile((prev) => (prev ? { ...prev, profile_photo_url: photoUrl } : null))
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue)
    setEditError(null)
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
    setEditError(null)
  }

  const saveEdit = async (field: string) => {
    if (!userId) return
    setSavingField(field)
    setEditError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, [field]: editValue }, { onConflict: 'id' })

    if (error) {
      setEditError(error.message)
      setSavingField(null)
      return
    }

    setProfile((prev) => (prev ? { ...prev, [field]: editValue } : null))
    setEditingField(null)
    setEditValue('')
    setSavingField(null)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || !userId) return
    setDeleting(true)
    setDeleteError(null)

    const supabase = createClient()
    
    // Delete app data only (not auth.users account).
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-on-surface-variant font-medium">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-24 md:pb-8 animate-in fade-in duration-200">
      
      {/* Profile Header Card */}
      <section className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/30 shadow-lg flex flex-col sm:flex-row items-center sm:items-start gap-5">
        
        {/* Avatar with upload action */}
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          {profile?.profile_photo_url ? (
            <img
              src={profile.profile_photo_url}
              alt={profile.name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-primary/30 group-hover:ring-primary transition-all"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-2xl sm:text-3xl ring-4 ring-primary/30">
              {profile?.name ? getInitials(profile.name) : 'U'}
            </div>
          )}

          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploadingPhoto ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>

        <div className="flex-1 text-center sm:text-left min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface truncate">
            {profile?.name}
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            {profile?.phone_number || profile?.phone || 'No phone set'}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
            <Link
              href="/profile/my-posts"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs sm:text-sm font-semibold text-on-surface transition-all active:scale-95 touch-target"
            >
              <span className="material-symbols-outlined text-base text-primary">post</span>
              <span>My Posts ({postCount})</span>
            </Link>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 text-xs sm:text-sm font-semibold text-primary transition-all active:scale-95 touch-target"
            >
              <span className="material-symbols-outlined text-base">upload</span>
              <span>Change Photo</span>
            </button>
          </div>
        </div>
      </section>

      {/* Personal Info Section */}
      <section className="bg-surface-container-low rounded-3xl p-5 sm:p-6 border border-outline-variant/30 shadow-md space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
          Personal Information
        </h3>

        <div className="divide-y divide-outline-variant/20">
          <EditableRow
            label="Full Name"
            value={profile?.name || null}
            field="name"
            editingField={editingField}
            savingField={savingField}
            editValue={editValue}
            editError={editError}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onEditValueChange={setEditValue}
          />

          <EditableRow
            label="Phone Number"
            value={profile?.phone_number || profile?.phone || null}
            field="phone_number"
            type="tel"
            editingField={editingField}
            savingField={savingField}
            editValue={editValue}
            editError={editError}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onEditValueChange={setEditValue}
          />

          <EditableRow
            label="Block / Flat / House No."
            value={profile?.block_flat || null}
            field="block_flat"
            editingField={editingField}
            savingField={savingField}
            editValue={editValue}
            editError={editError}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onEditValueChange={setEditValue}
          />
        </div>
      </section>

      {/* Discovery & Preferences */}
      <section className="bg-surface-container-low rounded-3xl p-5 sm:p-6 border border-outline-variant/30 shadow-md space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
          Discovery Preferences
        </h3>

        {/* Radius Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-on-surface">Discovery Radius</span>
            <span className="text-primary font-bold">{discoveryRadius} km</span>
          </div>
          <input
            type="range"
            min="1"
            max="25"
            value={discoveryRadius}
            onChange={(e) => setDiscoveryRadius(Number(e.target.value))}
            className="w-full accent-primary h-2 bg-surface-container rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-on-surface-variant">
            <span>1 km (Neighborhood)</span>
            <span>25 km (City)</span>
          </div>
        </div>

        {/* Notification Switch */}
        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-on-surface">Push Notifications</span>
            <span className="text-xs text-on-surface-variant">Get notified for nearby activities & businesses</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`w-12 h-7 rounded-full transition-colors relative p-0.5 ${
              notificationsEnabled ? 'bg-primary' : 'bg-surface-container-high'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full bg-white block shadow-sm transform transition-transform ${
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Account Actions */}
      <section className="bg-surface-container-low rounded-3xl p-5 sm:p-6 border border-outline-variant/30 shadow-md space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          Account
        </h3>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-3.5 px-4 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all touch-target"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="w-full py-3 px-4 rounded-2xl bg-error/10 hover:bg-error/20 border border-error/30 text-error font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 active:scale-[0.99] transition-all touch-target"
        >
          <span className="material-symbols-outlined text-base">delete_forever</span>
          <span>Delete Account</span>
        </button>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-low rounded-3xl p-6 max-w-sm w-full border border-outline-variant/40 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-on-surface">Delete Account?</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              This action will permanently delete your profile and posts. Type <strong className="text-error font-bold">DELETE</strong> to confirm.
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container text-on-surface text-sm focus:outline-none focus:border-error transition-all"
            />

            {deleteError && <p className="text-xs text-error font-medium">{deleteError}</p>}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setDeleteConfirmText('')
                  setDeleteError(null)
                }}
                disabled={deleting}
                className="px-4 py-2 rounded-full border border-outline-variant/30 text-on-surface hover:bg-surface-container text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="px-4 py-2 rounded-full bg-error text-on-error font-semibold text-xs disabled:opacity-50 shadow-md hover:bg-error/90 transition-all"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
