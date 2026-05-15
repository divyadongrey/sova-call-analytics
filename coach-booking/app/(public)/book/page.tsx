'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { formatDisplayDate, getBookingDate, getUniqueLanguages } from '@/lib/utils'
import { TimeSlot } from '@/types'

type Step = 1 | 2 | 3 | 4

interface CustomerInfo {
  name: string
  email: string
  phone: string
  language: string
}

interface Coach {
  id: string
  name: string
  languages: string[]
  specialization: string
  bio: string
  imageUrl: string
}

const BOOKING_DATE = getBookingDate()

export default function BookPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', email: '', phone: '', language: '' })
  const [allCoaches, setAllCoaches] = useState<Coach[]>([])
  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<CustomerInfo>>({})

  // Fetch all coaches on mount
  useEffect(() => {
    fetch('/api/coaches')
      .then(r => r.json())
      .then(data => {
        setAllCoaches(data.coaches ?? [])
        setLanguages(getUniqueLanguages(data.coaches ?? []))
      })
      .catch(() => setError('Failed to load coaches'))
  }, [])

  // When language is chosen, filter coaches
  useEffect(() => {
    if (!customer.language) return
    const filtered = allCoaches.filter(c =>
      c.languages.some(l => l.toLowerCase() === customer.language.toLowerCase())
    )
    setFilteredCoaches(filtered)
  }, [customer.language, allCoaches])

  // Fetch slots when coach selected
  const fetchSlots = useCallback(async (coachId: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/slots?coachId=${coachId}&date=${BOOKING_DATE}`)
      const data = await res.json()
      setSlots(data.slots ?? [])
    } catch {
      setError('Failed to load slots')
    } finally {
      setLoading(false)
    }
  }, [])

  function validateCustomer(): boolean {
    const errs: Partial<CustomerInfo> = {}
    if (!customer.name.trim() || customer.name.trim().length < 2) errs.name = 'Enter your full name'
    if (!customer.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = 'Enter a valid email'
    if (!customer.phone.match(/^\+?[\d\s\-()]{7,20}$/)) errs.phone = 'Enter a valid phone number'
    if (!customer.language) errs.language = 'Select your preferred language'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleBooking() {
    if (!selectedCoach || !selectedSlot) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName:      customer.name,
          customerEmail:     customer.email,
          customerPhone:     customer.phone,
          preferredLanguage: customer.language,
          coachId:           selectedCoach.id,
          slot:              selectedSlot,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Booking failed')
      const params = new URLSearchParams({
        confirmationId: data.booking.confirmationId,
        coachName:      data.booking.coachName,
        date:           data.booking.date,
        slot:           data.booking.slot,
        customerName:   data.booking.customerName,
        customerEmail:  data.booking.customerEmail,
      })
      router.push(`/confirmation?${params.toString()}`)
    } catch (err: any) {
      setError(err.message ?? 'Booking failed. Please try again.')
      // Refresh slots in case of conflict
      if (selectedCoach) fetchSlots(selectedCoach.id)
    } finally {
      setLoading(false)
    }
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Coach Booking'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{appName}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Booking date banner */}
        <div className="bg-blue-600 text-white rounded-xl p-4 mb-8 flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">
            Booking slots for <span className="font-bold">{formatDisplayDate(BOOKING_DATE)}</span>
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Customer Info */}
        {step === 1 && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Your Details</h2>
            <div className="grid md:grid-cols-2 gap-5">
              <FormField
                label="Full Name"
                required
                error={fieldErrors.name}
              >
                <input
                  type="text"
                  placeholder="John Doe"
                  value={customer.name}
                  onChange={e => setCustomer(p => ({ ...p, name: e.target.value }))}
                  className="input"
                />
              </FormField>

              <FormField label="Email Address" required error={fieldErrors.email}>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={customer.email}
                  onChange={e => setCustomer(p => ({ ...p, email: e.target.value }))}
                  className="input"
                />
              </FormField>

              <FormField label="Phone Number" required error={fieldErrors.phone}>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={customer.phone}
                  onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))}
                  className="input"
                />
              </FormField>

              <FormField label="Preferred Language" required error={fieldErrors.language}>
                <select
                  value={customer.language}
                  onChange={e => setCustomer(p => ({ ...p, language: e.target.value }))}
                  className="input"
                >
                  <option value="">Select a language</option>
                  {languages.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => { if (validateCustomer()) setStep(2) }}
                className="btn-primary"
              >
                Next: Choose a Coach
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Coach Selection */}
        {step === 2 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {filteredCoaches.length > 0
                  ? `Coaches available in ${customer.language}`
                  : `No coaches available for ${customer.language}`}
              </h2>
              <button onClick={() => setStep(1)} className="btn-ghost">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            </div>

            {filteredCoaches.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-slate-600">No coaches found for <strong>{customer.language}</strong>.</p>
                <button onClick={() => setStep(1)} className="btn-primary mt-4">Change Language</button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                {filteredCoaches.map(coach => (
                  <CoachCard
                    key={coach.id}
                    coach={coach}
                    selected={selectedCoach?.id === coach.id}
                    onSelect={() => {
                      setSelectedCoach(coach)
                      setSelectedSlot('')
                      fetchSlots(coach.id)
                      setStep(3)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Slot Selection */}
        {step === 3 && selectedCoach && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Choose a Time Slot</h2>
                <p className="text-slate-500 text-sm mt-1">with {selectedCoach.name}</p>
              </div>
              <button onClick={() => { setStep(2); setSelectedSlot('') }} className="btn-ghost">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {slots.map(slot => (
                    <button
                      key={slot.label}
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot.label)}
                      className={`
                        p-4 rounded-xl border-2 text-sm font-medium transition-all
                        ${!slot.available
                          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                          : selectedSlot === slot.label
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                        }
                      `}
                    >
                      {slot.label}
                      {!slot.available && (
                        <span className="block text-xs mt-1 font-normal">Booked</span>
                      )}
                    </button>
                  ))}
                </div>

                {slots.every(s => !s.available) && (
                  <p className="text-center text-slate-500 py-6">
                    All slots are booked for this coach. Please go back and select a different coach.
                  </p>
                )}

                {selectedSlot && (
                  <div className="mt-6 flex justify-end">
                    <button onClick={() => setStep(4)} className="btn-primary">
                      Review Booking
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 4: Review & Confirm */}
        {step === 4 && selectedCoach && selectedSlot && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Review & Confirm</h2>
              <button onClick={() => setStep(3)} className="btn-ghost">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-3 mb-6">
              <ReviewRow label="Name"     value={customer.name} />
              <ReviewRow label="Email"    value={customer.email} />
              <ReviewRow label="Phone"    value={customer.phone} />
              <ReviewRow label="Language" value={customer.language} />
              <hr className="border-blue-100" />
              <ReviewRow label="Coach"    value={selectedCoach.name} />
              <ReviewRow label="Date"     value={formatDisplayDate(BOOKING_DATE)} />
              <ReviewRow label="Slot"     value={selectedSlot} />
            </div>

            <p className="text-slate-500 text-sm mb-6">
              A confirmation email will be sent to <strong>{customer.email}</strong>.
            </p>

            <button
              onClick={handleBooking}
              disabled={loading}
              className="btn-primary w-full justify-center text-base py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Confirming...
                </>
              ) : 'Confirm Booking'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { num: 1, label: 'Your Info' },
    { num: 2, label: 'Choose Coach' },
    { num: 3, label: 'Pick Slot' },
    { num: 4, label: 'Confirm' },
  ]
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className={`
            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
            ${current === s.num ? 'bg-blue-600 text-white' : current > s.num ? 'bg-green-500 text-white' : 'bg-white text-slate-400'}
          `}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
              {current > s.num ? '✓' : s.num}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 mx-1 ${current > s.num ? 'bg-green-500' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function CoachCard({ coach, selected, onSelect }: { coach: Coach; selected: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={`
        bg-white rounded-2xl shadow-sm border-2 p-5 cursor-pointer transition-all hover:shadow-md
        ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-blue-200'}
      `}
    >
      <div className="flex items-start gap-4">
        <div className="relative w-14 h-14 shrink-0">
          {coach.imageUrl ? (
            <Image
              src={coach.imageUrl}
              alt={coach.name}
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
              {coach.name[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900">{coach.name}</h3>
          <p className="text-sm text-blue-600 font-medium">{coach.specialization}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {coach.languages.map(l => (
              <span key={l} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {l}
              </span>
            ))}
          </div>
          {coach.bio && (
            <p className="text-xs text-slate-500 mt-2 line-clamp-2">{coach.bio}</p>
          )}
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={e => { e.stopPropagation(); onSelect() }}
          className="w-full py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Select & View Slots
        </button>
      </div>
    </div>
  )
}

function FormField({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}
