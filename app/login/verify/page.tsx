'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function VerifyPhonePage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(30)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const pendingPhone = sessionStorage.getItem('locallink_pending_phone')
      if (!pendingPhone) {
        router.replace('/login/phone')
        return
      }

      setPhone(pendingPhone)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [router])

  useEffect(() => {
    if (secondsRemaining <= 0) return
    const timer = window.setInterval(() => {
      setSecondsRemaining((remaining) => Math.max(0, remaining - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [secondsRemaining])

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!phone || code.length !== 6 || verifying) return

    setVerifying(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      })

      if (verifyError) throw verifyError

      sessionStorage.removeItem('locallink_pending_phone')
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is invalid or expired. Request a new one and try again.')
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!phone || resending || secondsRemaining > 0) return

    setResending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: resendError } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: true },
      })
      if (resendError) throw resendError
      setSecondsRemaining(30)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.')
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background px-5 text-on-surface">
      <header className="mx-auto flex h-16 w-full max-w-md items-center">
        <Link href="/login/phone" aria-label="Back to phone entry" className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-container">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
      </header>
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col pt-8 sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight">Verify your number</h1>
        <p className="mt-2 text-base text-on-surface-variant">
          Enter the six-digit code sent to <span className="font-medium text-on-surface">{phone || 'your phone'}</span>.
        </p>
        <form onSubmit={handleVerify} className="mt-8 space-y-4">
          <label htmlFor="verification-code" className="sr-only">Six-digit verification code</label>
          <input
            id="verification-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-16 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low text-center text-2xl tracking-[0.4em] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          />
          <button
            type="button"
            onClick={handleResend}
            disabled={!phone || secondsRemaining > 0 || resending}
            className="w-full py-2 text-sm font-semibold text-primary disabled:text-on-surface-variant"
          >
            {resending ? 'Resending...' : secondsRemaining > 0 ? `Resend code in ${secondsRemaining}s` : 'Resend code'}
          </button>
          {error && <p role="alert" className="rounded-xl bg-error-container/50 px-3 py-2 text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={code.length !== 6 || verifying || !phone}
            className="mt-6 h-14 w-full rounded-xl bg-primary text-on-primary font-semibold shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </section>
    </main>
  )
}