import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  createBooking, getBookings, getCoachById, getBlockedSlots,
} from '@/lib/google-sheets'
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

    // Validate slot label is valid
    const validSlot = ALL_SLOTS.find(s => s.label === data.slot)
    if (!validSlot) return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })

    // Fetch coach
    const coach = await getCoachById(data.coachId)
    if (!coach || !coach.isActive) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 })
    }

    // Double-booking check
    const existingBookings = await getBookings({ coachId: data.coachId, date: bookingDate })
    const alreadyBooked = existingBookings.some(
      b => b.slot === data.slot && b.status !== 'cancelled'
    )
    if (alreadyBooked) {
      return NextResponse.json({ error: 'Slot already booked' }, { status: 409 })
    }

    // Blocked slot check
    const blocked = await getBlockedSlots(data.coachId, bookingDate)
    if (blocked.some(b => b.slot === data.slot)) {
      return NextResponse.json({ error: 'Slot is blocked' }, { status: 409 })
    }

    const confirmationId = generateConfirmationId()
    const booking = await createBooking({
      customerName:      data.customerName,
      customerEmail:     data.customerEmail,
      customerPhone:     data.customerPhone,
      preferredLanguage: data.preferredLanguage,
      coachId:           data.coachId,
      coachName:         coach.name,
      date:              bookingDate,
      slot:              data.slot,
      status:            'confirmed',
      timestamp:         new Date().toISOString(),
      confirmationId,
    })

    // Google Calendar event (non-blocking)
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
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
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

    const filters = role === 'admin'
      ? { date: dateFilter }
      : { coachId, date: dateFilter }

    const bookings = await getBookings(filters)
    return NextResponse.json({ bookings })
  } catch (err) {
    console.error('GET /api/bookings error:', err)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}
