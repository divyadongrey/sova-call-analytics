import { NextRequest, NextResponse } from 'next/server'
import { getBookings, getBlockedSlots } from '@/lib/google-sheets'
import { ALL_SLOTS, TimeSlot } from '@/types'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const coachId = searchParams.get('coachId')
    const date    = searchParams.get('date')

    if (!coachId || !date) {
      return NextResponse.json({ error: 'coachId and date are required' }, { status: 400 })
    }

    // Get booked slots
    const bookings = await getBookings({ coachId, date })
    const bookedSlotLabels = new Set(
      bookings
        .filter(b => b.status !== 'cancelled')
        .map(b => b.slot)
    )

    // Get manually blocked slots
    const blocked = await getBlockedSlots(coachId, date)
    const blockedSlotLabels = new Set(blocked.map(b => b.slot))

    const slots: TimeSlot[] = ALL_SLOTS.map(slot => ({
      ...slot,
      available: !bookedSlotLabels.has(slot.label) && !blockedSlotLabels.has(slot.label),
    }))

    return NextResponse.json({ slots, date })
  } catch (err) {
    console.error('GET /api/slots error:', err)
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 })
  }
}
