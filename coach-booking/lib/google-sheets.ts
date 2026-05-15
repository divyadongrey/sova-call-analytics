import { google, sheets_v4 } from 'googleapis'
import { Coach, Booking, BlockedSlot } from '@/types'

// Sheet names
const SHEETS = {
  COACHES: 'Coaches',
  BOOKINGS: 'Bookings',
  BLOCKED_SLOTS: 'BlockedSlots',
}

function getAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
    ],
  })
  return auth
}

async function getSheets(): Promise<sheets_v4.Sheets> {
  const auth = getAuth()
  return google.sheets({ version: 'v4', auth })
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!

// ── Coaches ──────────────────────────────────────────────────────────────────

export async function getCoaches(): Promise<Coach[]> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.COACHES}!A2:J1000`,
  })
  const rows = res.data.values ?? []
  return rows
    .filter(r => r[0])
    .map(r => ({
      id:             r[0] ?? '',
      name:           r[1] ?? '',
      email:          r[2] ?? '',
      languages:      (r[3] ?? '').split(',').map((l: string) => l.trim()).filter(Boolean),
      specialization: r[4] ?? '',
      bio:            r[5] ?? '',
      imageUrl:       r[6] ?? '',
      calendarId:     r[7] ?? '',
      isActive:       r[8]?.toLowerCase() === 'true',
      role:           (r[9] ?? 'coach') as Coach['role'],
    }))
}

export async function getCoachById(id: string): Promise<Coach | null> {
  const coaches = await getCoaches()
  return coaches.find(c => c.id === id) ?? null
}

export async function getCoachByEmail(email: string): Promise<Coach | null> {
  const coaches = await getCoaches()
  return coaches.find(c => c.email.toLowerCase() === email.toLowerCase()) ?? null
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export async function getBookings(filters?: { coachId?: string; date?: string }): Promise<Booking[]> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BOOKINGS}!A2:N1000`,
  })
  const rows = res.data.values ?? []
  let bookings = rows
    .filter(r => r[0])
    .map(r => ({
      id:               r[0] ?? '',
      customerName:     r[1] ?? '',
      customerEmail:    r[2] ?? '',
      customerPhone:    r[3] ?? '',
      preferredLanguage:r[4] ?? '',
      coachId:          r[5] ?? '',
      coachName:        r[6] ?? '',
      date:             r[7] ?? '',
      slot:             r[8] ?? '',
      status:           (r[9] ?? 'confirmed') as Booking['status'],
      timestamp:        r[10] ?? '',
      confirmationId:   r[11] ?? '',
      calendarEventId:  r[12] ?? '',
      notes:            r[13] ?? '',
    }))

  if (filters?.coachId) bookings = bookings.filter(b => b.coachId === filters.coachId)
  if (filters?.date)    bookings = bookings.filter(b => b.date === filters.date)
  return bookings
}

export async function createBooking(booking: Omit<Booking, 'id'>): Promise<Booking> {
  const sheets = await getSheets()
  const id = `BK-${Date.now()}`
  const row = [
    id,
    booking.customerName,
    booking.customerEmail,
    booking.customerPhone,
    booking.preferredLanguage,
    booking.coachId,
    booking.coachName,
    booking.date,
    booking.slot,
    booking.status,
    booking.timestamp,
    booking.confirmationId,
    booking.calendarEventId ?? '',
    booking.notes ?? '',
  ]
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BOOKINGS}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
  return { id, ...booking }
}

export async function updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BOOKINGS}!A2:A1000`,
  })
  const rows = res.data.values ?? []
  const rowIndex = rows.findIndex(r => r[0] === bookingId)
  if (rowIndex === -1) throw new Error('Booking not found')
  // Row index in sheet = rowIndex + 2 (1-based + header)
  const sheetRow = rowIndex + 2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BOOKINGS}!J${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  })
}

// ── Blocked Slots ─────────────────────────────────────────────────────────────

export async function getBlockedSlots(coachId: string, date: string): Promise<BlockedSlot[]> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BLOCKED_SLOTS}!A2:E1000`,
  })
  const rows = res.data.values ?? []
  return rows
    .filter(r => r[0] === coachId && r[1] === date)
    .map(r => ({
      coachId:   r[0],
      date:      r[1],
      slot:      r[2],
      blockedBy: r[3],
      timestamp: r[4],
    }))
}

export async function blockSlot(coachId: string, date: string, slot: string, blockedBy: string): Promise<void> {
  const sheets = await getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BLOCKED_SLOTS}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[coachId, date, slot, blockedBy, new Date().toISOString()]] },
  })
}

export async function unblockSlot(coachId: string, date: string, slot: string): Promise<void> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.BLOCKED_SLOTS}!A2:E1000`,
  })
  const rows = res.data.values ?? []
  const rowIndices: number[] = []
  rows.forEach((r, i) => {
    if (r[0] === coachId && r[1] === date && r[2] === slot) rowIndices.push(i + 2)
  })
  // Delete rows in reverse order to preserve indices
  for (const idx of rowIndices.reverse()) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: await getSheetId(sheets, SHEETS.BLOCKED_SLOTS),
              dimension: 'ROWS',
              startIndex: idx - 1,
              endIndex: idx,
            },
          },
        }],
      },
    })
  }
}

async function getSheetId(sheets: sheets_v4.Sheets, sheetName: string): Promise<number> {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = res.data.sheets?.find(s => s.properties?.title === sheetName)
  return sheet?.properties?.sheetId ?? 0
}
