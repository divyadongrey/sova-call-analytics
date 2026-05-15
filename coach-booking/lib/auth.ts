import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { google } from 'googleapis'

// Fetch coach passwords from a hidden sheet "CoachAuth" (coachId, email, passwordHash, role)
async function getCoachAuth(email: string): Promise<{ email: string; passwordHash: string; role: string; coachId: string; name: string } | null> {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    range: 'CoachAuth!A2:E1000',
  })
  const rows = res.data.values ?? []
  const row = rows.find(r => r[1]?.toLowerCase() === email.toLowerCase())
  if (!row) return null
  return {
    coachId:      row[0],
    email:        row[1],
    passwordHash: row[2],
    role:         row[3] ?? 'coach',
    name:         row[4] ?? '',
  }
}

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
