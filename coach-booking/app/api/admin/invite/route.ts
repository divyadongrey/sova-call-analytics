import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateInvite } from '@/lib/google-sheets'
import { z } from 'zod'

const schema = z.object({
  coachId: z.string().min(1),
  email:   z.string().email(),
  role:    z.enum(['coach', 'admin']).default('coach'),
  name:    z.string().default(''),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = schema.parse(body)
    const { token, expiresAt } = await generateInvite(data.coachId, data.email, data.role, data.name)

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const inviteUrl = `${appUrl}/invite/${token}`

    return NextResponse.json({ inviteUrl, expiresAt })
  } catch (err: any) {
    console.error('Generate invite error:', err)
    return NextResponse.json({ error: err.message ?? 'Failed to generate invite' }, { status: 500 })
  }
}
