'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/

export default function PhoneSignInPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedPhone = phone.trim().replace(/[\s()-]/g, '')

    if (!E164_PHONE_PATTERN.test(normalizedPhone)) {
      setError('Enter a valid number with country code, such as +14155550123.')
      return
    }

    setSending(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: sendError } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: { shouldCreateUser: true },
      })

      if (sendError) throw sendError

      sessionStorage.setItem('locallink_pending_phone', normalizedPhone)
      router.push('/login/verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a verification code.')
      setSending(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background px-5 text-on-surface">
      <header className="mx-auto flex h-16 w-full max-w-md items-center">
        <Link href="/login" aria-label="Back to sign in" className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-container">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
      </header>
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col pt-8 sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight">Enter your phone number</h1>
        <p className="mt-2 text-base text-on-surface-variant">We&apos;ll send a one-time verification code.</p>
        <form onSubmit={handleSendCode} className="mt-8 space-y-4">
          <label htmlFor="phone-number" className="sr-only">Phone number</label>
          <input
            id="phone-number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+1 415 555 0123"
            className="h-14 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 text-lg text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          />
          <p className="text-xs text-on-surface-variant">Use international format, including your country code.</p>
          {error && <p role="alert" className="rounded-xl bg-error-container/50 px-3 py-2 text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="mt-6 h-14 w-full rounded-xl bg-primary text-on-primary font-semibold shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? 'Sending code...' : 'Continue'}
          </button>
        </form>
      </section>
    </main>
  )
}