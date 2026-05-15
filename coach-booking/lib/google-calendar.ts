import { google } from 'googleapis'
import { Booking, Coach } from '@/types'

function getAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
}

export async function createCalendarEvent(booking: Booking, coach: Coach): Promise<string | null> {
  if (!process.env.GOOGLE_CALENDAR_ENABLED || !coach.calendarId) return null

  try {
    const auth = getAuth()
    const calendar = google.calendar({ version: 'v3', auth })
    const timezone = process.env.BOOKING_TIMEZONE ?? 'Asia/Kolkata'

    // Parse slot to get start/end times
    // slot format: "11:00 AM – 12:00 PM"
    const [startStr] = booking.slot.split('–').map(s => s.trim())
    const [startTime, period] = startStr.split(' ')
    const [startHour, startMin] = startTime.split(':').map(Number)
    let hour = startHour
    if (period === 'PM' && hour !== 12) hour += 12
    if (period === 'AM' && hour === 12) hour = 0

    const startDate = new Date(`${booking.date}T${String(hour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`)
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

    const event = await calendar.events.insert({
      calendarId: coach.calendarId,
      requestBody: {
        summary: `Consultation: ${booking.customerName}`,
        description: [
          `Customer: ${booking.customerName}`,
          `Email: ${booking.customerEmail}`,
          `Phone: ${booking.customerPhone}`,
          `Language: ${booking.preferredLanguage}`,
          `Confirmation ID: ${booking.confirmationId}`,
        ].join('\n'),
        start: { dateTime: startDate.toISOString(), timeZone: timezone },
        end:   { dateTime: endDate.toISOString(),   timeZone: timezone },
        attendees: [{ email: booking.customerEmail }, { email: coach.email }],
        status: 'confirmed',
      },
    })
    return event.data.id ?? null
  } catch (err) {
    console.error('Google Calendar error:', err)
    return null
  }
}

export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  try {
    const auth = getAuth()
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.delete({ calendarId, eventId })
  } catch (err) {
    console.error('Failed to delete calendar event:', err)
  }
}
