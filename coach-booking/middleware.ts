import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Admin-only routes
    if (pathname.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl
        // Public routes that don't need auth
        if (
          pathname.startsWith('/book') ||
          pathname.startsWith('/confirmation') ||
          pathname.startsWith('/login') ||
          pathname.startsWith('/api/coaches') ||
          pathname.startsWith('/api/slots') ||
          pathname.startsWith('/api/bookings') && req.method === 'POST' ||
          pathname.startsWith('/api/auth')
        ) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/bookings',
    '/api/slots/block/:path*',
    '/api/admin/:path*',
  ],
}
