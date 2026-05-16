import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getCoachAuth } from '@/lib/google-sheets'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const coach = await getCoachAuth(credentials.email)
          if (!coach) return null
          const valid = await bcrypt.compare(credentials.password, coach.passwordHash)
          if (!valid) return null
          return {
            id:      coach.coachId,
            email:   coach.email,
            name:    coach.name,
            role:    coach.role,
          }
        } catch (err) {
          console.error('Auth error:', err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role    = (user as any).role
        token.coachId = (user as any).id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role    = token.role
        ;(session.user as any).coachId = token.coachId
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
}
