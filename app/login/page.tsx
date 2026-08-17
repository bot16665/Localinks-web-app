'use client'

import { createClient } from '@/lib/supabase'
import { useState } from 'react'
import Image from 'next/image'

const FEATURE_PILLS = [
  { icon: 'groups', label: 'Community' },
  { icon: 'storefront', label: 'Local Shops' },
  { icon: 'directions_run', label: 'Activities' },
  { icon: 'forum', label: 'Neighbor Chat' },
]

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-on-surface flex items-center justify-center px-4 sm:px-6 py-8 antialiased selection:bg-primary-container selection:text-on-primary-container">

      {/* Animated Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-primary/15 blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6 sm:gap-8 py-4 sm:py-6">

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center gap-4 sm:gap-5">

          {/* Logo with Glow Effect */}
          <div className="group relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-3xl bg-primary/30 blur-2xl transition-all duration-500 opacity-60 group-hover:opacity-100" />

            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-2xl ring-2 ring-primary/40 transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/logo.png"
                alt="LocalLink"
                width={80}
                height={80}
                className="object-contain rounded-2xl"
                priority
              />
            </div>
          </div>

          {/* App Name and Tagline */}
          <div className="space-y-1.5 sm:space-y-2">
            <h1 className="text-4xl sm:text-5xl font-bold text-primary tracking-tight">
              LocalLink
            </h1>

            <p className="text-base sm:text-lg text-on-surface-variant leading-relaxed max-w-xs font-medium">
              Your neighborhood, connected.
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 max-w-sm">
            {FEATURE_PILLS.map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-full bg-surface-container-low border border-outline-variant/30 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-on-surface transition-all duration-200 hover:bg-surface-container hover:border-primary/40"
              >
                <span className="material-symbols-outlined text-primary text-base sm:text-lg">
                  {icon}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sign-in Card */}
        <div className="w-full rounded-3xl border border-outline-variant/30 bg-surface-container-low shadow-2xl p-6 sm:p-8">

          <div className="flex flex-col gap-5 sm:gap-6">

            {/* Card Header */}
            <div className="space-y-1.5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Welcome Back
              </p>

              <h2 className="text-xl sm:text-2xl font-bold text-on-surface">
                Sign in to continue
              </h2>

              <p className="text-xs sm:text-sm text-on-surface-variant">
                Connect with your neighborhood in one place.
              </p>
            </div>

            {/* Google Sign-In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="group relative flex w-full h-12 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 px-5 sm:px-6 shadow-md transition-all duration-200 hover:border-primary/50 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 touch-target"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.03 2.53-2.16 3.31v2.77h3.49c2.04-1.88 3.23-4.64 3.23-7.94z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.49-2.77c-.98.66-2.23 1.06-3.79 1.06-2.91 0-5.37-1.96-6.25-4.63H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.75 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.57-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.64 0 3.11.56 4.27 1.67l3.2-3.2C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l2.57 2.84c.88-2.67 3.34-4.63 6.25-4.63z"
                    fill="#EA4335"
                  />
                </svg>
              )}

              <span className="font-semibold text-sm sm:text-base text-on-surface">
                {loading ? 'Signing in...' : 'Continue with Google'}
              </span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-outline-variant/30" />
              <span className="text-xs text-on-surface-variant/60 font-medium">
                Secure sign in
              </span>
              <div className="h-px flex-1 bg-outline-variant/30" />
            </div>

            {/* Terms and Privacy */}
            <p className="text-xs leading-relaxed text-on-surface-variant/80 text-center px-2">
              By continuing, you agree to our{' '}
              <span className="text-primary font-medium hover:underline cursor-pointer">
                Terms of Service
              </span>{' '}
              and{' '}
              <span className="text-primary font-medium hover:underline cursor-pointer">
                Privacy Policy
              </span>
              .
            </p>

          </div>
        </div>

        {/* Footer Message */}
        <p className="text-xs text-on-surface-variant/60 text-center px-2 font-medium">
          Bringing neighbors closer, one connection at a time.
        </p>

      </div>
    </div>
  )
}
