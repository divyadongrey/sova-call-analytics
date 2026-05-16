import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/google-sheets'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const coachId = searchParams.get('coachId')
    const date    = searchParams.get('date')

    if (!coachId || !date) {
      return NextResponse.json({ error: 'coachId and date are required' }, { status: 400 })
    }

    // Apps Script handles both booked + blocked slot logic
    const slots = await getAvailableSlots(coachId, date)
    return NextResponse.json({ slots, date })
  } catch (err) {
    console.error('GET /api/slots error:', err)
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 })
  }
}
