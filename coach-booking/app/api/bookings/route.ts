import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createBooking, getBookings, getCoachById } from '@/lib/google-sheets'
import { createCalendarEvent } from '@/lib/google-calendar'
import { sendBookingConfirmation, sendCoachNotification } from '@/lib/email'
import { generateConfirmationId, getBookingDate } from '@/lib/utils'
import { z } from 'zod'
import { ALL_SLOTS } from '@/types'

const bookingSchema = z.object({
  customerName:      z.string().min(2).max(100),
  customerEmail:     z.string().email(),
  customerPhone:     z.string().min(7).max(20),
  preferredLanguage: z.string().min(1),
  coachId:           z.string().min(1),
  slot:              z.string().min(1),
})

// POST /api/bookings – create a new booking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = bookingSchema.parse(body)

    const bookingDate = getBookingDate()

    // Validate slot label
    const validSlot = ALL_SLOTS.find(s => s.label === data.slot)
    if (!validSlot) return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })

    // Fetch coach
    const coach = await getCoachById(data.coachId)
    if (!coach || !coach.isActive) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 })
    }

    const confirmationId = generateConfirmationId()

    // Apps Script handles double-booking and blocked-slot checks atomically
    const booking = await createBooking({
      customerName:      data.customerName,
      customerEmail:     data.customerEmail,
      customerPhone:     data.customerPhone,
      preferredLanguage: data.preferredLanguage,
      coachId:           data.coachId,
      coachName:         coach.name,
      date:              bookingDate,
      slot:              data.slot,
      timestamp:         new Date().toISOString(),
      confirmationId,
    })

    // Google Calendar event (non-blocking, optional)
    const calendarEventId = await createCalendarEvent(booking, coach)
    if (calendarEventId) booking.calendarEventId = calendarEventId

    // Send emails (non-blocking)
    Promise.all([
      sendBookingConfirmation(booking),
      sendCoachNotification(booking, coach.email),
    ]).catch(err => console.error('Email error:', err))

    return NextResponse.json({
      success: true,
      booking: {
        confirmationId: booking.confirmationId,
        coachName:      booking.coachName,
        date:           booking.date,
        slot:           booking.slot,
        customerName:   booking.customerName,
        customerEmail:  booking.customerEmail,
      },
    })
  } catch (err: any) {
    if (err?.message?.includes('already booked') || err?.message?.includes('blocked')) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err?.constructor?.name === 'ZodError') {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('POST /api/bookings error:', err)
    return NextResponse.json({ error: 'Booking failed' }, { status: 500 })
  }
}

// GET /api/bookings – list bookings (coach/admin only)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const dateFilter = searchParams.get('date') ?? undefined
    const role       = (session.user as any).role
    const coachId    = (session.user as any).coachId

    const bookings = await getBookings({ coachId: role === 'admin' ? undefined : coachId, date: dateFilter, role })
    return NextResponse.json({ bookings })
  } catch (err) {
    console.error('GET /api/bookings error:', err)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}
