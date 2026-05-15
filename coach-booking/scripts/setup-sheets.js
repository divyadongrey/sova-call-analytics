/**
 * Run once to initialize the Google Sheets structure.
 * Usage: GOOGLE_SERVICE_ACCOUNT_EMAIL=... GOOGLE_PRIVATE_KEY=... GOOGLE_SHEETS_SPREADSHEET_ID=... node scripts/setup-sheets.js
 */
const { google } = require('googleapis')

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  const sheetsConfig = [
    {
      title: 'Coaches',
      headers: ['id', 'name', 'email', 'languages', 'specialization', 'bio', 'imageUrl', 'calendarId', 'isActive', 'role'],
      sampleData: [
        ['C001', 'Priya Sharma', 'priya@example.com', 'Hindi,English', 'Career Coaching', 'Certified career coach with 10+ years experience', 'https://i.pravatar.cc/150?img=47', '', 'true', 'coach'],
        ['C002', 'Rajan Mehta', 'rajan@example.com', 'Gujarati,English', 'Life Coaching', 'Life coach specializing in work-life balance', 'https://i.pravatar.cc/150?img=12', '', 'true', 'coach'],
        ['C003', 'Anita Rao', 'anita@example.com', 'Telugu,English,Hindi', 'Business Coaching', 'Business strategy and entrepreneurship coach', 'https://i.pravatar.cc/150?img=32', '', 'true', 'coach'],
      ],
    },
    {
      title: 'Bookings',
      headers: ['id', 'customerName', 'customerEmail', 'customerPhone', 'preferredLanguage', 'coachId', 'coachName', 'date', 'slot', 'status', 'timestamp', 'confirmationId', 'calendarEventId', 'notes'],
    },
    {
      title: 'BlockedSlots',
      headers: ['coachId', 'date', 'slot', 'blockedBy', 'timestamp'],
    },
    {
      title: 'CoachAuth',
      headers: ['coachId', 'email', 'passwordHash', 'role', 'name'],
      note: 'Use scripts/hash-password.js to generate bcrypt password hashes',
      sampleData: [
        ['C001', 'priya@example.com', '$2a$10$REPLACE_WITH_BCRYPT_HASH', 'coach', 'Priya Sharma'],
        ['ADMIN1', 'admin@example.com', '$2a$10$REPLACE_WITH_BCRYPT_HASH', 'admin', 'Admin User'],
      ],
    },
  ]

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) ?? []

  for (const config of sheetsConfig) {
    if (existingSheets.includes(config.title)) {
      console.log(`Sheet "${config.title}" already exists, skipping`)
      continue
    }

    // Create sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: config.title } } }],
      },
    })
    console.log(`Created sheet: ${config.title}`)

    // Add headers
    const rows = [config.headers]
    if (config.sampleData) rows.push(...config.sampleData)

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${config.title}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    })
    console.log(`Added headers to: ${config.title}`)
  }

  console.log('\nSetup complete! Your Google Sheet is ready.')
  console.log('Next steps:')
  console.log('1. Add coach data to the Coaches sheet')
  console.log('2. Run "node scripts/hash-password.js <password>" to generate password hashes')
  console.log('3. Add coach credentials to CoachAuth sheet')
}

main().catch(console.error)
