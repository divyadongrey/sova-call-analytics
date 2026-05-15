'use client'
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { formatDisplayDate, getBookingDate } from '@/lib/utils'
import { ALL_SLOTS, Booking, TimeSlot } from '@/types'
import { format, addDays } from 'date-fns'

type ViewDate = 'tomorrow' | 'today' | 'all'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [slots, setSlots] = useState<(TimeSlot & { blocked: boolean })[]>([])
  const [dateFilter, setDateFilter] = useState<string>(getBookingDate())
  const [loading, setLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'bookings' | 'slots'>('bookings')
  const [toastMsg, setToastMsg] = useState('')

  const role     = (session?.user as any)?.role
  const coachId  = (session?.user as any)?.coachId
  const isAdmin  = role === 'admin'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchBookings()
  }, [status, dateFilter])

  useEffect(() => {
    if (status !== 'authenticated' || !coachId) return
    fetchSlots()
  }, [status, coachId, dateFilter])

  async function fetchBookings() {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings?date=${dateFilter}`)
      const data = await res.json()
      setBookings(data.bookings ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }

  async function fetchSlots() {
    if (!coachId) return
    setSlotsLoading(true)
    try {
      const [slotsRes, bookingsRes] = await Promise.all([
        fetch(`/api/slots?coachId=${coachId}&date=${dateFilter}`),
        fetch(`/api/bookings?date=${dateFilter}`),
      ])
      const slotsData    = await slotsRes.json()
      const bookingsData = await bookingsRes.json()
      const bookedLabels = new Set(
        (bookingsData.bookings ?? []).filter((b: Booking) => b.status !== 'cancelled').map((b: Booking) => b.slot)
      )
      setSlots((slotsData.slots ?? []).map((s: TimeSlot) => ({
        ...s,
        blocked: !s.available && !bookedLabels.has(s.label),
      })))
    } catch { /* silent */ }
    setSlotsLoading(false)
  }

  function toast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  async function toggleBlock(slot: TimeSlot & { blocked: boolean }) {
    const method = slot.blocked ? 'DELETE' : 'POST'
    const res = await fetch('/api/slots/block', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId, date: dateFilter, slot: slot.label }),
    })
    if (res.ok) {
      toast(slot.blocked ? 'Slot unblocked' : 'Slot blocked')
      fetchSlots()
    }
  }

  async function cancelBooking(bookingId: string) {
    if (!confirm('Cancel this booking?')) return
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (res.ok) { toast('Booking cancelled'); fetchBookings() }
  }

  // Generate selectable dates (next 7 days)
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i)
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE, MMM d') }
  })

  if (status === 'loading') return <LoadingScreen />

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-top">
          {toastMsg}
        </div>
      )}

      {/* Sidebar + Main layout */}
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-5 border-b border-slate-200">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-bold text-slate-900 text-sm">{session?.user?.name ?? 'Coach'}</p>
            <p className="text-xs text-slate-400">{session?.user?.email}</p>
            <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              {isAdmin ? 'Admin' : 'Coach'}
            </span>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            <NavBtn active={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Bookings
            </NavBtn>
            {!isAdmin && (
              <NavBtn active={activeTab === 'slots'} onClick={() => setActiveTab('slots')}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Manage Slots
              </NavBtn>
            )}
            {isAdmin && (
              <NavBtn active={false} onClick={() => router.push('/admin')}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
                Admin Panel
              </NavBtn>
            )}
          </nav>
          <div className="p-3 border-t border-slate-200">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Date picker */}
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                {activeTab === 'bookings' ? 'Bookings' : 'Slot Management'}
              </h2>
              <div className="ml-auto flex items-center gap-2">
                <label className="text-sm text-slate-500">Date:</label>
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                >
                  {dateOptions.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              loading ? <LoadingSpinner /> : (
                bookings.length === 0 ? (
                  <EmptyState message="No bookings for this date" />
                ) : (
                  <div className="space-y-3">
                    {bookings.map(b => (
                      <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-900">{b.customerName}</h3>
                              <StatusBadge status={b.status} />
                            </div>
                            <p className="text-sm text-slate-500">{b.customerEmail} · {b.customerPhone}</p>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              <span className="flex items-center gap-1 text-blue-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {b.slot}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500">{b.preferredLanguage}</span>
                              {isAdmin && (
                                <>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500">Coach: {b.coachName}</span>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1 font-mono">#{b.confirmationId}</p>
                          </div>
                          {b.status === 'confirmed' && (
                            <button
                              onClick={() => cancelBooking(b.id)}
                              className="shrink-0 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )
            )}

            {/* Slots Tab */}
            {activeTab === 'slots' && !isAdmin && (
              slotsLoading ? <LoadingSpinner /> : (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm text-slate-500 mb-4">
                    Block slots to prevent customers from booking during unavailable times.
                    Slots already booked by customers cannot be blocked.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {slots.map(slot => {
                      const isBooked = !slot.available && !slot.blocked
                      return (
                        <div
                          key={slot.label}
                          className={`
                            p-4 rounded-xl border-2 text-sm
                            ${isBooked
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : slot.blocked
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : 'bg-green-50 border-green-200 text-green-700'
                            }
                          `}
                        >
                          <p className="font-medium">{slot.label}</p>
                          <p className="text-xs mt-0.5 opacity-75">
                            {isBooked ? 'Booked by customer' : slot.blocked ? 'Blocked' : 'Available'}
                          </p>
                          {!isBooked && (
                            <button
                              onClick={() => toggleBlock(slot)}
                              className={`
                                mt-2 w-full py-1.5 rounded-lg text-xs font-medium border transition-colors
                                ${slot.blocked
                                  ? 'border-red-300 bg-red-100 hover:bg-red-200 text-red-700'
                                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-600'
                                }
                              `}
                            >
                              {slot.blocked ? 'Unblock' : 'Block'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  )
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const styles = {
    confirmed:   'bg-green-100 text-green-700',
    cancelled:   'bg-red-100 text-red-700',
    rescheduled: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
      <div className="text-4xl mb-3">📋</div>
      <p className="text-slate-500">{message}</p>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
