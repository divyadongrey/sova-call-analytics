import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateBookingStatus } from '@/lib/google-sheets'
import { z } from 'zod'

const schema = z.object({ status: z.enum(['confirmed', 'cancelled', 'rescheduled']) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { status } = schema.parse(body)
    await updateBookingStatus(params.id, status)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
