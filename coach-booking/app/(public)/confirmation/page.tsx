'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatDisplayDate } from '@/lib/utils'
import { Suspense } from 'react'

function ConfirmationContent() {
  const params = useSearchParams()
  const confirmationId = params.get('confirmationId') ?? ''
  const coachName      = params.get('coachName') ?? ''
  const date           = params.get('date') ?? ''
  const slot           = params.get('slot') ?? ''
  const customerName   = params.get('customerName') ?? ''
  const customerEmail  = params.get('customerEmail') ?? ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h1>
        <p className="text-slate-500 mb-6">
          A confirmation email has been sent to <strong>{customerEmail}</strong>.
        </p>

        <div className="bg-slate-50 rounded-xl p-5 text-left space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Confirmation ID</span>
            <span className="font-bold text-blue-600 font-mono tracking-wider">{confirmationId}</span>
          </div>
          <hr className="border-slate-200" />
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Name</span>
            <span className="font-medium">{customerName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Coach</span>
            <span className="font-medium">{coachName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Date</span>
            <span className="font-medium">{date ? formatDisplayDate(date) : ''}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Time</span>
            <span className="font-medium">{slot}</span>
          </div>
        </div>

        <p className="text-slate-400 text-sm mb-6">
          Please save your confirmation ID. Contact us if you need to reschedule or cancel.
        </p>

        <Link
          href="/book"
          className="inline-flex items-center justify-center w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Book Another Session
        </Link>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  )
}
