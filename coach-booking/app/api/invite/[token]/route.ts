import { NextRequest, NextResponse } from 'next/server'
import { validateInvite, consumeInvite } from '@/lib/google-sheets'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// GET /api/invite/[token] — validate token (called on page load)
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const data = await validateInvite(params.token)
  if (!data) return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 })
  // Return only safe fields — never return passwordHash
  return NextResponse.json({ email: data.email, name: data.name, role: data.role })
}

// POST /api/invite/[token] — set password and activate account
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body     = await req.json()
    const password = z.string().min(8, 'Password must be at least 8 characters').parse(body.password)

    // Validate the invite is still good
    const invite = await validateInvite(params.token)
    if (!invite) return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 })

    // Hash the password server-side — coach never sees a hash
    const passwordHash = await bcrypt.hash(password, 10)
    await consumeInvite(params.token, passwordHash)

    return NextResponse.json({ success: true, email: invite.email })
  } catch (err: any) {
    if (err?.constructor?.name === 'ZodError') {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid password' }, { status: 400 })
    }
    return NextResponse.json({ error: err.message ?? 'Failed to set password' }, { status: 500 })
  }
}
