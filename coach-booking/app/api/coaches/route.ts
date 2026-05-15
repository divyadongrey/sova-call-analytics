import { NextRequest, NextResponse } from 'next/server'
import { getCoaches } from '@/lib/google-sheets'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const language = searchParams.get('language')

    let coaches = await getCoaches()
    coaches = coaches.filter(c => c.isActive)

    if (language) {
      coaches = coaches.filter(c =>
        c.languages.some(l => l.toLowerCase() === language.toLowerCase())
      )
    }

    // Never expose sensitive fields to public
    const safe = coaches.map(({ id, name, languages, specialization, bio, imageUrl }) => ({
      id, name, languages, specialization, bio, imageUrl,
    }))

    return NextResponse.json({ coaches: safe })
  } catch (err) {
    console.error('GET /api/coaches error:', err)
    return NextResponse.json({ error: 'Failed to fetch coaches' }, { status: 500 })
  }
}
