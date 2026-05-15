import nodemailer from 'nodemailer'
import { Booking } from '@/types'

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendBookingConfirmation(booking: Booking): Promise<void> {
  if (!process.env.SMTP_USER) return

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Coach Booking Platform'
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL  ?? ''

  const transporter = getTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: booking.customerEmail,
    subject: `Booking Confirmed – ${booking.slot} with ${booking.coachName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
        <h1 style="color:#1d4ed8">${appName}</h1>
        <h2 style="color:#111827">Your consultation is confirmed!</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#6b7280">Confirmation ID</td><td style="padding:8px;font-weight:bold">${booking.confirmationId}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Coach</td><td style="padding:8px">${booking.coachName}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Date</td><td style="padding:8px">${booking.date}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Time Slot</td><td style="padding:8px">${booking.slot}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Language</td><td style="padding:8px">${booking.preferredLanguage}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:14px">If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">${appName} | ${appUrl}</p>
      </div>
    `,
  })
}

export async function sendCoachNotification(booking: Booking, coachEmail: string): Promise<void> {
  if (!process.env.SMTP_USER) return

  const transporter = getTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: coachEmail,
    subject: `New Consultation Booked – ${booking.date} ${booking.slot}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1d4ed8">New Consultation Booking</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#6b7280">Customer</td><td style="padding:8px;font-weight:bold">${booking.customerName}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Email</td><td style="padding:8px">${booking.customerEmail}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Phone</td><td style="padding:8px">${booking.customerPhone}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Language</td><td style="padding:8px">${booking.preferredLanguage}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Date</td><td style="padding:8px">${booking.date}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Slot</td><td style="padding:8px">${booking.slot}</td></tr>
        </table>
      </div>
    `,
  })
}
