import { format, addDays } from 'date-fns'

export function getBookingDate(): string {
  // Always book for next day
  return format(addDays(new Date(), 1), 'yyyy-MM-dd')
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return format(new Date(y, m - 1, d), 'EEEE, MMMM do, yyyy')
}

export function generateConfirmationId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function getUniqueLanguages(coaches: { languages: string[] }[]): string[] {
  const set = new Set<string>()
  for (const coach of coaches) {
    for (const lang of coach.languages) set.add(lang)
  }
  return Array.from(set).sort()
}
