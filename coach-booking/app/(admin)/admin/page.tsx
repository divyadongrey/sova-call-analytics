'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Booking } from '@/types'
import { format, addDays, subDays } from 'date-fns'

interface Coach {
  id: string
  name: string
  email: string
  languages: string[]
  specialization: string
  isActive: boolean
  role: string
}

interface Stats {
  total: number
  confirmed: number
  cancelled: number
  byCoach: Record<string, number>
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [dateFilter, setDateFilter] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'coaches'>('overview')

  const role = (session?.user as any)?.role
  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && role !== 'admin')) {
      router.push('/dashboard')
    }
  }, [status, role, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    Promise.all([
      fetch(`/api/bookings?date=${dateFilter}`).then(r => r.json()),
      fetch('/api/admin/coaches').then(r => r.json()),
    ]).then(([b, c]) => {
      setBookings(b.bookings ?? [])
      setCoaches(c.coaches ?? [])
    }).finally(() => setLoading(false))
  }, [status, dateFilter])

  const stats: Stats = {
    total:     bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    byCoach:   bookings.reduce((acc, b) => {
      if (b.status !== 'cancelled') acc[b.coachName] = (acc[b.coachName] ?? 0) + 1
      return acc
    }, {} as Record<string, number>),
  }

  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i - 1)
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE, MMM d') }
  })

  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-900">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-sm text-slate-500 hover:text-slate-700">
              Coach View
            </button>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
            >
              {dateOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-slate-200 w-fit">
          {(['overview', 'bookings', 'coaches'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${activeTab === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Bookings" value={stats.total} color="blue" />
              <StatCard label="Confirmed" value={stats.confirmed} color="green" />
              <StatCard label="Cancelled" value={stats.cancelled} color="red" />
              <StatCard label="Active Coaches" value={coaches.filter(c => c.isActive).length} color="purple" />
            </div>

            {/* Bookings by coach */}
            {Object.keys(stats.byCoach).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Bookings by Coach</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byCoach).sort((a, b) => b[1] - a[1]).map(([coach, count]) => (
                    <div key={coach} className="flex items-center gap-3">
                      <span className="text-sm text-slate-700 w-36 truncate">{coach}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min((count / stats.confirmed) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-3">
            {bookings.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                <p className="text-slate-500">No bookings for this date</p>
              </div>
            ) : bookings.map(b => (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">{b.customerName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        b.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{b.status}</span>
                    </div>
                    <p className="text-sm text-slate-500">{b.customerEmail} · {b.customerPhone}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                      <span>Coach: <strong className="text-slate-700">{b.coachName}</strong></span>
                      <span>·</span>
                      <span>{b.slot}</span>
                      <span>·</span>
                      <span>{b.preferredLanguage}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">#{b.confirmationId}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'coaches' && (
          <div className="grid md:grid-cols-2 gap-4">
            {coaches.map(c => (
              <CoachCard key={c.id} coach={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CoachCard({ coach }: { coach: Coach }) {
  const [inviteState, setInviteState] = useState<'idle' | 'loading' | 'copied'>('idle')
  const [inviteUrl, setInviteUrl]     = useState('')

  async function generateInvite() {
    setInviteState('loading')
    try {
      const res  = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId: coach.id, email: coach.email, role: coach.role, name: coach.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInviteUrl(data.inviteUrl)
      await navigator.clipboard.writeText(data.inviteUrl)
      setInviteState('copied')
      setTimeout(() => setInviteState('idle'), 4000)
    } catch (err: any) {
      alert('Failed to generate invite: ' + (err.message ?? 'Unknown error'))
      setInviteState('idle')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-slate-900">{coach.name}</h3>
          <p className="text-sm text-slate-500">{coach.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${coach.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {coach.isActive ? 'Active' : 'Inactive'}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${coach.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
            {coach.role}
          </span>
        </div>
      </div>
      <p className="text-sm text-blue-600">{coach.specialization}</p>
      <div className="flex flex-wrap gap-1 mt-2 mb-4">
        {coach.languages.map(l => (
          <span key={l} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{l}</span>
        ))}
      </div>

      {/* Invite link section */}
      {inviteUrl && inviteState === 'copied' && (
        <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500 mb-1 font-medium">Invite link (copied!):</p>
          <p className="text-xs text-blue-600 break-all font-mono">{inviteUrl}</p>
        </div>
      )}

      <button
        onClick={generateInvite}
        disabled={inviteState === 'loading'}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-60
          ${inviteState === 'copied'
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
      >
        {inviteState === 'loading' && (
          <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        )}
        {inviteState === 'copied' ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Link Copied! Send it to {coach.name.split(' ')[0]}
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {inviteState === 'loading' ? 'Generating…' : 'Generate & Copy Invite Link'}
          </>
        )}
      </button>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    green:  'bg-green-50 text-green-700 border-green-100',
    red:    'bg-red-50 text-red-700 border-red-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-75">{label}</p>
    </div>
  )
}
