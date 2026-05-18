'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

type Status = 'loading' | 'valid' | 'invalid' | 'success'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const router    = useRouter()

  const [status, setStatus]       = useState<Status>('loading')
  const [coachInfo, setCoachInfo] = useState<{ email: string; name: string } | null>(null)
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStatus('invalid'); return }
        setCoachInfo({ email: data.email, name: data.name })
        setStatus('valid')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setSaving(true)
    try {
      const res  = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }

      setStatus('success')
      // Auto sign-in after 2 seconds
      setTimeout(async () => {
        await signIn('credentials', {
          email: data.email,
          password,
          callbackUrl: '/dashboard',
          redirect: true,
        })
      }, 2000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Coach Booking Platform'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{appName}</h1>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Verifying your invite link…</p>
          </div>
        )}

        {/* Invalid */}
        {status === 'invalid' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Link Invalid or Expired</h2>
            <p className="text-slate-500 text-sm">This invite link has already been used or has expired. Please ask your admin to send a new one.</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Password Set!</h2>
            <p className="text-slate-500 text-sm">Your account is ready. Signing you in…</p>
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
          </div>
        )}

        {/* Set password form */}
        {status === 'valid' && coachInfo && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6">
              <p className="text-sm text-blue-800">
                Welcome, <strong>{coachInfo.name || coachInfo.email}</strong>! Set a password to activate your coach account.
              </p>
            </div>

            <div className="mb-5 text-sm">
              <span className="text-slate-500">Login email: </span>
              <span className="font-medium text-slate-900">{coachInfo.email}</span>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Create Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className="input"
                />
              </div>

              {/* Password strength hints */}
              <ul className="text-xs text-slate-400 space-y-0.5 pl-1">
                <li className={password.length >= 8 ? 'text-green-600' : ''}>
                  {password.length >= 8 ? '✓' : '○'} At least 8 characters
                </li>
                <li className={confirm && confirm === password ? 'text-green-600' : ''}>
                  {confirm && confirm === password ? '✓' : '○'} Passwords match
                </li>
              </ul>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full justify-center py-3 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Activating account…
                  </span>
                ) : 'Activate My Account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
