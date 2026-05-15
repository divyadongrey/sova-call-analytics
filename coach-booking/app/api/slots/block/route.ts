import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { blockSlot, unblockSlot } from '@/lib/google-sheets'
import { z } from 'zod'

const schema = z.object({
  coachId: z.string(),
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot:    z.string(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { coachId, date, slot } = schema.parse(body)
    const userCoachId = (session.user as any).coachId
    const role = (session.user as any).role

    // Coaches can only block their own slots; admins can block any
    if (role !== 'admin' && userCoachId !== coachId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await blockSlot(coachId, date, slot, session.user?.email ?? 'unknown')
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: 'Failed to block slot' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { coachId, date, slot } = schema.parse(body)
    const userCoachId = (session.user as any).coachId
    const role = (session.user as any).role

    if (role !== 'admin' && userCoachId !== coachId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await unblockSlot(coachId, date, slot)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 })
    return NextResponse.json({ error: 'Failed to unblock slot' }, { status: 500 })
  }
}
