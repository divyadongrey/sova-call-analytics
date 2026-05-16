/**
 * Google Sheets client via Apps Script Web App.
 * No Google Cloud project or service account required.
 * All requests go to the deployed Apps Script URL.
 */
import { Coach, Booking, BlockedSlot, TimeSlot } from '@/types'

const SCRIPT_URL = process.env.APPS_SCRIPT_URL!
const SECRET     = process.env.APPS_SCRIPT_SECRET!

async function get<T>(params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ ...params, token: SECRET }).toString()
  const res   = await fetch(`${SCRIPT_URL}?${query}`, { cache: 'no-store' })
  const data  = await res.json()
  if (!data.ok) throw new Error(data.error ?? 'Apps Script error')
  return data as T
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res  = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, token: SECRET }),
    cache: 'no-store',
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error ?? 'Apps Script error')
  return data as T
}

// ── Coaches ───────────────────────────────────────────────────────────────────

export async function getCoaches(language?: string): Promise<Coach[]> {
  const params: Record<string, string> = { action: 'getCoaches' }
  if (language) params.language = language
  const data = await get<{ coaches: Coach[] }>(params)
  return data.coaches
}

export async function getCoachById(id: string): Promise<Coach | null> {
  const coaches = await getCoaches()
  return coaches.find(c => c.id === id) ?? null
}

export async function getCoachByEmail(email: string): Promise<Coach | null> {
  const coaches = await getCoaches()
  return coaches.find(c => c.email.toLowerCase() === email.toLowerCase()) ?? null
}

// ── Slots ─────────────────────────────────────────────────────────────────────

export async function getAvailableSlots(coachId: string, date: string): Promise<TimeSlot[]> {
  const data = await get<{ slots: TimeSlot[] }>({ action: 'getSlots', coachId, date })
  return data.slots
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function getBookings(filters?: { coachId?: string; date?: string; role?: string }): Promise<Booking[]> {
  const params: Record<string, string> = { action: 'getBookings' }
  if (filters?.coachId) params.coachId = filters.coachId
  if (filters?.date)    params.date    = filters.date
  if (filters?.role)    params.role    = filters.role
  const data = await get<{ bookings: Booking[] }>(params)
  return data.bookings
}

export async function createBooking(booking: Omit<Booking, 'id' | 'status'>): Promise<Booking> {
  const data = await post<{ id: string; confirmationId: string }>({
    action: 'createBooking',
    ...booking,
    status: 'confirmed',
  })
  return { id: data.id, status: 'confirmed', ...booking }
}

export async function updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void> {
  await post({ action: 'updateBookingStatus', bookingId, status })
}

// ── Blocked Slots ─────────────────────────────────────────────────────────────

export async function getBlockedSlots(coachId: string, date: string): Promise<BlockedSlot[]> {
  // Derived from getSlots — we use the slot availability flags
  const slots = await getAvailableSlots(coachId, date)
  // getSlots already accounts for blocked; we don't need the raw BlockedSlot list
  return []
}

export async function blockSlot(coachId: string, date: string, slot: string, blockedBy: string): Promise<void> {
  await post({ action: 'blockSlot', coachId, date, slot, blockedBy })
}

export async function unblockSlot(coachId: string, date: string, slot: string): Promise<void> {
  await post({ action: 'unblockSlot', coachId, date, slot })
}

// ── Coach Auth (used by NextAuth) ─────────────────────────────────────────────

export async function getCoachAuth(email: string): Promise<{
  coachId: string; email: string; passwordHash: string; role: string; name: string
} | null> {
  try {
    const data = await get<{ coachId: string; email: string; passwordHash: string; role: string; name: string }>(
      { action: 'getCoachAuth', email }
    )
    return data
  } catch {
    return null
  }
}
