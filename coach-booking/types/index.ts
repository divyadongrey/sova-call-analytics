export interface Coach {
  id: string
  name: string
  email: string
  languages: string[]
  specialization: string
  bio: string
  imageUrl: string
  calendarId?: string
  isActive: boolean
  role: 'coach' | 'admin'
}

export interface Booking {
  id: string
  customerName: string
  customerEmail: string
  customerPhone: string
  preferredLanguage: string
  coachId: string
  coachName: string
  date: string       // YYYY-MM-DD
  slot: string       // "11:00 AM - 12:00 PM"
  status: 'confirmed' | 'cancelled' | 'rescheduled'
  timestamp: string  // ISO
  confirmationId: string
  calendarEventId?: string
  notes?: string
}

export interface BlockedSlot {
  coachId: string
  date: string
  slot: string
  blockedBy: string
  timestamp: string
}

export interface TimeSlot {
  label: string      // "11:00 AM - 12:00 PM"
  start: string      // "11:00"
  end: string        // "12:00"
  available: boolean
}

export const ALL_SLOTS: TimeSlot[] = [
  { label: '11:00 AM – 12:00 PM', start: '11:00', end: '12:00', available: true },
  { label: '12:00 PM – 1:00 PM',  start: '12:00', end: '13:00', available: true },
  { label: '1:00 PM – 2:00 PM',   start: '13:00', end: '14:00', available: true },
  { label: '2:00 PM – 3:00 PM',   start: '14:00', end: '15:00', available: true },
  { label: '3:00 PM – 4:00 PM',   start: '15:00', end: '16:00', available: true },
  { label: '4:00 PM – 5:00 PM',   start: '16:00', end: '17:00', available: true },
]
